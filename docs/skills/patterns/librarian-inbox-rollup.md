# Pattern: librarian INBOX-rollup

**Group:** fleet-ops · **Seeded by:** the fleet memory discipline — the memory index (`MEMORY.md`) as a one-line-per-memory rollup, and the librarian role that keeps it current; memory: project_kaizen_10_fleet_ops_2026_07_02 (fleet memory location), the MEMORY.md index convention.

## When to use — trigger phrases
- "roll up the loose notes / INBOX into the index"
- "the memory index is stale / too long"
- periodic fleet-memory maintenance

## Inputs
- New memory files / loose notes / report-backs since the last rollup.
- The canonical index (`MEMORY.md`) — one line per memory.

## Procedure
1. **Collect** new atomic memories and report-backs (the INBOX) since last rollup.
2. **Dedup** against existing memories — update the existing file rather than adding a near-duplicate; delete memories proven wrong.
3. **Roll up** each into a single index line: `- [Title](file.md) — <hook>`. Detail lives in the topic file, never in the index.
4. **Group** the index by theme (load-bearing rules, active waves, build mechanics, historical ledgers).
5. Keep it skimmable — the index is loaded into context every session; every line must earn its place.

## Output
A current, deduped `MEMORY.md` where one glance shows what's known and where the detail lives.

## Guardrails
- **One fact per file; one line per file in the index.** Never put memory content in the index (memory rules).
- **Dedup before adding** — check for an existing file that already covers it; update, don't duplicate.
- **Convert relative dates to absolute** when rolling up ("last Tuesday" → the date).
- **The index is the working set, the files are the archive.** Historical ledgers get a "read-only if resuming" section so they don't crowd the active set.
- Know where the store actually lives — fleet memory has been on a different mount than expected (memory: "fleet memory on Cowork mount, NOT here"). Roll up into the *canonical* store.

## Worked example
This project's `MEMORY.md` is the pattern in production: ~80 memories compressed to one hook-line each, grouped into "Load-bearing rules," "Active waves," "Build/ops mechanics," and "Historical ledgers." Each department report-back (PR #356–#369) became a single index line — the rollup step in action.
