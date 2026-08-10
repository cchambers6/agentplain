# AI Headmaster POC — Repo Scaffolding (`cchambers6/ai-headmaster`)

Layout for the new repo when Conner spawns it (private — the lesson from `project_founder_credibility_surface_2026_07_08`: agentplain sat public with prospect data; this repo starts private, no exceptions).

```
ai-headmaster/
├── README.md                      # skeleton below
├── package.json                   # next, react, prisma, @anthropic-ai/sdk, zod
├── next.config.mjs
├── tsconfig.json
├── vercel.json                    # cron: headmaster Sun 18:00 + Fri 16:00 (America/New_York)
├── .env.example                   # DATABASE_URL, ANTHROPIC_API_KEY, FAMILY_PASSWORD, CRON_SECRET
├── .gitignore                     # incl. .token files, .env*
│
├── app/
│   ├── (parent)/
│   │   ├── onboarding/page.tsx    # family → children → curricula metadata → philosophy → run Integrator
│   │   ├── today/page.tsx         # morning brief + debrief chat (SSE) — THE daily surface
│   │   ├── week/page.tsx          # current WeeklyPlan; disruption-replan button
│   │   ├── reports/page.tsx       # Friday reports + child model view (parent-readable)
│   │   └── records/page.tsx       # compliance records + export download
│   ├── api/
│   │   ├── agents/integrator/route.ts
│   │   ├── agents/tutor/route.ts          # GET brief (lazy) · POST debrief turn (SSE)
│   │   ├── agents/tutor/close/route.ts    # close debrief → triage → extraction → registrar txn
│   │   ├── cron/headmaster/route.ts       # guarded by CRON_SECRET
│   │   └── registrar/export/route.ts
│   └── layout.tsx
│
├── lib/
│   ├── llm/                       # PORTED: agentplain compose order (project_llm_provider_compose_order)
│   │   ├── provider.ts            # Logging(Budget(Sentinel(Caching(Anthropic))))
│   │   ├── budget.ts              # per-family gate; NO_CAP when unset (PR #146 seam)
│   │   ├── sentinel.ts            # content-leak / vendor-name / child-address scans (doc 03 §5)
│   │   ├── caching.ts             # cache_control placement per agent (doc 06)
│   │   └── prices.ts              # model price table — the ONLY file naming models
│   ├── agents/
│   │   ├── integrator/{context,run,validate}.ts
│   │   ├── headmaster/{context,weekly,friday,disruption}.ts
│   │   ├── tutor/{brief,debrief,triage,extract}.ts
│   │   └── registrar/{rules,edge-case,export}.ts
│   ├── philosophy-packs/
│   │   ├── types.ts               # PhilosophyPack interface — the swappability seam
│   │   ├── charlotte-mason.ts     # v0 pack: rhythm rules, lesson-length caps, subject-variety rules
│   │   └── index.ts               # keyed registry; Family.philosophyKey selects
│   └── db.ts                      # prisma client + SET LOCAL app.family_id per request
│
├── prisma/
│   ├── schema.prisma              # doc 02
│   ├── migrations/                # 0001_init, 0002_rls (raw SQL + drift-baseline entry)
│   └── seed-demo.ts               # synthetic family below
├── scripts/
│   ├── reset-demo.mjs             # wipe + reseed (agentplain PR #377 pattern)
│   ├── prisma-migrate-gate.mjs    # PORTED: migrate only when VERCEL_ENV=production (PR #307)
│   └── git/                       # fleet credential helper, agentplain pattern — see note below
│
├── tools/gates/
│   ├── voice-gate.mjs             # LIFTED from agentplain tools/brand/voice-gate.mjs; scans
│   │                              #   app/(parent)/** strings + lib/agents/** prompt files for
│   │                              #   LLM-ese A–D AND vendor names (rule 2 folded into the gate)
│   ├── voice-gate-allow.json
│   ├── content-gate.mjs           # NEW, this product's brand-gate analog: greps schema +
│   │                              #   fixtures for curriculum-content columns/blobs; fails CI
│   │                              #   if anything content-shaped lands in the repo
│   └── (brand-gate deferred — no visual brand yet; add with the brand decision, and keep
│        gate + tokens in lockstep per project_heritage_rollout_2026_06_22 when it lands)
│
├── .github/workflows/
│   ├── ci.yml                     # typecheck, test, prisma validate, voice-gate, content-gate,
│   │                              #   RLS smoke test (docker postgres service)
│   └── schema-drift.yml           # agentplain scripts/check-schema-drift.ts pattern
│
└── tests/
    ├── rls.smoke.test.ts
    ├── registrar.golden.test.ts   # hand-computed golden compliance set
    ├── sentinel.leak.test.ts      # seeded content-leak fixture must be blocked
    └── traceability.test.ts       # doc 02 acceptance-#3 query over seeded data
```

