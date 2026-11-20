/** The front matter of one RFC record, with exactly the fields the schema names. */
export interface Extension {
  granted_at: string;
  days: number;
  reason: string;
}

export interface RfcFrontMatter {
  number: number;
  title: string;
  scope: "org" | "dataset";
  dataset: string | null;
  shepherd: string;
  authors: string[];
  discussion: string | null;
  opened_at: string | null;
  window_days: number;
  extension: Extension | null;
  final_comment_at: string | null;
  proposed_disposition: "accept" | "reject" | null;
  decision: "accepted" | "rejected" | "withdrawn" | null;
  decided_at: string | null;
  decided_by: string | null;
  adr: string | null;
  supersedes_rfc: number | null;
  withdrawn_at: string | null;
  withdrawn_reason: string | null;
}

/** One file under `text/`: its path, its parsed front matter and its Markdown body. */
export interface RfcFile {
  path: string;
  record: RfcFrontMatter;
  body: string;
}

export type RfcState =
  | "draft"
  | "open"
  | "extended"
  | "final-comment"
  | "closed"
  | "accepted"
  | "rejected"
  | "withdrawn";

/** A file whose front matter could not be read; the check reports it and stops there. */
export interface UnreadableFile {
  path: string;
  problems: string[];
}
