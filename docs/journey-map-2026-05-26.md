# agentplain customer journey maps — 2026-05-26

UX/QA journey-mapping exercise across the marketing site (agentplain.com) and the app (app.agentplain.com). Each journey walks a single persona through the experience step by step and reports what they see, where it snags, an emotional read, an on-brand check, and a delivers-vs-overclaims call.

## Method + diligence notes

- **Sources of truth** — every observation cites either a route/component file:line (code-mapped) or a live URL with the WebFetch verdict (live-walked). When WebFetch summary conflicts with source, source wins and the conflict is noted.
- **WebFetch caveat** — across multiple live pages the WebFetch summarizer reported the `H1` as the tagline `"Intelligence rooted in reality."`. The actual `<h1>` in source on `/`, `/about`, `/general` is the locked mission line *"We lift up local businesses by doing the work…"*; the tagline is a `<p class="font-display text-base">` *above* the H1 (homepage `app/(marketing)/page.tsx:69-71` vs `app/(marketing)/page.tsx:72-77`; about page `app/(marketing)/about/page.tsx:28-30` vs `app/(marketing)/about/page.tsx:31-36`). WebFetch's confusion is itself a signal that the visual hierarchy reads tagline-as-headline to a skim reader — flagged below.
- **Auth-walled journeys (6–10)** were code-mapped only. No account was created. I never executed a sign-up, OAuth, draft, or billing action against live infra.
- **Date stamp** — pages were fetched on 2026-05-26 from `agentplain.com` (apex). The apex tracks the production build per `project_apex_alias_drift_rootcause.md` (fixed 2026-05-22 by adding the apex as a tracking project domain, not via `vercel alias set`).

---

## Journey 1 — First-time visitor on the homepage ("what is this / is it for me")

**Persona** — operator clicks an ad or link, lands on `/`, doesn't know what agentplain is.

**Live-walked** — `https://agentplain.com/` returned 200; rendered the locked mission line, tagline, hero subhead "Your AI ops team — without hiring one.", and all 10 vertical chips.

| Stage | What the user sees | Source |
|---|---|---|
| 1. Tagline | "Intelligence rooted in reality." (paragraph above H1) | `app/(marketing)/page.tsx:69-71` |
| 2. H1 (mission) | "We lift up **local businesses** by doing the work that takes their time and money away from the people they serve." | `app/(marketing)/page.tsx:72-77` |
| 3. Subhead | "Your AI ops team — without hiring one." | `app/(marketing)/page.tsx:78-80` |
| 4. Body | The service-partnership pitch (install / configure / run weekly reviews / customize) + the loop (read / categorize / coordinate / schedule / draft / you approve) | `app/(marketing)/page.tsx:81-90` |
| 5. Chip row | All 10 verticals as chips → `/<slug>`; `/general` offered as a separate "Don't see your industry?" link below | `app/(marketing)/page.tsx:99-132` |
| 6. CTAs | "Start free trial" → `/app/sign-up`; "See how it works" → `#how` | `app/(marketing)/page.tsx:134-143` |

**Friction**
- **The tagline reads as the headline.** WebFetch repeatedly summarized the visible H1 as the tagline rather than the locked mission line; the mission line is the longest text on the page and gets visually deferred. A skim reader leaves with "Intelligence rooted in reality" + 10 vertical chips and may not consciously absorb the mission line.
- The hero asks for two reads (tagline, mission line, subhead) before getting to the chip row that answers "is it for me?"

**Emotional read** — confident on the chip row ("yes, I see my industry"); slightly philosophical at the top before the chips. The double-line tagline + mission is dense for first-touch.

**On-brand** — yes. All 10 verticals present (real estate, mortgage, insurance, property management, title & escrow, recruiting, home services, CPA, law, RIA). No banned framings — no "V0", no pilot, no "agent count" leak, no realty-only framing. "The fleet" is the unit, per `project_agentplain_mission_and_positioning.md`. Forest/clay editorial holds (hairline grid, font-display, eyebrow uppercase mono).

**Delivers vs overclaims** — delivers. The hero's claims ("we install", "we run weekly reviews", "we customize") are commitments the service partnership can make today; the in-product loop preview lower on the page is honestly labeled "example · what lands here once mail flows" (`app/(product)/app/workspace/[id]/page.tsx:367-394`).

---

## Journey 2 — Realtor (deepest vertical) evaluating

