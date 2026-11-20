import { describe, expect, test } from "bun:test";
import { dispositionOfComments } from "../src/rules.ts";
import { accepted, at, DISPOSITION, file, nowAt, rec, run, violations } from "./helpers.ts";

const EXT = (days = 7, grantedDays = 10) => ({
  granted_at: at(grantedDays),
  days,
  reason: "more time to review",
});

describe("extension", () => {
  test("a valid extension is accepted", () => {
    const head = [file(rec({ extension: EXT() }))];
    expect(run({ head, base: [file(rec())], now: nowAt(11) })).toEqual([]);
  });

  test("a second extension is refused", () => {
    const base = [file(rec({ extension: EXT(7, 10) }))];
    const head = [file(rec({ extension: EXT(14, 12) }))];
    expect(run({ head, base, now: nowAt(13) })).toContain("one-extension");
  });

  test("removing the extension is refused", () => {
    const base = [file(rec({ extension: EXT() }))];
    expect(run({ head: [file(rec())], base, now: nowAt(13) })).toContain("one-extension");
  });

  test("an extension granted after the close is refused", () => {
    // granted_at lies after the original close (day 21); the record is unchanged from the base,
    // so only the rule about the grant's date can refuse it.
    const record = rec({ extension: { granted_at: at(21, 1), days: 7, reason: "late" } });
    const found = run({ head: [file(record)], base: [file(record)], now: nowAt(22) });
    expect(found).toContain("extension-in-window");
    expect(found).not.toContain("extension-after-close");
  });

  test("an extension granted before the window opened is refused", () => {
    const record = rec({ extension: { granted_at: at(-1), days: 7, reason: "early" } });
    expect(run({ head: [file(record)], now: nowAt(2) })).toContain("extension-in-window");
  });

  test("an extension granted in the future is refused", () => {
    const record = rec({ extension: { granted_at: at(5), days: 7, reason: "future" } });
    expect(run({ head: [file(record)], now: nowAt(2) })).toContain("extension-in-window");
  });

  test("an extension added after the close (check clock past the close) is refused", () => {
    // The asserted date is inside the window; the check's own clock is past the close.
    const base = [file(rec())];
    const head = [file(rec({ extension: EXT(7, 10) }))];
    const found = run({ head, base, now: nowAt(21, 2) });
    expect(found).toContain("extension-after-close");
    expect(found).not.toContain("extension-in-window");
  });

  test("an unchanged extension passes a later check run after the close", () => {
    const record = rec({ extension: EXT(7, 10) });
    expect(run({ head: [file(record)], base: [file(record)], now: nowAt(40) })).not.toContain(
      "extension-after-close",
    );
  });
});

describe("final comment and acceptance", () => {
  test("accepted with a final comment 7 days before the close is accepted", () => {
    expect(run({ head: [accepted({ final_comment_at: at(14) })], now: nowAt(23) })).toEqual([]);
  });

  test("accepted with final_comment_at 6 days before the close is refused", () => {
    const found = run({ head: [accepted({ final_comment_at: at(15) })], now: nowAt(23) });
    expect(found).toContain("accepted-needs-final-comment");
  });

  test("a window of 10 days or less needs the final comment 5 days before the close", () => {
    const short = (finalDays: number) =>
      accepted({ window_days: 10, final_comment_at: at(finalDays), decided_at: at(11) });
    expect(run({ head: [short(5)], now: nowAt(12) })).toEqual([]);
    expect(run({ head: [short(6)], now: nowAt(12) })).toContain("accepted-needs-final-comment");
  });

  test("accepted with no final comment is refused", () => {
    const found = run({
      head: [accepted({ final_comment_at: null, proposed_disposition: null })],
      now: nowAt(23),
    });
    expect(found).toContain("accepted-needs-final-comment");
  });

  test("accepted with adr: null is refused", () => {
    expect(run({ head: [accepted({ adr: null })], now: nowAt(23) })).toContain(
      "accepted-needs-adr",
    );
  });

  test("a final comment without a proposed disposition is refused", () => {
    const head = [file(rec({ final_comment_at: at(10), proposed_disposition: null }))];
    expect(run({ head, now: nowAt(12) })).toContain("final-comment-pairing");
  });

  test("a final comment outside the window is refused", () => {
    const early = rec({ final_comment_at: at(-1), proposed_disposition: "accept" });
    const late = rec({ final_comment_at: at(21, 1), proposed_disposition: "accept" });
    const future = rec({ final_comment_at: at(15), proposed_disposition: "accept" });
    expect(run({ head: [file(early)], now: nowAt(2) })).toContain("final-comment-in-window");
    expect(run({ head: [file(late)], now: nowAt(23) })).toContain("final-comment-in-window");
    expect(run({ head: [file(future)], now: nowAt(2) })).toContain("final-comment-in-window");
  });

  test("a rejection needs no final comment", () => {
    const head = [
      file(
        rec({ decision: "rejected", decided_at: at(22), decided_by: "Owner" }),
        `x\n\n${DISPOSITION}`,
      ),
    ];
    expect(run({ head, now: nowAt(23) })).toEqual([]);
  });
});

