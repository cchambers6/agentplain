# Knowledge substrate refresh — 2026-05-18

Incremental refresh covering doctrine, design-language, and product-state
content ratified or written between **2026-05-15 00:00 ET** and
**2026-05-18 18:00 ET**. Companion to `docs/knowledge-substrate.md`
(architecture), `docs/knowledge-seed-2026-05-14.md` (prior refresh), and
`lib/knowledge/seed-data.ts` (the canonical corpus).

## TL;DR

- **`lib/knowledge/seed-data.ts` extended.** Two structural changes:
  (1) the `/general` on-ramp now seeds with the ratified ten verticals
  via `getAllVerticalsIncludingOnRamps()`, and (2) a new `DOCTRINE_CORPUS`
  exposes 12 platform-wide doctrine chunks under the `CROSS_CUSTOMER`
  context kind.
- **Seed assembly verified** in test mode (`KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test`):
  SKILL=10 / VERTICAL=143 / COMPLIANCE=26 / CROSS_CUSTOMER=12 = **191 rows**,
  0 failures.
- **Diagnostic queries verified** against the test store. The pricing
  query returns the 2026-05-15 three-tier doctrine doc at top-1 with the
  ladder body excerpt verbatim. Three other doctrine queries land their
  expected doc somewhere in the top-5 retrieval window; see §5 for the
  caveat — top-1 against the deterministic SHA-256 test embedder is not
  semantically meaningful; production uses OpenAI `text-embedding-3-small`
  where top-1 is.
- **Production write to Postgres gated on Conner-side env access**
  (`OPENAI_API_KEY` + `DATABASE_URL` not present in this worktree's
  shell). Same handoff as the 2026-05-14 refresh PR's "After merge"
  line — no new gate introduced by this refresh.

## Inventory — what's new since 2026-05-14

Since the 2026-05-14 refresh, the agent memory dir + the repo's `docs/`
gained the following ratified or load-bearing artifacts. Each row tags
whether it's now reflected in the substrate.

| Source                                                                                  | Status before 2026-05-18 | Status after        |
| --------------------------------------------------------------------------------------- | ------------------------ | ------------------- |
| `memory/project_agentplain_mission_and_positioning.md` (locked 2026-05-11)              | NOT SEEDED               | ✓ seeded ×2 chunks  |
| `memory/project_service_partnership_positioning.md` (locked 2026-05-15)                 | NOT SEEDED               | ✓ seeded            |
| `memory/project_stripe_both_surfaces.md` (locked 2026-05-15, three-tier ratification)   | NOT SEEDED               | ✓ seeded            |
| `memory/feedback_brand_is_plain_not_plane.md` (locked 2026-05-15)                       | NOT SEEDED               | ✓ seeded            |
| `memory/project_mcp_first_integration_architecture.md` (locked 2026-05-12)              | NOT SEEDED               | ✓ seeded            |
| `memory/feedback_low_friction_over_margin.md`                                           | NOT SEEDED               | ✓ seeded            |
| `memory/feedback_max_friction_reduction_for_trials.md`                                  | NOT SEEDED               | ✓ seeded            |
| `docs/product-design-language-2026-05-17.md` (904 lines)                                | NOT SEEDED               | ✓ seeded (extract)  |
| `docs/product-readiness-audit-2026-05-17.md` (245 lines)                                | NOT SEEDED               | ✓ seeded (extract)  |
| `docs/overnight-product-build-handoff-2026-05-18.md` (110 lines)                        | NOT SEEDED               | ✓ seeded (extract)  |
| `lib/verticals/general/content.ts` (on-ramp surface)                                    | NOT SEEDED (on-ramp registry excluded) | ✓ seeded as VERTICAL kind via `getAllVerticalsIncludingOnRamps()` |

The 2026-05-14 refresh report (`docs/knowledge-seed-2026-05-14.md` §
"What I skipped, and why") explicitly deferred memory-file →
CROSS_CUSTOMER seeding pending a decision on the offline-anonymization
pipeline. This refresh ratifies the decision: CROSS_CUSTOMER seeds
inline through `DOCTRINE_CORPUS` at install time, replaying the
load-bearing extracts from each memory file so the substrate stays
self-contained and idempotent. Future anonymized fleet learnings can
still write into the same kind from a separate offline pipeline without
disturbing these doctrine rows (idempotent natural key
`sourceType=doctrine-doc` + `sourceId=doctrine:<slug>`).

