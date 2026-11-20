# The NEMAR RFC process

This page describes how a NEMAR Request for Comment (RFC) works.
The process is provisional: it is reviewed after the first two RFCs close, and the review may change it.
Where this page and an Architecture Decision Record (ADR) in nemarOrg/nemar-cli disagree, the ADR wins.

## What an RFC is for

An RFC is how NEMAR asks the community before a decision that people outside NEMAR will implement, cite or depend on.
Examples are a file format, a rule for versioning or citing datasets, and a change to what happens to one dataset's content.
It is bounded in time and ends in a recorded decision, which is how it differs from a Brain Imaging Data Structure (BIDS) Extension Proposal (BEP).

An RFC is not for a bug fix, a change that only NEMAR's own code sees, or a choice already settled by an ADR (an RFC may ask to supersede one).
A small change goes through an ordinary pull request.

## One home, two scopes

One public repository, `nemarOrg/rfcs`, holds the record and the one number space, so every RFC is cited as `NEMAR RFC 0001`.
Every comment thread is a Discussion in this repository, in the category `RFCs`, including the thread of an RFC about a single dataset.
No dataset repository gets Discussions.

- **Organization scope** (`scope: org`): a question for the whole community.
- **Dataset scope** (`scope: dataset`, with `dataset: nm000123`): a question about one dataset, such as a contested change to its content.
  The dataset's owner is told directly when the RFC opens.

## Who does what

- **Anyone may propose.**
  Open a pull request that adds a file to `text/`, or write to support@nemar.org.
- **A shepherd opens it.**
  Only a NEMAR owner or admin opens an RFC, because opening starts a clock and an announcement.
  The shepherd keeps the clock, writes the summary of comments, and drafts the decision.
- **The owner decides an organization RFC**, and answers each objection in writing.
  **A dataset RFC is decided by NEMAR** with the dataset owner's recorded position, whether or not that owner comments.
  A change to content its authors own also needs the consent of the dataset's owner.

## The life of an RFC

Each record is a Markdown file `text/NNNN-kebab-title.md` with YAML front matter; its fields are in [`schema/rfc.schema.json`](schema/rfc.schema.json).
The status of an RFC is not stored.
It is derived from the recorded events and the current time by one function, `rfcStatus` in `src/status.ts`, which both checks use.

| State                    | It begins when                                                          |
| ------------------------ | ----------------------------------------------------------------------- |
| `draft`                  | A pull request adds the file, and `opened_at` is not set                |
| `open`                   | The owner merges the pull request with `discussion` and `opened_at` set |
| `extended`               | The shepherd records the one extension before the close                 |
| `final-comment`          | The shepherd posts the summary of comments and a proposed disposition   |
| `closed`                 | The close passes; the daily clock locks the thread; a decision is awaited |
| `accepted` or `rejected` | The decision pull request merges                                        |
| `withdrawn`              | The author or the shepherd withdraws it, at any time before a decision  |

`accepted`, `rejected` and `withdrawn` are final.
An RFC that needs another round is withdrawn and opened again under a new number, with `supersedes_rfc` pointing at the old one.

### Drafting

A draft is a pull request, not a merged file.
The draft takes its number when the pull request is created: the next number unused by merged files and by every pull request, open or closed, that ever added a `text/` file (`bun run next-number` prints it).
A number is never reused, even when a draft is withdrawn.
Start from [`0000-template.md`](0000-template.md).

The body of the pull request carries the opening post: the summary, the numbered questions, the close date in Coordinated Universal Time (UTC), and how to comment without a GitHub account.

### Opening

Only the owner merges an RFC text pull request, because merging one with `opened_at` set is the act of opening the RFC.
The shepherd creates the thread (a Discussion in the category `RFCs`), then sets `discussion` to its address and `opened_at` to the thread's creation time, rounded down to the minute in UTC.
`rfc-check` must pass before the merge.
Then the announcements go out (below).

## The clock

### The window

An RFC is open for comment for `window_days` days, an integer from 7 to 21, set when it opens.
The shepherd may grant one extension of at most 14 days, before the close, with a stated reason; no RFC runs longer than 35 days.

### Why the window is short

Reviews today are often helped by artificial intelligence (AI).
NEMAR welcomes AI-assisted review and contributions when knowledgeable people use the AI and check what it produces.
With that help, a careful review fits in three weeks, so NEMAR RFCs are fast-paced: at most 21 days, with one extension of at most 14.

### The close is an instant

