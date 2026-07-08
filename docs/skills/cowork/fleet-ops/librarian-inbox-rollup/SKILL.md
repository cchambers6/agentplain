---
name: librarian-inbox-rollup
description: Keep a fleet memory store current by rolling loose notes and report-backs into a deduped, one-line-per-memory index. Use when the memory index is stale or bloated, after a batch of new memories lands, or on periodic memory maintenance. One fact per file; one hook-line per file in the index.
---

# Librarian INBOX-rollup

Turn a pile of new atomic memories and report-backs (the INBOX) into a current, deduped index where one glance shows what's known and where the detail lives.

## Procedure

1. **Collect** new memory files, loose notes, and report-backs since the last rollup.
2. **Dedup** against existing memories — update the existing file rather than adding a near-duplicate; delete memories proven wrong.
3. **Roll up** each into a single index line: `- [Title](file.md) — <hook>`. Detail stays in the topic file, never in the index.
4. **Group** the index by theme (e.g. load-bearing rules, active work, build mechanics, historical/archive).
5. **Prune to skimmable** — the index loads into context every session; every line must earn its place. Move stale ledgers to a "read-only if resuming" section.

## Rules

- **One fact per file; one line per file in the index.** Never put memory *content* in the index.
- **Dedup before adding.** Check for a file that already covers it; update, don't duplicate.
- **Absolute dates.** Convert "last Tuesday" → the actual date when rolling up.
- **The index is the working set; the files are the archive.**
- **Know where the store lives.** The canonical store may not be where you expect (it has lived on a different mount than the repo) — roll up into the canonical one.

## Origin

The fleet's `MEMORY.md` convention: ~80 memories compressed to one hook-line each, grouped into rules / active waves / mechanics / historical ledgers. Every department report-back (PR #356–#369) became a single index line.