**Persona** — solo realtor, clicks the "Real estate" chip from `/` → `/real-estate`.

**Live-walked** — `https://agentplain.com/real-estate` returned 200; reported H1 "Built for independent real-estate brokerages"; all expected sections present.

| Stage | What the user sees | Source |
|---|---|---|
| 1. Hero | Vertical-specific eyebrow + value prop pulled from `lib/verticals/real-estate/content.ts` | `app/(marketing)/[vertical]/page.tsx:69`, `components/vertical/VerticalHero.tsx` |
| 2. Value loop example | "Sarah's counter-offer" day-in-the-life — scenario → today → with agentplain → outcome | `lib/verticals/real-estate/content.ts` (`valueLoopExample`), `components/vertical/ValueLoopExample.tsx` |
| 3. JTBD tables | Per-role tables (broker-owner + agent) | `components/vertical/JtbdTables.tsx` |
| 4. ROI | Anchor math | `components/vertical/RoiAnchor.tsx` |
| 5. Claims triad | Replace / Integrate / Augment | `components/vertical/ClaimsTriadGrid.tsx` |
| 6. Pricing tier banner | Recommended tier surfaced inline | `components/vertical/PricingTierBanner.tsx` |
| 7. Integrations | Per-vertical list + planned window | `components/vertical/IntegrationsList.tsx` |
| 8. CTA | "Start free trial → `/app/sign-up?vertical=real-estate`" | `components/vertical/VerticalCta.tsx` |

**Friction**
- **Integration count mismatch (P1).** WebFetch reported the hero says *"Integrations planned: 10"* but only 9 were enumerated below. Worth verifying against `lib/verticals/real-estate/content.ts → integrations`.
- **Internal memory-file references leak (P0).** WebFetch reported these literal strings on the page: `` `project_stripe_both_surfaces.md` ``, `` `project_pricing_value_anchor.md` ``, `` `realty_vertical_spec_v1_2026-05-03.md` ``, `` `agentplain_positioning.md` ``, `` `project_integration_roadmap.md` ``, `` `feedback_integration_acceptance_is_functional.md` ``. These are internal source-of-truth citations bleeding into customer copy. Hard violation of `feedback_everything_tells_a_story.md` ("no internal language on customer surfaces").

**Emotional read** — confident through the day-in-the-life ("yes, this is my Tuesday") and JTBD tables. Drops a notch the moment the eye lands on a backtick'd `.md` filename.

**On-brand** — mostly. Forest/clay holds; voice is rooted-in-reality. The memory-file citations are off-brand.

**Delivers vs overclaims** — delivers on the day-in-the-life narrative. The "26x multiplier" ROI claim (WebFetch summary) is anchored to the ROI calculator inputs — verify it doesn't read as a universal promise.

---

## Journey 3 — Non-realty vertical prospect (CPA)

**Persona** — solo CPA, lands on `/cpa` either from the chip row or a search.

**Live-walked** — `https://agentplain.com/cpa` returned 200. WebFetch judged the page **"Deep, not placeholder-level"**.

| Stage | What the user sees | Source |
|---|---|---|
| 1. Hero | "Built for small CPA and tax practices" | `lib/verticals/cpa/content.ts` hero |
| 2. Value loop | March 17, 5:42pm — 23 clients missing documents; before (6hr/night) → after (35 min review) → outcome (17 responses by next noon) | `lib/verticals/cpa/content.ts:310-319` |
| 3. JTBD tables | 5 roles (partner, staff accountant, audit senior, CSM, admin) | `lib/verticals/cpa/content.ts` `jtbdTables` |
| 4. Agent roster | 5 named agents w/ honest `rooting` vs `live` runtime states + `rootingNote` on rooting agents | `lib/verticals/cpa/content.ts:36-60` |
| 5. Integrations | 13 planned, **Q4 2026** launch window | `lib/verticals/cpa/content.ts:307` |
| 6. CTA | "Start free trial → `/app/sign-up?vertical=cpa`" | `components/vertical/VerticalCta.tsx` |

