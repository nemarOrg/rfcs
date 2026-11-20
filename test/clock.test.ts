import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  fetchThread,
  type GraphqlClient,
  marker,
  OVERDUE_DECISION_DAYS,
  planClockActions,
  runClock,
} from "../src/clock.ts";
import { at, DISCUSSION_BASE, nowAt, rec } from "./helpers.ts";
import { type GraphqlStub, startGraphqlStub } from "./stub.ts";

const stubs: GraphqlStub[] = [];
afterEach(() => {
  for (const stub of stubs.splice(0)) stub.stop();
});

function stub(threads: Parameters<typeof startGraphqlStub>[0], pageSize?: number) {
  const started = startGraphqlStub(threads, pageSize);
  stubs.push(started);
  const client: GraphqlClient = { url: started.url, token: started.token };
  return { stub: started, client };
}

const RFC = rec({ number: 7 }); // opens at T0, closes at day 21
const URL = `${DISCUSSION_BASE}/7`;

function silently<T>(run: () => Promise<T>): Promise<T> {
  const log = console.log;
  console.log = () => {};
  return run().finally(() => {
    console.log = log;
  });
}

function postsOf(started: GraphqlStub, kind: string): number {
  return (started.threads.get(7)?.comments ?? []).filter((body) =>
    body.includes(`rfc-clock:${kind}:`),
  ).length;
}