describe("decision", () => {
  test("a decision without decided_at is refused", () => {
    expect(run({ head: [accepted({ decided_at: null })], now: nowAt(23) })).toContain(
      "decision-complete",
    );
  });

  test("a decision without decided_by is refused", () => {
    expect(run({ head: [accepted({ decided_by: null })], now: nowAt(23) })).toContain(
      "decision-complete",
    );
  });

  test("decided_at, decided_by or adr without a decision is refused", () => {
    for (const over of [
      { decided_at: at(22) },
      { decided_by: "Owner" },
      { adr: "https://example.org/adr" },
    ]) {
      expect(run({ head: [file(rec(over))], now: nowAt(23) })).toContain("decision-orphans");
    }
  });

  test("a decision without ## Disposition of comments is refused", () => {
    const record = accepted().record;
    const found = run({ head: [file(record, "## Summary\n\nText.\n")], now: nowAt(23) });
    expect(found).toContain("disposition-of-comments");
  });

  test("an empty ## Disposition of comments is refused", () => {
    const record = accepted().record;
    const body = "## Summary\n\nText.\n\n## Disposition of comments\n\n<!-- to be written -->\n";
    expect(run({ head: [file(record, body)], now: nowAt(23) })).toContain(
      "disposition-of-comments",
    );
  });

  test("the disposition section ends at the next heading", () => {
    expect(dispositionOfComments("## Disposition of comments\n\n## Change log\n\ntext")).toBe("");
    expect(dispositionOfComments("## Disposition of comments\n\nAdopted.\n\n## Change log\n")).toBe(
      "Adopted.",
    );
    expect(dispositionOfComments("no section")).toBeNull();
  });

  test("a decision before the close is refused", () => {
    const head = [accepted({ decided_at: at(22) })];
    const found = run({ head, now: nowAt(20) });
    expect(found).toContain("decision-after-close");
  });

  test("a decision dated before the close is refused", () => {
    const head = [accepted({ decided_at: at(20) })];
    expect(run({ head, now: nowAt(23) })).toContain("decision-after-close");
  });

  test("a decision dated in the future is refused", () => {
    const head = [accepted({ decided_at: at(30) })];
    expect(run({ head, now: nowAt(23) })).toContain("decision-after-close");
  });

  test("a decision with no opened_at is refused", () => {
    const head = [
      file(
        rec({
          opened_at: null,
          discussion: null,
          decision: "rejected",
          decided_at: at(2),
          decided_by: "Owner",
        }),
        DISPOSITION,
      ),
    ];
    expect(run({ head, now: nowAt(23) })).toContain("draft-has-no-events");
  });

  test("a valid accepted record passes", () => {
    expect(violations({ head: [accepted()], now: nowAt(23) })).toEqual([]);
  });
});