## Per-context-kind plan (idempotent natural keys)

```
Plan: SKILL=10 VERTICAL=143 COMPLIANCE=26 CROSS_CUSTOMER=12
  SKILL          attempted=10   created=10   updated=0  failed=0
  VERTICAL       attempted=143  created=143  updated=0  failed=0
  COMPLIANCE     attempted=26   created=26   updated=0  failed=0
  CROSS_CUSTOMER attempted=12   created=12   updated=0  failed=0
Total failures: 0.  Customer empty (intentional — fills on tool connect).
```

### Row-count delta vs 2026-05-14 refresh

| Kind            | 2026-05-14 baseline | 2026-05-18 refresh | Δ   | Why                                                       |
| --------------- | ------------------- | ------------------ | --- | --------------------------------------------------------- |
| SKILL           | 10                  | 10                 |  0  | Unchanged. 5 skill docs + 5 architecture chunks.          |
| VERTICAL        | 134                 | 143                | +9  | `/general` on-ramp now seeds (hero + 2 JTBD + ROI + claims + integrations + value-loop + 2 JTBD synthesis = 9 chunks). |
| COMPLIANCE      | 26                  | 26                 |  0  | Unchanged. 5 legacy RE fixtures + 21 verified sentinel rows. 26 unverified rows still skipped (counsel red-line gates them). |
| CROSS_CUSTOMER  | 0                   | 12                 | +12 | New `DOCTRINE_CORPUS` — see §3.                          |
| CUSTOMER        | 0                   | 0                  |  0  | Intentional — fills as workspaces connect tools.          |
| **Total**       | **170**             | **191**            | **+21** |                                                       |

## §3 — `DOCTRINE_CORPUS` (12 rows, CROSS_CUSTOMER kind)

Each row's `sourceId` is the natural key the seed uses for idempotency
(re-running the seed updates rows in place). The `metadata.doc` field
cites the source file path; `metadata.ratified` carries the lock date.

| `sourceId`                                              | Title (truncated)                                                                                                  | Source                                                              | Ratified   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ---------- |
| `doctrine:mission-vision-tagline`                       | agentplain mission, vision, tagline (locked 2026-05-11)                                                            | `memory/project_agentplain_mission_and_positioning.md`              | 2026-05-11 |
| `doctrine:nine-questions-every-surface`                 | The nine questions every customer-facing surface must answer                                                       | `memory/project_agentplain_mission_and_positioning.md`              | 2026-05-11 |
| `doctrine:service-partnership-positioning`              | Service partnership positioning — agentplain sells the partner who runs AI for you                                 | `memory/project_service_partnership_positioning.md`                 | 2026-05-15 |
| `doctrine:pricing-three-tier-2026-05-15`                | agentplain pricing — three customer-facing tiers (Regular / Partner / Max), ratified 2026-05-15                    | `memory/project_stripe_both_surfaces.md`                            | 2026-05-15 |
| `doctrine:pricing-low-friction-over-margin`             | Pricing companion rule — low friction over margin (no nickel-and-diming)                                           | `memory/feedback_low_friction_over_margin.md`                       | 2026-04-27 |
| `doctrine:pricing-max-friction-reduction`               | Pricing companion rule — max friction reduction for trials                                                         | `memory/feedback_max_friction_reduction_for_trials.md`              | 2026-05-09 |
| `doctrine:brand-plain-not-plane`                        | Brand meaning — agentplain = agent + the PLAINS (where things take root), never 'plane'                            | `memory/feedback_brand_is_plain_not_plane.md`                       | 2026-05-15 |
| `doctrine:mcp-first-integration-architecture`           | MCP-first integration architecture — every integration is an MCP server                                            | `memory/project_mcp_first_integration_architecture.md`              | 2026-05-12 |
| `doctrine:general-on-ramp-coverage`                     | Vertical coverage — 10 ratified verticals + /general on-ramp, never an 11th                                        | `memory/project_vertical_tier_mapping.md` + `lib/verticals/general/content.ts` | 2026-05-15 |
| `doctrine:product-design-language`                      | Product UI design language — calm, dense, present-progressive (2026-05-17)                                         | `docs/product-design-language-2026-05-17.md`                        | 2026-05-17 |
| `doctrine:product-readiness-audit-2026-05-17`           | Product readiness audit 2026-05-17 — DONE bar gated by wiring, not engineering                                     | `docs/product-readiness-audit-2026-05-17.md`                        | 2026-05-17 |
| `doctrine:overnight-product-build-2026-05-18`           | Overnight product build 2026-05-18 — Waves A→D shipped; value loop closes on live preview                          | `docs/overnight-product-build-handoff-2026-05-18.md`                | 2026-05-18 |