The close is `opened_at` plus `window_days` (plus the extension's days) times 24 hours, in UTC, to the minute.
The opening post prints it, and the index lists it.
There is no grace period: a comment posted after the close instant is late, whether or not the thread is locked yet.
The thread itself is locked by the daily clock run (below), so it stays open for up to about 24 hours after the close.
A late comment is still in the record: it gets a written disposition like any other, the shepherd marks it as late, and it cannot extend the window or reopen the RFC.

### One RFC at a time

At most one RFC is open for comment at a time.
A second RFC opens only after the first has closed (or been withdrawn), and `rfc-check` refuses a record whose window overlaps another's.

### The final comment

Inside the window, the shepherd posts a summary of the comments and a proposed disposition (accept or reject) in the thread, at least 7 days before the close (5 days when the window is 7 to 10 days).
The shepherd records it as `final_comment_at` and `proposed_disposition`.
An RFC can be accepted only if this happened in time; otherwise it can only use its extension, be rejected, or be withdrawn.

### Changing the text

A material change to the text is allowed until the final comment is posted.
It is logged in the file's Change log and announced in the thread.
After that, a material change uses the extension; if the extension is spent, the RFC is withdrawn and opened again.

### Reminders

`rfc-clock` runs daily.
It runs once a day, at 14:00 UTC.
It posts a reminder in the thread at the first run on or after the instant 7 days before the close, and again at the first run on or after the instant 2 days before it.
It locks the thread and posts a closing comment at the first run after the close instant, which is up to about 24 hours later.
If the lock fails, it posts no closing comment and tries again on the next run.
It edits no file and decides nothing.
If GitHub disagrees with the record (a thread that is missing, unlocked after its close, or locked before it), or an RFC has been closed for more than 14 days with no decision, the run fails and says so.
A silent clock is also visible: the weekly report shows when `rfc-clock` last ran.

## How to comment

- **With a GitHub account**, reply in the thread.
- **Without one**, write to support@nemar.org.
  A maintainer posts your comment in the thread, with your name only if you agree.
  A comment sent before the close is posted even if the thread has locked by then.

The category `RFCs` is in the Announcement format: only maintainers open a thread, and anyone with a GitHub account comments under the RFC's Discussion.
Email to support@nemar.org is the fallback for people without an account; the maintainer posts it to the thread with the sender's consent.

Anyone may comment; nobody has to be a NEMAR account holder.

## The decision

Every comment gets a written disposition before a decision: adopted, adopted in part, or not adopted, with the reason.
The decision pull request adds them to the RFC file under a section `## Disposition of comments`, and records `decision`, `decided_at`, `decided_by` and, when accepted, `adr`.
The decision is due within 14 days of the close; nothing decides an RFC automatically, because silence is not consent.

Which outcomes produce an ADR:

- **An accepted RFC** produces an ADR in nemarOrg/nemar-cli (or in the specification's own repository, for a specification), through the usual pull request.
  The ADR states the verdict and names the RFC; the RFC keeps the argument and the comments.
- **A rejection** produces an ADR when it closes off a reasonable path, for example "dataset versions stay `X.Y.Z`".
  A plain "not now" produces none.

## Withdrawing

The author or the shepherd may withdraw an RFC at any time before a decision, with `withdrawn_at`, `withdrawn_reason` and `decision: withdrawn`.
The shepherd posts the final comment (a note that the RFC is withdrawn, and why) in the thread and locks it by hand; `rfc-clock` does not manage a withdrawn thread.

## Announcements

An organization RFC is announced in these places, once, when it opens:

- the Discussion thread, which notifies its watchers;
- a news post on nemar.org;
- a command-line interface (CLI) notice that expires at the close;
- a community email to NEMAR account holders under the `rfcs` mail category, with an unsubscribe link in the footer (sent from production only);
- LinkedIn and the BIDS Google group, posted by the owner.

A dataset RFC is announced in its thread and by email to the dataset's owner and collaborators.
Each announcement carries the close instant and the thread's address.

## What the checks enforce

`rfc-check` is a required check on every pull request and every push to `main`.
It refuses a record that breaks any of these:

- the front matter matches the schema, and `number` matches the file name and is unique;
- `window_days` is from 7 to 21;
- at most one extension, of at most 14 days, granted inside the window; an extension cannot be added or changed once the check runs after the close;
- at most one RFC is open for comment at a time;
- `accepted` only with a final comment and proposed disposition at least 7 days (5 for windows of 7 to 10 days) before the close, and an `adr` link;
- decision fields only after the close, except `withdrawn`; a decision needs `decided_at` and `decided_by`; a decision other than `withdrawn` needs a non-empty section `## Disposition of comments`;
- status never moves backward against the base branch, a decision is not changed, and `opened_at`, `window_days`, `discussion`, `final_comment_at` and `proposed_disposition` do not change once recorded;
- a record is never deleted, and a number taken by any pull request is never reused;
- the index in `README.md` is the generated one.

The check's own clock decides every question about time; a date written in a record is not trusted over it.

## Licenses

Text (`PROCESS.md`, `README.md`, the template and every RFC in `text/`) is licensed Creative Commons Attribution 4.0 International (CC BY 4.0).
Tooling (`src/`, `test/`, `schema/`, `ops/`, `.github/`, configuration, and the agent instructions `AGENTS.md` and `CLAUDE.md`) is under the MIT License.
By proposing text you agree to license it under CC BY 4.0.
See [`LICENSE.md`](LICENSE.md).
