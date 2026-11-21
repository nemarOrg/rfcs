---
name: annex-worktree-removal
description: nemar-cli worktrees get a symlinked .git (git-annex), so git worktree remove fails until a gitdir file is restored
metadata:
  type: project
---

`git worktree remove` on a nemar-cli worktree fails with "'.git' is not a .git file, error code 10", because git-annex turns the worktree's `.git` into a symlink.
A local guard also refuses a recursive delete of a worktree root.
Seen again on 2026-11-21 with a temporary worktree.

**How to apply:** replace the symlink with a gitdir file, using the absolute repository root, then remove:

```bash
W=<worktree>; R=/Users/yahya/Documents/git/nemar/nemar-cli
unlink "$W/.git" && printf 'gitdir: %s/.git/worktrees/%s\n' "$R" "$(basename "$W")" > "$W/.git"
git -C "$R" worktree remove --force "$W" && git -C "$R" worktree prune
```

nemar-cli's own `.memory/annex-worktree-git-symlink.md` has the full history.