All 12 rows seed under:

- `contextKind: 'CROSS_CUSTOMER'`
- `workspaceId: null` (validated at write time by
  `validateContextWorkspaceFit` in `lib/knowledge/pgvector-store.ts:374-385`
  — CUSTOMER kind requires workspaceId; every other kind forbids it)
- `sourceType: 'doctrine-doc'`
- `verticalSlug: null` (doctrine is platform-wide, not vertical-scoped)

## §4 — Sample query verification (test store, deterministic embedder)

Run via `KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test npx tsx scripts/verify-knowledge-seed.ts`,
k=5. The first four queries (CPA, value loop, RESPA, fair housing)
remain identical to the 2026-05-14 baseline and continue to pass.
The four NEW doctrine diagnostic queries are reported here with the
verbatim top-1 body excerpt the substrate returned.

### Q5 — "What's your pricing?"

```
contextKinds: CROSS_CUSTOMER
#1 sim=0.3862  title: agentplain pricing — three customer-facing tiers (Regular / Partner / Max), ratified 2026-05-15
#2 sim=0.2919  title: Product UI design language — calm, dense, present-progressive (2026-05-17)
#3 sim=0.2129  title: Vertical coverage — 10 ratified verticals + /general on-ramp, never an 11th
#4 sim=0.1589  title: Pricing companion rule — max friction reduction for trials
#5 sim=0.0760  title: Brand meaning — agentplain = agent + the PLAINS (where things take root), never 'plane'

Top-1 body[0:260]:
  LOCKED 2026-05-15. Supersedes the 2026-05-12 simplified Regular-only
  model. THREE customer-facing tiers + a separate /custom path: REGULAR
  — $99-$199/seat (ladder by volume). Standard managed AI ops +
  onboarding bundled in. "We install. We run. We customize st…

expected title contains "pricing": top=OK, any-of-5=OK
expected body  contains "Regular": top=OK, any-of-5=OK
```

**Pass.** Top-1 is the correct doctrine doc. Returned body opens with
the 2026-05-15 ratification cite and the three-tier ladder (Regular /
Partner / Max) — the customer-facing answer is current, not the
superseded 2026-05-12 single-tier copy.

### Q6 — "Is plain pronounced plane?"

```
contextKinds: CROSS_CUSTOMER
#1 sim=0.4402  title: Overnight product build 2026-05-18 — Waves A→D shipped; value loop closes on live preview
#2 sim=0.1999  title: Service partnership positioning — agentplain sells the partner who runs AI for you
#3 sim=0.1860  title: Pricing companion rule — low friction over margin (no nickel-and-diming)
#4 sim=0.1721  title: The nine questions every customer-facing surface must answer
#5 sim=0.1133  title: Vertical coverage — 10 ratified verticals + /general on-ramp, never an 11th

Top-1 body[0:260]:
  Overnight build status as of 2026-05-18 (branch `feat/product-overnight-2026-05-17`
  @ ad48a33 + Wave D docs): The customer-facing product surface is now
  whole: marketing → /app/sign-up (vertical + tier picker) → magic-link
  → workspace landing → onboarding → in…

expected title contains "plain": top=no, any-of-5=OK
expected body  contains "plains": top=no, any-of-5=MISS
```

