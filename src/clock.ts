import { loadHead } from "./load.ts";
import { closeInstant, closeMs, DAY_MS, instant, OPEN_STATES, rfcStatus } from "./status.ts";
import type { RfcFrontMatter } from "./types.ts";

/** What the clock needs to know about one Discussion thread. */
export interface ThreadState {
  /** The GraphQL node id. */
  id: string;
  locked: boolean;
  /** The bodies of every top-level comment, in full. */
  comments: string[];
}

/** Threads by the RFC's `discussion` URL; null means GitHub has no such thread. */
export type Threads = Record<string, ThreadState | null | undefined>;

export type ClockAction =
  | { kind: "comment"; rfc: number; discussionId: string; body: string }
  | { kind: "lock"; rfc: number; discussionId: string };

export interface ClockPlan {
  actions: ClockAction[];
  /** Disagreements between GitHub and the record, and overdue decisions. Each fails the run. */
  failures: string[];
}

/** An RFC closed with no decision for longer than this many days fails the run. */
export const OVERDUE_DECISION_DAYS = 14;

const SUPPORT = "support@nemar.org";

function rfcLabel(record: RfcFrontMatter): string {
  return `RFC ${String(record.number).padStart(4, "0")}`;
}

/** The hidden marker that makes a post happen once per close instant. */
export function marker(kind: "remind-7d" | "remind-2d" | "closed", record: RfcFrontMatter): string {
  return `<!-- rfc-clock:${kind}:${closeInstant(record)} -->`;
}

function reminderBody(record: RfcFrontMatter, kind: "remind-7d" | "remind-2d", msLeft: number) {
  const days = Math.max(1, Math.round(msLeft / DAY_MS));
  return [
    marker(kind, record),
    `${rfcLabel(record)} closes in about ${days} ${days === 1 ? "day" : "days"}, at ${closeInstant(record)} UTC.`,
    "",
    `Comment here with a GitHub account, or write to ${SUPPORT}: a maintainer posts comments sent before the close, with your name only if you agree.`,
  ].join("\n");
}

function closedBody(record: RfcFrontMatter): string {
  return [
    marker("closed", record),
    `The comment period for ${rfcLabel(record)} ended at ${closeInstant(record)} UTC, and this thread is now locked.`,
    "",
    `A comment sent to ${SUPPORT} before the close is still posted here by a maintainer.`,
    "Every comment receives a written disposition before a decision, and the decision is recorded in the RFC file in this repository.",
  ].join("\n");
}

/**
 * The plan for one run, as a pure function of the records, what GitHub shows and the clock.
 * It posts each reminder once per close instant, locks a thread at its close, and reports what
 * disagrees with the record. It never edits a file and never decides.
 */
export function planClockActions(
  records: readonly RfcFrontMatter[],
  threads: Threads,
  now: Date,
): ClockPlan {
  const actions: ClockAction[] = [];
  const failures: string[] = [];
  const nowMs = now.getTime();

  for (const record of [...records].sort((a, b) => a.number - b.number)) {
    const status = rfcStatus(record, now);
    if (status === "draft" || status === "withdrawn") continue;
    const label = rfcLabel(record);
    const close = closeMs(record);
    if (record.discussion === null || close === null) continue;
    const thread = threads[record.discussion];
    if (thread == null) {
      failures.push(`${label}: its thread ${record.discussion} does not exist on GitHub`); // rule: thread-missing
      continue;
    }
    const posted = (kind: "remind-7d" | "remind-2d" | "closed") =>
      thread.comments.some((body) => body.includes(marker(kind, record)));

    if (OPEN_STATES.includes(status)) {
      if (thread.locked) {
        failures.push(
          `${label}: its thread is locked before the close (${closeInstant(record)} UTC)`,
        ); // rule: locked-early
      }
      const msLeft = close - nowMs;
      const opened = instant(record.opened_at as string);
      if (msLeft <= 2 * DAY_MS) {
        if (!posted("remind-2d")) {
          // rule: remind-2d
          actions.push({
            kind: "comment",
            rfc: record.number,
            discussionId: thread.id,
            body: reminderBody(record, "remind-2d", msLeft),
          });
        }
      } else if (msLeft <= 7 * DAY_MS && close - 7 * DAY_MS > opened && !posted("remind-7d")) {
        // rule: remind-7d
        actions.push({
          kind: "comment",
          rfc: record.number,
          discussionId: thread.id,
          body: reminderBody(record, "remind-7d", msLeft),
        });
      }
      continue;
    }

    // closed, accepted or rejected: the close has passed.
    if (!posted("closed")) {
      if (!thread.locked) {
        // rule: lock-at-close
        actions.push({ kind: "lock", rfc: record.number, discussionId: thread.id });
      }
      actions.push({
        kind: "comment",
        rfc: record.number,
        discussionId: thread.id,
        body: closedBody(record),
      });
    } else if (!thread.locked) {
      // rule: unlocked-after-close
      failures.push(`${label}: its thread was locked at the close and is unlocked now`);
    }
    if (status === "closed" && nowMs - close > OVERDUE_DECISION_DAYS * DAY_MS) {
      // rule: undecided-overdue
      const days = Math.floor((nowMs - close) / DAY_MS);
      failures.push(
        `${label}: closed ${days} days ago with no decision recorded (the limit is ${OVERDUE_DECISION_DAYS} days)`,
      );
    }
  }
  return { actions, failures };
}

// GitHub GraphQL access. The endpoint is GITHUB_GRAPHQL_URL so a test can point it elsewhere.

