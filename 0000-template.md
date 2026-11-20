---
number: 0 # the next number unused by a merged file and by every pull request that ever added a text/ file: `bun run next-number`
title: A short title in sentence case
scope: org # org | dataset
dataset: null # null for org; a dataset id such as nm000123 when scope is dataset
shepherd: Name or GitHub login of the NEMAR owner or admin who opens the RFC
authors: [Name of an author]
discussion: null # the thread's URL, set by the merge that opens the RFC
opened_at: null # the thread's creation instant, UTC, rounded down to the minute: 2027-01-11T16:00:00Z
window_days: 21 # 7 to 21
extension: null # {granted_at: 2027-01-25T10:00:00Z, days: 7, reason: "..."}; one at most, of at most 14 days
final_comment_at: null # set with proposed_disposition when the shepherd posts the summary of comments
proposed_disposition: null # accept | reject
decision: null # accepted | rejected | withdrawn
decided_at: null
decided_by: null
adr: null # a link to the Architecture Decision Record; required when accepted
supersedes_rfc: null # the number of an earlier RFC this one replaces
withdrawn_at: null
withdrawn_reason: null
---

<!--
Delete every comment before the pull request is ready.
Write for a researcher who does not know NEMAR's internals.
Spell out an abbreviation the first time it appears.
The twelve sections below are the template's order.
After the close, the decision pull request adds a section "Disposition of comments" (see PROCESS.md).
-->

## Summary

<!-- Three sentences a non-specialist can read. -->

## Scope

<!-- The organization, or one dataset and why. -->

## Problem

<!-- What is wrong today, with measured facts and where they were measured. -->

## Proposal

<!-- What would change, ending with the one-sentence verdict an Architecture Decision Record would carry. -->

## Who is affected

<!-- Depositors, authors, users, tools, NEMAR. -->

## What does not change, and what is irreversible

<!-- Say plainly which parts cannot be undone once done. -->

## Options considered

<!-- Each option with its cost, including doing nothing. -->

## Prior art

<!-- What other projects and standards do, and what is borrowed or left. -->

## Questions for commenters

<!-- Numbered, answerable questions. -->

## How the decision will be made

<!-- The criteria, written before comments arrive. Who decides is in PROCESS.md. -->

## Rollout and cost

<!-- What happens after acceptance, who does it, and what it costs. -->

## Change log

<!-- Dated, one line per material change to the text. -->

<!--
OPENING POST. Put this in the pull request body, not in this file.
The pull request that adds the draft carries the post that opens the thread:

  **RFC {NNNN}: {title}**

  {The summary, three sentences.}

  **Questions for commenters**
  {The numbered questions.}

  **Closes {{CLOSE_UTC}} UTC.** The window is {window_days} days from the thread's creation.
  The record is at {link to the file at its merge commit}.

  **How to comment.** Reply in this thread with a GitHub account.
  Without one, write to support@nemar.org before the close; a maintainer posts your comment here, with your name only if you agree.
-->