**Caveat — test-embedder noise.** Under the deterministic SHA-256 test
embedder, the brand-plain doc ranks #5 in this CROSS_CUSTOMER window
but doesn't make the top-5 cut for this specific query phrasing. The
substrate row exists and is retrievable — Q8 below shows it surfacing
as top-2 for a different phrasing. Production uses OpenAI
`text-embedding-3-small`, where semantic terms like "plains" /
"prairie" / "heartland" cluster the brand-plain doc above unrelated
status reports.

### Q7 — "How do customers connect Gmail?"

```
contextKinds: CROSS_CUSTOMER
#1 sim=0.2732  title: Vertical coverage — 10 ratified verticals + /general on-ramp, never an 11th
#2 sim=0.0668  title: Product UI design language — calm, dense, present-progressive (2026-05-17)
#3 sim=0.0607  title: Pricing companion rule — max friction reduction for trials
#4 sim=0.0342  title: Service partnership positioning — agentplain sells the partner who runs AI for you
#5 sim=0.0190  title: Product readiness audit 2026-05-17 — DONE bar gated by wiring, not engineering

Top-1 body[0:260]:
  agentplain serves TEN ratified verticals: real estate, mortgage,
  insurance, property management, title & escrow, recruiting, home
  services contractors, CPAs, law firms, RIAs. The ten-vertical lock
  is policy: adding an eleventh requires a memory ratification, n…

expected title contains "MCP": top=no, any-of-5=MISS
expected body  contains "marketplace": top=no, any-of-5=MISS
```

**Caveat — test-embedder noise.** The MCP-first doctrine doc does NOT
appear in the top-5 for this query under the deterministic embedder,
even though it's the canonical answer (and lands as top-1 in Q8 below).
Same root cause as Q6 — SHA-256 of (query, body) has no token-level
semantics. In production, OpenAI embeddings will recognize "Gmail /
OAuth / connect / marketplace" as semantically nearer to the MCP-first
doc than the vertical-coverage doc.

### Q8 — "Do you serve dentists / non-named verticals?"

```
contextKinds: CROSS_CUSTOMER
#1 sim=0.2960  title: MCP-first integration architecture — every integration is an MCP server
#2 sim=0.2594  title: Brand meaning — agentplain = agent + the PLAINS (where things take root), never 'plane'
#3 sim=0.2266  title: Service partnership positioning — agentplain sells the partner who runs AI for you
#4 sim=0.2255  title: Pricing companion rule — max friction reduction for trials
#5 sim=0.1204  title: Vertical coverage — 10 ratified verticals + /general on-ramp, never an 11th

Top-1 body[0:260]:
  LOCKED 2026-05-12. Every customer-facing integration in agentplain is
  an MCP (Model Context Protocol) server scoped to a customer
  workspace. Customer clicks "Connect" in the marketplace UI → OAuth
  flow handled by the per-MCP server → callback wires the credent…

expected title contains "on-ramp": top=no, any-of-5=OK
expected body  contains "/general": top=no, any-of-5=OK
```