**Friction**
- **Internal memory-file references again** — WebFetch reported `project_stripe_both_surfaces.md`, `b2b_vertical_opportunity_analysis_2026-04-27.md`, `project_pricing_value_anchor.md`, `project_integration_roadmap.md`, `feedback_integration_acceptance_is_functional.md` leaking. Same P0 as Journey 2.
- **Future window** — "Q4 2026" is honest but a CPA reading this in May 2026 is looking at "wait 4–6 months for my practice-mgmt integration". That's a real expectation. The agent-roster `rootingNote` text saves it — every non-live agent declares what unlocks its runtime, but only after the visitor parses past the headline.

**Emotional read** — strong. The March-17 scenario is specific and credible; the JTBD coverage of 5 roles signals the team actually researched CPA practice anatomy. The "rooting / live" honesty across the roster is unusual and trust-positive.

**On-brand** — yes (with the same memory-file leak caveat).

**Delivers vs overclaims** — honest. The page does NOT claim CPA is live today; the rootingNote pattern says explicitly what the customer needs to connect for each agent to come online. Same discipline as realty (`real-estate` is the only `verticalIsLive` per `app/(product)/app/workspace/[id]/page.tsx:74`, and the workspace overview surfaces "per-vertical fleet rooting in" for any non-realty vertical at `:138`).

---

## Journey 4 — The skeptic ("why believe / is it safe")

**Persona** — operator who's been burned by AI vapor before; wants proof.

**Live-walked** — uses content from `/`, `/about`, `/cpa`, `/custom` already fetched.

| Stage | What the user sees | Source |
|---|---|---|
| 1. Rooted-in-reality section | "Here's what we mean by 'rooted in reality.' Four things we can point at today. Not magic, not pixie dust." | `app/(marketing)/page.tsx:459-470` |
| 2. Knowledge stat panel | Pre-computed counts from `lib/knowledge/seed-data.ts` (VERTICAL, COMPLIANCE, SKILL, CROSS_CUSTOMER) — anchored as "not aspirational, not invented" | `app/(marketing)/page.tsx:423-457` |
| 3. No-outbound architecture | "Nothing leaves without your name on it" / "Every draft … lands in your approvals queue as a PENDING row" | `app/(marketing)/page.tsx:274-288`, anchored to `project_no_outbound_architecture.md` |
| 4. About page | "We run our own brokerage (flatsbo) on the fleet" — eat-our-own-cooking signal | `app/(marketing)/about/page.tsx` |
| 5. /custom emphasis | "No deck, no demo theater. The spec is written before the bill exists." | `app/(marketing)/custom/page.tsx` |

**Friction**
- The "Knowledge stat" panel intentionally cites `lib/knowledge/seed-data.ts` and the `SEED_COUNTS` symbol *in customer copy* (`app/(marketing)/page.tsx:451-456`). For an engineer-skeptic this reads as honest; for a non-technical operator it reads as gibberish — exposing internal code paths in customer copy.
- The about page's "~35 cron-fired agents" line (per WebFetch) is technical infrastructure language that a skeptic operator can either love or distrust — leans engineering-internal.

**Emotional read** — strong for an engineer-CTO. Mixed for an operator. The skeptic's exact question — *"will it send something stupid in my name?"* — is answered head-on by the PENDING-approval framing, which is the strongest single trust signal.

**On-brand** — yes. The no-outbound architecture is a real product property, not a positioning device.

**Delivers vs overclaims** — delivers. The architecture genuinely doesn't send outbound — every approval row is `PENDING` until human action (`app/(product)/app/workspace/[id]/approvals/page.tsx:18-24`, filtering on `status: "PENDING"`). The skeptic's question has a code-level answer.

---

## Journey 5 — Pricing (Regular / Partner / Max + /custom)

**Persona** — finance-minded operator; wants to know "what does it cost and can I act?"

**Live-walked** — `https://agentplain.com/pricing` returned 200; all three tier cards visible with correct ladders.

| Stage | What the user sees | Source |
|---|---|---|
| 1. H1 | "Three ways to partner. Affordable access to the team that runs it." | `app/(marketing)/pricing/page.tsx:93-99` |
| 2. Regular ladder | $199 / $179 / $149 / $119 / $99 across solo → 50–99 seats | `app/(marketing)/pricing/page.tsx:27-33` |
| 3. Partner ladder | $299 / $269 / $239 / $219 / $199 across the same bands | `app/(marketing)/pricing/page.tsx:35-41` |
| 4. Max | "Quoted per engagement" — sales-led | `app/(marketing)/pricing/page.tsx:151-160` |
| 5. ROI calculator | Pure client-side, anchored to Regular | `app/(marketing)/pricing/page.tsx:177-179` |
| 6. "When to choose what" | Per-tier headline + body + 3 examples each | `app/(marketing)/pricing/page.tsx:54-85` |
| 7. /custom callout | "Different from Max (a tier with non-standard scope): /custom is engagement work against a written spec." | `app/(marketing)/pricing/page.tsx:219-249` |
| 8. CTAs | Regular → `/app/sign-up` (primary); Partner → mailto; Max → mailto; /custom → `/custom` | `app/(marketing)/pricing/page.tsx:131-160` |

