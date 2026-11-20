import type { RfcFrontMatter, RfcState } from "./types.ts";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** States in which the thread is open for comment. */
export const OPEN_STATES: readonly RfcState[] = ["open", "extended", "final-comment"];

/** The instant `value` names; a value that is not a timestamp is a bug in the caller. */
export function instant(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`not a timestamp: ${value}`);
  return ms;
}

/**
 * The close before any extension, as epoch milliseconds, or null while the RFC has no
 * `opened_at`. It is `opened_at` plus `window_days` times 24 hours.
 */
export function baseCloseMs(record: RfcFrontMatter): number | null {
  if (record.opened_at === null) return null;
  return instant(record.opened_at) + record.window_days * DAY_MS;
}

/**
 * The close, as epoch milliseconds, or null while the RFC has no `opened_at`.
 * It is `opened_at` plus `window_days` (plus `extension.days`) times 24 hours.
 */
export function closeMs(record: RfcFrontMatter): number | null {
  const base = baseCloseMs(record);
  if (base === null) return null;
  return base + (record.extension?.days ?? 0) * DAY_MS;
}

/** The close as a UTC timestamp to the minute, or null while the RFC has no `opened_at`. */
export function closeInstant(record: RfcFrontMatter): string | null {
  const ms = closeMs(record);
  if (ms === null) return null;
  return `${new Date(ms).toISOString().slice(0, 16)}:00Z`;
}

/**
 * The one place the state of an RFC is derived, shared by `rfc-check` and `rfc-clock`.
 * Recorded events and the current time decide it; nothing else does.
 *
 * Precedence: a recorded decision wins (`withdrawn` first, then `accepted` or `rejected`);
 * a record with no `opened_at` is a `draft`; at or after the close it is `closed`;
 * before the close, a posted final comment gives `final-comment`, else a granted extension
 * gives `extended`, else `open`.
 */
export function rfcStatus(record: RfcFrontMatter, now: Date): RfcState {
  if (record.decision === "withdrawn" || record.withdrawn_at !== null) return "withdrawn";
  if (record.decision === "accepted") return "accepted";
  if (record.decision === "rejected") return "rejected";
  const close = closeMs(record);
  if (close === null) return "draft";
  if (now.getTime() >= close) return "closed";
  if (record.final_comment_at !== null && instant(record.final_comment_at) <= now.getTime()) {
    return "final-comment";
  }
  if (record.extension !== null) return "extended";
  return "open";
}

/** How far along the lifecycle a state is; the check refuses a move to a lower rank. */
export const STATE_RANK: Record<RfcState, number> = {
  draft: 0,
  open: 1,
  extended: 2,
  "final-comment": 3,
  closed: 4,
  accepted: 5,
  rejected: 5,
  withdrawn: 5,
};

export function isTerminal(state: RfcState): boolean {
  return state === "accepted" || state === "rejected" || state === "withdrawn";
}
