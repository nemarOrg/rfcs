import Ajv from "ajv";
import schema from "../schema/rfc.schema.json" with { type: "json" };

const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

const TIMESTAMP_FIELDS = ["opened_at", "final_comment_at", "decided_at", "withdrawn_at"] as const;

/** True when `value` is a real UTC instant spelled `YYYY-MM-DDTHH:MM:00Z`. */
function isRealInstant(value: string): boolean {
  const ms = Date.parse(value);
  return !Number.isNaN(ms) && new Date(ms).toISOString() === value.replace(":00Z", ":00.000Z");
}

/**
 * Validates front matter against `schema/rfc.schema.json`, then checks that every timestamp
 * names a real day (the schema pattern alone accepts 2026-02-31). Returns plain-language problems.
 */
export function validateFrontMatter(data: unknown): string[] {
  if (!validate(data)) {
    return (validate.errors ?? []).map((error) => {
      const where = error.instancePath === "" ? "front matter" : error.instancePath.slice(1);
      return `${where}: ${error.message ?? "is invalid"}${describeParams(error.params)}`;
    });
  }
  const problems: string[] = [];
  const record = data as Record<string, unknown>;
  for (const field of TIMESTAMP_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && !isRealInstant(value)) {
      problems.push(`${field}: ${value} is not a real date`);
    }
  }
  const extension = record.extension as { granted_at: string } | null;
  if (extension && !isRealInstant(extension.granted_at)) {
    problems.push(`extension.granted_at: ${extension.granted_at} is not a real date`);
  }
  return problems;
}

function describeParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([key]) => key !== "type");
  if (entries.length === 0) return "";
  return ` (${entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")})`;
}
