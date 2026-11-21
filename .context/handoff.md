# Handoff: the RFC program, paused before RFC-0001 opens

Written 2026-11-21 by the manager of the RFC program (manager id `mba-claude-sonnet`), at the end of its session.
Resume in a fresh session from this repository, `/Users/yahya/Documents/git/nemar/rfcs`, not from a worktree.
Observations learned along the way are in [`.memory/`](../.memory/README.md), one per file.

## Where things stand

Every program step before the opening of RFC-0001 is done, reviewed and merged.
The RFC text is ready: draft pull request [nemarOrg/rfcs#2](https://github.com/nemarOrg/rfcs/pull/2), branch `rfc/0001-biosig-zarr`, head `b6bbb3cddca8f49fc59b98ca130e72eaf1cca4eb`.
Its last review read the whole file as well as the last edit, and found nothing to fix:
every link into nemarOrg/biosig-zarr resolves at the tag it names, nothing stale remains, questions 1 to 40 are each defined once, and `rfc-check` passes.

Opening the RFC (step O5) waits on two things:

1. **The mail epic in production.**
   Epic nemarOrg/nemar-cli#2260 (community mail categories, one-click unsubscribe, recalls), together with the privacy-policy text, must be live in production first (owner, 2026-11-20).
   On 2026-11-21, phases P1 to P3 were merged into `feature/issue-2260-epic-mail-categories`, and P4 was an open pull request, nemarOrg/nemar-cli#2290.
   The epic was not yet on `dev`, let alone in production.
   That work is outside this program; check its state, do not drive it.
2. **The owner's go-ahead.**
   Only the owner opens an RFC (this repository's `AGENTS.md`: no agent merges an RFC text pull request, creates a Discussion or posts in a thread).

## When the mail epic is in production

Check, in order:

1. `gh issue view 2260 -R nemarOrg/nemar-cli` and the epic's pull request into `dev`, then confirm production has it (`nemar-cli` release notes or the deploy record), and that the privacy text is published.
2. rfcs#2 is still a draft at `b6bbb3cd` (or a descendant with only reviewed commits): `gh pr view 2 -R nemarOrg/rfcs --json headRefOid,isDraft`.
3. The evidence tag still resolves: `git ls-remote https://github.com/nemarOrg/nemar-cli refs/tags/rfc-0001-evidence` prints `c48405fe0ad8e4a005dea123a0fa668b40af6ab1`.
4. Then ask the owner to open RFC-0001.

The owner opens it with the three steps in nemar-cli's `plan.md`, section 5, "O5 and O6":

1. Create the Discussion thread in nemarOrg/rfcs, titled "RFC 0001: biosig-zarr and its single-file form .bzx", from the opening post in the pull request body, and read back its URL and `createdAt`.
2. On rfcs#2, set `discussion` (the URL), `opened_at` (the `createdAt`, to the minute) and `window_days: 21`; `rfc-check` must pass; merge it.
   Merging it starts the clock.
3. Announce from N1's drafts in nemar-cli `.context/rfc-program/owner/announce-0001/` (mail, news, docs banner, CLI notice, LinkedIn, the BIDS Google group, notes), after filling `{{CLOSE_UTC}}` and `{{THREAD_URL}}`.
   The venues are the EEGLAB mailing list, the MNE Forum and Neurostars (Q31, Q32); no posts in other projects' repositories.
   Broadcast mail is production-only and honors the `announcements` preference.

## After RFC-0001 opens

| Step | What | Waits on |
|---|---|---|
| A3 | ADR amending nemar-cli ADR 0124 (conformance vectors canonical in biosig-zarr), worktree `rfc-A3` | ADR 0132 reaching nemar-cli `dev` with the mail epic; then merge `dev` into the epic branch and review A3 |
| C3 | Checkpoint: decision draft and follow-through outline | RFC-0001's close instant (21 days after `opened_at`) |
| V2 | RFC-0002 text (card outline; the lead completes it at C2) | Q16, "For RFC-0002, what does first party mean?", due 2027-01-15 |
| O6 | Owner opens RFC-0002 | C3; one RFC open at a time |
| C4 | Checkpoint after RFC-0002 closes | O6 |

## The program's state lives in nemar-cli

The plan, the cards, the board and its log are in nemarOrg/nemar-cli, branch `feature/rfc-program` (pushed; last board commit `c5d9f68e`), under `.context/rfc-program/`:
`board.md` (state), `board-log.md` (decisions and log, append-only), `plan.md`, `runbook.md`, `cards/`, `checkpoints.md`, `risks.md`, `evidence/` (S1's back-catalog scan) and `owner/` (announcement drafts).
Read the board from origin without a worktree: `git -C /Users/yahya/Documents/git/nemar/nemar-cli fetch origin feature/rfc-program && git -C /Users/yahya/Documents/git/nemar/nemar-cli show origin/feature/rfc-program:.context/rfc-program/board.md`.
The board helper is `python3 /Users/yahya/.claude/plugins/cache/research-skills/project/0.15.1/skills/manager-loop/scripts/manager_board.py` (the runbook still names 0.12.0).
It edits a checked-out board, so writing to the board needs a checkout of `feature/rfc-program`; the owner prefers that a session not run inside a worktree, so decide with the owner where the board lives next, or keep the board read-only and record new decisions here until then.
Never merge `feature/rfc-program` into nemar-cli `dev` without the owner.

## What was published on 2026-11-20 and 2026-11-21

- nemarOrg/biosig-zarr releases: `2.0.0`, `2.0.1`, `2.0.2` (Latest, on `509b6897`, the independence release), and the pre-releases `3.0.0-draft.1`, `3.0.0-draft.2` and `3.0.0-draft.3` (on `c0cb7e49`, the text RFC-0001 proposes).
- biosig-zarr is independent of NEMAR (Q37 to Q42, biosig-zarr ADR 0005): the copyright holder is "the biosig-zarr contributors"; the editor is Seyed Yahya Shirazi in a personal capacity and decides through RFCs in this repository; NEMAR hosts the repository and registers DOIs through nemar-doi as a service, is ready to hand the specification off when it matures, and until then backstops its continuation without deciding its text.
- Tag `rfc-0001-evidence` in nemarOrg/nemar-cli on `c48405fe`, so the RFC's link to S1's evidence survives whatever happens to the branch.
- nemarOrg/nemar-cli#2292: nm000411 has no converted stores (conversion failed, no requeue); cause not examined.

## Rules the owner set that still bind

- While RFC-0001 is open, `3.0.0-draft.N` pre-releases are fine; no `3.0.x` release is cut until the RFC closes (owner, 2026-11-21).
- The manager may create tags, releases and settings only when the owner says so for that step, and records the say-so first.
- Every pull request gets its own review before it merges: one Sonnet reviewer for docs-only or small changes, a panel of two otherwise, at most two rounds; small fixes after the last round are verified by the manager directly.
- biosig-zarr pull requests merge with a merge commit (Developer Certificate of Origin sign-offs); nemar-cli step pull requests squash-merge; `gh pr merge --match-head-commit` takes the full 40-character SHA.

## Cleanup waiting for the owner

Worktrees made during the program, all for work that is merged unless noted:

- nemar-cli: `nemar-cli-worktrees/rfc-program` (the board's checkout), `rfc-A1`, `rfc-A2`, `rfc-A3` (A3 is open, keep it), `rfc-N1`, `rfc-R3`, `rfc-S1`, `rfc-V1`, `rfc-lead-c1`, `rfc-lead-indep`, `lead-b4d`, and the temporary `rfc-devmerge` and `rfc-devmerge2` with branches `rfc-devmerge-tmp` and `rfc-devmerge2-tmp`.
  These worktrees have a symlinked `.git`; see [`.memory/annex-worktree-removal.md`](../.memory/annex-worktree-removal.md).
- biosig-zarr: `biosig-zarr-worktrees/b5`, `b5a`, `b7`, `b7b`, and a prunable `wt-pin`; after removing them, run `git -C /Users/yahya/Documents/git/nemar/biosig-zarr config --unset extensions.worktreeConfig`.
- `/tmp/claude-guard`.
