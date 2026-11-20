# nemarOrg/rfcs: Development Instructions

> Project instructions for any coding agent and for people.
> Claude Code reads this through `@AGENTS.md` in `CLAUDE.md`.

This repository holds NEMAR's Request for Comment (RFC) process: the record (`text/`), the template, the schema, the generated index, and two checks, `rfc-check` and `rfc-clock`.
**This file is the hard rules**: what can go wrong here and is not obvious from the code.
The process is in [`PROCESS.md`](PROCESS.md); the decisions behind it are in nemarOrg/nemar-cli, `.context/decisions/` (the ADR that adopts the process wins over any other text).

## Hard rules

### Only the owner merges an RFC text pull request

Merging a pull request that sets `opened_at` and `discussion` is the act of opening the RFC: it starts the clock and the announcements.
No agent merges one, creates a Discussion, posts in a thread or locks one.
`rfc-clock` posts reminders and locks at the close, from its scheduled workflow.
The shepherd, a person, locks a withdrawn thread and posts its final comment by hand.

### A number is never reused

The next draft takes `bun run next-number`: above every merged file and every pull request, open or closed, that added a `text/` file.
Never delete or renumber a record, not even a withdrawn one.

### Time is the check's clock, never a date in a record

`rfcStatus` in `src/status.ts` is the one place a state is derived; `rfc-check` and `rfc-clock` both import it.
Do not compare dates anywhere else, and do not make the check read a date from the file in place of its own clock.
Tests pass `now` explicitly; no test sleeps or reads the real clock.

### The index is generated, and holds nothing that depends on the time

Run `bun run index` after any change to a record.
Do not add a column that changes as time passes: it would turn every pull request red.

### The clock never edits a file and never decides

`rfc-clock` has `contents: read` and `discussions: write`, and no more.
Do not give it a permission, a file write or a decision.
Its GraphQL endpoint is `GITHUB_GRAPHQL_URL`; tests point it at a local `Bun.serve` stand-in.

### The ruleset is the owner's

`ops/ruleset-main.json` is applied by the owner (`gh api -X POST repos/nemarOrg/rfcs/rulesets --input ops/ruleset-main.json`).
Do not apply it, and do not change repository settings.

## Tooling is fixed

**Bun** for TypeScript, never npm or npx. **Biome** for lint and format, never ESLint or Prettier.
Gates: `bun install && bun run lint && bun run typecheck && bun test && bun run src/check.ts`.
Tests use the real code paths; no mocks of business logic.
A local `Bun.serve` stand-in for GitHub's API is allowed, to test a client's behavior against HTTP conditions.

## Writing

American English; no em-dashes; spell out an abbreviation on first use; semantic line breaks in Markdown (one sentence per line).
Text posted to GitHub keeps each paragraph on one line.
Commit subjects are under 50 characters, with no emojis and no AI or co-author attribution.