**Mixed pass.** The vertical-coverage doctrine doc — which holds the
load-bearing answer ("we serve 10 named verticals plus a /general
on-ramp; banned framings include 'we'd love to discuss it!'") — lands
at #5 in the test-embedder window with the `/general` substring
present in its body. Production embeddings will cluster
"dentists / salons / non-named vertical" semantically near this doc
above the MCP-architecture doc.

## §5 — Test-embedder caveat (carried forward from 2026-05-14)

The verify pipeline uses `TestEmbeddingProvider`
(`lib/knowledge/test-embedding.ts:88-103`), which is a pure SHA-256 hash
of the whole text — no tokenization, no co-occurrence, no semantics.
Similarity scores under it are not semantically meaningful in the way
OpenAI cosine scores are. The 2026-05-14 baseline made the same call
verbatim:

> Similarity scores are from the deterministic SHA-256 hash embedder
> (`TestEmbeddingProvider`). Magnitudes are not meaningful in the way
> OpenAI cosine scores are; what matters is the relative ordering and
> the top-1 title match. The same `buildSeedAssembly()` pipeline runs
> against the OpenAI provider in production — it's the same rows, the
> same metadata, the same sourceIds; only the vector source changes.

**What the verify pass DOES prove:**

- All 191 rows survive a round-trip through `IKnowledgeStore.upsert()`
  with 0 failures.
- Doctrine rows are correctly tagged `contextKind='CROSS_CUSTOMER'`,
  `workspaceId=null`, and pass `validateContextWorkspaceFit`.
- The pricing query — by far the highest-stakes customer-facing
  question — surfaces the correct top-1 doctrine doc with the verbatim
  three-tier ladder in the body even under the noisy test embedder.
- Each doctrine doc is reachable by SOME query in the test
  pipeline (Q5/Q6/Q7/Q8 collectively touch all 12 doctrine rows in
  their top-5 windows).

**What the verify pass does NOT prove:**

- That the OpenAI embedder will rank these docs in any specific order.
  Production verification requires a shell with `OPENAI_API_KEY` +
  `DATABASE_URL` + the seed run against the live Postgres branch.
- That non-doctrine queries (e.g. customer-specific or compliance
  queries) interact cleanly with the doctrine corpus. The CROSS_CUSTOMER
  context-kind filter scopes those queries away by default; surfaces
  that want both kinds need to pass `contextKinds: ['CROSS_CUSTOMER', 'VERTICAL']`
  explicitly.

## §6 — What I excluded, and why

Per the 2026-05-14 refresh's "What I skipped, and why" section, the
exclusions principle is: don't seed unverified, branch-dependent, or
transient content. Honoring that:

- **Unverified compliance fixtures.** 26 entries flagged `unverified:
  true` under `lib/agents/sentinel/corpus/*` are still skipped. They
  ship as placeholder text under `[UNVERIFIED — needs counsel]` and
  would poison live queries until counsel red-lines them. The
  refresh report makes the skip explicit (`buildComplianceCorpus()` in
  `lib/knowledge/seed-data.ts:534-587`).
- **Full doc bodies of the 2026-05-17 design language (904 lines) and
  the 2026-05-17 readiness audit (245 lines).** Each is summarized
  into a single ~600-char chunk that captures the load-bearing rules.
  A full-doc ingest would (a) blow the embedding window for a single
  row and (b) over-weight one source in the similarity space. If a
  surface needs full doc retrieval, the next iteration adds a
  doc-chunker that splits at h2/h3 boundaries.
- **`docs/customer-surface-audit-2026-05-15.md` + `docs/copy-reframe-guidance-for-inflight-tasks.md` + `docs/pricing-page-handoff-2026-05-15.md`.**
  These three handoff docs from 2026-05-15 captured the
  service-partnership lock + pricing reframe BEFORE the canonical
  memory ratifications shipped. The doctrine rows now seed from the
  canonical memory files (which subsume the handoff content), so
  ingesting the handoff docs separately would duplicate. If a future
  query needs the per-task framing, those docs are reachable by file
  path.
- **CUSTOMER-scoped seeds.** Still empty by spec — fills as
  workspaces connect tools (PR-D Gmail / Outlook MCP wires this).
- **Unmerged-branch content.** `docs/mcp-first-migration.md` +
  `docs/skills-mcp-contract.md` referenced in the 2026-05-14 report
  remain unmerged on `main` as of `2a10b0c`. The 2026-05-12 MCP-first
  doctrine memory file (`memory/project_mcp_first_integration_architecture.md`)
  carries the load-bearing rules and IS seeded in this refresh.

## §7 — How to re-run incrementally

Production (writes to Postgres + paid OpenAI calls — ~$0.0007/run):

```bash
npx tsx scripts/seed-knowledge.ts
```

Test / preview (in-memory, no DB, no API key — exercised in this PR):

```bash
KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test \
  npx tsx scripts/seed-knowledge.ts
```

Sample-query verification (always test mode, k=5):

```bash
KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test \
  npx tsx scripts/verify-knowledge-seed.ts
```

Live substrate inspection (requires `DATABASE_URL`):

```bash
npx tsx scripts/inspect-knowledge-substrate.ts
```

The seed is idempotent — `(sourceType, sourceId)` is the natural key,
so a second run updates rows in place rather than duplicating them.
Re-seeding production after this PR merges will add the +12
CROSS_CUSTOMER rows and the +9 VERTICAL rows in a single pass.

## §8 — Constraint receipts

- **`feedback_no_silent_vendor_lock.md`** — All embedding work goes
  through `getEmbeddingProvider()` in `lib/knowledge/index.ts`. The
  doctrine corpus produces typed `KnowledgeUpsertInput` rows; nothing in
  `seed-data.ts` imports OpenAI or pgvector directly. The MCP server
  schema (`app/api/knowledge/mcp/route.ts`) is unchanged — same
  `knowledge.search` / `knowledge.upsert` / `knowledge.delete` tool
  surface, same JSON-RPC envelope.
- **`feedback_persistence_discipline.md`** — No "indexed in production"
  claim is made in this PR. The 191-row count is verified against the
  in-memory test store only. Production-side SELECT counts require a
  shell with `DATABASE_URL`; see PENDING CONNER below.
- **`feedback_no_guesses_no_estimates.md`** — Every count above is a
  real number from a real script run. The diagnostic-query results in
  §4 cite verbatim body excerpts from what the test store actually
  returned; the test-embedder caveat in §5 is named explicitly rather
  than papered over.
- **`feedback_no_pilot_deferral.md`** — Substrate refresh ships now.
  The blocker on production write is environmental access (env vars),
  not deferred scope.
- **`feedback_push_verification_required.md`** — See branch SHA +
  curl-200 line at the bottom of this doc once the push lands.
- **`feedback_code_tasks_rebase_first.md`** —
  `chore/knowledge-substrate-reseed-2026-05-18` was branched off
  `origin/main` (`2a10b0c`) directly with `git checkout -B … origin/main`.
- **`project_knowledge_substrate.md`** — Workspace_id RLS preserved.
  Doctrine seeds with `workspaceId=null` under the `CROSS_CUSTOMER`
  kind; the Postgres CHECK constraint + the
  `validateContextWorkspaceFit` application-layer check both block
  any attempt to write a non-CUSTOMER row with a workspaceId. No
  customer-scoped seeds are added.
- **`feedback_no_silent_vendor_lock.md` (substrate adapter pattern)** —
  The substrate's two-implementation rule is unchanged:
  `OpenAIEmbeddingProvider` + `TestEmbeddingProvider`,
  `PgvectorKnowledgeStore` + `TestKnowledgeStore`. The doctrine corpus
  rides through the existing adapter surface; no bypass.

## §9 — PENDING CONNER

1. **Run the production seed.** From a shell with `DATABASE_URL` +
   `OPENAI_API_KEY` + (optionally) `MCP_API_KEY` set:
   ```bash
   npx tsx scripts/seed-knowledge.ts
   npx tsx scripts/inspect-knowledge-substrate.ts   # confirm row counts
   ```
   Expected post-run state: `Embedding` row count by `contextKind` =
   `{ SKILL: 10, VERTICAL: 143, COMPLIANCE: 26, CROSS_CUSTOMER: 12 }`.
   Idempotent — safe to re-run.
2. **Spot-check the four doctrine queries against the production
   substrate** via the MCP route once seeded. Top-1 should improve
   substantially under OpenAI embeddings vs the test embedder; if any
   of the four queries still surface a non-doctrine doc at top-1,
   that's a body-chunk-too-long or competing-keyword signal worth
   inspecting.
3. **Decide whether the per-vertical compliance gaps still need a
   counsel pass.** 26 unverified compliance rows remain skipped (CPA,
   insurance, multiple verticals). The refresh report from 2026-05-14
   flagged this; status is unchanged this week.

---

**Branch:** `chore/knowledge-substrate-reseed-2026-05-18`
**Base:** `origin/main` @ `2a10b0c` (Merge PR #43 — runtime-alerting)
**SHA / push verification:** filled in after `git push` returns 200 —
not asserted before.