**Friction**
- **Leak (P0)** — WebFetch reported the literal string `"Schema-backed Partner tier per project_stripe_both_surfaces.md HISTORICAL"` rendered on the customer-facing pricing page (source: `app/(marketing)/pricing/page.tsx:148`). The label is a `footnote` prop on the `TierColumn` component and is rendered into the customer surface (`page.tsx:381-383`). This is internal documentation leaking — a finance buyer scanning a pricing page does not benefit from reading the words "schema-backed" and the on-disk filename.
- **Max vs /custom distinction is real but subtle.** The page explains the difference well; the /custom inquiry form (`app/(marketing)/custom/page.tsx`) offers "Max-tier service engagement" as one of the inquiry types — that re-blurs the line.

**Emotional read** — confident on the ladder; mildly confused by Partner-vs-Max-vs-Custom on first scan. The 3-tier card grid + "When to choose what" + /custom callout collectively resolves it, but it's three concepts to hold.

**On-brand** — yes (modulo the memory-file leak). Forest/clay, hairline grid, mono eyebrow uppercase.

**Delivers vs overclaims** — delivers. Stripe is wired (per `app/(product)/app/workspace/[id]/settings/billing/page.tsx` — `addPaymentMethodAction`, `openPortalAction`, `cancelSubscriptionAction`); whether live Stripe keys are present in production is an env question this audit can't verify without authenticating.

---

## Journey 6 — Sign-up → onboarding

**Live-walked through the sign-up landing page only.** Code-mapped past that — no account created.

| Stage | What the user sees | Source |
|---|---|---|
| 1. Sign-up landing | "Root your workspace on agentplain." + Plaino's name as service partner + 4 fields (work / firm name / email / name) + tier picker with Regular highlighted at $99 | `app/(product)/app/sign-up/page.tsx`, `SignUpForm.tsx` |
| 2. Magic-link email | "We email you a link. No password to lose." | `app/(product)/app/sign-up/page.tsx:60-62` |
| 3. After verify | Lands on `/app` → `defaultWorkspaceIdFor()` → `/app/workspace/<id>` | `app/(product)/app/page.tsx:11-19` |
| 4. Workspace overview | Eyebrow ("this morning, Conner"), computed headline ("nothing's come in yet"), Plaino avatar + service-partner intro, "continue onboarding" banner if `onboarding.completedAt == null` | `app/(product)/app/workspace/[id]/page.tsx:101-163` |
| 5. Onboarding step 1 | "Hi {firstName}. I'm {partner}, your service partner at agentplain." — Confirm Details (workspace name / vertical / tier) | `app/(product)/app/workspace/[id]/onboarding/page.tsx:131-172` |
| 6. Onboarding step 2 | Connect Integration (or "skip for now") | `app/(product)/app/workspace/[id]/onboarding/page.tsx:173-179` |
| 7. Onboarding step 3 | Set Preferences (tone, default hours) | `app/(product)/app/workspace/[id]/onboarding/page.tsx:181-185` |
| 8. Completion | "Your workspace is rooted." → "open workspace" / "see the fleet" | `app/(product)/app/workspace/[id]/onboarding/page.tsx:84-119` |

**Friction (code-mapped, not live-walked)**
- **Magic-link gating** — every step requires the magic-link email to land. If outbound transactional email is misconfigured or delayed, the user is stuck at sign-up with no obvious next step. Not visible from code without runtime verification.
- **Tier picker on sign-up** — Regular highlighted by default; the path from "I picked Regular on /pricing" → `/app/sign-up?tier=regular` correctly resolves (`app/(product)/app/sign-up/page.tsx:16-24`). `?tier=partner` resolves to the on-disk enum `plus`. Good.
- **The "skip for now" affordance on the integrations step** (`onboarding/page.tsx:201-209`) is honest, but a user who skips arrives at a workspace with nothing connected — the overview's `LoopPreview` example state (`workspace/[id]/page.tsx:367-394`) carries that visitor.