describe("rfc-clock against a stand-in for GitHub", () => {
  test("the clock posts each reminder once across two runs against the stand-in", async () => {
    const { stub: s, client } = stub({ 7: {} });
    for (const now of [nowAt(14, 1), nowAt(14, 5), nowAt(19, 1), nowAt(19, 9)]) {
      expect(await silently(() => runClock([RFC], client, now))).toEqual([]);
    }
    expect(postsOf(s, "remind-7d")).toBe(1);
    expect(postsOf(s, "remind-2d")).toBe(1);
    expect(s.threads.get(7)?.locked).toBe(false);
  });

  test("the clock posts nothing before the 7-day mark", async () => {
    const { stub: s, client } = stub({ 7: {} });
    await silently(() => runClock([RFC], client, nowAt(13)));
    expect(s.threads.get(7)?.comments).toEqual([]);
  });

  test("a reminder names the exact close instant and how to comment without GitHub", async () => {
    const { stub: s, client } = stub({ 7: {} });
    await silently(() => runClock([RFC], client, nowAt(14, 1)));
    const body = s.threads.get(7)?.comments[0] ?? "";
    expect(body).toContain(at(21));
    expect(body).toContain("support@nemar.org");
    expect(body).toStartWith("<!-- rfc-clock:remind-7d:");
  });

  test("the clock locks at the close", async () => {
    const { stub: s, client } = stub({ 7: {} });
    expect(await silently(() => runClock([RFC], client, nowAt(21, 0)))).toEqual([]);
    expect(s.threads.get(7)?.locked).toBe(true);
    expect(postsOf(s, "closed")).toBe(1);
    // A rerun posts and locks nothing more.
    expect(await silently(() => runClock([RFC], client, nowAt(21, 6)))).toEqual([]);
    expect(postsOf(s, "closed")).toBe(1);
  });

  test("the closing comment says the lock follows the first daily run after the close", async () => {
    const { stub: s, client } = stub({ 7: {} });
    await silently(() => runClock([RFC], client, nowAt(21, 3)));
    const body = s.threads.get(7)?.comments[0] ?? "";
    expect(body).toContain("first run after the close");
    expect(body).toContain("marked late");
  });

  test("the clock does not lock a minute before the close", async () => {
    const { stub: s, client } = stub({ 7: {} });
    await silently(() => runClock([RFC], client, new Date(nowAt(21).getTime() - 60_000)));
    expect(s.threads.get(7)?.locked).toBe(false);
  });

  test("the clock fails the run on an unlocked closed thread", async () => {
    const closing = [`${marker("closed", RFC)}\nThe comment period ended.`];
    const { stub: s, client } = stub({ 7: { locked: false, comments: closing } });
    const failures = await silently(() => runClock([RFC], client, nowAt(22)));
    expect(failures.join("\n")).toContain("unlocked");
    // It does not repair what it reports.
    expect(s.threads.get(7)?.locked).toBe(false);
  });

  test("the clock fails the run on an RFC closed and undecided for 15 days", async () => {
    const closing = [`${marker("closed", RFC)}\nended`];
    const { client } = stub({ 7: { locked: true, comments: closing } });
    const failures = await silently(() => runClock([RFC], client, nowAt(21 + 15)));
    expect(failures.join("\n")).toContain("no decision");
  });

  test("an RFC closed and undecided for 14 days does not fail", async () => {
    const closing = [`${marker("closed", RFC)}\nended`];
    const { client } = stub({ 7: { locked: true, comments: closing } });
    expect(OVERDUE_DECISION_DAYS).toBe(14);
    expect(await silently(() => runClock([RFC], client, nowAt(21 + 14)))).toEqual([]);
  });

  test("the clock fails the run when a thread is missing", async () => {
    const { client } = stub({});
    const failures = await silently(() => runClock([RFC], client, nowAt(3)));
    expect(failures.join("\n")).toContain("does not exist");
  });

  test("the clock fails the run when an open thread is locked", async () => {
    const { client } = stub({ 7: { locked: true } });
    const failures = await silently(() => runClock([RFC], client, nowAt(3)));
    expect(failures.join("\n")).toContain("locked before the close");
  });

  test("a reminder is found past the first page of comments", async () => {
    const posted = [`${marker("remind-7d", RFC)}\nearlier`];
    const filler = Array.from({ length: 5 }, (_, i) => `comment ${i}`);
    const { stub: s, client } = stub({ 7: { comments: [...posted, ...filler] } }, 2);
    // The reminder is on the first page, the closing marker would be on the last.
    await silently(() => runClock([RFC], client, nowAt(14, 1)));
    expect(postsOf(s, "remind-7d")).toBe(1);
    const thread = await fetchThread(client, URL);
    expect(thread?.comments).toHaveLength(6);
    expect(s.requests.filter((r) => r.query.includes("discussion(")).length).toBeGreaterThan(2);
  });

  test("a closing marker on a late page is seen", async () => {
    const filler = Array.from({ length: 5 }, (_, i) => `comment ${i}`);
    const closing = `${marker("closed", RFC)}\nended`;
    const { stub: s, client } = stub({ 7: { locked: true, comments: [...filler, closing] } }, 2);
    expect(await silently(() => runClock([RFC], client, nowAt(22)))).toEqual([]);
    expect(postsOf(s, "closed")).toBe(1);
  });

  test("a failed lock posts no closing comment, and a later run re-locks", async () => {
    const started = startGraphqlStub({ 7: {} }, 2, { failLock: true });
    stubs.push(started);
    const client: GraphqlClient = { url: started.url, token: started.token };
    const failures = await silently(() => runClock([RFC], client, nowAt(21)));
    expect(failures.join("\n")).toContain("could not lock the thread");
    expect(started.threads.get(7)?.locked).toBe(false);
    // No closing comment and so no marker: the next run is not mistaken for "locked, then unlocked".
    expect(postsOf(started, "closed")).toBe(0);
    started.options.failLock = false;
    expect(await silently(() => runClock([RFC], client, nowAt(21, 6)))).toEqual([]);
    expect(started.threads.get(7)?.locked).toBe(true);
    expect(postsOf(started, "closed")).toBe(1);
  });

  test("each RFC with a failed lock is reported and gets no closing comment", async () => {
    const started = startGraphqlStub({ 7: {}, 8: {} }, 2, { failLock: true });
    stubs.push(started);
    const client: GraphqlClient = { url: started.url, token: started.token };
    const other = rec({ number: 8, window_days: 7, discussion: `${DISCUSSION_BASE}/8` });
    const failures = await silently(() => runClock([RFC, other], client, nowAt(21)));
    expect(failures.filter((f) => f.includes("could not lock"))).toHaveLength(2);
    expect(started.threads.get(7)?.comments).toEqual([]);
    expect(started.threads.get(8)?.comments).toEqual([]);
  });

  test("without a token the clock stops, unless there is nothing to do", async () => {
    expect(await silently(() => runClock([], null, nowAt(1)))).toEqual([]);
    expect(
      await silently(() => runClock([rec({ opened_at: null, discussion: null })], null, nowAt(1))),
    ).toEqual([]);
    expect(silently(() => runClock([RFC], null, nowAt(1)))).rejects.toThrow("GITHUB_TOKEN");
  });

  test("a GraphQL error other than NOT_FOUND is an error, not a missing thread", async () => {
    for (const threadError of ["forbidden", "partial", "repo-missing"] as const) {
      const { stub: s, client } = stub({ 7: {} });
      s.options.threadError = threadError;
      expect(fetchThread(client, URL)).rejects.toThrow("GitHub GraphQL");
    }
  });

  test("a thread that vanishes on page 2 is an error", async () => {
    const filler = Array.from({ length: 5 }, (_, i) => `comment ${i}`);
    const { stub: s, client } = stub({ 7: { comments: filler } }, 2);
    s.options.threadError = "vanish-on-page-2";
    expect(fetchThread(client, URL)).rejects.toThrow("page 2");
  });

  test("a NOT_FOUND answer on page 1 is a missing thread", async () => {
    const { client } = stub({});
    expect(await fetchThread(client, URL)).toBeNull();
  });

  test("a wrong token is an error, not a silent pass", async () => {
    const { client } = stub({ 7: {} });
    expect(fetchThread({ ...client, token: "wrong" }, URL)).rejects.toThrow("401");
  });
});

