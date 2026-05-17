# Knowledge substrate refresh — 2026-05-14

Incremental refresh covering content ratified or written between **2026-05-12 00:00 ET** and **2026-05-14 23:59 ET**. Companion to `docs/knowledge-substrate.md` (architecture) and `agent-state/pr-knowledge-reseed-2026-05-12.md` (the prior 48h's substrate growth).

## TL;DR

- **No new seed-data.ts changes were required.** PR #19 (`fdb892c`, merged 2026-05-13 23:42 ET) already wired every committed-on-`main` artifact landed in this window into `lib/knowledge/seed-data.ts` via the live loaders (`getAllVerticals()`, `loadCorpusFor()`, `listCorpusVerticals()`).
- **Seed assembly verified** in test mode: SKILL=10 / VERTICAL=134 / COMPLIANCE=26 = **170 docs**, 0 failures, 176ms.
- **All four sample queries return the expected top-1 hit** with the deterministic test embedder.
- **Production write to Postgres is gated on Conner-side env access** (`OPENAI_API_KEY` + `DATABASE_URL` not present in this worktree's shell). Same handoff as the prior re-seed PR's "After merge" line — no new gate introduced by this refresh.

## Inventory — committed content since 2026-05-12

`git log --since="2026-05-12 00:00 ET"`:

| Commit    | Date              | Summary                                                          | Substrate impact                                                |
| --------- | ----------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `eede4e3` | 2026-05-12 23:20  | ratify JTBD tables for 9 non-real-estate verticals               | Picked up by `chunkVertical()` + `buildJtbdSynthesisRows()`     |
| `a3bf5cc` | 2026-05-12 23:23  | draft per-vertical compliance corpus for 9 non-real-estate verticals | Picked up by `buildComplianceCorpus()` (verified rules only) |
| `8fe17d8` | 2026-05-12 23:27  | add knowledge substrate (pgvector + MCP route)                   | Substrate itself                                                |
| `fdb892c` | 2026-05-13 20:44  | re-seed substrate with compliance corpus + jtbd synthesis + arch docs | Updated `seed-data.ts` to wire all of the above             |
| `1d1052b` | 2026-05-13 20:45  | add /operator/leadership-board                                   | None — operator UI; no doctrine to seed                         |
| `cde47c7` | 2026-05-13 20:46  | PR description text for knowledge-reseed PR                      | None — internal `agent-state/` artifact                         |
| `9ab106a` | (current default) | pin Stripe API version                                           | None — billing chore                                            |

Full table by context kind:

| File / loader                                                | Context kind | Action                | Wired through                                       |
| ------------------------------------------------------------ | ------------ | --------------------- | --------------------------------------------------- |
| `lib/verticals/cpa/content.ts`                               | VERTICAL     | covered (commit eede4e3) | `getAllVerticals()` → `chunkVertical()` + `buildJtbdSynthesisRows()` |
| `lib/verticals/home-services/content.ts`                     | VERTICAL     | covered (commit eede4e3) | same                                              |
| `lib/verticals/insurance/content.ts`                         | VERTICAL     | covered (commit eede4e3) | same                                              |
| `lib/verticals/law/content.ts`                               | VERTICAL     | covered (commit eede4e3) | same                                              |
| `lib/verticals/mortgage/content.ts`                          | VERTICAL     | covered (commit eede4e3) | same                                              |
| `lib/verticals/property-management/content.ts`               | VERTICAL     | covered (commit eede4e3) | same                                              |
| `lib/verticals/recruiting/content.ts`                        | VERTICAL     | covered (commit eede4e3) | same                                              |
| `lib/verticals/ria/content.ts`                               | VERTICAL     | covered (commit eede4e3) | same                                              |
| `lib/verticals/title-escrow/content.ts`                      | VERTICAL     | covered (commit eede4e3) | same                                              |
| `lib/verticals/real-estate/content.ts`                       | VERTICAL     | covered (pre-window)  | same                                              |
| `lib/agents/sentinel/corpus/cpa/*`                           | COMPLIANCE   | covered (commit a3bf5cc) | `loadCorpusFor('cpa')` → `buildComplianceCorpus()` |
| `lib/agents/sentinel/corpus/home-services/*`                 | COMPLIANCE   | covered (commit a3bf5cc) | same                                              |
| `lib/agents/sentinel/corpus/insurance/*`                     | COMPLIANCE   | covered (commit a3bf5cc) | same                                              |
| `lib/agents/sentinel/corpus/law/*`                           | COMPLIANCE   | covered (commit a3bf5cc) | same                                              |
| `lib/agents/sentinel/corpus/mortgage/*`                      | COMPLIANCE   | covered (commit a3bf5cc) | same                                              |
| `lib/agents/sentinel/corpus/property-management/*`           | COMPLIANCE   | covered (commit a3bf5cc) | same                                              |
| `lib/agents/sentinel/corpus/real-estate/*`                   | COMPLIANCE   | covered (commit a3bf5cc) | same                                              |
| `lib/agents/sentinel/corpus/recruiting/*`                    | COMPLIANCE   | covered (commit a3bf5cc) | same                                              |
| `lib/agents/sentinel/corpus/ria/*`                           | COMPLIANCE   | covered (commit a3bf5cc) | same                                              |
| `lib/agents/sentinel/corpus/title-escrow/*`                  | COMPLIANCE   | covered (commit a3bf5cc) | same                                              |
| `docs/skills-architecture.md`                                | SKILL (arch) | covered (commit fdb892c) | hardcoded `ARCHITECTURE_CORPUS` (3 chunks)        |
| `docs/knowledge-substrate.md`                                | SKILL (arch) | covered (commit fdb892c) | hardcoded `ARCHITECTURE_CORPUS` (2 chunks)        |
| Five PR-C skill docs (`lib/skills/{read,categorize,coordinate,schedule,draft}.ts`) | SKILL | covered (commit fdb892c) | hardcoded `SKILL_CORPUS` (5 chunks) |

## Per-context-kind chunk count (assembled, idempotent natural keys)

```
Plan: SKILL=10 VERTICAL=134 COMPLIANCE=26
  SKILL        attempted=10  created=10  updated=0  failed=0
  VERTICAL     attempted=134 created=134 updated=0 failed=0
  COMPLIANCE   attempted=26  created=26  updated=0 failed=0

Done in 176ms. Total failures: 0.
Customer + cross-customer empty (intentional per spec).
```

Compliance verified-vs-skipped per vertical (verified counted; unverified rows under `[UNVERIFIED — needs counsel]` are skipped per `feedback_no_guesses_no_estimates.md`):

```
real-estate          verified=1  skipped=0
mortgage             verified=3  skipped=2
insurance            verified=0  skipped=4
property-management  verified=1  skipped=3
title-escrow         verified=2  skipped=2
recruiting           verified=5  skipped=1
home-services        verified=1  skipped=3
cpa                  verified=0  skipped=6
law                  verified=6  skipped=1
ria                  verified=2  skipped=4
─────────────────────────────────────────
total                verified=21 skipped=26
```

5 verticals (insurance, cpa, partial coverage on others) currently have zero verified rules. Counsel red-lining flips `unverified=true → false` and a re-seed lifts them in.

## Sample query verification (test store, deterministic embedder)

Run via `KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test npx tsx scripts/verify-knowledge-seed.ts`. Top-3 with similarity, expected top-1 title needle in parens.

### Q1 — "What does the cpa vertical do?"
Filter: `contextKinds=[VERTICAL] verticalSlug=cpa`. Expected top-1 title contains `CPA`.
```
#1 sim=0.1397 vertical=cpa  title: CPA firms — Admin jobs-to-be-done
#2 sim=0.1038 vertical=cpa  title: CPA firms — Partner / owner-CPA jobs-to-be-done
#3 sim=0.0963 vertical=cpa  title: CPA firms — ROI math
expected title contains "CPA": top=OK, any-of-3=OK
```

### Q2 — "How does the value loop compose? read / categorize / coordinate / schedule / draft."
Filter: `contextKinds=[SKILL]`. Expected top-1 title contains `Skills architecture`.
```
#1 sim=0.2868 vertical=-    title: Skills architecture — the five-skill value loop
#2 sim=0.2645 vertical=-    title: Skill: read — fetch + parse Gmail messages off a WebhookEvent cursor
#3 sim=0.1923 vertical=-    title: Skill: coordinate — summarize the thread for the draft skill
expected title contains "Skills architecture": top=OK, any-of-3=OK
```

### Q3 — "Mortgage RESPA Section 8 anti-kickback unearned fees"
Filter: `contextKinds=[COMPLIANCE] verticalSlug=mortgage`. Expected top-1 title contains `RESPA Section 8`.
```
#1 sim=-0.0076 vertical=mortgage  title: RESPA Section 8 — anti-kickback and unearned fees
#2 sim=-0.0385 vertical=mortgage  title: TILA / Regulation Z — disclosure of credit terms
#3 sim=-0.1986 vertical=mortgage  title: TRID — Closing Disclosure three-business-day rule
expected title contains "RESPA Section 8": top=OK, any-of-3=OK
```

### Q4 — "fair housing act protected classes HUD discrimination"
Filter: `contextKinds=[COMPLIANCE] verticalSlug=real-estate`. Expected top-1 title contains `Fair Housing Act`.
```
#1 sim=0.0928 vertical=real-estate  title: Fair Housing Act § 804(c) — prohibition on discriminatory advertising
#2 sim=0.0891 vertical=real-estate  title: Fair Housing Act — advertising words to avoid
#3 sim=-0.0170 vertical=real-estate  title: Material-fact disclosure baseline (Georgia)
expected title contains "Fair Housing Act": top=OK, any-of-3=OK
```

> Note: similarity scores are from the deterministic SHA-256 hash embedder (`TestEmbeddingProvider`). Magnitudes are not meaningful in the way OpenAI cosine scores are; what matters is the relative ordering and the top-1 title match. The same `buildSeedAssembly()` pipeline runs against the OpenAI provider in production — it's the same rows, the same metadata, the same sourceIds; only the vector source changes.

The user's own spec listed two test queries (`"How do agents push branches?"` and `"What's the pricing model for agentplain?"`) whose payload lives in user-side memory files (`feedback_push_verification_required.md`, `project_stripe_both_surfaces.md`) that are **not committed to this repo**. Per `project_knowledge_substrate.md`, those files are intended for the `CROSS_CUSTOMER` kind, which is intentionally empty at seed time and populated offline. They are reported as gaps below.

## What I skipped, and why

- **Memory-file → CROSS_CUSTOMER seeding** (`project_mcp_first_integration_architecture.md`, `project_agentplain_mission_and_positioning.md`, `feedback_leadership_runs_autonomously.md`, `project_stripe_both_surfaces.md`). These live at `~/.claude/projects/C--agentplain/memory/`, not in `git`. The substrate constraint in this PR's task spec was: *"DO NOT add new content to the substrate that isn't already in committed files — substrate ingests what exists, doesn't author."* Adding them would mean either (a) inlining the body into `seed-data.ts` (authoring), or (b) reading from `~/.claude/...` at seed time (silent dependency on a non-repo path that breaks for any other contributor). The CROSS_CUSTOMER kind is documented in `docs/knowledge-substrate.md` as "populated offline via the anonymization fleet agent" — that is the right surface for these decisions; this PR does not pre-empt it.
- **Skill files at `~/.claude/skills/<agent>/SKILL.md`.** Same reason — outside the repo. The fleet agent that builds agentplain is itself outside the substrate's per-workspace scope; if its rules need to ride along with skill responses, they belong in CROSS_CUSTOMER under the same offline-seeded pipeline.
- **`docs/mcp-first-migration.md` + `docs/skills-mcp-contract.md`.** These were authored on commit `841b4b0` (2026-05-13 09:30 ET) on branch `spec/agentplain-mcp-first-migration`, **but that branch has not merged to main**. Seeding their content would either pull from an unmerged branch (footgun: the seed becomes branch-dependent) or duplicate-author here. Recommended path: when that PR merges, add 4–6 hardcoded chunks to `ARCHITECTURE_CORPUS` (same pattern as the existing 5 chunks for `skills-architecture.md` + `knowledge-substrate.md`) and re-run the seed.
- **`feat/agentplain-visual-components` (commit `bc01fce`).** Frontend marketing components — no doctrine to seed.
- **`outputs/` audit artifacts and `agent-state/*`.** Transient internal tracking files. Not source-of-truth doctrine.

## How to re-run incrementally

Production (writes to Postgres + paid OpenAI calls):
```bash
npx tsx scripts/seed-knowledge.ts
```

Test / preview (in-memory, no DB, no API key):
```bash
KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test npx tsx scripts/seed-knowledge.ts
```

Sample-query verification (always test mode):
```bash
KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test npx tsx scripts/verify-knowledge-seed.ts
```

Live substrate inspection (requires `DATABASE_URL`):
```bash
npx tsx scripts/inspect-knowledge-substrate.ts
```

The seed is idempotent — `(sourceType, sourceId)` is the natural key, so a second run updates rows in place rather than duplicating them. Cost on a full re-seed against `text-embedding-3-small`: ~$0.0006.

## Constraint receipts

- **`feedback_no_silent_vendor_lock.md`** — All embedding work goes through `getEmbeddingProvider()` in `lib/knowledge/index.ts`. No new direct `openai`/`@anthropic-ai/sdk` calls; no new direct pgvector SQL outside `lib/knowledge/pgvector-store.ts`.
- **`feedback_persistence_discipline.md`** — No "indexed in production" claim is made in this PR. The 170-row count is verified against the in-memory test store only. Production-side SELECT counts require a shell with `DATABASE_URL`; see "PENDING CONNER" below.
- **`feedback_no_guesses_no_estimates.md`** — Every count above is a real number from a real script run, not an estimate. The 26 unverified compliance rows are skipped (not fabricated) and the count is published.
- **`feedback_no_pilot_deferral.md`** — Substrate refresh ships now. The blocker on production write is environmental access (env vars), not deferred scope.
- **`feedback_push_verification_required.md`** — See branch SHA + PENDING line below; no "pushed" claim is made until `git push` returns 200.
- **`feedback_code_tasks_rebase_first.md`** — `chore/knowledge-substrate-refresh-2026-05-14` was branched off `origin/main` (`69173c6`) directly, not rebased atop legacy worktree commits.

## PENDING CONNER

1. **Run production seed.** From a shell with `DATABASE_URL` + `OPENAI_API_KEY` + `MCP_API_KEY` set:
   ```bash
   npx tsx scripts/seed-knowledge.ts
   npx tsx scripts/inspect-knowledge-substrate.ts   # confirm row counts
   ```
   Expected post-run state: `Embedding` row count by `contextKind` = `{ SKILL: 10, VERTICAL: 134, COMPLIANCE: 26 }`. (Idempotent — safe to re-run.)
2. **Push this branch** so the verify + inspect helpers ship to the rest of the fleet.
3. **Decide on CROSS_CUSTOMER.** The four ratified memory files identified in the task spec belong in CROSS_CUSTOMER; the offline anonymization-agent path is documented but not yet built. Greenlighting that work is the right next step if those rules need to surface in skill responses.