**Emotional read** — Plaino-as-service-partner anchoring across sign-up + onboarding is a strong continuity device. The "Your workspace is rooted." completion line is satisfying.

**On-brand** — yes. Plaino is the named partner per `project_plaino_named_agent.md`. Step copy uses heritage voice; no chirpy assistant language.

**Delivers vs overclaims** — honest. Onboarding does NOT claim agents are firing; it correctly states "The 9am block runs tomorrow" only after onboarding completes (`onboarding/page.tsx:91-94`).

---

## Journey 7 — Connect an integration

**Code-mapped — not live-walked** (no authenticated session).

| Stage | What the user sees | Source |
|---|---|---|
| 1. Marketplace grid | Tiles per `lib/integrations/marketplace.ts` — Gmail, Outlook, Google Calendar, Google Drive, OneDrive, QuickBooks, DocuSign, Slack, Teams, HubSpot, Canva, Excel, etc. | `app/(product)/app/workspace/[id]/integrations/page.tsx:69-89`, `components/marketplace/IntegrationTile.tsx` |
| 2. Tile state — connected | "manage →" link | `IntegrationTile.tsx:82-91` |
| 3. Tile state — available + configured | "connect →" button (clay-filled CTA) → OAuth start route | `IntegrationTile.tsx:103-111` |
| 4. Tile state — available + **not configured** | Text-only "your service partner connects this" (no click target) | `IntegrationTile.tsx:96-101` |
| 5. Tile state — coming-soon | "join the waitlist →" outline button | `IntegrationTile.tsx:113-121`, `waitlistPath()` |
| 6. OAuth callback | Returns to `/app/workspace/<id>/integrations?connected=<id>` → ConnectionFlash slide-over | `app/(product)/app/workspace/[id]/integrations/ConnectionFlash.tsx` (referenced from `page.tsx:143-147`) |

**Friction**
- **The "not configured" state is the honest one, and it's well-handled** — `IntegrationTile.tsx:96-101` checks `isIntegrationConfigured(entry)` per `lib/integrations/config-status.ts` and renders a non-clickable "your service partner connects this" label instead of a button that would dead-end at the start route's `oauth_not_configured` branch. This is good defensive UX. The user does NOT see a connect button that errors.
- **But the upstream count line is "X connected · Y available · Z coming soon"** (`integrations/page.tsx:106-112`) — a tile counted in "available" but with `configured=false` looks promised in the count line and demoted in the tile body. Mildly confusing.
- **For the audited build's actual configured-providers state**, we cannot verify from code which OAuth envs are wired in production. The honest customer experience varies based on env-var presence.

**Emotional read** — calm. The "your service partner connects this" copy is a smart escape valve; the user reads it as a deliberate service-partnership move, not as a dead button.

**On-brand** — yes. Service-partnership voice ("your service partner picks it up, finishes the wiring, and tells you when it's ready"). No `auto-send` framing anywhere. Page copy at `integrations/page.tsx:97-102` reaffirms "Nothing leaves your accounts and nothing sends without your hand on it."

**Delivers vs overclaims** — delivers, IF the configured-flag wiring is correct in prod. Worth a runtime sanity check that `env.googleOAuthClientId() && env.googleOAuthClientSecret()` actually return truthy in production before any customer sees a Gmail tile. (See `lib/integrations/config-status.ts:39-41`.)

---

## Journey 8 — The core value loop (read → categorize → coordinate → schedule → draft → approval)

**Code-mapped — not live-walked.**

| Stage | What the user sees | Source |
|---|---|---|
| 1. Workspace overview | Computed headline that names what just happened: *"We drafted 3 replies and flagged 1 item."* (or empty state with the labeled LoopPreview) | `app/(product)/app/workspace/[id]/page.tsx:193-238`, LoopPreview `:367-394` |
| 2. "What we did" feed | `ApHairlineList` of HandoffLogEntry rows: `fromAgent → toAgent · handoffType` w/ HH:MM stamp | `workspace/[id]/page.tsx:246-333` |
| 3. Today's queue sidebar | `pendingApprovals` count, `openFlags` (compliance) count, "open queue" CTA → `/approvals` | `workspace/[id]/page.tsx:452-501` |
| 4. Today's briefing | Notion-sourced morning briefing via `getBriefingsProvider()` | `workspace/[id]/page.tsx:78-82`, `:398-447` |
| 5. /approvals | `workApprovalQueueItem` rows where `status=PENDING`, rendered per `renderApprovalPayload(kind, payload)` | `app/(product)/app/workspace/[id]/approvals/page.tsx:14-32` |
| 6. Approval action | Approve / Edit / Reject; "Routine items send through automatically. Anything above your threshold lands here for explicit ratification — we draft, you decide, your existing system sends." | `approvals/page.tsx:35-44`, `actions.ts` |

