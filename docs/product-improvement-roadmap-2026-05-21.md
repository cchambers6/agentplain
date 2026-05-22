# agentplain — Product Improvement Roadmap (overnight build, 2026-05-21)

**Branch:** `feat/overnight-improvements-2026-05-21` (off `origin/main` @ `5aa2b1d`, PR #54 consolidated).
**DONE bar (locked):** signup → branded workspace → connect Gmail → read/categorize/coordinate/schedule/draft loop on a real inbox → pay via Stripe.
**Method:** 6 parallel discovery lenses against current code; every item cites file:line / command output. `[ESTIMATE]` = size guess, `[UNKNOWN]` = unverified. Conner-gated = needs a credential/decision only Conner can supply.

**Standing constraints honored:** Google + Microsoft OAuth are NOT live (Conner-gated). Brand = rooted/heritage ("agent + the plains"), service-partnership voice ("we run it for you"), named partner Plaino. No outbound from agentplain's surface. Three-tier pricing **Regular / Partner / Max is canonical** (Dispatch brief + README:107 + a 2026-05-15 ratification cited in `settings/billing/page.tsx`); the `project_stripe_both_surfaces.md` memory (2026-05-12, "Regular + Custom only, 3-column tiers banned") is **STALE** — see Open Question OQ-1. Do not act on it.

---

## 1. What's already strong (so we don't redo it)

Verified against current code — these were named as gaps in older docs but are **fixed** on `main`:

- All five known UX gaps from `docs/product-design-language-2026-05-17.md` are closed: approvals no longer dumps raw JSON (`approvals/page.tsx:31` → `renderApprovalPayload` + `ApprovalsList`); workspace "fleet initializing" uses calm `text-mute` not `text-flag` (`workspace/[id]/page.tsx:133-140`); the customer-facing "v1 · phase 1" stamp is gone (`app/(product)/layout.tsx` → `ApAppShell`); settings says "your service partner" not "operator" (`settings/page.tsx:170`); `ApRootedLoader` + `ApRootedEmptyState` exist and all 14 product `loading.tsx` files consume the loader.
- Error/empty/loading boundaries are broad: `error.tsx` / `not-found.tsx` / `loading.tsx` at `(product)` root + workspace, per-segment `loading.tsx` for activity/agents/approvals/briefings/compliance/integrations/onboarding/settings.
- Form a11y is solid: `ApHeritageField` wires `htmlFor`/`id`/`aria-describedby`/`aria-invalid`/`role="alert"` (`components/ui/ap/ApHeritageField.tsx:60-103`); focus-visible rings consistent.
- The skill chain (read→categorize→coordinate→schedule→draft) is **fully real and OAuth-free**: `lib/skills/runner.ts:81-274`, `TestLlmProvider` heuristic mode with no API key (`lib/llm/index.ts:40-57`), `FixtureMessageFetcher` (`lib/skills/fixture-fetcher.ts:83-105`), 35-fixture corpus (`tests/fixtures/webhook-events/_corpus.ts`).
- Banned-phrase grep across `app/(product)/**` + `components/**`: **zero** customer-visible body-copy violations (all hits are code comments, Prisma field names, or the marketing FAQ's anti-pattern list).

---

## 2. Ranked improvement backlog

Ranked by **leverage** (impact × how-much-it-unblocks ÷ size), filtered for buildable-tonight where noted. **★ = selected for tonight's build.**

### P0 — Highest leverage, build tonight

**B1 ★ — Seed the value loop so it's visible end-to-end without OAuth.**
- *Problem:* The skill chain is real but nothing lands it in the DB/UI without a live Gmail webhook (Conner-gated). `scripts/demo-skill-chain.ts` runs the chain **in memory only** — `RecordingDraftPersister` + `writeLog:false`, never calls `persistSkillRunArtifacts` (`scripts/demo-skill-chain.ts:30-32`). No `prisma/seed` exists (verified: `ls prisma/` → only `migrations`, `schema.prisma`). So the loop has never been *seen* in the product.
- *Impact:* This is the DONE bar's core. A clickable, in-product demo of read→categorize→coordinate→schedule→draft is the strongest proof agentplain works — for Conner, for a pilot demo, and for our own confidence. Removes the "every layer built, never observed end-to-end" risk (S1 in `pre-pilot-ship-readiness-2026-05-18.md`) for everything *downstream of the webhook receiver*.
- *Leverage:* Highest. Pure composition of existing parts.
- *Size:* [ESTIMATE] M. New `scripts/seed-loop-demo.ts`: upsert Workspace + BROKER_OWNER membership + ACTIVE `IntegrationCredential(provider=GOOGLE)` + `WebhookSubscription`, insert a `WebhookEvent` from a corpus fixture, run the **real** `runSkillChain`, call the **real** `persistSkillRunArtifacts`. Run with `AUTH_PROVIDER=test BRIEFINGS_PROVIDER=test LLM_PROVIDER=test`.
- *Gated:* No.

**B2 ★ — Fix the OAuth dead-end + the truthfulness lie.**
- *Problem:* Onboarding renders "One-tap read-only Gmail OAuth is **live**" with a primary CTA (`onboarding/page.tsx:374-391`), but with OAuth env unset the start route's `buildAuthorizeUrl` throws and returns a raw, unstyled `503 {"error":"oauth_not_configured"}` (`app/api/integrations/[integrationId]/oauth/start/route.ts:137-146`). The surface both **lies** (claims live) and **dead-ends ugly**.
- *Impact:* The single worst first-5-minutes failure; also a truthfulness gap. A pilot clicking "connect gmail" today hits a JSON error page.
- *Leverage:* High. Closes the critical onboarding break.
- *Size:* [ESTIMATE] M. Best-fix (not quick): add an `isConfigured()` check to the integrations seam so copy + button can't drift; when unconfigured, show a calm Plaino state ("Gmail opens for your workspace on the welcome call — skip below and Plaino wires it with you") and make the start route redirect to a branded surface, never `NextResponse.json`.
- *Gated:* The *real* OAuth go-live is Conner-gated; making the surface honest + branded is not.

**B3 ★ — Defensive briefings fallback (stop the whole workspace 500ing on a missing optional key).**
- *Problem:* `briefingsProvider` defaults to `"notion"` (`lib/env.ts:39-40`) → `required("NOTION_API_KEY")` throws (`lib/env.ts:96`). It's called eagerly at top level in `workspace/[id]/page.tsx:78` and `briefings/page.tsx:18`, so a missing key takes down the **entire** overview, not just the briefing card. The provider's own fetch path is defensive, but *construction* throws first.
- *Impact:* High. Any prod/preview without `NOTION_API_KEY` shows the error boundary instead of a working workspace.
- *Leverage:* High, tiny size.
- *Size:* [ESTIMATE] S (~15 min). Fall back to the empty/test briefings provider when `NOTION_API_KEY` is unset (mirror the existing OpenAI-embedder fallback at `lib/env.ts:48`).
- *Gated:* No.

**B4 ★ — Make the agents page vertical-aware (it's hardcoded to realty for all 10 verticals).**
- *Problem:* `app/(product)/app/workspace/[id]/agents/page.tsx:13-21` defines a static 7-agent realty `FLEET` and never reads `Workspace.vertical` (which exists, `prisma/schema.prisma:270`, defaults `REAL_ESTATE`). A CPA/law/insurance workspace sees the realty fleet. No agent-roster abstraction exists on `VerticalContent` (`lib/verticals/types.ts:157-220`).
- *Impact:* High. Wrong-vertical fleet shown to 9 of 10 verticals — embarrassing in any non-realty demo.
- *Leverage:* High. One abstraction fixes all verticals.
- *Size:* [ESTIMATE] M. Add `agentRoster` to `VerticalContent`, populate per vertical in `content.ts`, read `workspace.vertical` in the agents page, render the roster. Realty roster = the existing 7 names (zero regression).
- *Gated:* No.

**B5 ★ — Home page: "a free chatbot vs. your service partner" comparison block.**
- *Problem:* The strongest "why pay vs free" rebuttals sit in **collapsed** FAQ accordions near the page bottom (`components/FAQ.tsx:31-36`, `:92`). The home page never names the cheap alternative (ChatGPT / Claude for Small Business / $20 tool); the "Five things you won't get from a generic AI tool" section asserts features without contrasting them (`app/(marketing)/page.tsx:264-279`). The sharpest line ("Not a chatbot… not on your homepage waiting to be prompted") is stranded on `/about` (`app/(marketing)/about/page.tsx:189-192`).
- *Impact:* High competitive leverage. The "why not just use ChatGPT?" objection fires in the first 15 seconds and nothing on the scroll path answers it.
- *Leverage:* High. Reuses the existing `grid gap-px bg-rule` two-cell pattern (`page.tsx:204`).
- *Size:* [ESTIMATE] M. Two-column block after `page.tsx:279`: "A free chatbot" vs "agentplain, run for you" — waits-for-prompt vs works-overnight; starts-blank vs pre-trained+compliance; gives-you-text-to-copy vs draft-in-your-Gmail; you-prompt-engineer vs we-install-and-tune. NOT a 3-column tier grid (different axis: product-vs-alternative, safe).
- *Gated:* No.

### P1 — High leverage, build tonight if time

**B6 ★ — `mute` text color fails WCAG AA; darken it.**
- *Problem:* `mute` `#8C8478` on `paper` `#F7F4ED` ≈ **3.15:1**, below AA's 4.5:1 for normal text (`app/globals.css:18`, `lib/brand/tokens.ts:52`). It's the default for 11–13px captions, helper text, eyebrows, empty-state secondary copy, timestamps throughout.
- *Impact:* Med-High. Pervasive; an axe/Lighthouse scan or a low-vision pilot user flags it immediately.
- *Size:* [ESTIMATE] S. Darken to ≈`#6E665B` (≈4.6:1). **Must** update the pinned hex assertion in `tests/brand.test.ts:31`.
- *Gated:* No. *Risk:* repo-wide visual touch (value change only, not structural).

**B7 ★ — Preview-of-value card for OAuth-blocked users.**
- *Problem:* With OAuth gated, a new user can't connect Gmail, so a skipped/empty workspace shows no evidence the fleet does anything (`workspace/[id]/page.tsx:275-307`; onboarding sticky preview `onboarding/page.tsx:579-617`). "Where do my drafts live" is never explained on first load (audit S9).
- *Impact:* High onboarding. Lets a user *see the loop* before they can run it.
- *Size:* [ESTIMATE] M. Static realty sample handoff (Buyer Inquiry Router → draft) in the overview empty state, plus a one-line "where do my drafts live" caption under the queue card linking to `/approvals`. Presentational, fits `ApRootedEmptyState`.
- *Gated:* No.

**B8 ★ — Brand-voice polish batch (small, customer-visible).**
- *Problem:* (a) "Standard managed AI ops" — AI banality on billing copy (`settings/billing/page.tsx:452`); (b) sentence-case action buttons "Open in your browser"/"Open to confirm" violate §1.7 verb-led-lowercase (`approvals/ApprovalsList.tsx:267,289`); (c) agents-grid card uses `hover:bg-paper-deep` which §3.2 reserves for tiles, should be `hover:border-ink` (`agents/page.tsx:61`); (d) `border-moss` on advisory suggested-rewrite is borderline-decorative, should be `border-rule` (`compliance/page.tsx:77`); (e) onboarding "Let me get you set up" brushes banned "set up your" register (`onboarding/page.tsx:126`); (f) signup body never names Plaino though design §4.1:503 requires it (`sign-up/page.tsx:47-50`).
- *Impact:* Med. Each small; together they tighten brand fidelity across high-traffic surfaces.
- *Size:* [ESTIMATE] S each, batched.
- *Gated:* No.

### P2 — Real value, sequenced for next session (NOT built tonight unless time remains)

**B9 — WebhookEvent backlog alarm (audit S8 still open).**
- *Problem:* No alarm counts unprocessed `WebhookEvent` rows older than N minutes. `scripts/validate/inngest-health-check.ts` is proof-of-life only. A stalled Inngest queue grows silently → a paying customer's drafts quietly stop.
- *Size:* [ESTIMATE] M. `scripts/validate/webhook-backlog-check.ts` (`prisma.webhookEvent.count({where:{processed:false, receivedAt:{lt: now-15m}}})`, non-zero exit past threshold) **plus** an Inngest cron that runs it and reports to Sentry — otherwise it's a script nobody runs ([UNKNOWN] scheduler hookup, flagged by Lens 5).
- *Gated:* No. *Why deferred:* needs the cron wiring to be real value; keep PR coherent.

**B10 — Deepen the realty compliance corpus (1 → ~4 rules).**
- *Problem:* The lead/proof vertical has the **thinnest** sentinel corpus — 1 rule, fair-housing only (`lib/agents/sentinel/corpus/real-estate/index.ts:8`), while law has 7, cpa/ria/recruiting 6.
- *Size:* [ESTIMATE] M. Add RESPA §8, GA license-law advertising, team-name disclosure, wire-fraud notice following the existing literal-rule file pattern.
- *Gated:* No (but warrants a counsel pass before customer-facing reliance — flag).

**B11 — Defer the tier choice off the signup form.**
- *Problem:* The tier picker is the **first** thing on signup (`sign-up/SignUpForm.tsx:80,127-176`), forcing a pricing decision before any value; design §4.1:501 explicitly says drop it (default `regular`, already the default).
- *Size:* [ESTIMATE] S. *Why deferred:* signup carries tier defense-in-depth logic (`actions.ts:59-74`); changing the flow risks destabilizing it — wants a careful, isolated PR, not a rushed overnight edit.
- *Gated:* No.

**B12 — Bind realty FLEET slugs to actual skills.**
- *Problem:* [UNKNOWN, Lens 4] The hardcoded `realty-*` FLEET slugs match neither `SKILL_CATALOG` slugs nor `lib/skills/` dirs, so the handoff `_count` lookups (`agents/page.tsx:29-38`) likely return 0 for every agent. Realty has only 2 runnable skills (invoice-chasing, lead-triage) for a 7-agent advertised fleet.
- *Size:* [ESTIMATE] L. Reconcile the advertised roster with real skills; add missing skills (e.g. showing-scheduler) over time.
- *Gated:* No. *Why deferred:* largest item; needs roster-vs-skill reconciliation design (B4 lands the abstraction it builds on).

**B13 — `(operator)` / `(marketing)` route-group error/not-found boundaries.**
- *Problem:* Those route groups have no own `error.tsx`/`not-found.tsx` (inherit root). Low severity.
- *Size:* [ESTIMATE] S.
- *Gated:* No.

---

## 3. Open questions / new Conner-gated blockers discovered

- **OQ-1 (memory conflict — needs a ruling):** `project_stripe_both_surfaces.md` (2026-05-12) says the model is ONE Regular tier + per-scope Custom and **bans 3-column tier comparisons**. But the code, README:107, the Dispatch brief, and a 2026-05-15 ratification cited in `settings/billing/page.tsx` all say **three-tier Regular/Partner/Max**. Tonight we treat three-tier as canonical and **did not** touch the tier UI. Conner: confirm three-tier is current and let us update/retire the stale memory file.
- **OQ-2 (Conner-gated, unchanged):** Google + Microsoft OAuth client credentials + Pub/Sub topic + Graph subscription are not live. The loop's *receiver* end (steps 4–7 of the DONE bar) cannot be exercised on a real inbox until Conner supplies these. B1 makes everything *downstream* demonstrable in the meantime.
- **OQ-3 (Conner-gated, unchanged):** Stripe live-mode Products/Prices for Partner/Max tiers + one live test charge unverified (audit S2). Code path is sound; needs Conner's test card.
- **OQ-4:** Deepening the realty compliance corpus (B10) should get an outside-counsel pass before customers rely on it (per the attorney-firstpass discipline).

---

## 4. Tonight's build set (selected)

B1, B2, B3, B4, B5, B6, B7, B8 — one branch, one PR. Serialized on shared files (`workspace/[id]/page.tsx`, `agents/page.tsx`); isolated pieces (home block, mute token, agent roster) parallelized across the fleet. Best fix, not quick fix; typed, files <500 lines, zod-validated inputs, brand voice throughout. B9–B13 sequenced for the next session.
