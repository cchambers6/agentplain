# Settings — IA audit

## What this tab IS today

Settings (`/settings`) is the workspace **chrome bucket** — the place the
owner goes to tell Plaino "how I like things." The index
(`settings/page.tsx`) is a hairline list of **15 rows** (13 live + 2
"coming soon"): connections, work thresholds, autonomy, skill config,
marketplace, billing, pause your fleet, scheduling windows, discipline
heads, sign-in & security, activity, your data, voice & templates, plus a
conditional **demo data** row, plus coming-soon team-members and
notifications. Header copy frames the whole tab as notes to a service
team: "Every setting here is a note to your service team, not a knob you
have to fiddle with."

The index is **not just account chrome** — it is acting as a catch-all
launcher. Several rows are not settings at all: they deep-link OUT to
other top-level tabs (`connections` → Integrations, `activity` →
Activity, `marketplace` → Marketplace). The tab is doing double duty as
a navigation hub and a settings surface. That is the core IA problem.

Every sub-page is gated `requireWorkspaceMember(..., ["BROKER_OWNER"])`
(discipline-heads also accepts the newer `OWNER` role). So Settings is
owner-only today — there is no member-tier read view.

## Sub-route inventory

| Route | Purpose | Recommendation |
|---|---|---|
| `settings/` (index) | Hairline launcher list + workspace facts (name, slug, tier, state, billing mode, members, created) | **Keep in Account (E)** but strip the rows that are really nav-outs (connections, activity, marketplace) — those should not live in a settings list |
| `settings/billing` | Plan, seats, invoices, payment method, trial banner, past-due banner, usage panel, budget summary | **Keep in Account (E)** — true account chrome, the spine of bucket E |
| `settings/billing/UsagePanel` | Token + cost usage, per-discipline spend, cache savings | **Keep in Account (E)** under billing; consider a customer-facing "what Plaino did this month" framing |
| `settings/billing/BudgetSummary` | Monthly activity vs advisory budget; operator cap when set | **Keep in Account (E)** under billing |
| `settings/passkeys` | Add/remove passkeys for faster sign-in | **Keep in Account (E)** — pure sign-in/security chrome |
| `settings/data` | Export workspace JSON; close workspace | **Keep in Account (E)** — data/privacy chrome |
| `settings/pause` | Schedule a vacation/PTO/cutover window; fleet auto-resumes | **MOVE to Today/Plaino (A/B)** — this is an operational control the owner reaches for in-the-moment, not buried account chrome. A "pause Plaino" control belongs near where the work happens |
| `settings/schedule` | Constrain a skill to business hours / weekdays / a window | **MOVE to Plaino (B)** or fold into one "when Plaino works" control with pause |
| `settings/autonomy` | Which low-stakes reversible actions run without a click + dollar ceiling + log | **MOVE to Plaino (B)** — this is the "how much Plaino does on its own" product control, not chrome |
| `settings/work-thresholds` | Minimum severity that requires explicit approval per work kind | **MERGE into autonomy → Plaino (B)** — duplicates autonomy's job (see Duplications); two pages for one mental model |
| `settings/skills` | Per-skill knobs: wait-days, priority keywords, default meeting length | **MOVE to Plaino/Connections (B/C)** — this is product configuration; surface as "how Plaino handles X," not a "skills" page |
| `settings/voice` | Voice fingerprint, learned templates, corrections, sample draft | **MOVE to Plaino (B)** — "how Plaino sounds for me" is a Plaino-tuning control |
| `settings/discipline-heads` | Nominate one approver per discipline (8 disciplines) | **MOVE to Connections/Account team (C/E)** — team-routing; belongs with people/team mgmt once that ships |
| `settings/demo` | View/remove the seeded sample data; auto-clears on real data | **Keep but de-emphasize (E)** — onboarding artifact; fine as a conditional row, low priority |

## Customer job (JTBD)

A local-business owner comes to Settings to do one of four jobs:
1. **"Handle my account"** — pay, see invoices, change my plan, add a
   passkey, export my data, close down. (billing, passkeys, data)
2. **"Tell Plaino how much to do on its own and when"** — pause for
   vacation, set work hours, decide what runs without my click. (pause,
   schedule, autonomy, work-thresholds)
3. **"Tune how Plaino works for me"** — sound like me, handle each kind
   of task my way. (voice, skills)
4. **"Decide who on my team signs off on what."** (discipline-heads,
   coming-soon team members)

