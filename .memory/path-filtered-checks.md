---
name: path-filtered-checks
description: biosig-zarr's conformance workflow is path-filtered, so a docs-only PR shows no conformance check; a card gate naming it is not applicable, not passed
metadata:
  type: project
---

nemarOrg/biosig-zarr's conformance workflow runs only when `schemas/`, `conformance/`, `tools/`, `package.json` or `bun.lock` change; the owner widened the filter on 2026-11-20 (Q27).
Docs-only PRs such as #7 and #8 show only `links`, `lint` and `spelling`.
Card B7b's acceptance named the conformance workflow anyway.

**How to apply:** when a card's gate names a path-filtered workflow, first prove that the PR changed none of the filtered paths, for example with `git diff --name-only <base> HEAD -- schemas conformance tools`.
Run the workflow's commands locally.
Record the gate as not applicable, with that evidence, never as a pass.
