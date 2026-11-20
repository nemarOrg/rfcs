import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCheck } from "../src/check.ts";
import { fetchPrClaims } from "../src/github.ts";
import { loadBase } from "../src/load.ts";
import { at, file, markdown, nowAt, readmeFor, rec } from "./helpers.ts";
import { type RestStub, startRestStub } from "./stub.ts";

const ROOT = join(import.meta.dir, "..");

/** The environment of a local run: nothing that would make the check think it is in Actions. */
function localEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.startsWith("GITHUB_") && !key.startsWith("RFC_")) {
      env[key] = value;
    }
  }
  return env;
}

async function cli(args: string[], env: Record<string, string> = localEnv()) {
  const proc = Bun.spawn(["bun", "run", "src/check.ts", ...args], {
    cwd: ROOT,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, stdout, stderr };
}

const temps: string[] = [];
const stubs: RestStub[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const stub of stubs.splice(0)) stub.stop();
});

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "rfcs-test-"));
  temps.push(dir);
  mkdirSync(join(dir, "text"), { recursive: true });
  return dir;
}

function git(dir: string, ...args: string[]) {
  const result = Bun.spawnSync([
    "git",
    "-C",
    dir,
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.org",
    ...args,
  ]);
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

describe("bun run src/check.ts", () => {
  test("exits 0 on the repository as committed (empty text/)", async () => {
    const result = await cli([]);
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("rfc-check: ok");
  });

  test("exits non-zero on a fixture with window_days: 22", async () => {
    const result = await cli(["--root", "test/fixtures/window-22"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("window_days");
  });

  test("exits 0 on a valid fixture", async () => {
    const result = await cli(["--root", "test/fixtures/valid", "--now", "2026-12-05T00:00:00Z"]);
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  });

  test("the same valid fixture is refused once its index is stale", async () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "README.md"), readmeFor([]));
    writeFileSync(
      join(dir, "text", "0001-valid-fixture.md"),
      readFileSync(join(ROOT, "test/fixtures/valid/text/0001-valid-fixture.md")),
    );
    const result = await cli(["--root", dir, "--now", "2026-12-05T00:00:00Z"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("index-fresh");
  });

  test("in Actions, a missing base ref is an error and not a pass", async () => {
    const result = await cli([], { ...localEnv(), GITHUB_ACTIONS: "true" });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("RFC_BASE_REF");
  });

  test("an unreadable base ref is an error and not a pass", async () => {
    const result = await cli(["--base-ref", "no-such-ref"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("cannot read base");
  });
});

describe("the base branch, read from git", () => {
  test("an extension added after the close is refused when the base is read from git", async () => {
    const dir = tempRepo();
    const base = file(rec());
    writeFileSync(join(dir, base.path), markdown(base.record));
    writeFileSync(join(dir, "README.md"), readmeFor([base]));
    git(dir, "init", "-q", "-b", "main");
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "base");
    const head = file(rec({ extension: { granted_at: at(10), days: 7, reason: "more time" } }));
    writeFileSync(join(dir, head.path), markdown(head.record));
    writeFileSync(join(dir, "README.md"), readmeFor([head]));
    const report = await runCheck(
      { root: dir, now: nowAt(21, 2), baseRef: "HEAD", prNumber: null },
      {},
    );
    expect(report.violations.map((v) => v.rule)).toContain("extension-after-close");
  });

  test("a push that creates the branch has no base", () => {
    expect(loadBase(ROOT, "0000000000000000000000000000000000000000").files).toEqual([]);
  });
});

describe("numbers taken by pull requests", () => {
  const closedPr = { number: 4, files: [{ filename: "text/0003-an-idea.md", status: "added" }] };

  test("a number used by a closed, unmerged PR is refused, through the API", async () => {
    const rest = startRestStub("nemarOrg/rfcs", [
      closedPr,
      { number: 5, files: [{ filename: "README.md", status: "modified" }] },
    ]);
    stubs.push(rest);
    const dir = tempRepo();
    const draft = file(rec({ number: 3, opened_at: null, discussion: null }));
    writeFileSync(join(dir, draft.path), markdown(draft.record));
    writeFileSync(join(dir, "README.md"), readmeFor([draft]));
    git(dir, "init", "-q", "-b", "main");
    git(dir, "commit", "-q", "--allow-empty", "-m", "base");
    const report = await runCheck(
      { root: dir, now: nowAt(1), baseRef: "HEAD", prNumber: 6 },
      { GITHUB_REPOSITORY: "nemarOrg/rfcs", GITHUB_API_URL: rest.url, GITHUB_TOKEN: "t" },
    );
    expect(report.violations.map((v) => v.rule)).toEqual(["number-claimed"]);
  });

  test("fetchPrClaims keeps only added or renamed text files of lower-numbered pull requests", async () => {
    const rest = startRestStub("nemarOrg/rfcs", [
      closedPr,
      { number: 5, files: [{ filename: "text/0004-other.md", status: "modified" }] },
      { number: 6, files: [{ filename: "text/0005-renamed.md", status: "renamed" }] },
      { number: 9, files: [{ filename: "text/0006-later.md", status: "added" }] },
    ]);
    stubs.push(rest);
    const options = { apiUrl: rest.url, repo: "nemarOrg/rfcs" };
    expect(await fetchPrClaims(options, 9)).toEqual([
      { pr: 4, number: 3, path: "text/0003-an-idea.md" },
      { pr: 6, number: 5, path: "text/0005-renamed.md" },
    ]);
    expect((await fetchPrClaims(options)).map((c) => c.number)).toEqual([3, 5, 6]);
  });

  test("fetchPrClaims pages through more than 100 pull requests", async () => {
    const pulls = Array.from({ length: 130 }, (_, i) => ({
      number: i + 1,
      files: i === 120 ? [{ filename: "text/0007-late.md", status: "added" }] : [],
    }));
    const rest = startRestStub("nemarOrg/rfcs", pulls);
    stubs.push(rest);
    const claims = await fetchPrClaims({ apiUrl: rest.url, repo: "nemarOrg/rfcs" });
    expect(claims).toEqual([{ pr: 121, number: 7, path: "text/0007-late.md" }]);
  });

  test("an API failure fails the check", async () => {
    const rest = startRestStub("someone/else", []);
    stubs.push(rest);
    expect(fetchPrClaims({ apiUrl: rest.url, repo: "nemarOrg/rfcs" })).rejects.toThrow("404");
  });
});

describe("next-number", () => {
  test("prints one above every merged file and every pull request's claim", async () => {
    const rest = startRestStub("nemarOrg/rfcs", [
      { number: 2, files: [{ filename: "text/0009-closed-idea.md", status: "added" }] },
    ]);
    stubs.push(rest);
    const dir = tempRepo();
    writeFileSync(join(dir, "text", "0002-an-example-rfc.md"), markdown(rec({ number: 2 })));
    const proc = Bun.spawn(["bun", "run", join(ROOT, "src/next-number.ts")], {
      cwd: dir,
      env: { ...localEnv(), GITHUB_REPOSITORY: "nemarOrg/rfcs", GITHUB_API_URL: rest.url },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect((await new Response(proc.stdout).text()).trim()).toBe("0010");
    expect(await proc.exited).toBe(0);
  });
});
