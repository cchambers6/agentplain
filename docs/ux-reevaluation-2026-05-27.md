# UX re-evaluation — agentplain customer surface vs. the "premium AI ops team in a few clicks" bar — 2026-05-27

**Author.** UX heuristic evaluation against the customer-facing app code on `origin/main` (`23361a0`) and against Strand 1's premium fleet expansion plan (`origin/docs/fleet-expansion-plan-2026-05-27:docs/fleet-expansion-plan-2026-05-27.md`).

**Status.** DRAFT — doc-only. No feature code. Strand 3 (UX build) consumes this once Conner signs off.

**Method.** Code-level heuristic walk through the 9 in-product flows below. **Not** live user testing; every claim is anchored to a `file:line` cite. I tag what I can verify in code, and call out separately what only live observation can answer (see §6).

**Anchors (read in this order).**

1. Strand 1 fleet expansion — `origin/docs/fleet-expansion-plan-2026-05-27:docs/fleet-expansion-plan-2026-05-27.md` (88-cell discipline × vertical matrix, ~45 net-new connectors over today's 12, 7 numbered "premium few-clicks UX requirements" the customer surface owes).
2. Agent-interview master — `origin/docs/agent-interviews-master-2026-05-27:docs/agent-interviews/00-MASTER.md` (1 of ~50 agents is firing live; the other 49 are demo-only, charter-only, staged, or dormant; in-product agent cards overclaim `runtime: "live"` on 11 vertical pages).
3. Self-serve readiness — `origin/docs/self-serve-readiness-2026-05-27:docs/self-serve-readiness-2026-05-27.md` (links 1, 3, 5 work code-wise; link 2 is gated on prod OAuth creds; link 4 [support] is the single biggest "no human at agentplain" gap; link 6 [data export + workspace close] is in-flight).
4. Journey map — `origin/docs/journey-map-2026-05-26:docs/journey-map-2026-05-26.md` (the 10-journey walk that this doc extends in-product; carries the P0 memory-file-leak findings and the "Routine items send through automatically" copy hazard).
5. Customer-facing code under `app/(product)/app/**` + components — every cite below is from this branch's checkout of `origin/main`.

**Headline.**

- The product today is a clean, brand-anchored *single*-vertical workspace built for the lone realty pilot. Forest/clay editorial holds, Plaino's service-partnership voice carries across every surface, the approval queue is honest, the "what we did → today's queue → next actions" overview is operator-grade. The customer surface is a B+ for what it claims to do today.
- The expanded fleet from Strand 1 — 8 disciplines × 11 verticals × 4–8 skills per cell, with 12 → 57 connector tiles — breaks every single one of the existing affordances. There is no Discipline panel, the marketplace tile-grid does not facet, the agent roster page would render 30–60 flat cards, the approval queue would render dozens of unfaceted rows per day. The surface does not scale to the load Strand 1 implies.
- **Single biggest UX blocker:** there is no `discipline` axis anywhere in the schema, copy, or UI. Strand 1 introduces "8 disciplines" as the customer-facing organizing unit; today's product surfaces only "vertical" and "agent slug." Without a discipline seam, the expanded surface lands as a tile dump.
- **Single highest-leverage UX win:** add the discipline axis as a single column on `WorkApprovalQueueItem` + a single layer of facet chips above the marketplace, the agent roster, and the approval queue. One schema migration unlocks four "premium few-clicks" affordances at once.

---

## 1. Per-step evaluation — heuristic walk through the 9 in-product flows

Each step gets a verdict (`works` / `partial` / `breaks under load`) against today's product **and** against the Strand 1 expanded fleet. Cites are `file:line` against the customer-facing code under `app/(product)/app/**`.

### Step 1. Land → signup → magic-link → workspace

**Today verdict — `works` (with a known dependency).**

- `/app/sign-up` is well-composed: a single `ApMotif` wheat mark + `ApEyebrow "begin with us"` + locked H1 *"Root your workspace on agentplain."* + 4-field form + Plaino name as service partner + tier picker pre-selected from `?tier=` query (`app/(product)/app/sign-up/page.tsx:37-67`).
- `signUpAction` → `signUpBrokerOwner` creates User + Workspace + Membership + OnboardingState + audit log in one tx (`lib/auth/flows.ts:70-189` per self-serve readiness audit row #1), then Stripe trial provisioning (`lib/billing/provisioning.ts:66-143`), then magic-link via Resend, then verify → `/app/workspace/[id]` (`app/(product)/app/verify/route.ts:35-67`). No operator step.
- **Clicks to value:** sign-up + magic-link + verify = 3 clicks to workspace. Within the "few-clicks" bar.

**Friction.**

- **Magic-link is the only auth on this path.** If Resend is misconfigured or delayed the user is stuck with no next step — invisible from code, only visible at runtime. (Journey 6 in the journey-map flags this as a P1 runtime-only verification.)
- **Tier-picker on sign-up duplicates `/pricing`.** A buyer who already chose Regular on `/pricing` is asked again on `/app/sign-up`. Honest, but a half-step.

**Expanded fleet (Strand 1) — `partial`.**

- Signup currently asks for vertical only. Strand 1's vertical preset (premium UX requirement §5.3) implies the moment a vertical is picked, the **right disciplines flip on with the right skills + the right connector recommendations + a vertical-tuned preset**. Today the workspace is bare on landing — no disciplines preselected, no connectors recommended, no preset applied. The sign-up form has no discipline question. Either the preset is invisibly applied by vertical (good) or the sign-up form needs to surface "which disciplines do you want first?" (probably not — that's onboarding's job).

### Step 2. Onboard (3 steps — confirm / connect / preferences)

**Today verdict — `works`.**

- Three-step linear flow in a single `ApPaperCard` with sticky `WorkspacePreview` pane: confirm-details → connect-integration → set-preferences (`app/(product)/app/workspace/[id]/onboarding/page.tsx:131-235`). `StepCards` shows complete / in-progress / next-up with moss/clay/mute color (`:239-282`).
- Header opens with Plaino-as-partner anchoring (`PlainoAvatar` size lg + first-person voice: *"Hi {firstName}. I'm {partner}, your service partner at agentplain. Let me get your fleet rooted in your shop."* — `:135-141`).
- The connect-integration step is the strongest single piece: if primary integration (Gmail) is configured, it renders a one-tap clay-filled CTA; if it's NOT configured, the copy degrades honestly to *"Your {primary} connection opens for your workspace on the welcome call — {partner} wires it with you"* (`:421-437`). No dead-end button.
- "skip for now" affordance on step 2 (`:201-209`) preserves the few-clicks vibe — onboarding doesn't gate on a connector.
- Completion copy *"Your workspace is rooted."* + *"The 9am block runs tomorrow"* (`:88-101`) is brand-aligned and operator-grade.

**Friction (today).**

- **Step 1 confirm-details is a no-op for most users.** The values were set on the previous page; rendering them again is conservative. Fine but a half-step.
- **Step 2 only offers the FIRST available integration** (`onboarding/page.tsx:341-342` — `primary = available[0]`). A realty owner who needs M365 + QBO + FUB at once gets a single-connector flow + "see all connections" link. That's not "few clicks" for a multi-connector vertical.
- **No "test the loop now" affordance.** A customer who connects Gmail at 10am has to wait for the next 5-minute cron tick + a real inbound to see the loop fire. Nothing in onboarding shows them what's about to happen on real data.

**Expanded fleet — `breaks under load`.**

- Strand 1 first-run target is **5 clicks to first artifact** (premium UX requirement §5.7). Today's onboarding gets you to a workspace; not to a first artifact. With 8 disciplines, the customer needs to know which disciplines are flipping on at first-run. Strand 1's "vertical preset" approach is sound — but there is no UI that surfaces *"Based on your vertical, we've turned on Analytics, Research, Legal, and CS. Marketing and Finance are off — flip them on later."* That summary is the missing onboarding step 4 (or part of the completion screen).
- **No discipline tour.** Once 8 disciplines are real, the operator needs a one-screen affordance to know what each discipline does. Today there is nothing to tour.

### Step 3. Connect (the marketplace tiles — "few clicks")

**Today verdict — `works` at 12 tiles; `breaks under load` at 57.**

- `/app/workspace/[id]/integrations` is a clean grid: hero copy + 4 count chips (connected / available now / awaiting connection / coming soon) + tile grid (`integrations/page.tsx:101-151`).
- The `IntegrationTile` component handles 3 states + the `!configured` honest-degrade state (`components/marketplace/IntegrationTile.tsx:68-122`). The non-clickable *"your service partner connects this"* label is excellent defensive UX.
- `ConnectionFlash` slide-over fires on `?connected=` for the post-OAuth landing.
- **Clicks to value:** tile-click → provider authorize → callback. 1 click + provider's own consent screen. On-brand.

**Friction (today).**

- **No category facet.** The 12 tiles render in a flat 2/3-col grid with category eyebrow per tile, but no filter chip ("Email / Calendar / CRM / Accounting / Documents / Messaging / Payments / Creative / Spreadsheets" — defined in `lib/integrations/marketplace.ts:45-54` but never surfaced as a UI seam).
- **No search.** Once the catalog grows past ~15, scan-time per tile climbs.
- **"X available now · Y awaiting connection" count is confusing.** Honest (the configured-vs-not split is real per `lib/integrations/config-status.ts`) but a buyer doesn't grok the difference. Better: a single "X connect-ready, Y needs your service partner" with the partner-mediated tiles visually grouped (or de-emphasized) below.

**Expanded fleet — `breaks under load`.**

- Strand 1 adds ~45 net-new connectors (§4). At 57 tiles in a 3-col grid that's 19 rows — well past the scan threshold. Premium UX requirement §5.1 says "one tile per connector" stays; **§5.1 alone is insufficient — the grid needs faceting, search, and discipline-grouping.**
- Strand 1's per-discipline groupings (Analytics → Metabase + Looker + Amplitude + Mixpanel + GA4 + Google Sheets; Marketing → Webflow + WordPress + Contentful + Sanity + Postiz + Buffer + Meta Ads + Google Ads + LinkedIn Ads + Ahrefs + Semrush + GSC + Canva + Figma + Mailchimp + Klaviyo) are exactly the right UX seams. They don't exist in `MarketplaceEntry` today — there is a flat `category` field but no `discipline` field (`lib/integrations/marketplace.ts:39-69`).
- **Vertical-system connectors (the ~50 vertical-CRM / AMS / LOS / PMS / ATS / job-mgmt / law-mgmt / accounting-platform connectors enumerated in Strand 1 §4) are the hardest UX problem.** They are only relevant per-vertical. Today's marketplace has no per-vertical filter — every workspace sees every tile. A CPA shouldn't see SoftPro/Qualia; an RIA shouldn't see ServiceTitan/AccuLynx. Without per-vertical filtering, the marketplace becomes 57 tiles of mostly irrelevant clutter for any single workspace.

### Step 4. Value-loop preview / first agent activity

**Today verdict — `works`.**

- Workspace overview at `/app/workspace/[id]` (`app/(product)/app/workspace/[id]/page.tsx:30-189`) is the strongest single page in the product:
  - Computed dynamic headline names what just happened (`:193-238`): *"We drafted 3 replies and flagged 1 item."* / *"{partner} is watching your inbox. Nothing's come in yet."*
  - Plaino avatar + service-partner sentence below the headline (`:110-117`).
  - "what we did" handoff feed (`:246-333`) renders real `HandoffLogEntry` rows with hh:mm stamps in `ApHairlineList`.
  - **`LoopPreview` empty state** (`:367-394`) is the model of how to do "what's about to happen on real data" without faking it: `clay-mute` eyebrow `"example · what lands here once mail flows"` + a 3-row illustrated handoff + closer line *"An illustration, not your data."* Honest, clear, brand-aligned.
  - Right column: today's queue card (pending approvals + open flags + "open queue" CTA) + next-actions card (`:452-547`).

**Friction (today).**

- **The page assumes one customer = one vertical = one fleet, and the fleet roster lives in `lib/verticals/<slug>/content.ts`.** No discipline grouping. A workspace with 8 active disciplines and 30+ skills firing would surface the handoff feed as a flat 8-row list of `fromAgent → toAgent · handoffType` — readable, but not faceted by discipline or grouped by which discipline is producing which work.
- **No "currently working" vs "drafting" vs "needs you" split on the overview page itself.** The Fleet hub (`/fleet`) has this split as a 3-column to-do board, but the overview just gives counts. Strand 1's premium UX §5.5 calls for the overview to be a 3-way "Working for you right now / Drafted, waiting for your call / Needs you specifically" dashboard — that's a redesign of the overview, not the fleet hub.

**Expanded fleet — `breaks under load`.**

- 8 disciplines firing into a flat handoff feed is the same scale problem as the marketplace. The headline-computation (`buildHeadline`) currently combines `drafted N replies` + `scheduled N showings` + `flagged N items` (`:208-237`). Once Analytics, Research, Legal, Marketing, Sales, CS, Finance, Ops are all firing, the headline would either grow combinatorially or have to facet ("Analytics drafted 2 reports, Marketing drafted 3 posts, Sales flagged 4 leads, Legal flagged 1 contract"). The current shape doesn't generalize.

### Step 5. Discipline / agent activation (Strand 1's "Discipline panel")

**Today verdict — `breaks under load` (doesn't exist).**

- **There is no Discipline concept anywhere in the product.** Grep across `app/(product)/app/workspace/[id]/` returns zero hits for "discipline" / "Discipline" (verified).
- The agent activation model today is implicit: workspace's vertical → `lib/verticals/<slug>/content.ts → agentRoster` → every agent in that roster is "on" for that vertical (per-card runtime status is informational; the customer cannot toggle).
- `app/(product)/app/workspace/[id]/agents/page.tsx:55-65` says explicitly: *"Open any capability for its daily loops, recent activity, and the work it has surfaced for review. Enabling or disabling capabilities is your service team's call today; ask your partner if your fleet should change."* — honest, but unwinds Strand 1's premium-tier promise. A premium few-clicks bar means the operator can flip disciplines on/off themselves.

**Expanded fleet — `breaks under load` (does not exist).**

- Strand 1 premium UX requirement §5.2 explicitly calls for a Discipline panel under `/app/workspace/[id]/settings`: 8 toggles, each surfacing the dependency ("Activating Marketing requires Canva and Mailchimp connected; HubSpot recommended"). Today: nothing. This is the load-bearing missing affordance.
- Strand 1 §5.3 calls for vertical presets — first-run picks a vertical → the right disciplines flip on with the right skills + the right connector recommendations + a vertical-tuned `vertical-preset.json`. Today the vertical preset is implicit (the `agentRoster` IS the preset) and the customer cannot edit it from product.

### Step 6. Invoke an agent / see a draft / approve work (the approval queue)

**Today verdict — `works` at handful-per-day scale; `breaks under load` at dozens-per-day.**

- `/app/workspace/[id]/approvals` (`app/(product)/app/workspace/[id]/approvals/page.tsx:14-61`) renders up to 50 PENDING items in `proposedAt` desc order with the well-composed `ApprovalsList` UI (`approvals/ApprovalsList.tsx:26-95`):
  - Per-card eyebrow (kindLabel · agentSlug · relative time) + title + recipient line + inbound summary + body paragraphs + proposed slots + persisted state + meta line + "drafted by Plaino" attribution row + approve/edit/reject footer (`ApprovalsList.tsx:108-225`).
  - The `AdminCardContent` renderer handles 5 specialized admin card types (verification-code, password-reset, email-verification, trial-expiration, account-suspension) with first-class affordances (`ApprovalsList.tsx:232-326`). Excellent quality.
  - Header copy: *"Nothing leaves agentplain on its own. We draft; you decide; your existing system is what actually sends. … routine work in a quieter lane, anything above your threshold flagged for explicit ratification."* (`approvals/page.tsx:41-46`). On-brand and architecturally honest.
  - **Edit-in-place via `ApPaperSheet` slide-over** (`ApprovalsList.tsx:44-94`) — well-executed.

**Friction (today).**

- **Flat list, no facet, no grouping, no filter chips.** The list is purely time-ordered with no facet by agent, kind, or priority. With one firing agent today (`office-admin`) this is fine; the moment 5+ agents draft per day it gets noisy.
- **"Routine items send through automatically" copy (`approvals/page.tsx:43-46`)** is the same friction Journey 8 in the journey-map flagged as P1 — a literal reader can mistake "send through automatically" for "agentplain emails on my behalf," which contradicts the no-outbound architecture. Should be "auto-marked APPROVED" or similar.
- **No "needs your attention urgently" elevation.** The `adminBorderClass` (`ApprovalsList.tsx:329-333`) adds a flag-colored border for `priority === "critical"` — that exists for admin cards. But compliance-flagged drafts don't get the same priority surface; they live on `/compliance` instead.

**Expanded fleet — `breaks under load`.**

- Strand 1 premium UX §5.4 names this directly: *"Approval queue grouped by discipline + agent. Today `WorkApprovalQueueItem` is a flat list. Premium: facet by discipline first, then agent. Filter chips: 'Show me only Legal flags', 'Show me only Marketing drafts'. Existing rendering in `app/(app)/workspace/[id]/approvals/*` needs the facet seam; one schema column (`discipline`) on `WorkApprovalQueueItem`."*
- With 8 disciplines firing, a customer could land on /approvals with 25+ items. Without facets and without the "needs you specifically" elevation, the queue becomes a scroll-through.

### Step 7. Settings: data export, workspace close, billing

**Today verdict — `works` (operator-grade).**

- `/app/workspace/[id]/settings` is a single hairline-list of section links (`settings/page.tsx:55-103, 138-171`). Connections / Work thresholds / Billing / Sign-in & security / Activity / Your data — all routed; team members + drafting tone + notifications honestly marked `coming-soon`.
- **`/settings/data`** (`settings/data/page.tsx:38-95, 99-143`) is the best piece of customer-control UX in the product: section eyebrow + headline *"Export it. Close the workspace. Always your call."* + download-export button (single GET → JSON via `/api/workspaces/[id]/export`) + structured 4-bullet explainer + closure section with 3-state UI (active → closing → closed) + cancel-during-grace affordance. Service-partnership voice holds throughout (`"{partner} runs the work, but the data is yours"`).
- **`/settings/billing`** (`settings/billing/page.tsx:107-282`) renders trial banner / past-due banner / cancellation banner / current-plan card with seats × per-seat × monthly + next-charge date / seat adjuster / tier picker. Max-tier path correctly hides self-serve actions and routes to `/custom?type=max`.

**Friction (today).**

- **9 settings sections is approaching the cap for hairline-list scan.** Once Discipline panel (Strand 1) + Notifications + Team members + Drafting tone all land, that's 13 sections. Hairline-list works to ~12; past that, sectioned grouping reads better.
- **No single "what's my data footprint" panel.** Storage used, message-count processed, embeddings count — none of this lands. A premium tier prospect asks "how much of my mailbox are you holding?" and the only answer today is "open the export and look." That's fine for an engineer; a brokerage-owner deserves a one-line summary.

**Expanded fleet — `partial`.**

- Adding the Discipline panel as Strand 1 §5.2 calls for is a net-new top-level settings section. Today there is no obvious place to put it (it's not a connection, not a billing knob, not a security knob). It deserves its own first-position card on /settings — possibly hoisted out of settings entirely and given a top-nav link.

### Step 8. Support / help

**Today verdict — `partial` (the form works; the answer is human-only).**

- `/app/workspace/[id]/help` (`help/page.tsx:13-37`) is a minimal centered form: `ApMotif lone-tree` + headline *"Need a hand? Message your service partner."* + Plaino-mediated copy + the `HelpForm` component. Service-partnership voice holds.
- `submitSupportRequest` persists `SupportRequest` → emails `SUPPORT_EMAIL` (default `hello@agentplain.com`) → routes operator triage at `/operator/support` (per self-serve readiness audit row #4).
- **Every support request terminates at a human inbox.** No fleet handler triages, drafts a first-touch, or auto-resolves anything.

**Friction (today).**

- **No self-help.** There is no FAQ, no docs link, no "common things people ask Plaino about" surface. Premium few-clicks means a customer's first move on "how do I X" is to find a one-screen answer; today the first move is to write a note.
- **No status indicator.** A customer who submits a help request has no in-product trace afterward — no "received" state, no expected response time, no notification when answered. The page is a write-only inbox.
- **No way to invoke a specific agent or ask the fleet a question.** The Fleet hub has `TalkToFleet` (writes an `owner-request` handoff log entry — `fleet/page.tsx:84-95, 217-219`), but that's a request-intake to the *fleet*, not to support. Two different inboxes that look similar.

**Expanded fleet — `breaks under load`.**

- With 8 disciplines and 30+ active skills per vertical, the surface area of "how do I X" questions multiplies. A help form does not scale. Self-serve readiness audit #4 calls this out as *"the single biggest 'no human at agentplain' gap once items 1–6 of the unlock list are set."*
- The fleet-side support skill (drafts the first-touch reply into an operator review queue, auto-resolves low-risk categories) is in the fleet-buildable backlog but doesn't exist today.

### Step 9. Re-engagement (second visit, third week)

**Today verdict — `partial`.**

- Returning to `/app/workspace/[id]` gives the dynamic headline + handoff feed + today's queue. The eyebrow says `{timeOfDayLabel}, {firstName}` (e.g., `this morning, Sarah`) — good continuity device (`page.tsx:104-106, 618-625`).
- `TodaysBriefing` slot (`page.tsx:398-447`) renders Notion-sourced briefings via `getBriefingsProvider()` — but on Day 2 with no briefing filed, the empty state is *"No briefing filed yet. {partner} files one each morning after the overnight run. The first one lands tomorrow."* That message reads identically on Day 30. It does not adapt to *"You've been with us 3 weeks — here's what we've shipped + what's working + what's drifting."*
- No "week-over-week" or "month-over-month" surface anywhere. The activity stream is a chronological feed; there is no "this week vs last week" rollup.
- No proactive nudge: a customer who hasn't returned in 7 days gets no email digest, no "here's what your fleet did while you were away."

**Friction (today).**

- **Re-engagement is push-based on the customer's habit, not on agentplain's signal.** A premium service partner emails you *"Plaino's weekly note — here's what the fleet did, here's what's drifting, here's what needs your call."* Today, the customer has to remember to come back.
- **No in-product progress narrative.** Day 1 looks like Day 30 except for handoff count.

**Expanded fleet — `breaks under load`.**

- With 8 disciplines firing, the third-week customer needs a one-screen *"state of your fleet this week"* — which discipline shipped how many drafts, which compliance flags were closed, which research briefs landed, which marketing posts went out (after the owner approved). Without that summary, the customer has to navigate 8 detail pages to know what's happening.

---

## 2. Friction inventory — ranked by severity

Severity legend: **P0** blocks the premium-feel claim today; **P1** breaks under Strand 1's expanded load; **P2** polish gap; **P3** minor.

### P0 — blocks the premium claim today

| # | Friction | Where | Why it's P0 |
|---|---|---|---|
| 1 | **No Discipline concept anywhere in product.** | Strand 1 §5.2; absent across `app/(product)/app/workspace/[id]/**` (grep verified) | Strand 1 calls disciplines the customer-facing organizing unit. Without them, every Strand 1 affordance (panel, presets, grouped queue, dashboard) has nowhere to live. |
| 2 | **Approval queue is a flat list with no facet, no grouping, no "needs you" elevation.** | `app/(product)/app/workspace/[id]/approvals/page.tsx:18-25` (flat `findMany`); `ApprovalsList.tsx:32-42` (flat `map`) | One firing agent today = fine. Multi-agent (Strand 1's 30+ per vertical) = a scroll-through, not a queue. |
| 3 | **Marketplace has no category/discipline facet, no search, no per-vertical filter.** | `app/(product)/app/workspace/[id]/integrations/page.tsx:139-151` (flat grid); `lib/integrations/marketplace.ts:39-69` (no `discipline` field) | 12 tiles today is OK; 57 (Strand 1) is a tile dump. A CPA shouldn't see SoftPro/Qualia. |
| 4 | **Agent activation has no customer-facing toggle.** | `app/(product)/app/workspace/[id]/agents/page.tsx:60-65` (literally says "your service team's call today") | Premium few-clicks means the operator flips disciplines on/off themselves; today it's a service-team mediated request. Walks the "premium" claim back. |
| 5 | **Help is a write-only inbox terminating at a human inbox.** | `app/(product)/app/workspace/[id]/help/page.tsx`; `lib/support/index.ts:90-94` (per self-serve audit row #4) | "No human at agentplain in the loop" is the north star; help breaks it. No self-help, no status, no fleet-side triage. |
| 6 | **In-product agent cards still overclaim `runtime: "live"` on 11 vertical rosters.** | `lib/verticals/<slug>/content.ts → agentRoster` × 11 (per agent-interview master Tier i item 1) | A premium product cannot show a runtime "live" badge for capabilities that don't fire. Tier i fix is 7 doc-only edits in `content.ts`. |

### P1 — breaks under Strand 1 expanded fleet (or under sustained use)

| # | Friction | Where | Why it's P1 |
|---|---|---|---|
| 7 | **Workspace overview headline + handoff feed don't generalize past ~4 firing skills.** | `app/(product)/app/workspace/[id]/page.tsx:208-237` (`buildHeadline`); `:246-333` (`TodaysWork`) | 8 disciplines firing = combinatorial sentence + flat 8-source feed. Needs discipline-bucket summary + facet. |
| 8 | **Onboarding step 2 only offers the FIRST available integration.** | `app/(product)/app/workspace/[id]/onboarding/page.tsx:341-342` (`primary = available[0]`) | A vertical-aware preset would recommend the 3 core connectors for the picked vertical. Today it's pick-one-or-skip. |
| 9 | **"Routine items send through automatically" copy on /approvals.** | `app/(product)/app/workspace/[id]/approvals/page.tsx:43-46` | Literal reader misinterprets as agentplain-sends, which contradicts no-outbound. Reword to "auto-marked APPROVED." (Journey 8 P1.) |
| 10 | **No re-engagement surface (weekly digest, "what shipped this week").** | absent — `app/(product)/app/workspace/[id]/page.tsx` empty-state-tomorrow for briefings (`:411-421`) | Premium service partners send the customer a weekly note. Today there is no weekly note. |
| 11 | **No data-footprint summary in /settings.** | `app/(product)/app/workspace/[id]/settings/page.tsx:114-134` (workspace facts, no data counts) | A premium customer asks "how much of my mailbox are you holding?" The answer should be one line, not "open the export and look." |
| 12 | **No fleet-side support handler.** | `lib/support/index.ts:34-122` (persists, emails human) | First-touch triage by the fleet itself is the leverage move to close the "no human at agentplain" gap. |
| 13 | **`/agents` and `/fleet` are two surfaces telling the same story differently.** | `app/(product)/app/workspace/[id]/agents/page.tsx` (3-col flat grid); `app/(product)/app/workspace/[id]/fleet/page.tsx` (map + board + stream + chat) | Two doors → same roster. Under Strand 1's 30+ skills per vertical, the duplication amplifies. Consolidate. |
| 14 | **Settings is 9 hairline rows trending toward 13.** | `app/(product)/app/workspace/[id]/settings/page.tsx:55-103` | Hairline-list reads to ~12. Past that, sectioned grouping with eyebrows. |

### P2 — polish gap

| # | Friction | Where | Why it's P2 |
|---|---|---|---|
| 15 | **Marketplace "available now / awaiting connection" split is confusing.** | `integrations/page.tsx:116-128` | Honest but a buyer doesn't grok. Single "X connect-ready, Y your-service-partner-wires" reads better. |
| 16 | **Confirm-details onboarding step is a no-op for most users.** | `onboarding/page.tsx:286-326` | Values were set on the previous page; rendering them again is conservative. Could be a 1-second `defaultExpanded={false}` accordion. |
| 17 | **No "test the loop now" affordance after first connector lands.** | `onboarding/page.tsx:357-389` (post-connect copy says "next sweep") | A customer who connects Gmail at 10am has to wait for the 5-min cron + a real inbound. A "send Plaino a test email now → watch the loop fire" CTA closes the wait. |
| 18 | **`TalkToFleet` (Fleet hub) and HelpForm (Help) look near-identical.** | `fleet/TalkToFleet.tsx` vs `help/HelpForm.tsx` | Two inboxes, same shape, different routing. A user sends a help question into Talk-to-Fleet and never gets a response. |
| 19 | **Compliance page (`/compliance`) has its own front door, separate from /approvals.** | `app/(product)/app/workspace/[id]/compliance/page.tsx` | Compliance flags are first-class work; they belong elevated in /approvals with a "Needs you specifically" facet (Strand 1 §5.5), not on a separate route. |
| 20 | **`TodaysBriefing` empty-state on Day 30 reads same as Day 1.** | `page.tsx:411-421` (*"The first one lands tomorrow."*) | Stale-promise once you've been a customer a week. Should adapt: "No briefing today — last one was 3 days ago." |

### P3 — minor

| # | Friction | Where |
|---|---|---|
| 21 | Integration count header (`X connected · Y available now · …`) is long line of mono-text, harder to scan than 3 stats cards. | `integrations/page.tsx:116-128` |
| 22 | `firstNameFromEmail` returns "there" when the email local-part doesn't yield a name — fine, but a one-time prompt at signup for "what should we call you?" would let the eyebrow read "this morning, Sarah" reliably. | `page.tsx:609-616` + `onboarding/page.tsx:716-724` |
| 23 | Skip-to-content link wraps in a `<a>` with `.skip-to-content` class (`layout.tsx:45-47`) — verify class is keyboard-visible-on-focus only (offscreen otherwise). | `layout.tsx:45-47` (a11y check) |

---

## 3. Required redesigns to handle the expanded fleet

Each redesign is sketched to about the depth Strand 3 needs to scope it. Cross-references Strand 1 §5 premium UX requirements where applicable.

### 3.1 Discipline panel — top-level workspace nav + first-class settings card

**What.** A new top-nav link `Disciplines` (between Fleet and Agents) → `/app/workspace/[id]/disciplines`. Page is an 8-card grid (Analytics / Research / Legal / Marketing / Sales / CS / Finance / Ops). Each card shows: discipline name (Fraunces 2xl) + Plaino-voice one-line description + current state (on/off + how many skills firing) + the connector dependencies ("requires Gmail + HubSpot; recommended: Apollo") + toggle + "see skills" expand.

**Why.** Strand 1 §5.2 calls for the panel under `/settings`; I'd hoist it to top-nav because disciplines are the organizing unit Strand 1 introduces, not a settings knob. Settings keeps the connector-dependency editor.

**How.** Schema: new `DisciplineActivation` table (`workspaceId`, `discipline`, `enabledAt`, `enabledByUserId`); new `discipline` field on every skill/agent row. UI: 8-card grid; toggle is a server action.

**Cites.** Today: no such surface. Closest analog is `/agents` (flat fleet grid).

### 3.2 Per-vertical preset applied at first-run, surfaced as a "preset summary" onboarding step 4

**What.** After step 3 (preferences), a new completion screen reads: *"Here's your preset — we turned on Analytics, Research, Legal, CS for {vertical}. Marketing and Finance are off — flip them on later from Disciplines. Recommended connectors next: Gmail, [vertical-CRM], QuickBooks. Skip-all + start watching."* Two primary CTAs: "open workspace" / "configure disciplines."

**Why.** Strand 1 §5.3 + §5.7 demand 5-clicks-to-first-artifact. Today onboarding ends at "Your workspace is rooted"; the customer arrives with no idea which disciplines are firing. A preset summary closes that gap.

**How.** New `lib/onboarding/vertical-presets.ts` keyed by vertical slug → `{ enabledDisciplines: Discipline[], recommendedConnectors: string[] }`. Completion screen reads from the preset; the toggle state is already persisted because step 1 picked the vertical.

**Cites.** Today: `onboarding/page.tsx:84-119` ("Your workspace is rooted" + 2 CTAs). Extend that block.

### 3.3 Approval queue grouped by discipline + agent, with "Needs you specifically" facet on top

**What.** Add 3 stacked sections on /approvals:
1. **Needs you specifically** — high-urgency or compliance-flagged items, elevated with `border-flag` (the existing `adminBorderClass` pattern). Default-expanded.
2. **By discipline** — collapsible group per discipline (Analytics 3 / Marketing 7 / Sales 2 / Legal 1 / …). Default-expanded for the first 2; collapsed below.
3. **All recent (last 7 days, decided)** — collapsed by default, for the customer who wants to scroll.
Filter chips above: All / Analytics / Research / Legal / Marketing / Sales / CS / Finance / Ops + a search input.

**Why.** Strand 1 §5.4 names this explicitly; the existing flat list does not generalize.

**How.** Schema: one new column on `WorkApprovalQueueItem` — `discipline VARCHAR(32)`. Backfill from `agentSlug` lookup. UI: rewrite `approvals/page.tsx:14-61` + `ApprovalsList.tsx`. The existing per-card rendering (`renderApprovalPayload` + admin-card affordances) doesn't change — only the wrapping list does.

**Cites.** Today: `approvals/page.tsx:18-25`; `ApprovalsList.tsx:30-42`.

### 3.4 Workspace overview redesigned as "Working for you / Drafted for you / Needs you" 3-pane dashboard

**What.** Replace the current overview's "what we did" + "today's queue" + "next actions" with three first-class panels:
1. **Working for you right now** — what's drafting right this minute (subscribed to `HandoffLogEntry` rows in `categori|draft|propose|schedul` types from the last 30 min). Counts + per-discipline breakdown.
2. **Drafted, waiting for your call** — Pending approvals count grouped by discipline (links to /approvals filtered).
3. **Needs you specifically** — Compliance flags + high-urgency admin cards elevated above the queue.

Each pane is an `ApPaperCard` with a "open detail →" CTA to the relevant route.

**Why.** Strand 1 §5.5 names this. The current overview is honest but undifferentiated for the customer who wants "what's the state of my service partner *right now*?"

**How.** Re-use existing data; add a discipline-bucket aggregation (depends on §3.3's schema column). The `HandoffLogEntry`-derived "drafting" column already exists on the Fleet hub (`fleet/page.tsx:144-153`); hoist it.

**Cites.** Today: `page.tsx:165-187`. Replace the right-column queue card + next-actions card with the 3-pane dashboard; keep the dynamic headline and Plaino intro.

### 3.5 Marketplace with category facet, search, per-vertical filter, and "wired by your service partner" group at the bottom

**What.** Marketplace gets:
- A facet bar across the top: All / Email / Calendar / CRM / Accounting / Documents / Messaging / Payments / Creative / Spreadsheets / Analytics / Research / Marketing / Sales / CS / Finance / Ops / Vertical-system. Single-select.
- A search input next to the facet bar.
- A per-vertical toggle (default ON) — "Show only connectors relevant to {vertical}." A CPA workspace flips this off to see SoftPro etc.
- 3 visually grouped tile-grids stacked: **Connected** (top) → **Connect now** (configured + available + relevant) → **Your service partner wires this** (configured = false OR vertical-irrelevant OR coming-soon). The `!configured` honest-degrade state stays as-is.

**Why.** Strand 1's 57-tile expansion makes a flat grid unscannable. Strand 1 §5.1 says "one tile per connector" but doesn't specify the facet/search seam; this fills it in.

**How.** Schema: `MarketplaceEntry` gets `discipline: Discipline` field + `relevantVerticals: VerticalSlug[]` (or `relevantVerticals: 'all'`). UI: facet/search local state in a client component above the `IntegrationTile` grid; vertical filter reads from workspace's vertical.

**Cites.** Today: `lib/integrations/marketplace.ts:39-69` (entry shape); `integrations/page.tsx:101-151` (page); `components/marketplace/IntegrationTile.tsx`.

### 3.6 Fleet-side support handler — drafts the first-touch reply into an operator review queue

**What.** When a customer submits `SupportRequest`, the fleet does what `office-admin` does on inbound mail: classify by category (account-help / billing-q / how-do-I / capability-gap / bug-report / urgent) → draft a first-touch reply → land in operator review queue. The customer sees in-product:
- "Received — Plaino is on it" state appears on /help post-submit.
- A "your support thread" card on the workspace overview when there's an open ticket, with last reply preview.
- A notification (in-app + email) when the operator (or auto-resolution) answers.

For categories where the answer is a docs link or a setting toggle, the fleet can auto-resolve with operator-on-call to override.

**Why.** Self-serve readiness #4 names this as the single biggest "no human at agentplain" gap. Closes the help loop.

**How.** New `SupportThread` model (or extend `SupportRequest`); new `support-triage` runtime skill (mirrors `office-admin` structure); operator surface at `/operator/support` already exists.

**Cites.** Today: `lib/support/index.ts:34-122`; `help/page.tsx:13-37`.

### 3.7 Weekly digest — "Plaino's weekly note" emailed to the operator + persisted in-product

**What.** Every Monday 7am, the fleet drafts (and the operator approves OR auto-sends if threshold is set) a weekly note: "Here's what we shipped (counts by discipline) + what's drifting + what needs your call this week." Lands in the customer's existing email inbox + persists in /briefings + summary card on the overview.

**Why.** Step 9 (re-engagement) breaks today; this is the leverage move. A premium service partner sends the customer a weekly note unbidden.

**How.** New Inngest cron `weekly-digest` writes a `Briefing` row + a `WorkApprovalQueueItem` of kind `weekly-digest`. Existing `getBriefingsProvider()` plumbing renders it on the overview.

**Cites.** Today: `lib/inngest/functions/process-webhook-event.ts:54` (cron pattern); `page.tsx:78-82, 398-447` (briefings plumbing).

### 3.8 Per-discipline detail pages — `/disciplines/[discipline]`

**What.** Click a Discipline card → land on /disciplines/[discipline]:
- Discipline name (Fraunces 4xl) + Plaino's one-paragraph definition.
- "What this discipline does for your vertical" — the §3 matrix cell for (vertical, discipline) rendered as a list of capabilities + their runtime state.
- Connector dependencies + recommendations.
- Recent activity stream (filtered to this discipline).
- Recent approvals (filtered to this discipline).
- Toggle to enable/disable.

**Why.** Strand 1 §5.8 says "the detail page is where the agent enumeration lives, and only the live ones get cards." This is that page.

**How.** New route; reuses the existing `AgentRosterEntry` + adds discipline filtering on `HandoffLogEntry` + `WorkApprovalQueueItem`.

**Cites.** Today: per-agent detail at `/agents/[slug]` is the closest analog; per-discipline doesn't exist.

---

## 4. Premium-feel gaps — where polish drops below the service-partnership bar

### 4.1 Typography + visual hierarchy

- **Strong.** Forest/clay/Fraunces editorial holds across signup → onboarding → workspace → settings → billing → data. `ApEyebrow` mono-uppercase + Fraunces display + hairline-rule list = the editorial rhythm Strand 1 demands.
- **Drop.** Workspace overview eyebrow `{timeOfDayLabel}, {firstName}` is small mono caps; the H1 below carries the "We drafted N replies" headline. The eyebrow gets visually subordinated to the headline — which is correct — but the headline rhythm reads almost identically across days. A premium service partner's note reads differently on Monday than Friday; today's headline doesn't have that texture.
- **Drop.** Marketplace `IntegrationTile` icons are hand-drawn 1.5px-stroke SVGs (`IntegrationTile.tsx:192-285`). Clean and brand-aligned, but they all read the same — at 57 tiles the eye can't distinguish a CRM from an accounting from a CMS at-a-glance. Color-tinted category eyebrows + bolder iconography per discipline would lift it.

### 4.2 Density

- **Strong.** `ApPaperCard` + hairline-list pattern keeps density right — the right answer between density-dense (operator dashboard) and density-loose (marketing page).
- **Drop.** Settings page is currently 1 column of hairline rows for 9 sections — 13+ post-Strand 1. Hairline-list scans to ~12; past that it needs sectioned grouping (`workspace + access`, `data + privacy`, `fleet + disciplines`, `billing + plan`, `team + notifications`).
- **Drop.** Approval card density is correct per-card, but the wrapping `<ul className="mt-8 space-y-4">` stacks cards 100%-width on every breakpoint. On a 1440px desktop with 20+ cards that's a long scroll. A 2-col layout above lg breakpoint (or master-detail with the body in a right pane) reads premium; the long single-column reads "list."

### 4.3 Empty states

- **Strong.** `ApRootedEmptyState` is well-used everywhere it lands — overview ("Nothing has come in yet"), approvals ("Nothing waiting on you"), compliance ("Nothing flagged"), help ("a hand when you need one"). Plaino-voice copy + a single small motif + a calm two-line "reality / change" framing.
- **Strong.** The workspace overview `LoopPreview` is the gold-standard empty-state in the product — clearly labeled "example," shows the SHAPE of what's about to land, can't be mistaken for real data.
- **Drop.** Day-30 empty states read identically to Day-1 empty states. *"The first one lands tomorrow"* (briefings) doesn't adapt. Premium-feel says: when a customer's been with you a week, the empty state acknowledges that — *"Plaino's been quiet today; last briefing was Tuesday."*

### 4.4 Error states

- **Strong.** `InlineFlash` on integrations page handles `not-configured` / `disconnected` / `error` gracefully with brand-aligned banners (`integrations/page.tsx:191-228`).
- **Strong.** Help form, billing past-due, billing cancel-at-period-end all have first-class flash states.
- **Drop.** No global error-banner pattern for "your service partner is investigating" — when a connector breaks (auth expired, scope removed, vendor outage), where does that show up? The Activity log gets a row, but the overview doesn't elevate it. Premium-feel says: connector health gets a first-class card the moment something breaks.

### 4.5 Copy voice — service-partnership vs DIY tool

- **Strong.** Plaino name + service-partner sentence on overview, onboarding, settings, help, billing, data. *"Tell {partner} how you like things. Every setting here is a note to your service team, not a knob you have to fiddle with."* (`settings/page.tsx:109-112`) is the model line.
- **Strong.** "Your existing tools send." on approvals, integrations, onboarding — the no-outbound architecture is the single most-repeated copy beat. On-brand and architecturally honest.
- **Drop.** "Routine items send through automatically" on /approvals (`approvals/page.tsx:43-46`) — Journey 8 P1. Misleading.
- **Drop.** /agents page copy "Enabling or disabling capabilities is your service team's call today" (`agents/page.tsx:60-65`) — honest but walks the premium-tier promise back. Strand 1 says the operator should toggle disciplines themselves.
- **Drop.** First-name extraction returns "there" when the email local-part doesn't yield a name. Soft. A premium product asks once: "what should we call you?"

### 4.6 Brand fidelity (forest/clay/Fraunces per `docs/brand-and-claims.md`)

- **Strong.** Forest green + warm cream paper + clay (`#1F3D2E`, `#FBF7F0`, `clay`) hold everywhere I read. Hairline rules are 1px `border-rule`. Eyebrow mono-uppercase `tracking-eyebrow`. Fraunces (`font-display`) on every H1/H2/H3.
- **Strong.** `PlainoAvatar` is consistent across surfaces — overview header (md), onboarding header (lg), approval drafted-by row (xs).
- **Drop (minor).** Some click targets are slightly off: e.g. `IntegrationTile` clay-filled connect CTA is `px-4 py-2` (`IntegrationTile.tsx:103-111`) — tight for finger-targets on tablet. The heritage button variant is generally larger.

---

## 5. Prioritized UX backlog — ordered design+build items

### P0 — premium-feel today (do first; these are blocking the bar in the absence of Strand 1)

1. **Re-grade the 11+7 in-product/vertical-page runtime overclaims to `rooting` + `rootingNote`.** *(Doc-only edit per agent-interview master Tier i items 1-2. ~7 `content.ts` files. Trivial.)*
2. **Re-word /approvals copy "Routine items send through automatically" → "auto-marked APPROVED" or equivalent that doesn't read as agentplain-sends.** *(Journey 8 P1. One file: `approvals/page.tsx:43-46`.)*
3. **Add the Discipline axis.** *(Schema migration: `discipline VARCHAR(32)` on `WorkApprovalQueueItem` + `MarketplaceEntry`; lookup table for slug → discipline. Code-bearing but reversible.)*
4. **Marketplace facet + search + per-vertical filter + 3-group layout.** *(Redesign §3.5. Depends on #3.)*
5. **Approval queue grouped by discipline + "Needs you specifically" elevation.** *(Redesign §3.3. Depends on #3.)*
6. **Discipline panel as top-nav surface.** *(Redesign §3.1. Depends on #3.)*

### P1 — Strand 1 expanded fleet (do once #3 lands and waves 1–2 of Strand 1 ship)

7. **Workspace overview redesigned as "Working / Drafted / Needs you" 3-pane dashboard.** *(Redesign §3.4.)*
8. **Per-discipline detail pages `/disciplines/[discipline]`.** *(Redesign §3.8. Depends on §3.1.)*
9. **Per-vertical preset applied at first-run + preset-summary onboarding step 4.** *(Redesign §3.2.)*
10. **Fleet-side support handler + in-product support-thread UI.** *(Redesign §3.6.)*
11. **Weekly digest cron + briefing.** *(Redesign §3.7.)*
12. **Consolidate /agents and /fleet into one canonical surface.** *(Friction #13. Two doors → same roster is duplication that amplifies under load.)*
13. **Elevate /compliance into /approvals as the "Needs you specifically" facet.** *(Friction #19.)*

### P2 — polish

14. **Settings sectioned grouping (workspace + access / data + privacy / fleet + disciplines / billing + plan / team + notifications).** *(Friction #14.)*
15. **"Test the loop now" CTA post-first-connector in onboarding.** *(Friction #17.)*
16. **Data-footprint summary card in /settings.** *(Friction #11.)*
17. **Day-N-aware empty states (briefings, "what we did," etc.).** *(Premium gap §4.3.)*
18. **Marketplace icon refresh (color-tinted per discipline; bolder iconography).** *(Premium gap §4.1.)*
19. **"What should we call you?" prompt at signup so the eyebrow reads reliably.** *(Friction #22.)*
20. **Approval card master-detail layout on lg+ breakpoints.** *(Premium gap §4.2.)*

### P3 — minor

21. Connector health card on overview when something breaks. *(Premium gap §4.4.)*
22. Marketplace "available now / awaiting" → single label clean-up. *(Friction #15.)*
23. Confirm-details onboarding step compressed to accordion. *(Friction #16.)*
24. Disambiguate `TalkToFleet` vs `HelpForm` (different routing, near-identical UX). *(Friction #18.)*

---

## 6. What needs live user observation — assumptions I cannot verify from code alone

I tagged this exercise as a heuristic code-walk, not live user testing. The following claims are assumptions code cannot answer; recommend lightweight tests where named.

| # | Assumption | Why code cannot answer | Lightweight test |
|---|---|---|---|
| 1 | Magic-link signup completes in <60 seconds on a real Gmail + Outlook inbox without spam-foldering. | Resend deliverability is a runtime + sender-reputation question. | Send 10 magic-links to a mix of Gmail/Outlook/Yahoo/Apple addresses; measure inbox-vs-spam and time-to-arrival. |
| 2 | The "skip for now" affordance on onboarding step 2 is the right escape valve — a meaningful share of customers actually choose it and the product handles them well downstream. | I can verify the code path; I can't verify the *rate* or *downstream success* of "skip" users. | Track `OnboardingState.completedSteps` not including `connect_integration`; cohort their 30-day activity vs. completers. |
| 3 | "Your service partner connects this" non-clickable label is read as a deliberate service-partnership move, not as a dead button. | Honest defensive UX. But it's a non-click on a tile that looks otherwise clickable — that's a usability hazard if users don't read the label. | 5-user moderated test; ask "what would you click to connect QuickBooks?" while QuickBooks is configured-false. |
| 4 | The dynamic headline on workspace overview reads as "calm, operator-grade" rather than "fake-personalized." | Hard to know without watching a user encounter it. | Same 5-user test; ask "describe what's on this page." |
| 5 | The `LoopPreview` example empty-state isn't mistaken for live data. | I can verify the label says "example" — I can't verify a tired customer sees it. | Same 5-user test; before they connect anything, ask "what just happened?" |
| 6 | "Routine items send through automatically" is in fact misread as agentplain-sends. | I'm asserting this is the hazard from a literal reading; live users might or might not actually misread. | One question on the 5-user test: "If you approve this, who sends it?" |
| 7 | The approval queue flat list isn't a problem until ~5+ items/day. | I have no usage data on real customer queue depth. | Once the realty pilot has ≥7 days of data, query `WorkApprovalQueueItem.count() group by date` for the pilot workspace; segment by P0=1-3 / P1=4-9 / P2=10+. |
| 8 | The "your data" page's typed-confirmation closure flow is intuitive enough that a customer who wants to close DOES close — and a customer who DOESN'T want to close doesn't trip into it. | The typed-confirmation pattern is good defensive UX; verify it actually prevents accidents and doesn't block intentional closure. | 5-user test; one prompt: "Close this workspace." |
| 9 | The "Today's briefing" pane reads as useful when there IS a briefing — not just as a structured paragraph. | Notion-sourced briefings are real content with author intent; I can't tell from code if the briefing copy itself lands. | Read the last 5 briefings filed; rate quality 1-5. If <3, the pane is real estate spending on low-value content. |
| 10 | The Plaino service-partner voice is felt as a consistent character, not as scattered first-person copy. | Code shows Plaino name + avatar at 22+ call sites (per journey-map brand check). Whether the voice feels like *one* character vs *multiple* needs human ears. | Read the customer-facing copy aloud; flag any line where Plaino sounds like a different person. |
| 11 | The premium feel actually lands for a buyer in the brokerage-owner persona. | A heuristic eval against an aspirational bar isn't the same as a buyer's emotional read. | First-touch test: bring a brokerage owner (not Conner) to `/app/sign-up`, no priming, observe to "Your workspace is rooted" + 5 min of exploration. Ask: "What does this company do?" "Would you pay for this?" "What's missing?" |

**Recommended sequence.** Item #11 is the single highest-leverage test. Items #4, #5, #6, #8 ride along on the same session (5-user moderated test, ~45 min each). Items #1, #9 are cheaper internal checks Conner can do solo. Items #2, #7 wait for pilot data.

---

## Closing — three-line headline

**Current state vs premium bar.** The product is a clean, brand-honest single-vertical workspace built for one firing agent and one paying brokerage. It is B+ for what it claims to do today. It is built around `vertical` and `agentSlug`; it does not have the `discipline` seam Strand 1's expanded fleet requires.

**Single biggest UX blocker.** No `discipline` axis exists in the schema, copy, or UI. Strand 1's "8 disciplines" is the customer-facing organizing unit the product needs to lift, facet, group, and dashboard around — the absence of this axis cascades into broken affordances at the marketplace, the approval queue, the agent roster, and the overview.

**Single highest-leverage UX win.** Add the discipline column on `WorkApprovalQueueItem` + the `discipline` field on `MarketplaceEntry` + a single Discipline panel at top-nav. One schema migration + one new route + facets across 3 existing pages = four of Strand 1's premium UX requirements (§5.2, §5.3, §5.4, §5.5) unlocked at once. P0 backlog items 3–6 are the load-bearing wedge.
