import { describe, expect, test } from "bun:test";
import { extractIndex, generateIndex, replaceIndex } from "../src/index-gen.ts";
import { accepted, DISPOSITION, file, nowAt, readmeFor, rec, run } from "./helpers.ts";

describe("index", () => {
  test("a stale index is refused", () => {
    const head = [file(rec())];
    const stale = readmeFor([]);
    expect(run({ head, readme: stale })).toContain("index-fresh");
  });

  test("a README with no markers is refused", () => {
    expect(run({ head: [file(rec())], readme: "# no markers\n" })).toContain("index-fresh");
  });

  test("a fresh index is accepted", () => {
    expect(run({ head: [file(rec())] })).toEqual([]);
  });

  test("the index lists each record by number with its close instant", () => {
    const index = generateIndex([
      file(rec({ number: 2 })),
      file(rec({ number: 1, title: "A | B" })),
    ]);
    const rows = index.split("\n").slice(2);
    expect(rows[0]).toContain("[0001](text/0001-an-example-rfc.md)");
    expect(rows[0]).toContain("A \\| B");
    expect(rows[0]).toContain("2026-12-22T14:00:00Z");
    expect(rows[1]).toContain("[0002]");
  });

  test("the index does not depend on the time", () => {
    const head = [file(rec())];
    const readme = readmeFor(head);
    for (const days of [1, 10, 22, 400]) {
      expect(run({ head, readme, now: nowAt(days) })).not.toContain("index-fresh");
    }
  });

  test("a decided record shows its decision", () => {
    expect(generateIndex([accepted()])).toContain("| accepted |");
    expect(DISPOSITION).toContain("Disposition");
  });

  test("an empty repository has an empty index", () => {
    expect(generateIndex([])).toBe("No RFC has been proposed yet.");
    expect(run({ head: [] })).toEqual([]);
  });

  test("replaceIndex round-trips and refuses a README without markers", () => {
    const readme = readmeFor([file(rec())]);
    expect(extractIndex(readme)).toBe(generateIndex([file(rec())]));
    expect(replaceIndex(readme, "x")).toContain(
      "<!-- rfc-index:start -->\nx\n<!-- rfc-index:end -->",
    );
    expect(() => replaceIndex("nothing", "x")).toThrow();
  });
});
