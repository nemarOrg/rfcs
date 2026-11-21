---
name: owner-prefers-no-worktree-sessions
description: The owner does not want a session to run inside a git worktree; resume RFC work from the rfcs clone
metadata:
  type: feedback
---

The RFC program's 2026-11-20 and 2026-11-21 sessions ran inside the nemar-cli worktree `nemar-cli-worktrees/rfc-program`, and the owner said this is not something they like (2026-11-21).
Fresh sessions resume from `/Users/yahya/Documents/git/nemar/rfcs`.

**How to apply:** start the session in a plain clone.
Delegated workers may still use short-lived worktrees for their own branches, and remove them once merged.
Never edit a primary checkout another session may share.
