# NEMAR Requests for Comment

The record, the index and the clock for NEMAR Requests for Comment (RFCs).

An RFC is how NEMAR asks the community before a decision that people outside NEMAR will implement, cite or depend on.
Each RFC is open for comment for at most 21 days, in a Discussion in this repository, and ends in a written decision.
The whole process is in [`PROCESS.md`](PROCESS.md).

## How to take part

- **Comment** on an open RFC under its Discussion thread (see the index below), with a GitHub account.
  Only maintainers open a thread; anyone with an account comments.
  Without an account, write to support@nemar.org before the close: a maintainer posts your comment in the thread, with the sender's consent and your name only if you agree.
- **Propose** an RFC by opening a pull request that adds `text/NNNN-title.md` from [`0000-template.md`](0000-template.md), or by writing to support@nemar.org.
  A NEMAR owner or admin opens it for comment.

## Index

Times are in Coordinated Universal Time (UTC).
The index is generated from the records in `text/` by `bun run index`, and `rfc-check` refuses a pull request that leaves it stale.
It lists what each record says; the live state of an RFC (open, final comment, closed) is on its thread.

<!-- rfc-index:start -->
No RFC has been proposed yet.
<!-- rfc-index:end -->

## Contents

| Path                                               | What it is                                                   |
| -------------------------------------------------- | ------------------------------------------------------------ |
| [`PROCESS.md`](PROCESS.md)                         | The process, in plain language                               |
| [`0000-template.md`](0000-template.md)             | The template for an RFC                                      |
| `text/`                                            | One file per RFC, `NNNN-kebab-title.md`                      |
| [`schema/rfc.schema.json`](schema/rfc.schema.json) | The schema of an RFC's front matter                          |
| `src/`, `test/`                                    | The two checks, `rfc-check` and `rfc-clock`, and their tests |
| `.github/workflows/`                               | Where the two checks run                                     |
| `ops/ruleset-main.json`                            | The repository ruleset that protects `main`                  |
| [`LICENSE.md`](LICENSE.md)                         | The licenses: MIT for tooling, Creative Commons Attribution 4.0 International (CC BY 4.0) for text            |

## License

Text is licensed under CC BY 4.0 and tooling under the MIT License; see [`LICENSE.md`](LICENSE.md).