Only job #1 is true Account chrome. Jobs #2–#4 are **product controls
masquerading as settings**. That is the heart of the simplification: the
chrome bucket (E) should hold job #1; jobs #2–#3 belong with Plaino (B),
and the team piece (#4) belongs with people/team management.

## Duplications

- **autonomy vs work-thresholds** — the single biggest duplication. Both
  pages answer the identical question: "does this item run automatically
  or wait in /approvals for my click?" Their own `SettingAffects` strings
  are nearly word-for-word ("Whether a matching item waits in /approvals
  for your click or flows through automatically"). autonomy governs
  *which low-stakes classes* auto-run under a dollar ceiling;
  work-thresholds governs *the severity threshold per work kind*. To the
  owner these are one knob ("how much Plaino does on its own"), split
  across two pages with different vocabulary. **Merge.**
- **pause vs schedule** — both control *when* Plaino is allowed to work.
  pause = a one-off vacation window; schedule = recurring per-skill
  windows. Two pages, one mental model ("when does Plaino work?").
- **connections / activity / marketplace rows** duplicate the top-level
  nav. The Settings index re-lists tabs that already exist as their own
  destinations. Pure redundancy.
- **billing usage panel vs the Reports/Weekly-report bucket** — "where
  your spend went" and "what each agent is doing" overlap conceptually
  with reporting; keep cost in billing but watch for drift.

## Relationships

- **→ Integrations / Marketplace:** the index links straight into both;
  `skills` and `schedule` both read `SKILL_CATALOG` from the registry, so
  skill config is tightly coupled to what's connected — argues for
  skills living near Connections (C).
- **→ Approvals:** autonomy, work-thresholds, and discipline-heads all
  describe behavior of the `/approvals` queue (what skips it, what routes
  where). These pages are the *control panel for Approvals* — they belong
  wherever the approvals job lives, not in chrome.
- **→ Activity:** autonomy's auto-execute log and the `activity` row both
  surface "what Plaino did." Overlap with the Today/Reports buckets.
- **→ Billing/operator:** BudgetSummary and UsagePanel read the
  operator-set cap (`lib/billing/budget.ts`); the cost *judgment* lives on
  the operator board, the customer sees a calm advisory only.

## What's broken or confusing

- **Engineer-vocab leaks (PR #249 violations).** Heavy use of "fire,"
  "runtime," "skill slug," "autonomy," "work thresholds":
  - schedule: "when each **skill** is allowed to **fire**," "every skill
    **fires** whenever the work shows up," renders raw `w.skillSlug`.
  - skills page: "the running **skill** reads this value on every
    **fire**," "Saved — persists, but the **running skill** does not read
    it yet. Wires up in a future release" — exposes wiring state to the
    customer.
  - work-thresholds / autonomy titles use "thresholds," "severity,"
    "auto-execute," "platform-wide ceiling." These read as engineer
    jargon. Equivalents per the rule: "how much Plaino does on its own,"
    "Setting up / Working."
  - Several `SettingAffects` strings reference the literal `/approvals`
    route path to the customer.
- **"Saved but not wired yet" badges** (skills page) tell the customer a
  control is cosmetic. That is honest but it should not be a customer-
  facing knob at all — flag for removal/hiding until wired.
- **Two pages for one job** (autonomy+work-thresholds, pause+schedule)
  force the owner to learn two vocabularies for one decision.
- **The index mixes navigation and configuration**, so the owner can't
  tell "a place I go" from "a thing I set."
- **discipline-heads** warns the auto-fallback isn't built ("if you
  assign a head and they go on vacation, items pile up") — a load-bearing
  gap shipped to customers with a caveat rather than gated.

## What's working

- **No Conner-time / human-service leak.** I checked every sub-page: none
  expose Max/Custom-tier human-in-the-loop controls to lower tiers. The
  service framing ("note to your service team") is voice, not a control.
  This constraint is satisfied — no bug here.
- **Billing is correct and calm.** trial days read from
  `env.stripeTrialPeriodDays()` (not hard-coded), Max tier shows "Custom
  scope" with no productized price, past-due and trial banners are
  handled, usage is honest about whether it's metered to Stripe. Billing
  is the one sub-route that is genuinely well-placed account chrome.
- **data** export/close is clean, honest about retention (billing + audit
  rows survive close), good privacy posture.
- **Brand voice** on most pages is on-target heritage-calm ("Tell Plaino
  how you like things," "not a knob you have to fiddle with").
- **demo** auto-clears on real data and only shows conditionally — good
  onboarding hygiene.
- Every page reads durable state per-request (cold-start safe) and is
  owner-gated.

## Verdict

**SPLIT — Settings is the core of bucket E (Account) but is overloaded.**

- Bucket **E (Account)** keeps: **billing**, **passkeys**, **data**, the
  index workspace-facts block, and (de-emphasized) **demo**. This is the
  true chrome and the natural home of bucket E.
- Bucket **B (Plaino)** receives the product controls: **autonomy +
  work-thresholds merged into one "how much Plaino does on its own"**,
  **pause + schedule merged into "when Plaino works,"** **voice**, and
  **skills** (reframed as "how Plaino handles each task").
- Bucket **C (Connections)** is the better home for **skills**'
  per-integration knobs if they're tied to a connected tool, and for
  **discipline-heads** until a real Team/People surface exists (then move
  there).
- Kill from the Settings index: the **connections / activity /
  marketplace** rows — they're nav duplicates, not settings.

Net: KEEP a slim Account (E) settings tab; MOVE the four product-control
clusters to Plaino (B) / Connections (C); MERGE the two duplicated pairs.

## Migration notes

1. **Merge autonomy + work-thresholds** into one Plaino control:
   "Decide how much Plaino does on its own." One list, one vocabulary;
   the dollar ceiling + the severity threshold become two facets of the
   same row. Kills the worst duplication and the worst jargon.
2. **Merge pause + schedule** into "When Plaino works" (a vacation toggle
   + recurring windows). Surface a quick "pause Plaino" affordance on
   Today (A) for in-the-moment reach.
3. **Reframe skills + voice as Plaino tuning**, not a "skills" page. Drop
   the "Saved but not wired yet" customer-facing badges — hide unwired
   fields rather than shipping cosmetic knobs. Replace "fire" / "skill
   slug" / "runtime" with "Working" / task names per PR #249.
4. **Strip nav-out rows** (connections, activity, marketplace) from the
   Settings index; they already exist as destinations.
5. **discipline-heads → future Team surface.** Until then park in
   Connections/Account; gate or finish the unbuilt vacation-fallback
   before promoting it.
6. **Keep billing exactly as-is** — it's the cleanest sub-route and the
   anchor of bucket E. Verify trial copy stays env-driven (7-day default
   / 14-day CPA-Law) and the 14-day money-back is surfaced.
7. **Vocab sweep** across every retained page for: fire, runtime, skill
   slug, threshold, autonomy, severity, auto-execute, `/approvals` path.
8. **No tier-leak risk** to fix — confirmed no Conner-time/human-service
   control is exposed on any settings sub-page.
