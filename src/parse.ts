import { parse as parseYaml } from "yaml";
import type { RfcFile, RfcFrontMatter } from "./types.ts";
import { validateFrontMatter } from "./validate.ts";

export interface ParseFailure {
  path: string;
  problems: string[];
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;

/** Splits a record into its YAML front matter text and its Markdown body. */
export function splitFrontMatter(text: string): { yaml: string; body: string } | null {
  const match = FRONT_MATTER.exec(text);
  if (!match) return null;
  return { yaml: match[1] ?? "", body: match[2] ?? "" };
}

/**
 * Reads one record. The YAML core schema is used, so a timestamp stays a string and is checked
 * by the JSON Schema pattern instead of being silently turned into a date.
 */
export function parseRfcFile(path: string, text: string): RfcFile | ParseFailure {
  const parts = splitFrontMatter(text);
  if (!parts) return { path, problems: ["the file does not start with YAML front matter"] };
  let data: unknown;
  try {
    data = parseYaml(parts.yaml, { schema: "core", uniqueKeys: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { path, problems: [`the front matter is not valid YAML: ${message}`] };
  }
  const problems = validateFrontMatter(data);
  if (problems.length > 0) return { path, problems };
  return { path, record: data as RfcFrontMatter, body: parts.body };
}

export function isParseFailure(value: RfcFile | ParseFailure): value is ParseFailure {
  return "problems" in value;
}
