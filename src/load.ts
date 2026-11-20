import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isParseFailure, parseRfcFile } from "./parse.ts";
import type { RfcFile, UnreadableFile } from "./types.ts";

export interface Loaded {
  files: RfcFile[];
  unreadable: UnreadableFile[];
}

function parseAll(entries: { path: string; text: string }[]): Loaded {
  const files: RfcFile[] = [];
  const unreadable: UnreadableFile[] = [];
  for (const { path, text } of entries) {
    const parsed = parseRfcFile(path, text);
    if (isParseFailure(parsed)) unreadable.push(parsed);
    else files.push(parsed);
  }
  return { files, unreadable };
}

/** Every `text/*.md` under `root`, parsed. `.gitkeep` and other non-Markdown files are ignored. */
export function loadHead(root: string): Loaded {
  const dir = join(root, "text");
  if (!existsSync(dir)) return { files: [], unreadable: [] };
  const names = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort();
  return parseAll(
    names.map((name) => ({ path: `text/${name}`, text: readFileSync(join(dir, name), "utf8") })),
  );
}

function git(root: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" });
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

/**
 * The records at `ref` (a branch, or the commit a push came from). An all-zero ref is a push that
 * creates the branch: there is no base, so there are no records. A ref git cannot read is an
 * error: a check that cannot see the base must fail, not pass.
 */
export function loadBase(root: string, ref: string): Loaded {
  if (/^0+$/.test(ref)) return { files: [], unreadable: [] };
  const listing = git(root, ["ls-tree", "-r", "--name-only", ref, "--", "text"]);
  if (!listing.ok) throw new Error(`cannot read base ${ref}: ${listing.stderr.trim()}`);
  const paths = listing.stdout
    .split("\n")
    .filter((path) => /^text\/[^/]+\.md$/.test(path))
    .sort();
  const entries = paths.map((path) => {
    const shown = git(root, ["show", `${ref}:${path}`]);
    if (!shown.ok) throw new Error(`cannot read ${path} at ${ref}: ${shown.stderr.trim()}`);
    return { path, text: shown.stdout };
  });
  return parseAll(entries);
}

export function loadReadme(root: string): string {
  const path = join(root, "README.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
