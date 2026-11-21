---
name: bun-install-rewrites-lock
description: In nemarOrg/rfcs, bun install rewrites bun.lock (caret ranges to exact pins); revert it, do not commit it
metadata:
  type: project
---

Running `bun install` in this repository rewrites `bun.lock`.
The entries for `ajv` and `yaml` go from `^8.20.0` to `8.20.0`, because `package.json` pins exact versions.
Two separate workers saw this on 2026-11-21, and both reverted it.

**How to apply:** after `bun install`, run `git checkout bun.lock` unless the change is the point of the pull request.
Fixing the lock file for good is a separate small pull request.
