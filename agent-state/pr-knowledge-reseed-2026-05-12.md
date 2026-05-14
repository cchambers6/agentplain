# PR description — feat(knowledge): re-seed substrate with compliance corpus + jtbd synthesis + arch docs

Branch: `feat/agentplain-knowledge-reseed-2026-05-12`
Open: https://github.com/cchambers6/agentplain/pull/new/feat/agentplain-knowledge-reseed-2026-05-12

---

## Summary

Re-seed `lib/knowledge/seed-data.ts` with the content from today's three landed PRs (compliance corpus drafts, vertical JTBD tables, knowledge substrate). Substrate grows from **89 → 170 docs** (1.9x) without touching either source corpus.

## What changed by bucket

| Bucket       | Before | After | Delta | What's new |
|---|---|---|---|---|
| SKILL        | 5      | 10    | +5    | 5 architecture-doc chunks from `docs/skills-architecture.md` + `docs/knowledge-substrate.md` |
| VERTICAL     | 79     | 134   | +55   | Per-role JTBD synthesis rows joining JTBD + claims + integrations + value-loop example |
| COMPLIANCE   | 5      | 26    | +21   | Verified rules iterated from `lib/agents/sentinel/corpus/<vertical>/` |
| CUSTOMER     | 0      | 0     | —     | Intentional — fills on tool connect |
| CROSS_CUSTOMER | 0    | 0     | —     | Intentional — fills offline via anonymization agent |
| **Total**    | **89** | **170** | **+81** | |

## Compliance corpus — verified vs skipped

Per `feedback_no_guesses_no_estimates.md`, entries flagged `unverified: true` (literal text under `[UNVERIFIED — needs counsel]`) are intentionally **SKIPPED** from seed. Counsel red-line flips the flag and a re-seed picks them up.

| Vertical            | Verified | Skipped (unverified) |
|---|---|---|
| real-estate         | 1 | 0 |
| mortgage            | 3 | 2 |
| insurance           | 0 | 4 |
| property-management | 1 | 3 |
| title-escrow        | 2 | 2 |
| recruiting          | 5 | 1 |
| home-services       | 1 | 3 |
| cpa                 | 0 | 6 |
| law                 | 6 | 1 |
| ria                 | 2 | 4 |
| **total**           | **21** | **26** |

Five verticals currently have zero verified rules (insurance, cpa, plus partial coverage on others). Counsel review unlocks the rest.

## Sample query output (TestKnowledgeStore + deterministic embedder)

```
'CPA tax-preparer JTBD' query        → jtbd:cpa:staff-accountant-tax-preparer
                                       (title: "Staff accountant / tax preparer in CPA firms")
'mortgage RESPA section 8' query     → mortgage:respa-section-8-anti-kickback
                                       (title: "RESPA Section 8 — anti-kickback and unearned fees")
'how to call the substrate' query    → architecture:knowledge-substrate:context-kinds
                                       (title: "Knowledge substrate — the five context kinds + RLS rules")
vertical-scoped (verticalSlug=cpa)    → only verticalSlug=cpa hits, no real-estate bleed
workspace RLS                         → WS_CPA cannot see WS_REALTY CUSTOMER rows (cross-workspace isolated)
```

All assertions pass in `tests/knowledge-substrate-reseed.test.ts` (10 new tests).

## Constraint receipts

- **`feedback_no_quick_fixes.md`** — Every seed entry is REAL content from shipped source files, not placeholder. Source path cited in `metadata.source` for traceability.
- **`feedback_no_guesses_no_estimates.md`** — 26 unverified entries skipped (count published above). The spec's referenced `docs/mcp-first-migration.md` does not exist in this repo; I seeded from the actual shipped artifacts (`docs/skills-architecture.md`, `docs/knowledge-substrate.md`) rather than fabricate content.
- **`feedback_no_silent_vendor_lock.md`** — Seed code stays inside `lib/knowledge/`; no direct OpenAI / pgvector calls outside the existing adapters.
- **Source files NOT modified** — `lib/agents/sentinel/corpus/` and `lib/verticals/<slug>/content.ts` are read through their existing loaders (`loadCorpusFor`, `getAllVerticals`).
- **Idempotent** — Re-seed updates rows in place via `(sourceType, sourceId)` natural key.

## Env vars Conner needs

- **`OPENAI_API_KEY`** — required in Vercel env for production embeddings (`text-embedding-3-small`, $0.02 per 1M tokens; ~$0.0006 per full re-seed at current corpus size).
- When unset, `lib/knowledge/index.ts` falls back to the deterministic test embedder so dev / preview environments stay functional.
- `KNOWLEDGE_STORE` defaults to `pgvector`; set to `test` for in-memory dev.

## Test plan

- [x] `npm run typecheck` clean
- [x] `npm run lint` clean
- [x] `npm test` — all 1629 tests pass (10 new in `knowledge-substrate-reseed.test.ts`)
- [x] `npm run build:no-migrate` clean
- [x] `KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test npx tsx scripts/seed-knowledge.ts` — 170 rows created, 0 failures
- [ ] **After merge:** Conner sets `OPENAI_API_KEY` in Vercel env, then runs the production seed via the cron path (or one-shot `npx tsx scripts/seed-knowledge.ts` against the prod DB).
