import { readFileSync } from "node:fs";
import { parseNow, parsePrNumber } from "./env.ts";
import { fetchPrClaims, githubOptionsFromEnv } from "./github.ts";
import { loadBase, loadHead, loadReadme } from "./load.ts";
import { type CheckInput, checkRfcs, type Violation } from "./rules.ts";

interface Options {
  root: string;
  now: Date;
  baseRef: string | null;
  prNumber: number | null;
}

function parseArgs(argv: string[], env: Record<string, string | undefined>): Options {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag?.startsWith("--")) args.set(flag.slice(2), argv[++i] ?? "");
  }
  const now = args.has("now")
    ? parseNow(args.get("now"), "--now")
    : parseNow(env.RFC_CHECK_NOW, "RFC_CHECK_NOW");
  return {
    root: args.get("root") ?? process.cwd(),
    now,
    baseRef: args.get("base-ref") ?? env.RFC_BASE_REF ?? null,
    prNumber: pullRequestNumber(env),
  };
}

/** The number of the pull request this run checks, from the Actions event or `RFC_PR_NUMBER`. */
export function pullRequestNumber(env: Record<string, string | undefined>): number | null {
  if (env.RFC_PR_NUMBER) return parsePrNumber(env.RFC_PR_NUMBER);
  if (env.GITHUB_EVENT_NAME !== "pull_request") return null;
  // On a pull_request event the number must be found: a check that cannot tell which pull
  // request it is checking would skip the number rule, so it fails instead.
  if (!env.GITHUB_EVENT_PATH) {
    throw new Error("pull_request event without GITHUB_EVENT_PATH: cannot find the pull request");
  }
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")) as {
    pull_request?: { number?: unknown };
  };
  const number = event.pull_request?.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    throw new Error("pull_request event without a pull request number");
  }
  return number;
}

export interface CheckReport {
  violations: Violation[];
  notes: string[];
}

/** Runs the check against the repository at `options.root`. */
export async function runCheck(
  options: Options,
  env: Record<string, string | undefined>,
): Promise<CheckReport> {
  const notes: string[] = [];
  const inActions = env.GITHUB_ACTIONS === "true";
  const head = loadHead(options.root);

  let base: CheckInput["base"] = null;
  let baseUnreadable: CheckInput["baseUnreadable"] = [];
  if (options.baseRef !== null) {
    const loaded = loadBase(options.root, options.baseRef);
    base = loaded.files;
    baseUnreadable = loaded.unreadable;
  } else if (inActions) {
    throw new Error("RFC_BASE_REF is not set: the check must see the base branch to compare");
  } else {
    notes.push("no base ref: rules that compare with the base branch were not run");
  }

  let claims: CheckInput["claims"] = null;
  const github = githubOptionsFromEnv(env);
  if (options.prNumber !== null && github !== null) {
    claims = await fetchPrClaims(github, options.prNumber);
  } else if (inActions && env.GITHUB_EVENT_NAME === "pull_request") {
    throw new Error("cannot find the pull request number or repository to check numbers against");
  } else {
    notes.push("not a pull request run: numbers taken by other pull requests were not checked");
  }

  const violations = checkRfcs({
    head: head.files,
    unreadable: head.unreadable,
    base,
    baseUnreadable,
    now: options.now,
    readme: loadReadme(options.root),
    claims,
    currentPr: options.prNumber,
  });
  return { violations, notes };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2), process.env);
  const { violations, notes } = await runCheck(options, process.env);
  for (const note of notes) console.log(`note: ${note}`);
  for (const v of violations) {
    console.error(`rfc-check [${v.rule}] ${v.path}: ${v.message}`);
    if (process.env.GITHUB_ACTIONS === "true") {
      console.error(`::error file=${v.path},title=rfc-check ${v.rule}::${v.message}`);
    }
  }
  if (violations.length > 0) {
    console.error(`rfc-check: ${violations.length} problem(s)`);
    return 1;
  }
  console.log("rfc-check: ok");
  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`rfc-check: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(2);
    },
  );
}
