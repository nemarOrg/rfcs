import { extractIndex, generateIndex } from "./index-gen.ts";
import {
  baseCloseMs,
  closeInstant,
  closeMs,
  DAY_MS,
  instant,
  isTerminal,
  rfcStatus,
  STATE_RANK,
} from "./status.ts";
import type { RfcFile, UnreadableFile } from "./types.ts";

/** A pull request, open or closed, that added a `text/NNNN-*.md` file. */
export interface PrClaim {
  pr: number;
  number: number;
  path: string;
}

export interface CheckInput {
  /** Every record under `text/` at the head being checked. */
  head: RfcFile[];
  /** Files that could not be read at the head. */
  unreadable?: UnreadableFile[];
  /** Files on the base branch that could not be read; each is a violation unless the head repairs it. */
  baseUnreadable?: UnreadableFile[];
  /** The records on the base branch, or null when there is no base to compare with. */
  base: RfcFile[] | null;
  /** The check's own clock; no date written in a record is used in its place. */
  now: Date;
  /** The head's `README.md`. */
  readme: string;
  /** Files added by other pull requests, or null outside a pull request. */
  claims: PrClaim[] | null;
  /** The number of the pull request being checked, or null outside a pull request. */
  currentPr: number | null;
}

export interface Violation {
  /** A stable name for the rule, used by tests and in the report. */
  rule: string;
  path: string;
  message: string;
}