describe("planClockActions", () => {
  const thread = (over = {}) => ({ id: "D_7", locked: false, comments: [] as string[], ...over });

  test("it plans nothing for drafts and withdrawn RFCs", () => {
    const draft = rec({ number: 7, opened_at: null, discussion: null });
    const withdrawn = rec({
      number: 8,
      decision: "withdrawn",
      decided_at: at(2),
      decided_by: "Owner",
      withdrawn_at: at(2),
      withdrawn_reason: "dropped",
    });
    expect(planClockActions([draft, withdrawn], {}, nowAt(3))).toEqual({
      actions: [],
      failures: [],
    });
  });

  test("it locks first, then comments, at the close", () => {
    const plan = planClockActions([RFC], { [URL]: thread() }, nowAt(21));
    expect(plan.actions.map((a) => a.kind)).toEqual(["lock", "comment"]);
    expect(plan.failures).toEqual([]);
  });

  test("it only comments when someone already locked the thread", () => {
    const plan = planClockActions([RFC], { [URL]: thread({ locked: true }) }, nowAt(22));
    expect(plan.actions.map((a) => a.kind)).toEqual(["comment"]);
  });

  test("it posts only the 2-day reminder when both are due and neither was posted", () => {
    const plan = planClockActions([RFC], { [URL]: thread() }, nowAt(19, 12));
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({ kind: "comment" });
    expect((plan.actions[0] as { body: string }).body).toContain("remind-2d");
  });

  test("an extension gives new reminders, keyed by the new close", () => {
    const extended = rec({
      number: 7,
      extension: { granted_at: at(10), days: 14, reason: "more time" },
    });
    const old = [`${marker("remind-7d", RFC)}\nold`, `${marker("remind-2d", RFC)}\nold`];
    const plan = planClockActions([extended], { [URL]: thread({ comments: old }) }, nowAt(28, 1));
    expect(plan.actions).toHaveLength(1);
    expect((plan.actions[0] as { body: string }).body).toContain(at(35));
  });

  test("a window of 7 days has no 7-day reminder", () => {
    const short = rec({ number: 7, window_days: 7 });
    const plan = planClockActions([short], { [URL]: thread() }, nowAt(0, 1));
    expect(plan.actions).toEqual([]);
  });

  test("an RFC decided long ago with its thread locked and closed needs nothing", () => {
    const decided = rec({
      number: 7,
      decision: "rejected",
      decided_at: at(22),
      decided_by: "Owner",
    });
    const closing = [`${marker("closed", decided)}\nended`];
    const plan = planClockActions(
      [decided],
      { [URL]: thread({ locked: true, comments: closing }) },
      nowAt(90),
    );
    expect(plan).toEqual({ actions: [], failures: [] });
  });
});

describe("rfc-clock environment", () => {
  test("a RFC_CLOCK_NOW that is not a timestamp stops the clock", async () => {
    const proc = Bun.spawn(["bun", "run", "src/clock.ts"], {
      cwd: join(import.meta.dir, ".."),
      env: { ...process.env, RFC_CLOCK_NOW: "yesterday-ish" },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await proc.exited).toBe(2);
    expect(await new Response(proc.stderr).text()).toContain("RFC_CLOCK_NOW");
  });
});
