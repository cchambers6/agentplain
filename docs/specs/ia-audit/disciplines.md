# Disciplines — IA audit

Tab: **Disciplines** (`/disciplines`), nav label "Disciplines" (3rd of 13 tabs —
`app/(product)/app/workspace/[id]/layout.tsx:19`). Files audited:
`disciplines/page.tsx`, `disciplines/actions.ts`,
`disciplines/[disciplineId]/page.tsx`,
`settings/discipline-heads/page.tsx`,
`settings/discipline-heads/DisciplineHeadForm.tsx`.

## What this tab IS today

A grid of 8 cards — analytics, research, legal, marketing, sales-enablement,
customer-success, finance, operations — sourced from `listDisciplines()`
(`lib/disciplines/index.ts`). The 8 disciplines are a hard-coded, locked
taxonomy (the "customer-facing organizing unit ABOVE the vertical axis" per the
module doc comment). Each card on `disciplines/page.tsx`:

- Shows a name + service-partner description (e.g. "We chase the unpaid invoice…").
- Derives a live **status** from real wiring — `deriveStatus()` returns
  `active` / `connector-needed` / `build-pending` based on whether a mapped
  agent/skill exists AND whether a credential is connected. This is genuinely
  computed, not a label (the file is heavily commented "derived from actual
  wiring, never a label").
- Surfaces a customer sentence via `customerStatusSentence()` ("Working ·
  3 workers, all connections live" / "Setting up" / "connection needed").
- Has an **on/off toggle** (iOS-switch) wired to `toggleDisciplineAction`
  (`disciplines/actions.ts` → `setDisciplineEnabled`). Turning a discipline off
  stops Plaino surfacing work in it.
- Links to a per-discipline detail page and (when a connector is missing) a
  "Connect X to start" button routing into Integrations.

The detail page (`disciplines/[disciplineId]/page.tsx`) is a deep dossier on one
discipline with **four sections**: connectors this discipline reads from; agents
+ skills in the discipline (roster + `SKILL_CATALOG` filtered by vertical);
a per-skill **scorecard** (drafts·7d, acceptance·7d, last fire, rules applied —
real numbers via `buildSkillScorecard`); and recent approvals filtered to that
discipline, with a "open the full queue →" link into Approvals.

The fifth file lives under **Settings** (`settings/discipline-heads/`): an
owner-only routing control to nominate a "head" per discipline so new
approval-queue items in that discipline route to one named person
(`lib/auth/route-approval.ts`). That is an approver-routing setting, not part of
the tab's grid.

## Customer job (JTBD)

The honest customer job this tab serves: **"Across the areas of my business, what
is Plaino actually doing for me, what is waiting on me to connect something, and
what hasn't started yet — and can I turn an area off?"**

That is a real job. But notice it is a *cross-cutting status + control* job, not a
"browse my org chart" job. The valuable atoms are: (1) per-area status truth,
(2) the on/off control, (3) the per-area drill into recent work + connectors.
The *framing device* ("disciplines") is the weak part — see below.

## Duplications

This is one of the three suspected-duplicative roster tabs, and the overlap is
concrete, not vibes:

- **vs. Agents** (`agents/page.tsx` + `agents/AgentsFleetGrid.tsx`): Agents reads
  the SAME `listDisciplines()` and the SAME `AGENT_DISCIPLINE` mapping, then
  renders discipline names as **filter chips** over the roster, AND carries its
  own activation/`getActivationState` plumbing. So "disciplines" already exists
  inside Agents as a facet. Disciplines-tab and Agents-tab are two top-level
  entries built on the identical `lib/disciplines` + roster + activation
  primitives — one as a grid-of-areas, one as a grid-of-workers-filtered-by-area.
- **vs. Fleet** (`fleet/page.tsx`): Fleet is the "one customer surface that brings
  the four panels together" — fleet map (roster grouped live/rooting), a to-do
  board of approvals by status, an activity stream of handoffs, and talk-to-fleet.
  Disciplines-detail re-renders a roster slice (agents+skills) and a
  recent-approvals slice — both of which Fleet already shows whole.
- **vs. Approvals**: the detail page's "recent approvals in <discipline>" section
  is literally `workApprovalQueueItem.findMany` filtered by discipline, then links
  out to `/approvals?discipline=…`. It is a pre-filtered view of the Approvals tab.
- **vs. Integrations**: "connectors this discipline reads from" re-lists
  marketplace entries (`entriesForDiscipline`) that the Integrations tab owns; the
  "Connect X to start" button routes straight into Integrations.

So the Disciplines tab is mostly a **lens** assembled from data four other tabs
already own. Its one non-duplicated atom is the **on/off activation toggle** and
its derived per-area status sentence.

## Relationships

- Reads from: `lib/disciplines` (taxonomy), `lib/disciplines/activation`
  (on/off + `getActivationState`), `lib/disciplines/skill-mapping`
  (`AGENT_DISCIPLINE`/`SKILL_DISCIPLINE`), `lib/verticals` (roster),
  `lib/skills/registry` (SKILL_CATALOG), `lib/integrations/marketplace`,
  `lib/skills/skill-scorecard`, `workApprovalQueueItem`.
- The `discipline` value is a real DB column on `WorkApprovalQueueItem` and a
  field on marketplace entries — so disciplines are **load-bearing as a data
  axis** even if the *tab* is not load-bearing as UI. Killing the tab does not
  kill the taxonomy; the activation toggle and routing still need a home.
- Shared with Agents (facet + activation), Fleet (roster + approvals), Approvals
  (queue filter), Integrations (connector mapping), Settings (discipline-heads).

## What's broken or confusing

- **"Disciplines" is engineer/org-chart vocab leaking to the customer.** A local-
  business owner does not think "I have a sales-enablement discipline." This is the
  internal fleet-org taxonomy (the module doc literally cites
  `docs/fleet-expansion-plan` and "8 disciplines × 11 verticals"). The page even
  apologizes for it in the H1 ("Eight disciplines, one service partner"). The
  customer thinks in *outcomes* ("my invoices," "my marketing"), not disciplines.
- **Detail page is riddled with raw jargon leaks** (violates PR #249 customer-vocab
  rule): it renders `a.slug` and `catalog.slug` (agent/skill slugs) as visible
  text; status badges read **"rooting"** and **"live"** (`a.runtime === "live" ?
  "live" : "rooting"`); approval rows show `item.kind · item.agentSlug` and raw
  `refTable:refId`; section headers say "agents + skills in …". `isRooted` variable
  surfaces "rooting" framing. The top-level grid was *cleaned* (Fix 1–6 comments
  removed slug-as-text and the AGENTS/SKILLS counter grid) but the detail page was
  NOT given the same treatment — it is the worst customer-vocab offender in the tab.
- **Three tabs, one roster** is the headline confusion: a customer landing on
  Disciplines, Fleet, and Agents sees three different arrangements of the same
  workers and cannot tell what each is *for*.
- **discipline-heads under Settings** is a powerful, risky control (assigns a single
  approver who can block a whole area) buried two levels deep, with a self-admitted
  gap ("auto-fallback to owner … is queued for the next wave" — items pile up if a
  head goes on vacation). It is disconnected from the Disciplines tab it governs.
- "sales-enablement" displays as "Sales enablement" — fine as a label, but it is the
  most B2B-jargon of the eight for a local-business owner.

## What's working

- **The status derivation is honest and well-built.** `deriveStatus()` refuses to
  claim "Working" unless a real connector AND a real worker exist; the bottom
  ApPaperCard states this contract plainly. This is the brand-v2 "we don't claim
  live work that isn't running" promise made literal — genuinely good.
- **The top-grid customer-vocab cleanup** (Fix 1–6 comments) already did the hard
  work of translating to "Setting up / Working / connection needed" and removing
  the misleading counter grid. That translation layer is reusable.
- **The on/off toggle** is a real, customer-meaningful control with no duplicate
  anywhere else — this is the load-bearing atom.
- **The scorecard** (drafts/acceptance/last-fire per skill) is the only place real
  per-worker performance numbers surface to the customer — valuable, just mislabeled.

## Verdict

**MERGE INTO bucket C (Connections) — and split the load-bearing atoms out.**
Do NOT keep "Disciplines" as a customer-facing top-level tab; the word is
org-chart vocab and the grid is a lens over data four other tabs own.

Recommended decomposition:
- **Fold Disciplines + Fleet + Agents into ONE bucket-C surface** ("Connections" /
  the place you manage what Plaino works on and what it's plugged into). Disciplines
  becomes a *grouping/filter* inside that surface (as it already is in Agents), not
  a sibling tab. This collapses 3 tabs → 1.
- **Keep the on/off activation control** as the one unique atom — surface it as a
  per-area toggle inside bucket C. This is the only thing that would be *lost* by
  killing the tab.
- **Move the recent-approvals + scorecard slices** to where they belong: approvals
  drill stays a filter on **Reports/Approvals**; the scorecard is a **Reports (D)**
  artifact, not a navigation primitive.
- **`settings/discipline-heads` → bucket E (Account/Settings)** where it already
  lives; relabel away from "discipline" toward "who approves what" (the H1 already
  says this — good) and connect it to the activation control conceptually.

Net: the Disciplines *tab* dies as a top-level entry; the *taxonomy* survives as a
data axis and an in-surface filter; the *toggle* survives as a control in C.

## Migration notes

- **Do not delete `lib/disciplines`.** It is a load-bearing data axis: the
  `discipline` column on `WorkApprovalQueueItem`, marketplace `disciplines[]`, the
  `AGENT_DISCIPLINE`/`SKILL_DISCIPLINE` maps, and `route-approval.ts` all key off
  these 8 ids. This is the "secretly load-bearing" finding — kill the tab, keep the
  module.
- **Relabel before merging.** Pick customer-outcome names for the 8 (or collapse to
  ~5 the owner recognizes) before they become in-surface filter chips. "Disciplines"
  the word should not appear on any customer surface.
- **Fix the detail-page vocab leaks during migration** (raw slugs, "rooting"/"live",
  `kind·agentSlug`, `refTable:refId`) — these violate PR #249 and were never cleaned
  the way the top grid was. If the detail page survives as a drill-in inside C, it
  needs the same Fix-1–6 translation pass.
- **Preserve the activation toggle's server action** (`setDisciplineEnabled`) and
  `getActivationState` — re-point its UI into the merged C surface; the action and
  RLS plumbing are reusable as-is.
- **Re-home discipline-heads** under Account/Settings with a link from wherever the
  activation toggle lands, and ship the queued auto-fallback-to-owner before
  promoting it (today a head on vacation silently blocks an area).
- **De-dupe with Fleet/Agents waves**: the Fleet, Agents, and Disciplines IA specs
  must converge on a single bucket-C surface — do not migrate this tab in isolation.