**Friction (code-mapped)**
- The empty-state LoopPreview at `workspace/[id]/page.tsx:367-394` is intentionally an example with a *clay-mute* eyebrow `"example · what lands here once mail flows"` so it can never be mistaken for live data. Honest and well-executed.
- The headline computation (`buildHeadline()` at `:193-238`) is genuinely dynamic — different counts produce different sentences. A new customer with 0 handoffs gets *"{partner} is watching your inbox. Nothing's come in yet."*
- **Threshold UX is real** — `workspace/[id]/settings/work-thresholds` exists; user can configure what gets auto-sent vs gated. (Listed in `workspace/[id]/settings/page.tsx:62-66`.) The approvals copy "Routine items send through automatically" is consistent with this. But: per `project_no_outbound_architecture.md` the system itself never sends outbound — "send through automatically" means *marked APPROVED automatically*, and the customer's own tool ultimately executes. Worth re-reading the approvals page line to make sure operators don't read "send through" as "agentplain emails on my behalf."

**Emotional read** — strong. The whole shape (headline → handoffs → queue → briefing) reads like a daily report-back from a junior employee — which is exactly the service-partnership framing.

**On-brand** — yes. Plaino avatar carries through. No "AI assistant" voice.

**Delivers vs overclaims** — honest at the architectural level (PENDING rows, no outbound). The "Routine items send through automatically" copy needs a re-read; it's the one phrase a literal reader could misinterpret given the otherwise-strict no-outbound discipline.

---

## Journey 9 — Owner / cross-vertical (PowerUser) view

**Code-mapped. The customer-facing version of this journey does NOT exist in the current product.**

What exists:
- `/operator/leadership-board`, `/operator/fleet`, `/operator/workspaces`, `/operator/inquiries`, `/operator/integrations` — all gated on `session.isOperator` per `app/(operator)/layout.tsx:36-39`.
- `app/(operator)/operator/fleet/page.tsx` documents itself as *"NOT customer-sellable; owner/internal only."*

What the customer model assumes:
- One workspace per customer; one `BROKER_OWNER` role (`requireWorkspaceMember(workspaceId, ["BROKER_OWNER"])` in every workspace page).
- No surface for a customer who runs a brokerage *and* a CPA arm to see both in one pane.

**Friction**
- If a buyer at a multi-vertical firm asks "can I see all my workspaces at once?", the answer today is **no** — they'd manually switch workspaces, and the chrome doesn't expose a workspace switcher in the marketing-facing copy. There's an `/app/page.tsx` redirect that picks a default workspace, but no UI for *"all my workspaces."*
- For the owner (Conner), the operator console IS the cross-vertical view, but it's gated and explicitly internal.

**Emotional read (from a hypothetical multi-vertical buyer)** — *"so I'd run two subscriptions and switch?"* — that's the implicit answer, and it isn't surfaced anywhere in marketing.