const FILE_NAME = /^text\/(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/** The days before the close by which the final comment must be posted for `accepted`. */
export function finalCommentLeadDays(windowDays: number): number {
  return windowDays <= 10 ? 5 : 7;
}

/** The body of `## Disposition of comments`, without HTML comments, or null if absent. */
export function dispositionOfComments(body: string): string | null {
  const heading = /^##[ \t]+Disposition of comments[ \t]*$/m.exec(body);
  if (!heading) return null;
  const rest = body.slice(heading.index + heading[0].length);
  const next = /^#{1,2}[ \t]/m.exec(rest);
  const section = next ? rest.slice(0, next.index) : rest;
  return section.replace(/<!--[\s\S]*?-->/g, "").trim();
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Applies every rule `rfc-check` enforces. Each rule is one guard marked `// rule: <name>`;
 * the name is the `rule` of the violation it reports.
 */
export function checkRfcs(input: CheckInput): Violation[] {
  const { head, base, now, readme, claims, currentPr } = input;
  const nowMs = now.getTime();
  const out: Violation[] = [];
  const report = (rule: string, path: string, message: string) => out.push({ rule, path, message });

  for (const bad of input.unreadable ?? []) {
    for (const problem of bad.problems) report("front-matter", bad.path, problem);
  }

  for (const bad of input.baseUnreadable ?? []) {
    if (!head.some((file) => file.path === bad.path)) {
      report(
        "base-unreadable",
        bad.path,
        `the base branch's copy cannot be read (${bad.problems.join("; ")}), so it cannot be compared with`,
      ); // rule: base-unreadable
    }
  }

  const headNumbers = new Set(head.map((file) => file.record.number));
  const baseByNumber = new Map((base ?? []).map((file) => [file.record.number, file]));

  // Rules about the set of records.
  const seen = new Map<number, string>();
  for (const { path, record } of head) {
    const first = seen.get(record.number);
    if (first !== undefined) {
      report("number-unique", path, `number ${record.number} is also used by ${first}`); // rule: number-unique
    } else {
      seen.set(record.number, path);
    }
  }
  if (base !== null) {
    for (const { path, record } of base) {
      if (!headNumbers.has(record.number)) {
        report(
          "no-delete",
          path,
          `RFC ${record.number} is on the base branch and may not be deleted or renumbered`,
        ); // rule: no-delete
      }
    }
  }

  const intervals: { path: string; number: number; start: number; end: number }[] = [];

  for (const file of head) {
    const { path, record: r } = file;
    const b = baseByNumber.get(r.number) ?? null;
    const opened = r.opened_at === null ? null : instant(r.opened_at);
    const baseClose = baseCloseMs(r);
    const close = closeMs(r);

    const name = FILE_NAME.exec(path);
    if (!name || Number(name[1]) !== r.number) {
      report(
        "file-name",
        path,
        `the file must be text/NNNN-kebab-title.md with NNNN equal to number ${r.number}`,
      ); // rule: file-name
    }

    if (base !== null && b === null && claims !== null && currentPr !== null) {
      const clash = claims.find((c) => c.number === r.number && c.pr < currentPr);
      if (clash) {
        report(
          "number-claimed",
          path,
          `number ${r.number} was already taken by pull request #${clash.pr} (${clash.path}); numbers are never reused`,
        ); // rule: number-claimed
      }
    }

    if (opened !== null && opened > nowMs) {
      report("opened-not-future", path, `opened_at ${r.opened_at} is after the check's clock`); // rule: opened-not-future
    }

    if (
      opened === null &&
      (r.extension !== null ||
        r.final_comment_at !== null ||
        r.proposed_disposition !== null ||
        r.adr !== null ||
        (r.decision !== null && r.decision !== "withdrawn"))
    ) {
      report(
        "draft-has-no-events",
        path,
        "a draft (no opened_at) has no extension, final comment, decision or adr",
      ); // rule: draft-has-no-events
    }

    // Extension.
    const ext = r.extension;
    if (ext !== null && opened !== null && baseClose !== null) {
      const granted = instant(ext.granted_at);
      if (granted < opened || granted >= baseClose || granted > nowMs) {
        report(
          "extension-in-window",
          path,
          `the extension must be granted between opened_at and the close (${closeInstant({ ...r, extension: null })}), and not in the future; granted_at is ${ext.granted_at}`,
        ); // rule: extension-in-window
      }
    }
    if (b !== null && b.record.extension !== null && !sameJson(b.record.extension, ext)) {
      report(
        "one-extension",
        path,
        "an RFC has at most one extension, and it cannot be changed or removed",
      ); // rule: one-extension
    }
    if (
      base !== null &&
      ext !== null &&
      !sameJson(b?.record.extension ?? null, ext) &&
      baseClose !== null &&
      nowMs >= baseClose
    ) {
      report(
        "extension-after-close",
        path,
        `an extension cannot be added after the close; the window ended ${closeInstant({ ...r, extension: null })}`,
      ); // rule: extension-after-close
    }

    // Recorded events do not move.
    if (b !== null) {
      const moved = (
        [
          "opened_at",
          "window_days",
          "discussion",
          "final_comment_at",
          "proposed_disposition",
        ] as const
      ).filter(
        (field) =>
          b.record[field] !== null &&
          b.record[field] !== r[field] &&
          (field !== "window_days" || b.record.opened_at !== null),
      );
      if (moved.length > 0) {
        report("frozen-events", path, `${moved.join(", ")} cannot change once recorded`); // rule: frozen-events
      }
    }

    // Final comment.
    if ((r.final_comment_at === null) !== (r.proposed_disposition === null)) {
      report(
        "final-comment-pairing",
        path,
        "final_comment_at and proposed_disposition are set together",
      ); // rule: final-comment-pairing
    }
    if (r.final_comment_at !== null && opened !== null && close !== null) {
      const at = instant(r.final_comment_at);
      if (at < opened || at >= close || at > nowMs) {
        report(
          "final-comment-in-window",
          path,
          `final_comment_at ${r.final_comment_at} must lie inside the window and not in the future`,
        ); // rule: final-comment-in-window
      }
    }

    // Decision.
    if (r.decision !== null && (r.decided_at === null || r.decided_by === null)) {
      report(
        "decision-complete",
        path,
        `decision ${r.decision} requires decided_at and decided_by`,
      ); // rule: decision-complete
    }
    if (r.decision === null && (r.decided_at !== null || r.decided_by !== null || r.adr !== null)) {
      report(
        "decision-orphans",
        path,
        "decided_at, decided_by and adr are set only with a decision",
      ); // rule: decision-orphans
    }
    if (
      (r.withdrawn_at !== null) !== (r.decision === "withdrawn") ||
      (r.withdrawn_at !== null) !== (r.withdrawn_reason !== null)
    ) {
      report(
        "withdrawn-pairing",
        path,
        "withdrawn_at, withdrawn_reason and decision: withdrawn are set together",
      ); // rule: withdrawn-pairing
    }
    if (
      r.withdrawn_at !== null &&
      (instant(r.withdrawn_at) > nowMs || (opened !== null && instant(r.withdrawn_at) < opened))
    ) {
      report(
        "withdrawn-dates",
        path,
        `withdrawn_at ${r.withdrawn_at} must be after opened_at and not in the future`,
      ); // rule: withdrawn-dates
    }
    if (r.decision === "accepted" || r.decision === "rejected") {
      if (
        close === null ||
        nowMs < close ||
        (r.decided_at !== null && (instant(r.decided_at) < close || instant(r.decided_at) > nowMs))
      ) {
        report(
          "decision-after-close",
          path,
          `a decision is recorded only after the close${closeInstant(r) ? ` (${closeInstant(r)})` : ""}`,
        ); // rule: decision-after-close
      }
      const section = dispositionOfComments(file.body);
      if (section === null || section === "") {
        report(
          "disposition-of-comments",
          path,
          "a decision other than withdrawn requires a non-empty section ## Disposition of comments",
        ); // rule: disposition-of-comments
      }
    }
    if (r.decision === "accepted") {
      if (r.adr === null) {
        report(
          "accepted-needs-adr",
          path,
          "accepted requires adr, a link to the Architecture Decision Record",
        ); // rule: accepted-needs-adr
      }
      const lead = finalCommentLeadDays(r.window_days);
      if (
        r.proposed_disposition === null ||
        r.final_comment_at === null ||
        close === null ||
        close - instant(r.final_comment_at) < lead * DAY_MS
      ) {
        report(
          "accepted-needs-final-comment",
          path,
          `accepted requires a final comment (with a proposed disposition) at least ${lead} days before the close`,
        ); // rule: accepted-needs-final-comment
      }
    }

    if (
      r.supersedes_rfc !== null &&
      (r.supersedes_rfc === r.number || !headNumbers.has(r.supersedes_rfc))
    ) {
      report(
        "supersedes-exists",
        path,
        `supersedes_rfc ${r.supersedes_rfc} must name another RFC in this repository`,
      ); // rule: supersedes-exists
    }

    // Against the base branch's copy.
    if (b !== null) {
      const was = rfcStatus(b.record, now);
      const is = rfcStatus(r, now);
      if (STATE_RANK[is] < STATE_RANK[was]) {
        report("status-backward", path, `the status moved backward, from ${was} to ${is}`); // rule: status-backward
      }
      if (
        isTerminal(was) &&
        (
          ["decision", "decided_at", "decided_by", "withdrawn_at", "withdrawn_reason"] as const
        ).some((field) => b.record[field] !== r[field])
      ) {
        report("decision-final", path, `the decision (${was}) cannot be changed`); // rule: decision-final
      }
    }

    if (opened !== null && close !== null) {
      const ended = r.withdrawn_at === null ? close : Math.min(close, instant(r.withdrawn_at));
      intervals.push({ path, number: r.number, start: opened, end: Math.max(opened, ended) });
    }
  }

  // At most one RFC is open for comment at a time: no two windows overlap.
  const byStart = [...intervals].sort((a, b) => a.start - b.start);
  for (let i = 0; i < byStart.length; i++) {
    for (let j = i + 1; j < byStart.length; j++) {
      const first = byStart[i];
      const second = byStart[j];
      if (first && second && second.start < first.end) {
        report(
          "one-open",
          second.path,
          `RFC ${second.number} opens while RFC ${first.number} is still open for comment; only one RFC is open at a time`,
        ); // rule: one-open
      }
    }
  }

  // The index in the README is the generated one.
  if ((input.unreadable ?? []).length === 0) {
    const actual = extractIndex(readme);
    if (actual !== generateIndex(head)) {
      // rule: index-fresh
      report(
        "index-fresh",
        "README.md",
        "the index between the rfc-index markers is stale or missing; run `bun run index` and commit the result",
      );
    }
  }

  return out;
}