describe("withdrawn", () => {
  const withdrawn = (day: number, over = {}) =>
    file(
      rec({
        decision: "withdrawn",
        decided_at: at(day),
        decided_by: "Owner",
        withdrawn_at: at(day),
        withdrawn_reason: "the author asked",
        ...over,
      }),
    );

  test("withdrawn before the close is accepted", () => {
    expect(run({ head: [withdrawn(3)], now: nowAt(4) })).toEqual([]);
  });

  test("withdrawn needs its reason and date together with the decision", () => {
    expect(run({ head: [withdrawn(3, { withdrawn_reason: null })], now: nowAt(4) })).toContain(
      "withdrawn-pairing",
    );
    expect(run({ head: [withdrawn(3, { withdrawn_at: null })], now: nowAt(4) })).toContain(
      "withdrawn-pairing",
    );
    const stray = file(rec({ withdrawn_at: at(3), withdrawn_reason: "x" }));
    expect(run({ head: [stray], now: nowAt(4) })).toContain("withdrawn-pairing");
  });

  test("withdrawn_at must be after the opening and not in the future", () => {
    expect(run({ head: [withdrawn(3, { withdrawn_at: at(-2) })], now: nowAt(4) })).toContain(
      "withdrawn-dates",
    );
    expect(run({ head: [withdrawn(3, { withdrawn_at: at(9) })], now: nowAt(4) })).toContain(
      "withdrawn-dates",
    );
  });

  test("a draft can be withdrawn", () => {
    const draft = file(
      rec({
        opened_at: null,
        discussion: null,
        decision: "withdrawn",
        decided_at: at(1),
        decided_by: "Owner",
        withdrawn_at: at(1),
        withdrawn_reason: "dropped",
      }),
    );
    expect(run({ head: [draft], now: nowAt(2) })).toEqual([]);
  });
});

describe("against the base branch", () => {
  test("a status moving from closed to open is refused", () => {
    const base = [file(rec({ window_days: 7 }))];
    const head = [file(rec({ window_days: 21 }))];
    const found = run({ head, base, now: nowAt(10) });
    expect(found).toContain("status-backward");
  });

  test("a status moving forward is accepted", () => {
    const base = [file(rec())];
    const head = [file(rec({ final_comment_at: at(10), proposed_disposition: "accept" }))];
    expect(run({ head, base, now: nowAt(12) })).toEqual([]);
  });

  test("a decision cannot be changed once recorded", () => {
    const base = [accepted()];
    const head = [
      file(rec({ ...accepted().record, decision: "rejected", adr: null }), accepted().body),
    ];
    expect(run({ head, base, now: nowAt(25) })).toContain("decision-final");
  });

  test("an accepted record may still have its text edited", () => {
    const base = [accepted()];
    const head = [file(accepted().record, `${accepted().body}\nA typo fix.\n`)];
    expect(run({ head, base, now: nowAt(25) })).toEqual([]);
  });

  test("recorded events cannot be moved", () => {
    const base = [file(rec())];
    for (const over of [
      { opened_at: at(1) },
      { window_days: 14 as number },
      { discussion: "https://github.com/nemarOrg/rfcs/discussions/99" },
    ]) {
      expect(run({ head: [file(rec(over))], base, now: nowAt(3) })).toContain("frozen-events");
    }
    const withFinal = [file(rec({ final_comment_at: at(10), proposed_disposition: "accept" }))];
    const moved = [file(rec({ final_comment_at: at(11), proposed_disposition: "accept" }))];
    expect(run({ head: moved, base: withFinal, now: nowAt(12) })).toContain("frozen-events");
  });

  test("a draft may change its window before it opens", () => {
    const draft = (over = {}) => file(rec({ opened_at: null, discussion: null, ...over }));
    expect(run({ head: [draft({ window_days: 14 })], base: [draft()], now: nowAt(1) })).toEqual([]);
  });

  test("opening a draft is accepted", () => {
    const base = [file(rec({ opened_at: null, discussion: null }))];
    expect(run({ head: [file(rec())], base, now: nowAt(1) })).toEqual([]);
  });

  test("a record on the base branch cannot be deleted", () => {
    const found = run({ head: [], base: [file(rec())], now: nowAt(1) });
    expect(found).toContain("no-delete");
  });

  test("with no base the base rules do not run", () => {
    expect(
      run({ head: [file(rec({ extension: EXT() }))], base: null, now: nowAt(40) }),
    ).not.toContain("extension-after-close");
  });
});

