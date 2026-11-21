---
name: release-date-vs-decision-date
description: A decision dated in Pacific time can predate its release in UTC; date history rows by event and say both
metadata:
  type: project
---

biosig-zarr's independence was decided on 2026-11-20, Pacific time.
Release `2.0.2` and pre-release `3.0.0-draft.3` were published on 2026-11-21 UTC.
A card-given history row in RFC-0001 dated 2026-11-20 said the specification "was released as `2.0.2`", which was false for that date.
Card B4d fixed the row.

**How to apply:** in history tables and change logs, date a decision by its decision and a release by its publication (`gh release view <tag> --json publishedAt`).
When both fall in one row, give each its own date.