export interface GraphqlClient {
  url: string;
  token: string;
}

interface GraphqlResponse {
  data?: Record<string, unknown> | null;
  errors?: { type?: string; message?: string }[];
}

async function graphql(
  client: GraphqlClient,
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphqlResponse> {
  const response = await fetch(client.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${client.token}`,
      "content-type": "application/json",
      "user-agent": "nemar-rfcs",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`GitHub GraphQL answered ${response.status}`);
  return (await response.json()) as GraphqlResponse;
}

const THREAD_QUERY = `query($owner:String!,$name:String!,$number:Int!,$after:String){
  repository(owner:$owner,name:$name){
    discussion(number:$number){
      id
      locked
      comments(first:100,after:$after){ pageInfo{hasNextPage endCursor} nodes{body} }
    }
  }
}`;

const DISCUSSION_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/discussions\/(\d+)$/;

/** Reads a thread with every top-level comment (all pages), or null when it does not exist. */
export async function fetchThread(
  client: GraphqlClient,
  discussionUrl: string,
): Promise<ThreadState | null> {
  const match = DISCUSSION_URL.exec(discussionUrl);
  if (!match) throw new Error(`not a Discussion URL: ${discussionUrl}`);
  const [, owner, name, number] = match;
  let id = "";
  let locked = false;
  const comments: string[] = [];
  let after: string | null = null;
  for (;;) {
    const result: GraphqlResponse = await graphql(client, THREAD_QUERY, {
      owner,
      name,
      number: Number(number),
      after,
    });
    const repository = result.data?.repository as
      | {
          discussion: null | {
            id: string;
            locked: boolean;
            comments: {
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
              nodes: { body: string }[];
            };
          };
        }
      | null
      | undefined;
    const discussion = repository?.discussion;
    if (discussion == null) {
      const unexpected = (result.errors ?? []).filter((e) => e.type !== "NOT_FOUND");
      if (unexpected.length > 0) {
        throw new Error(`GitHub GraphQL: ${unexpected.map((e) => e.message).join("; ")}`);
      }
      return null;
    }
    id = discussion.id;
    locked = discussion.locked;
    comments.push(...discussion.comments.nodes.map((node) => node.body));
    if (!discussion.comments.pageInfo.hasNextPage) break;
    after = discussion.comments.pageInfo.endCursor;
  }
  return { id, locked, comments };
}

const ADD_COMMENT = `mutation($id:ID!,$body:String!){
  addDiscussionComment(input:{discussionId:$id,body:$body}){ comment{ id } }
}`;
const LOCK = `mutation($id:ID!){ lockLockable(input:{lockableId:$id}){ lockedRecord{ locked } } }`;

/** Carries out the plan; an action that fails is reported and the rest still run. */
export async function executeActions(
  client: GraphqlClient,
  actions: readonly ClockAction[],
): Promise<string[]> {
  const failures: string[] = [];
  for (const action of actions) {
    const label = rfcLabel({ number: action.rfc } as RfcFrontMatter);
    try {
      const result =
        action.kind === "lock"
          ? await graphql(client, LOCK, { id: action.discussionId })
          : await graphql(client, ADD_COMMENT, { id: action.discussionId, body: action.body });
      if (result.errors?.length) {
        throw new Error(result.errors.map((e) => e.message).join("; "));
      }
      console.log(`${label}: ${action.kind === "lock" ? "locked the thread" : "posted a comment"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(
        `${label}: could not ${action.kind === "lock" ? "lock the thread" : "post a comment"}: ${message}`,
      );
    }
  }
  return failures;
}

/** One run of the clock: read the records and the threads, plan, execute, return every failure. */
export async function runClock(
  records: readonly RfcFrontMatter[],
  client: GraphqlClient | null,
  now: Date,
): Promise<string[]> {
  const tracked = records.filter((record) => {
    const status = rfcStatus(record, now);
    return status !== "draft" && status !== "withdrawn" && record.discussion !== null;
  });
  if (tracked.length === 0) {
    console.log("rfc-clock: no RFC has been opened; nothing to do");
    return [];
  }
  if (client === null) throw new Error("GITHUB_TOKEN is not set");
  const threads: Threads = {};
  for (const record of tracked) {
    const url = record.discussion as string;
    threads[url] = await fetchThread(client, url);
  }
  const plan = planClockActions(records, threads, now);
  const failures = [...plan.failures, ...(await executeActions(client, plan.actions))];
  return failures;
}

async function main(): Promise<number> {
  const loaded = loadHead(process.cwd());
  if (loaded.unreadable.length > 0) {
    for (const bad of loaded.unreadable) console.error(`${bad.path}: ${bad.problems.join("; ")}`);
    return 1;
  }
  const token = process.env.GITHUB_TOKEN;
  const client: GraphqlClient | null = token
    ? { url: process.env.GITHUB_GRAPHQL_URL ?? "https://api.github.com/graphql", token }
    : null;
  const now = process.env.RFC_CLOCK_NOW ? new Date(process.env.RFC_CLOCK_NOW) : new Date();
  const failures = await runClock(
    loaded.files.map((file) => file.record),
    client,
    now,
  );
  for (const failure of failures) {
    console.error(`rfc-clock: ${failure}`);
    if (process.env.GITHUB_ACTIONS === "true") console.error(`::error title=rfc-clock::${failure}`);
  }
  if (failures.length > 0) return 1;
  console.log("rfc-clock: ok");
  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`rfc-clock: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(2);
    },
  );
}