describe("numbers and names", () => {
  test("a number used twice is refused", () => {
    const a = file(rec({ number: 1 }));
    const b = { ...file(rec({ number: 1 })), path: "text/0001-other.md" };
    expect(run({ head: [a, b], now: nowAt(40) })).toContain("number-unique");
  });

  test("a file whose name disagrees with its number is refused", () => {
    const wrong = { ...file(rec({ number: 2 })), path: "text/0003-an-example-rfc.md" };
    expect(run({ head: [wrong] })).toContain("file-name");
  });

  test("a file name that is not kebab case is refused", () => {
    const wrong = { ...file(rec({ number: 1 })), path: "text/0001-Some_Title.md" };
    expect(run({ head: [wrong] })).toContain("file-name");
  });

  test("a number used by a closed, unmerged PR is refused", () => {
    const head = [file(rec({ number: 3, opened_at: null, discussion: null }))];
    const claims = [{ pr: 4, number: 3, path: "text/0003-withdrawn-idea.md" }];
    const found = run({ head, base: [], claims, currentPr: 5, now: nowAt(1) });
    expect(found).toContain("number-claimed");
  });

  test("a number taken by a later pull request does not block an earlier one", () => {
    const head = [file(rec({ number: 3, opened_at: null, discussion: null }))];
    const claims = [{ pr: 9, number: 3, path: "text/0003-later.md" }];
    expect(run({ head, base: [], claims, currentPr: 5, now: nowAt(1) })).not.toContain(
      "number-claimed",
    );
  });

  test("a pull request keeps the number it already holds on the base branch", () => {
    const base = [file(rec({ number: 3, opened_at: null, discussion: null }))];
    const claims = [{ pr: 2, number: 3, path: "text/0003-an-example-rfc.md" }];
    expect(run({ head: base, base, claims, currentPr: 8, now: nowAt(1) })).toEqual([]);
  });

  test("supersedes_rfc must name another RFC", () => {
    const b = file(rec({ number: 2, supersedes_rfc: 1 }));
    expect(run({ head: [b], now: nowAt(1) })).toContain("supersedes-exists");
    const a = file(rec({ number: 1, window_days: 7 }));
    expect(run({ head: [a, b], now: nowAt(8) })).not.toContain("supersedes-exists");
    const self = file(rec({ number: 2, supersedes_rfc: 2 }));
    expect(run({ head: [self], now: nowAt(1) })).toContain("supersedes-exists");
  });

  test("unreadable front matter is reported", () => {
    const found = run({ head: [], unreadable: [{ path: "text/0001-x.md", problems: ["bad"] }] });
    expect(found).toEqual(["front-matter"]);
  });
});

describe("one RFC at a time", () => {
  const first = (over = {}) => file(rec({ number: 1, ...over }));
  const second = (openedDays: number, over = {}) =>
    file(rec({ number: 2, opened_at: at(openedDays), ...over }));

  test("a second RFC opened while one is open is refused", () => {
    const found = run({ head: [first(), second(5)], now: nowAt(6) });
    expect(found).toContain("one-open");
  });

  test("a second RFC that opens after the first closed is accepted", () => {
    expect(run({ head: [first(), second(22)], now: nowAt(23) })).toEqual([]);
  });

  test("a second RFC that opens at the very instant the first closes is accepted", () => {
    expect(run({ head: [first(), second(21)], now: nowAt(22) })).toEqual([]);
  });

  test("an extension that makes a window overlap a later RFC is refused", () => {
    const extended = first({ extension: EXT(14, 20) });
    expect(run({ head: [extended, second(22)], now: nowAt(23) })).toContain("one-open");
  });

  test("a withdrawn RFC frees the slot from its withdrawal", () => {
    const gone = first({
      decision: "withdrawn",
      decided_at: at(3),
      decided_by: "Owner",
      withdrawn_at: at(3),
      withdrawn_reason: "dropped",
    });
    expect(run({ head: [gone, second(5)], now: nowAt(6) })).toEqual([]);
    expect(run({ head: [gone, second(2)], now: nowAt(6) })).toContain("one-open");
  });

  test("a draft does not hold the slot", () => {
    const draft = file(rec({ number: 2, opened_at: null, discussion: null }));
    expect(run({ head: [first(), draft], now: nowAt(6) })).toEqual([]);
  });

  test("an opening in the future is refused", () => {
    expect(run({ head: [first({ opened_at: at(5) })], now: nowAt(2) })).toContain(
      "opened-not-future",
    );
  });
});

describe("drafts", () => {
  test("a draft with an extension or a final comment is refused", () => {
    const draft = (over = {}) => file(rec({ opened_at: null, discussion: null, ...over }));
    expect(run({ head: [draft({ extension: EXT() })] })).toContain("draft-has-no-events");
    expect(
      run({ head: [draft({ final_comment_at: at(1), proposed_disposition: "accept" })] }),
    ).toContain("draft-has-no-events");
    expect(run({ head: [draft()] })).toEqual([]);
  });
});