**Fleet push note:** the brief names `scripts/mint-fleet-token.mjs`, but agentplain memory records that file as a ghost (`project_case_study_framework_2026_07_08`) — the real minter is `.get-token.mjs` at the repo root calling `scripts/git/agentplain-fleet-credential-helper.ts`. The new repo gets the same *working* pattern with an honest name: `scripts/git/fleet-credential-helper.ts` + root `.get-token.mjs` (output-file arg, never stdout). Requires the GitHub App installation to be extended to the new repo (doc 09). Push auth uses the `x-access-token:<token>@github.com` URL form (`project_de_ai_2_visual_system_2026_06_19` recipe).

## Seed data (`prisma/seed-demo.ts`)

Synthetic family, no real-family PII in the repo:

- **Family:** "The Harper Family (Demo)", Marietta GA, school days Mon–Thu, `charlotte-mason`.
- **Child:** "June", born 2020 (age 6), grammar stage. Seed `Child.model`: `{ modalities: {strong: "read-aloud/narration"}, strengths: ["retells stories in detail"], struggles: [{area: "number bonds past 10", since: "2026-06"}], pacing: {math: "behind", "language-arts": "ahead"}, interests: ["birds", "baking"] }` — seeded rich so demo plans visibly use it.
- **Curricula (3, metadata only — titles + unit labels + counts, no content):** placeholders `"Demo Math 1"`, `"Demo Language Arts 1"`, `"Demo Nature Study"` with realistic unit tables (e.g. Demo Math 1: 12 units × 10 lessons × 15 min, skill tags, 3 prerequisite edges). **Real curriculum titles go in only after Conner's decision #2** — and even then only ToC metadata, which keeps the seed on the right side of the core rule. (Truth Wave: the demo is *labeled* demo, mirroring agentplain's `isDemo` guard discipline from PR #377.)
- **Two seeded weeks of history:** WeeklyPlan + DailyLogs + 4 ChildModelUpdates with evidence strings, so `/reports`, the Friday report, and the traceability test have data on first boot.

## README.md skeleton

```markdown
# AI Headmaster

An orchestration layer — a headmaster + tutor-advisor — that sits on top of the
classical curricula a homeschool family already owns, blends them into one
coherent plan, runs a short daily loop with the parent, builds a longitudinal
model of each child, and quietly produces state compliance records as a
byproduct.

## The two rules (read before writing any code)
1. **It is not a curriculum.** It never reproduces, replaces, or reveals
   curriculum content. It plans around materials the family owns — by
   reference only. The schema has no column for lesson content; the CI
   content-gate keeps it that way.
2. **It serves the parent-teacher, never the child.** No child-facing
   interaction exists in this codebase.

## Architecture
Four agents over one shared Postgres memory: Integrator (onboarding),
Headmaster (weekly), Tutor-Advisor (daily), Registrar (compliance).
See docs/ (mirrored from agentplain docs/products/ai-headmaster/2026-07-10-poc-plan/).

## Run it
1. `cp .env.example .env` and fill DATABASE_URL, ANTHROPIC_API_KEY,
   FAMILY_PASSWORD, CRON_SECRET
2. `npm install && npx prisma migrate dev && npx tsx prisma/seed-demo.ts`
3. `npm run dev` → http://localhost:3000 → sign in → /today
4. Reset the demo family anytime: `node scripts/reset-demo.mjs`

## Gates (CI enforces all of these)
typecheck · tests · RLS smoke · voice-gate (parent-surface language,
vendor invisibility) · content-gate (no curriculum content in the repo)
```
