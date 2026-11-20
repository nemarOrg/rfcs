import { closeInstant } from "./status.ts";
import type { RfcFile } from "./types.ts";

export const INDEX_START = "<!-- rfc-index:start -->";
export const INDEX_END = "<!-- rfc-index:end -->";

const HEADER = [
  "| Number | Title | Scope | Opened (UTC) | Closes (UTC) | Decision | Thread |",
  "| --- | --- | --- | --- | --- | --- | --- |",
];

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

/** The file name without its directory, for a link relative to the README. */
function link(path: string): string {
  return path.replace(/^\.\//, "");
}

/**
 * The index lists what each record says and nothing that depends on the current time, so it
 * never goes stale by itself: the live state (open, final comment, closed) is `rfc-clock`'s.
 */
export function generateIndex(files: readonly RfcFile[]): string {
  if (files.length === 0) return "No RFC has been proposed yet.";
  const rows = [...files]
    .sort((a, b) => a.record.number - b.record.number)
    .map(({ path, record }) => {
      const scope = record.scope === "org" ? "org" : `dataset ${record.dataset}`;
      const decision = record.decision ?? (record.opened_at === null ? "draft" : "pending");
      return [
        `[${String(record.number).padStart(4, "0")}](${link(path)})`,
        cell(record.title),
        scope,
        record.opened_at ?? "-",
        closeInstant(record) ?? "-",
        decision,
        record.discussion === null ? "-" : `[thread](${record.discussion})`,
      ].join(" | ");
    })
    .map((row) => `| ${row} |`);
  return [...HEADER, ...rows].join("\n");
}

/** The text between the markers, or null when a marker is missing or they are out of order. */
export function extractIndex(readme: string): string | null {
  const start = readme.indexOf(INDEX_START);
  const end = readme.indexOf(INDEX_END);
  if (start === -1 || end === -1 || end < start) return null;
  return readme.slice(start + INDEX_START.length, end).trim();
}

/** The README with the text between the markers replaced by the generated index. */
export function replaceIndex(readme: string, index: string): string {
  const start = readme.indexOf(INDEX_START);
  const end = readme.indexOf(INDEX_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`README.md needs the markers ${INDEX_START} and ${INDEX_END}, in that order`);
  }
  return `${readme.slice(0, start + INDEX_START.length)}\n${index}\n${readme.slice(end)}`;
}

/** `bun run index` rewrites the index in `README.md`; `bun run index --check` only compares. */
if (import.meta.main) {
  const { readFileSync, writeFileSync } = await import("node:fs");
  const { loadHead } = await import("./load.ts");
  const loaded = loadHead(process.cwd());
  if (loaded.unreadable.length > 0) {
    for (const bad of loaded.unreadable) console.error(`${bad.path}: ${bad.problems.join("; ")}`);
    process.exit(1);
  }
  const readme = readFileSync("README.md", "utf8");
  const next = replaceIndex(readme, generateIndex(loaded.files));
  if (process.argv.includes("--check")) {
    if (next !== readme) {
      console.error("README.md index is stale; run `bun run index`");
      process.exit(1);
    }
  } else {
    writeFileSync("README.md", next);
  }
}
