# Overview — IA audit

Audited against `origin/main`. Source files (relative to `app/(product)/app/workspace/[id]/`):
`page.tsx`, `overview-view.tsx`, `PasskeyEnrollNudge.tsx`, `layout.tsx`.

## What this tab IS today

Overview is the default landing route (`""` in the `NAV` array in `layout.tsx`). It is
the daily report-back surface — `overview-view.tsx`'s own header comment calls it
"the daily report-back from the fleet."

It composes six things, all derived from a single server fetch in `page.tsx`:

1. **Computed headline** (`buildHeadline`) — a one-line natural-language summary of what
   happened: "We drafted 3 replies and flagged 1 item." Falls back to a watching state
   when everything is zero.
2. **Greeting + partner line** — time-of-day eyebrow (`timeOfDayLabel`), first name from
   email (`firstNameFromEmail`), a `PlainoStatus` pose icon whose state is derived
   (`sleep`/`fetch`/`sit`) from pause + pending counts, and the standing "Plaino is your
   service partner" paragraph.
3. **Vertical/tier strip** — vertical name + tier (mapped through `VERTICAL_TIER_DISPLAY`),
   plus a "rooting in" note for non-live verticals.
4. **Onboarding nudge** — an inline card when `onboardingComplete === false`, linking to
   the onboarding wizard. Also drives the top `NextActions` entry.
5. **Today's work feed** (`TodaysWork`) — the last 8 `handoffLogEntry` rows, or an
   `ApRootedEmptyState` + an illustrative `LoopPreview` sample when empty.
6. **Today's briefing** (`TodaysBriefing`) — the single most recent briefing body.
7. **Right rail** — `TodaysQueue` (counts of `pendingApprovals` + `openFlags`, link to
   `/approvals`) and `NextActions` (computed 1–3 deep-links via `buildNextActions`).

It fetches: pending approval count, open compliance-flag count, 8 recent handoffs, the
workspace vertical/tier, onboarding state, the active pause config, and the latest
briefing. It is a read-only roll-up — it owns no data, only links out.

Two cross-cutting banners are injected one level up in `layout.tsx`, NOT by this tab:
the billing-pause banner (`isWorkspacePaused`), the integration-health banner
(`getUnhealthyIntegrations`), and the `PasskeyEnrollNudge`. These render above Overview
but appear on every tab.

## Customer job (JTBD)

- When a customer **opens the app in the morning**, they want **a one-glance answer to
  "what did Plaino do for me and what needs me"** so they can **decide where to spend
  the next five minutes**.
- When a customer **has drafts or flags waiting**, they want **a single obvious door to
  the decisions queue** so they can **clear it without hunting through tabs**.
- When a customer **is brand-new and nothing has happened yet**, they want **proof the
  system is alive and a clear next step** so they can **trust it and finish setup**.

This is the canonical "Today" job. Overview is the only tab built around the daily
return-visit loop rather than a single object type.

## Duplications

- **Activity tab** — `TodaysWork` renders the same `handoffLogEntry` stream (last 8 rows)
  that the Activity tab exists to show in full. The "see fleet →" link in `TodaysWork`
  even points at `/agents`, not `/activity`, so the relationship between the two is
  already muddled.
- **Approvals tab** — `TodaysQueue` duplicates the approvals-queue count and the
  approve/edit/reject framing; the `NextActions` "Review N drafts" entry is a third copy
  of the same call-to-action. Three elements on Overview point at `/approvals`.
- **Compliance tab** — the `openFlags` count appears in both `TodaysQueue` and a
  `NextActions` "Triage N compliance flags" card, both linking to `/compliance`.
- **Briefings tab** — `TodaysBriefing` renders the latest briefing body inline,
  duplicating the `/briefings` list's top item.
- **Fleet / Agents tabs** — the headline ("We're working on N handoffs") and the "see
  fleet →" link surface fleet status that the Fleet and Agents tabs own in depth.
- **Onboarding** — the inline onboarding card + the high-urgency `NextActions` entry are
  the same nudge rendered twice within this one view.

Net: Overview is a roll-up of Activity + Approvals + Compliance + Briefings + Fleet. That
is by design for a landing page — but it means four of the current 13 tabs are things
Overview already previews.

## Relationships

- **Data in:** `page.tsx` reads `workApprovalQueueItem`, `complianceFlag`,
  `handoffLogEntry`, `workspace` (vertical/tier), `onboardingState`,
  `workspacePauseConfig`, and the briefings provider — all via `withRls`.
- **Data out:** none. Overview writes nothing; it only links.
- **Nav crossings (outbound links):** `/approvals` (x3 — queue card, next-action,
  empty-state implied), `/compliance` (x2), `/onboarding` (x2), `/integrations` (x2 —
  empty-state CTA + idle next-action), `/agents` ("see fleet"), `/settings/pause` (pause
  banner manage link).
- **Dependencies:** `servicePartnerForWorkspace` (Plaino name), `getVerticalContent`
  (vertical display + integration window), `PlainoStatus` component, the `ApRootedEmptyState`
  / `ApPaperCard` / `ApHairlineList` primitives.
- **Sibling-injected:** the pause, integration-health, and passkey banners come from
  `layout.tsx` and float above Overview on every route — so Overview is not their owner
  but is their most common backdrop.

## What's broken or confusing

Engineer-vocab leaks (violations of the PR #249 customer-vocab rule — these are the most
serious findings):

