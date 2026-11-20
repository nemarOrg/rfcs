import { stringify } from "yaml";
import { generateIndex, replaceIndex } from "../src/index-gen.ts";
import type { CheckInput } from "../src/rules.ts";
import { checkRfcs } from "../src/rules.ts";
import { DAY_MS } from "../src/status.ts";
import type { RfcFile, RfcFrontMatter } from "../src/types.ts";

/** The instant the example RFCs open: every other date in the tests is an offset from it. */
export const T0 = Date.parse("2026-12-01T14:00:00Z");

/** A UTC timestamp to the minute, `days` (and `hours`) after T0. */
export function at(days: number, hours = 0): string {
  return `${new Date(T0 + days * DAY_MS + hours * 3_600_000).toISOString().slice(0, 16)}:00Z`;
}

/** The check's clock, `days` after T0. */
export function nowAt(days: number, hours = 0): Date {
  return new Date(T0 + days * DAY_MS + hours * 3_600_000);
}

export const DISCUSSION_BASE = "https://github.com/nemarOrg/rfcs/discussions";

/** A valid RFC that opened at T0 with a 21-day window; override any field. */
export function rec(over: Partial<RfcFrontMatter> = {}): RfcFrontMatter {
  const number = over.number ?? 1;
  return {
    number,
    title: "An example RFC",
    scope: "org",
    dataset: null,
    shepherd: "Owner",
    authors: ["Author One"],
    discussion: `${DISCUSSION_BASE}/${number}`,
    opened_at: at(0),
    window_days: 21,
    extension: null,
    final_comment_at: null,
    proposed_disposition: null,
    decision: null,
    decided_at: null,
    decided_by: null,
    adr: null,
    supersedes_rfc: null,
    withdrawn_at: null,
    withdrawn_reason: null,
    ...over,
  };
}

export const DISPOSITION = "## Disposition of comments\n\nEvery comment was adopted.\n";

export function file(record: RfcFrontMatter, body = "## Summary\n\nText.\n"): RfcFile {
  const slug = "an-example-rfc";
  return { path: `text/${String(record.number).padStart(4, "0")}-${slug}.md`, record, body };
}

/** A record that was decided `accepted` with everything the rules ask for. */
export function accepted(over: Partial<RfcFrontMatter> = {}): RfcFile {
  return file(
    rec({
      final_comment_at: at(10),
      proposed_disposition: "accept",
      decision: "accepted",
      decided_at: at(22),
      decided_by: "Owner",
      adr: "https://github.com/nemarOrg/nemar-cli/blob/dev/.context/decisions/0200-example.md",
      ...over,
    }),
    `## Summary\n\nText.\n\n${DISPOSITION}`,
  );
}

export function markdown(record: RfcFrontMatter, body = "## Summary\n\nText.\n"): string {
  return `---\n${stringify(record)}---\n\n${body}`;
}

export function readmeFor(head: RfcFile[]): string {
  return replaceIndex(
    "# README\n\n<!-- rfc-index:start -->\n<!-- rfc-index:end -->\n",
    generateIndex(head),
  );
}

/** Runs the rules with sensible defaults: the README is fresh and there is no base or PR. */
export function run(over: Partial<CheckInput> & { head: RfcFile[] }): string[] {
  return violations(over).map((v) => v.rule);
}

export function violations(over: Partial<CheckInput> & { head: RfcFile[] }) {
  return checkRfcs({
    base: null,
    now: nowAt(1),
    readme: readmeFor(over.head),
    claims: null,
    currentPr: null,
    ...over,
  });
}
