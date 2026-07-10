# Chiron

Personal classical education orchestration for homeschool families — a
headmaster + tutor-advisor that sits on top of the curricula a family already
owns, blends them into one coherent plan, runs a short daily loop with the
parent, builds a longitudinal model of each child, and quietly produces state
compliance records as a byproduct.

**Proof of concept: one family per install, Charlotte Mason philosophy,
Georgia.** This is Milestone 1 (Memory + Onboarding) of the M1–M6 plan in
agentplain `docs/products/ai-headmaster/2026-07-10-poc-plan/`.

## The two rules (read before writing any code)

1. **It is not a curriculum.** It never reproduces, replaces, or reveals
   curriculum content. It plans around materials the family owns — by
   reference only. The schema has no column for lesson content
   (`Curriculum.parentNotes` holds the parent's own words, nothing else).
2. **It serves the parent-teacher, never the child.** No child-facing
   interaction exists in this codebase. Model/vendor names never appear on a
   parent-facing surface.

## Run it

1. `cp .env.example .env` and fill `DATABASE_URL`, `FAMILY_ADMIN_EMAIL`,
   `SESSION_SECRET`. The `AI_*_API_KEY` tiers are optional in M1 — the chat
   surface degrades honestly when unset.
2. `npm install`
3. `npm run catalog:build` — regenerates `lib/catalog/catalog.json` from the
   research corpus in `../docs/research/` (committed, so this is only needed
   when the research changes)
4. `npx prisma migrate dev && npm run db:seed`
5. `npm run dev` → http://localhost:3000 → sign in with `FAMILY_ADMIN_EMAIL`
   → `/onboard`

## Layout

- `app/onboard` — 7-step onboarding wizard (M1's success criterion: ≤20 min
  to a coherent picture)
- `app/today` — daily surface: SSE chat shell (M3 wires the full
  Tutor-Advisor behind it)
- `app/api/cron/headmaster` — Vercel Cron seam for the weekly cycle (M4)
- `app/api/agents/integrator` — on-demand Integrator seam (M2)
- `lib/ai/route.ts` — tiered model routing (heavy / conversational /
  lightweight); `lib/ai/meter.ts` — every call metered into
  `DailyCostRecord` (≤$10/family/mo target is a query, not a guess)
- `prisma/` — schema + migrations + Hartfield demo seed
- `../docs/research/` — the classical-curriculum knowledge base (36+
  curricula as structured YAML, 4 philosophy packs, Georgia compliance spec)

## Milestones

M1 memory+onboarding (this) → M2 Integrator → M3 daily loop → M4 Headmaster
weekly cycle → M5 Registrar (Georgia export) → M6 two-week dry run with cost
report.
