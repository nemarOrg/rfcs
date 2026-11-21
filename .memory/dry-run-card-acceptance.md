---
name: dry-run-card-acceptance
description: Card acceptance greps written by the lead were wrong several times; dry-run them against the intended text and the base before dispatch
metadata:
  type: feedback
---

Lead-written cards in the RFC program carried acceptance greps that would have failed a correct edit:
- a case-insensitive `grep -i nemar` matched `nemarOrg`;
- a count missed a second mention added by the card's own new sentence;
- an exact line redefined an abbreviation the file already defined.

A reviewer once claimed the opposite error, that a `(question 18)` count was wrong.
The base text already held one, and the lead rejected the finding with that evidence.

**How to apply:** before a card is dispatched, apply its exact lines to a scratch copy of the target and run every acceptance command.
Run each command on both the edited copy and the base, and check the counts on both.
Ask a reviewer of the card to do the same.
When a finding about a count comes in, check the base text before accepting it.
