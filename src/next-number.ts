import { fetchPrClaims, githubOptionsFromEnv } from "./github.ts";
import { loadHead } from "./load.ts";

/**
 * Prints the number the next draft takes: one above every number used by a file on this checkout
 * and by every pull request, open or closed, that ever added a `text/` file.
 * Run it on an up-to-date `main`: `GITHUB_REPOSITORY=nemarOrg/rfcs GITHUB_TOKEN=$(gh auth token)
 * bun run next-number`.
 */
async function main(): Promise<void> {
  const github = githubOptionsFromEnv({ GITHUB_REPOSITORY: "nemarOrg/rfcs", ...process.env });
  if (github === null) throw new Error("GITHUB_REPOSITORY is not set");
  const used = new Set(loadHead(process.cwd()).files.map((file) => file.record.number));
  for (const claim of await fetchPrClaims(github)) used.add(claim.number);
  const next = Math.max(0, ...used) + 1;
  console.log(String(next).padStart(4, "0"));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
