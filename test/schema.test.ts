import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import schema from "../schema/rfc.schema.json" with { type: "json" };
import { isParseFailure, parseRfcFile } from "../src/parse.ts";
import { validateFrontMatter } from "../src/validate.ts";
import { at, markdown, rec } from "./helpers.ts";

function problemsOf(over: Parameters<typeof rec>[0]): string[] {
  const parsed = parseRfcFile("text/0001-an-example-rfc.md", markdown(rec(over)));
  return isParseFailure(parsed) ? parsed.problems : [];
}

describe("schema", () => {
  test("a valid record parses", () => {
    expect(problemsOf({})).toEqual([]);
  });

  test("window_days: 22 is refused", () => {
    expect(problemsOf({ window_days: 22 }).join("\n")).toContain("window_days");
  });

  test("window_days below 7 or not an integer is refused", () => {
    expect(problemsOf({ window_days: 6 })).not.toEqual([]);
    expect(problemsOf({ window_days: 10.5 })).not.toEqual([]);
  });

  test("a 15-day extension is refused", () => {
    const problems = problemsOf({
      extension: { granted_at: at(5), days: 15, reason: "more time" },
    });
    expect(problems.join("\n")).toContain("extension/days");
  });

  test("a 14-day extension is accepted", () => {
    expect(problemsOf({ extension: { granted_at: at(5), days: 14, reason: "more time" } })).toEqual(
      [],
    );
  });

  test("an unknown field is refused", () => {
    const text = markdown(rec()).replace("scope: org", "scope: org\nstatus: open");
    const parsed = parseRfcFile("text/0001-an-example-rfc.md", text);
    expect(isParseFailure(parsed)).toBe(true);
  });

  test("a timestamp that is not to the minute in UTC is refused", () => {
    expect(problemsOf({ opened_at: "2026-12-01T14:00:30Z" })).not.toEqual([]);
    expect(problemsOf({ opened_at: "2026-12-01T14:00:00+02:00" })).not.toEqual([]);
  });

  test("a timestamp on a day that does not exist is refused", () => {
    expect(problemsOf({ opened_at: "2026-02-31T14:00:00Z" }).join("\n")).toContain(
      "not a real date",
    );
  });

  test("a dataset RFC names a dataset and an organization RFC does not", () => {
    expect(problemsOf({ scope: "dataset", dataset: null })).not.toEqual([]);
    expect(problemsOf({ scope: "org", dataset: "nm000123" })).not.toEqual([]);
    expect(problemsOf({ scope: "dataset", dataset: "nm000123" })).toEqual([]);
  });

  test("the thread and the opening instant are set together", () => {
    expect(
      problemsOf({ opened_at: null, discussion: "https://github.com/nemarOrg/rfcs/discussions/1" }),
    ).not.toEqual([]);
    expect(problemsOf({ opened_at: at(0), discussion: null })).not.toEqual([]);
  });

  test("the thread must be a Discussion in nemarOrg/rfcs", () => {
    expect(
      problemsOf({ discussion: "https://github.com/nemarDatasets/nm000103/discussions/1" }),
    ).not.toEqual([]);
  });

  test("front matter that is not YAML or is missing is refused", () => {
    expect(isParseFailure(parseRfcFile("text/0001-x.md", "no front matter"))).toBe(true);
    expect(isParseFailure(parseRfcFile("text/0001-x.md", "---\n: : [\n---\nbody"))).toBe(true);
  });

  test("validateFrontMatter refuses a non-object", () => {
    expect(validateFrontMatter("text")).not.toEqual([]);
  });

  test("the template's front matter has exactly the schema's fields", () => {
    const text = readFileSync("0000-template.md", "utf8");
    const yaml = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    const fields = Object.keys(parse(yaml, { schema: "core" }) as object).sort();
    expect(fields).toEqual([...schema.required].sort());
  });

  test("the template lists the twelve sections in order", () => {
    const text = readFileSync("0000-template.md", "utf8");
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual([
      "Summary",
      "Scope",
      "Problem",
      "Proposal",
      "Who is affected",
      "What does not change, and what is irreversible",
      "Options considered",
      "Prior art",
      "Questions for commenters",
      "How the decision will be made",
      "Rollout and cost",
      "Change log",
    ]);
  });
});
