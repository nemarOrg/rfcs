import type { PrClaim } from "./rules.ts";

export interface GithubOptions {
  /** `https://api.github.com` by default; tests point it at a local stand-in. */
  apiUrl: string;
  /** `owner/name`. */
  repo: string;
  token?: string | undefined;
}

export function githubOptionsFromEnv(
  env: Record<string, string | undefined>,
): GithubOptions | null {
  const repo = env.GITHUB_REPOSITORY;
  if (!repo) return null;
  return {
    apiUrl: (env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/$/, ""),
    repo,
    token: env.GITHUB_TOKEN,
  };
}

async function getJson(options: GithubOptions, path: string): Promise<unknown> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "nemar-rfcs",
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await fetch(`${options.apiUrl}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub ${path} answered ${response.status}`);
  }
  return response.json();
}

async function paginate<T>(options: GithubOptions, path: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = (await getJson(options, `${path}${separator}per_page=100&page=${page}`)) as T[];
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

interface PullSummary {
  number: number;
}
interface PullFile {
  filename: string;
  status: string;
}

const TEXT_FILE = /^text\/(\d{4})-[^/]+\.md$/;

/**
 * The numbers taken by pull requests, open, closed or merged, that added a `text/NNNN-*.md`
 * file. Only the final diff of each pull request is visible to GitHub's API, so a file that a
 * pull request added and later removed from its own branch is not seen.
 * `before` limits the search to pull requests with a lower number than the one being checked.
 */
export async function fetchPrClaims(
  options: GithubOptions,
  before?: number | null,
): Promise<PrClaim[]> {
  const pulls = await paginate<PullSummary>(options, `/repos/${options.repo}/pulls?state=all`);
  const claims: PrClaim[] = [];
  for (const pull of pulls) {
    if (before != null && pull.number >= before) continue;
    const files = await paginate<PullFile>(
      options,
      `/repos/${options.repo}/pulls/${pull.number}/files`,
    );
    for (const file of files) {
      if (file.status !== "added" && file.status !== "renamed") continue;
      const match = TEXT_FILE.exec(file.filename);
      if (match?.[1]) {
        claims.push({ pr: pull.number, number: Number(match[1]), path: file.filename });
      }
    }
  }
  return claims;
}
