import { describe, expect, test } from "bun:test";
import { closeInstant, closeMs, rfcStatus } from "../src/status.ts";
import { at, nowAt, rec } from "./helpers.ts";

describe("rfcStatus", () => {
  test("rfcStatus returns each of the eight states", () => {
    expect(rfcStatus(rec({ opened_at: null, discussion: null }), nowAt(1))).toBe("draft");
    expect(rfcStatus(rec(), nowAt(1))).toBe("open");
    expect(
      rfcStatus(rec({ extension: { granted_at: at(5), days: 7, reason: "more time" } }), nowAt(10)),
    ).toBe("extended");
    expect(
      rfcStatus(rec({ final_comment_at: at(10), proposed_disposition: "accept" }), nowAt(12)),
    ).toBe("final-comment");
    expect(rfcStatus(rec(), nowAt(22))).toBe("closed");
    expect(rfcStatus(rec({ decision: "accepted" }), nowAt(23))).toBe("accepted");
    expect(rfcStatus(rec({ decision: "rejected" }), nowAt(23))).toBe("rejected");
    expect(
      rfcStatus(
        rec({ decision: "withdrawn", withdrawn_at: at(3), withdrawn_reason: "superseded" }),
        nowAt(4),
      ),
    ).toBe("withdrawn");
  });

  test("the close is an instant: open one minute before it, closed at it", () => {
    const record = rec();
    expect(closeInstant(record)).toBe(at(21));
    expect(rfcStatus(record, new Date((closeMs(record) as number) - 60_000))).toBe("open");
    expect(rfcStatus(record, new Date(closeMs(record) as number))).toBe("closed");
  });

  test("an extension moves the close by its days times 24 hours", () => {
    const record = rec({ extension: { granted_at: at(5), days: 14, reason: "more time" } });
    expect(closeInstant(record)).toBe(at(35));
    expect(rfcStatus(record, nowAt(30))).toBe("extended");
    expect(rfcStatus(record, nowAt(35))).toBe("closed");
  });

  test("a final comment that is not yet posted does not change the state", () => {
    const record = rec({ final_comment_at: at(10), proposed_disposition: "accept" });
    expect(rfcStatus(record, nowAt(9))).toBe("open");
  });

  test("a draft has no close", () => {
    const record = rec({ opened_at: null, discussion: null });
    expect(closeMs(record)).toBeNull();
    expect(closeInstant(record)).toBeNull();
  });
});