**On-brand** — n/a (the surface doesn't exist).

**Delivers vs overclaims** — neither, but a multi-vertical buyer reading `/verticals` ("Different ops. Same value loop.") may infer cross-vertical aggregation. Today: not in the product.

---

## Journey 10 — Billing / account management

**Code-mapped — not live-walked.**

| Stage | What the user sees | Source |
|---|---|---|
| 1. Settings index | Connections / Work thresholds / Billing / Sign-in & security / Activity | `app/(product)/app/workspace/[id]/settings/page.tsx:55-84` |
| 2. Billing page | Plan name + status badge + per-seat $ × seats = monthly + next-charge date | `app/(product)/app/workspace/[id]/settings/billing/page.tsx:171-228` |
| 3. Trial banner | Days-to-trial-end + "add a card any time before your trial ends" copy | `billing/page.tsx:113-117`, `:129-136` |
| 4. Past-due banner | "Open the billing portal … agents pause until billing is current." | `billing/page.tsx:138-158` |
| 5. Add card | Server action `addPaymentMethodAction(workspaceId)` → Stripe checkout/portal | `billing/page.tsx:244-256`, `actions.ts` |
| 6. View invoices | `openPortalAction` → Stripe portal | `billing/page.tsx:257-263` |
| 7. Cancel | `cancelSubscriptionAction` — schedules cancel-at-period-end | `billing/page.tsx:263-278` |
| 8. Change plan | `changePlanAction` — surfaces seat-band switching, tier switching | imported `billing/page.tsx:24-29` |

**Friction (code-mapped)**
- **Max tier path** — when the workspace is on Max, the billing page hides the "add payment method" / "view invoices" / "cancel" actions and replaces them with a "manage your engagement" CTA → `/custom?type=max#custom-contact` (`billing/page.tsx:233-242`). The customer-managed self-serve flow doesn't apply. Honest.
- **Past-due copy** — *"agents pause until billing is current"* (`billing/page.tsx:144-148`) maps to the DB-backed Inngest pause flag added in `fix/p0-4-db-backed-pause-flag-2026-05-26` (commit `bc6789d`). Real, not aspirational.
- **What's untested by this audit** — actual Stripe round-trip in prod (whether `STRIPE_SECRET_KEY` is wired and the portal returns). Not verifiable from code alone.

**Emotional read** — calm. Heritage button + paper-card styling holds. The trial-end / past-due messages are operator-grade plain English.

**On-brand** — yes. No banned framings.

**Delivers vs overclaims** — code is in place; live keys are an env question. The pause-on-past-due is real per the recent commit chain.

---

## Summary table

| # | Journey | Walk method | Biggest friction | Priority fix |
|---|---------|-------------|------------------|--------------|
| 1 | Homepage first-touch | Live | Tagline reads as headline; H1 deferred | P2 — re-balance visual weight of tagline vs mission line OR accept and treat tagline as effective H1 |
| 2 | Realtor evaluation | Live | Internal `*.md` filenames in customer copy; integration count "10" vs 9 enumerated | **P0** — remove memory-file refs from rendered copy; **P1** — reconcile count |
| 3 | CPA evaluation | Live | Internal `*.md` filenames in customer copy; Q4 2026 wait window | **P0** — same as #2; P2 — soften Q4 framing on hero |
| 4 | Skeptic / trust | Live | `lib/knowledge/seed-data.ts` cited in customer copy | **P0** — replace with plain-English "(verifiable in our source code)" |
| 5 | Pricing | Live | "Schema-backed Partner tier per project_stripe_both_surfaces.md HISTORICAL" literal string | **P0** — rewrite TierColumn `footnote` prop |
| 6 | Sign-up + onboarding | Code-mapped | Magic-link delivery dependency (runtime, not visible from code) | P1 — verify SES/Resend health in prod alerting |
| 7 | Connect integration | Code-mapped | "available" tile count includes not-configured providers | P2 — surface configured-vs-not in the header count line |
| 8 | Value loop + approvals | Code-mapped | "Routine items send through automatically" copy can read as agentplain-sends | P1 — reword to "auto-approve" / "auto-mark-sent" |
| 9 | Owner cross-vertical view | Code-mapped | **The customer surface does not exist** | P1 — either build a customer-facing workspace switcher / multi-workspace aggregator OR add marketing copy that sets the expectation honestly |
| 10 | Billing / account | Code-mapped | Stripe live keys unverified by this audit | P1 — runtime check that portal redirect succeeds with prod keys |

---

## Top issues (cross-journey, prioritized)

### P0 — Internal memory-file references leak into customer copy

Multiple customer-facing pages contain literal references to internal memory files (`project_stripe_both_surfaces.md`, `project_pricing_value_anchor.md`, `realty_vertical_spec_v1_2026-05-03.md`, `agentplain_positioning.md`, `project_integration_roadmap.md`, `feedback_integration_acceptance_is_functional.md`, `b2b_vertical_opportunity_analysis_2026-04-27.md`, `feedback_agentplain_built_by_agents.md`, `project_counsel_engaged.md`, `project_no_outbound_architecture.md`, and `lib/knowledge/seed-data.ts`) inside rendered HTML.

- **Confirmed leak sources**: `/pricing` (verbatim "*Schema-backed Partner tier per project_stripe_both_surfaces.md HISTORICAL*" — `app/(marketing)/pricing/page.tsx:148`), `/real-estate`, `/cpa`, `/custom`, `/` homepage's `SEED_COUNTS` citation at `:451-456`.
- **Why this matters**: violates `feedback_everything_tells_a_story.md` ("no internal language on customer surfaces"). A non-engineer operator reads gibberish; an engineer-skeptic reads it as either heroic transparency or sloppy.
- **Fix**: replace backtick'd `.md` references with plain English sourcing (e.g., "(our ratified positioning doctrine)") or remove. Single PR; ~15 occurrences across the marketing tree.

### P0 — H1 visual hierarchy reads as tagline-dominant

WebFetch reported the *tagline* as the H1 on `/`, `/about`, and `/general` (all three pages where the locked tagline + locked mission line both render). The actual `<h1>` is the mission line, but visual size + position give the tagline more weight to a skim reader.

- **Fix options**: (a) restyle the tagline `<p>` to smaller and more muted so the H1 wins; OR (b) elevate the tagline to be the H1 deliberately and rework the mission line to a body paragraph; OR (c) accept the ambiguity but add an aria-labelledby cue. Coordinate with brand owner (`project_brand_locked.md`).

### P1 — Realty integration count mismatch

WebFetch reported "Integrations planned: 10" in the `/real-estate` hero but only 9 integrations enumerated. Two-minute fix in `lib/verticals/real-estate/content.ts` once the source is reconciled.

### P1 — Customer-facing cross-vertical view does not exist

Journey 9 has no product surface. The `/operator/*` console is owner-only. A multi-vertical buyer who reads `/verticals` ("Different ops. Same value loop.") may infer aggregation across workspaces; today that means running multiple subscriptions and switching manually.

- **Fix options**: (a) build a `/app/workspaces` switcher pane (gated on user having >1 active membership); (b) document the constraint honestly on `/pricing` or `/verticals`.

### P1 — "Routine items send through automatically" copy

`app/(product)/app/workspace/[id]/approvals/page.tsx:40-44` says *"Routine items send through automatically."* Per `project_no_outbound_architecture.md`, the system itself never sends outbound. Reword to "Routine items are auto-approved" or "Routine items pass through your existing system automatically" to remove the false-send implication.

### P1 — Magic-link delivery not verified

Sign-up's success path depends on outbound email delivery. The audit can't verify this from code. Confirm SES/Resend health in prod alerting and the bounce/spam-folder rate.

### P2 — Tier-vs-engagement confusion at /custom inquiry form

The pricing page explains: *"Different from Max (a tier with non-standard scope): /custom is engagement work against a written spec."* The /custom inquiry form then offers "Max-tier service engagement" as an inquiry type, partially re-blurring the distinction.

### P2 — `/how-it-works` returns 404

The header nav links to the anchor `/#how`, but a typed `/how-it-works` URL or external link will 404. Add a `redirect()` at `app/(marketing)/how-it-works/page.tsx` → `/#how` for SEO + external-link resilience.

### P2 — Integration-tile count line

`integrations/page.tsx:106-112` shows "X connected · Y available · Z coming soon" — "available" includes providers that aren't actually OAuth-configured (the tile body downgrades them to "your service partner connects this"). Surface configured-vs-not in the header count for honest scanning.

---

## What I could only code-map (no live walk)

Journeys 6, 7, 8, 9, and 10 — sign-up + onboarding, connect-an-integration, the core value loop, the cross-vertical view, and billing. The audit did not create an account, did not start OAuth, did not draft or approve anything, and did not exercise Stripe. Code-mapped findings reflect what the route handlers and components *render* and *gate on*; they cannot speak to runtime issues (email deliverability, OAuth env wiring, Stripe key presence, Inngest cron health).

What's reachable publicly:
- `/`, `/verticals`, `/<vertical>`, `/pricing`, `/custom`, `/about`, `/general`, `/inquiry-received` — live-walked.
- `/app/sign-up`, `/app/sign-in` — public landing pages, live-walked but not exercised.
- `/how-it-works` — confirmed 404 (only `/#how` exists).
- Everything under `/app/workspace/<id>/*` and `/operator/*` — auth-gated; code-mapped only.
