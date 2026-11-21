---
name: usage-limit-stops-agents
description: Agents stopped by the weekly usage limit keep their work; resume them by message, and do not count the pause against a timebox
metadata:
  type: project
---

On 2026-11-20 two running agents (B7 and S1) stopped on the weekly usage limit (HTTP 429), mid-task, with uncommitted edits in their worktrees.
After the reset, a message to each agent resumed it from its own transcript, and both finished without redoing work.
The board then flagged B7 as past twice its timebox, which was clock time during the pause, not slow work.

**How to apply:** resume a stopped agent with a message instead of starting a new one.
Tell it to run `git status` and `git log` first and to re-run its gates.
Log a timebox breach that spans the pause, and do not escalate it.