- **Raw agent slugs in the handoff feed.** `TodaysWork` and `LoopPreview` print
  `reader → router`, `router → scheduler`, `scheduler → drafter` plus the raw
  `handoffType` token (`categorize`, `schedule`, `draft`). These are internal pipeline
  node names, exactly the "agent slug"/"skill" surface the rule bans. The customer sees
  plumbing, not "Plaino read a new buyer inquiry and drafted a reply."
- **"rooting"/"rooted" leak.** The vertical strip renders "per-vertical fleet **rooting**
  in" and the empty state uses `ApRootedEmptyState`. "rooting" is the exact banned token;
  customer equivalent is "Setting up."
- **"fleet" / "fire" / "handoff" vocabulary throughout.** Headline fallback "We're working
  on N **handoffs**"; "see **fleet** →"; empty state "the first **handoff** lands once new
  mail or a webhook **fires**"; pause banner eyebrow "**fleet paused**". All engineer-facing.
  Plaino is supposed to be ONE named partner, not a "fleet" the customer manages.
- **"webhook" surfaced to the customer** in two empty-state strings.
- **`stale` token** printed verbatim in `TodaysBriefing` ("· stale").

UX / structure:

- **The headline says "We" but the standing line says "Plaino is your service partner."**
  Two different voices for the same actor on the same screen — "We drafted 3 replies"
  vs. a single named partner. Pick one (Plaino-first per brand rule).
- **"see fleet →" points at `/agents`, not `/fleet`.** Mislabeled link; the word and the
  destination disagree.
- **Three doors to the same queue.** `TodaysQueue`, the `NextActions` approvals card, and
  the empty-state all push to `/approvals` — redundant on a screen meant for one glance.
- **Pause is shown twice.** The `layout.tsx` billing-pause banner and the Overview
  `activePause` banner can both appear, with different copy and different "manage" targets
  (`/settings/billing` vs `/settings/pause`).
- **No dead-ends found**, and empty states are strong (see below).

## What's working

- **The computed headline is the single best IA idea in the product.** A natural-language
  "here's what happened" beats any KPI grid for the daily-return job. The file comment
  explicitly rejects "No KPI grid. No 'Welcome back!'" — that restraint is on-brand
  (calm heritage partner, not SaaS dashboard).
- **Empty states are genuinely good.** `ApRootedEmptyState` uses the reality→change
  structure, and `LoopPreview` shows a clearly-labeled "example · what lands here once
  mail flows" sample so a brand-new customer sees the SHAPE of value before any data
  exists. This is the right answer to the cold-start problem.
- **DB-free presentation split.** All copy/state logic lives in `overview-view.tsx` and is
  unit-tested (`tests/customer-workspace-home.test.tsx`); `page.tsx` is a thin loader.
  This makes the tab safe to restructure.
- **`PlainoStatus` pose derivation** (sleep/fetch/sit from existing data, no extra fetch)
  is exactly the "Plaino's current state" signal bucket B wants — and it already lives here.
- **`NextActions` is a real action queue**, prioritized by urgency, capped at 3 — the
  skeleton of the proposed "Today" tab.

## Verdict

**KEEP top-level → this IS the proposed "Today" tab (bucket A).**

Overview should not be merged into another tab or killed — it should be *renamed*
"Today" and become the evolved bucket-A surface. It is the only tab organized around the
daily return-visit job rather than a single object type, and it already contains the
three things "Today" needs: the action queue (`NextActions` + `TodaysQueue`), recent
activity (`TodaysWork`), and what-Plaino-is-working-on (headline + `PlainoStatus`).

Despite looking like a pure roll-up of Activity/Approvals/Compliance/Briefings, it is
**secretly load-bearing**: it is the default route, the cold-start proof-of-life, and the
only screen that answers "what do I do right now." Killing it would scatter that job
across four object-type tabs and break the morning loop.

## Migration notes

- **Rename Overview → "Today"** (bucket A). Keep the route at `""` as the default landing.
- **Absorb, don't link to, the duplicated surfaces.** As Activity, Approvals, Compliance,
  and Briefings get reorganized, Overview's inline previews become the *primary* surface
  for the daily glance, with the full lists demoted to deeper drill-ins (Approvals likely
  folds into Today's queue; Activity into Today's "what we did"; Briefings into Today).
- **Collapse the three approvals doors to one.** Keep `TodaysQueue` as the single CTA;
  drop the redundant `NextActions` approvals card or merge them.
- **Fix all engineer-vocab before the rename ships** (blocking, PR #249): translate the
  handoff feed and `LoopPreview` from `reader → router · categorize` into Plaino-voice
  past-tense sentences ("Plaino read a new buyer inquiry and drafted a reply — waiting for
  you"); replace "fleet"/"handoff"/"fire"/"webhook"/"rooting"/"stale" with
  Setting-up / Working / Watching / drafted / done. Rename `ApRootedEmptyState` usage copy
  away from "rooted."
- **Unify the voice to Plaino-first.** Replace the "We drafted…" headline construction with
  "Plaino drafted…" so the named-partner rule holds across the screen.
- **Move the standing pause logic up.** The Overview `activePause` banner and the
  `layout.tsx` billing-pause banner should be one banner system in bucket B (Plaino's
  state) or as a global strip — not duplicated with divergent copy and targets.
- **Keep `PlainoStatus` here**; it is the bucket-B "Plaino's current state" signal but it
  belongs on the daily-landing surface too. No need to move it — share the component.
- **No schema/data changes required.** Overview owns no writes; restructuring is pure
  presentation, and the DB-free `overview-view.tsx` + its test make that low-risk.
