# Overnight build handoff — 2026-05-22

One PR off `feat/overnight-improvements-2026-05-21` (based on `origin/main` @ `5aa2b1d`, PR #54 consolidated). Discovery → build → verify in one session. Full evidence-backed backlog: `docs/product-improvement-roadmap-2026-05-21.md` (committed first, durable).

## What shipped (B1–B8)

All non-Conner-gated. Best-fix, typed (no `any`), zod/brand-clean, files coherent.

| # | Item | Files |
|---|------|-------|
| **B1** | **Seed the value loop so it's VISIBLE end-to-end without OAuth.** New `scripts/seed-loop-demo.ts` seeds a workspace + ACTIVE Google credential + `WebhookSubscription`, inserts real `WebhookEvent` rows from the fixture corpus, runs the **real** `runSkillChain` (FixtureMessageFetcher + TestLlmProvider — no Gmail, no API key), calls the **real** `persistSkillRunArtifacts`, marks events processed. Mirrors `process-webhook-event.ts` exactly. Result: `HandoffLogEntry` + `WorkApprovalQueueItem` rows land → the loop is clickable in the overview + `/approvals`. | `scripts/seed-loop-demo.ts` (new) |
| **B2** | **Killed the OAuth dead-end + the truthfulness lie.** Onboarding claimed "Gmail OAuth is live" and the CTA returned a raw JSON `503 oauth_not_configured`. New server-only `isIntegrationConfigured()` seam gates the copy + CTA; onboarding now shows an honest "Plaino wires it with you on the welcome call" state when unconfigured; marketplace tiles show "your service partner connects this" instead of a 503 link; the start route redirects to a branded `notice=not-configured` banner instead of JSON (pre-check + catch, defense-in-depth). | `lib/integrations/config-status.ts` (new), `oauth/start/route.ts`, `onboarding/page.tsx`, `integrations/page.tsx`, `IntegrationTile.tsx` |
| **B3** | **Stopped the whole workspace 500ing on a missing optional key.** `briefingsProvider` defaulted to `notion` → `required("NOTION_API_KEY")` threw at eager top-level render. Now degrades to the empty/test provider (honest "no briefings yet") when unset, mirroring the documented embedder fallback. | `lib/env.ts`, `lib/notion/index.ts` |
| **B4** | **Vertical-aware agents page.** Was hardcoded to a realty fleet for all 10 verticals. Added `agentRoster` to `VerticalContent`, populated all 10 (realty = the exact prior 7 slugs, zero regression), agents page reads `workspace.vertical`. Also fixed the card hover (`bg-paper-deep` → `border-ink`, §3.2). | `lib/verticals/types.ts` + 10 `content.ts`, `agents/page.tsx`, `agents/[slug]/page.tsx` |
| **B5** | **Home "a free chatbot vs. your service partner" comparison block.** The "why pay vs ChatGPT/Claude for Small Business" answer was buried in collapsed FAQ; now it's a two-column hairline block on the main scroll path (overnight-vs-prompted, pre-trained-vs-blank, draft-in-your-Gmail-vs-copy-paste, we-install-vs-you-prompt, rooted-vs-no-memory). | `app/(marketing)/page.tsx` |
| **B6** | **WCAG AA fix.** `mute` `#8C8478` on `paper` was 3.36:1 (fails AA 4.5:1 for the 11–13px captions it's used for everywhere). Darkened to `#726A5E` (4.85:1), warm-greige preserved. Test pin updated. | `lib/brand/tokens.ts`, `app/globals.css`, `tests/brand.test.ts` |
| **B7** | **Preview-of-value + "where do my drafts live."** Overview empty state now shows a clearly-labeled "example" loop preview so OAuth-blocked users see the shape of the work; queue card gains a one-line draft→approve→your-tools-send explainer (closes audit S9). | `workspace/[id]/page.tsx` |
| **B8** | **Brand-voice polish batch.** Removed "Standard managed AI ops" (AI banality) → "Your fleet, run for you"; lowercased approval action buttons (§1.7); onboarding "get you set up" → "get your fleet rooted"; compliance suggested-rewrite `border-moss` → `border-rule` (moss reserved for verified states); signup body now names Plaino (§4.1). | `settings/billing/page.tsx`, `ApprovalsList.tsx`, `onboarding/page.tsx`, `compliance/page.tsx`, `sign-up/page.tsx` |

## Verification

- **Typecheck:** `tsc --noEmit` — clean (exit 0).
- **Lint:** `next lint` — no warnings or errors.
- **Build:** `build:no-migrate` — green (exit 0); all touched routes compiled.
- **Tests:** `npm test` — 1741/1742 pass. The one failure (`knowledge-substrate.test.ts` "SEED_COUNTS matches the assembly", asserts `CROSS_CUSTOMER === 0` but it's 12) is **pre-existing**: `tests/knowledge-substrate.test.ts` and `lib/knowledge/` are byte-identical to `origin/main` (zero diff), so the failure predates this branch and is unrelated to any file here. Flagged for a separate fix.
- **Banned-phrase:** `marketing-banned-strings` (814) + `brand` suites pass; no new customer-visible banned words introduced.
- **Screenshots:** NOT captured — this worktree has no `DATABASE_URL` (only `.env.example`), so the product surface can't be rendered live without a dev DB. Build-time route compilation + design-language conformance stand in. To see B1/B7 live: set a dev DB + `AUTH_PROVIDER=test BRIEFINGS_PROVIDER=test`, run `npx tsx scripts/seed-loop-demo.ts`, open the printed workspace URL.

## Leftover backlog — sequenced for the next session

From `docs/product-improvement-roadmap-2026-05-21.md` §2 (P2), in priority order:

1. **B9 — WebhookEvent backlog alarm** (audit S8). Script + Inngest cron + Sentry alert for `processed=false` rows older than 15 min. [ESTIMATE] M.
2. **B10 — Deepen the realty compliance corpus** (1 → ~4 rules: RESPA §8, GA advertising, team-name disclosure, wire-fraud). The lead vertical has the thinnest corpus. Wants a counsel pass. [ESTIMATE] M.
3. **B11 — Defer the tier choice off the signup form** (design §4.1:501; default `regular` already set). Held tonight because signup carries tier defense-in-depth — wants an isolated PR. [ESTIMATE] S.
4. **B12 — Bind realty FLEET slugs to real skills.** [UNKNOWN] the advertised 7-agent roster's slugs match neither `SKILL_CATALOG` nor `lib/skills/` dirs, so per-agent handoff counts likely read 0. Largest item. [ESTIMATE] L.
5. **B13 — `(operator)`/`(marketing)` route-group error/not-found boundaries.** [ESTIMATE] S.
6. **Pre-existing:** fix the stale `CROSS_CUSTOMER` knowledge-substrate test assertion (flagged via spawn-task).

## Open questions / Conner-gated blockers

- **OQ-1 (needs a ruling):** `project_stripe_both_surfaces.md` memory (2026-05-12) says "Regular + Custom only, 3-column tiers banned," but the Dispatch brief, README:107, the code, and a 2026-05-15 ratification all say **three-tier Regular/Partner/Max**. Tonight treated three-tier as canonical; **the tier UI was NOT touched.** Please confirm and let us update/retire the stale memory.
- **OQ-2 (unchanged, Conner-gated):** Google + Microsoft OAuth client credentials + Pub/Sub topic + Graph subscription are not live. The loop's *receiver* end can't be exercised on a real inbox until supplied. B1 makes everything downstream demonstrable meanwhile.
- **OQ-3 (unchanged, Conner-gated):** Stripe live-mode Prices for Partner/Max + one live test charge unverified (audit S2).
- **OQ-4:** B10's corpus deepening should get an outside-counsel pass before customer reliance.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
