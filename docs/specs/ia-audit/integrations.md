# Integrations — IA audit

> Tab audited: **Integrations** (`/integrations`). Source read at `HEAD`
> (`plan/production-growth-2026-06-03`) via `git show`. `rent-collection/`
> does NOT exist at HEAD — it lives only on the unmerged
> `buildium/adapter-and-killer-workflow` branch and was read from there.

## What this tab IS today

The Integrations tab is the **connection marketplace** — the surface where a
local-business owner wires Plaino into the tools they already use (Gmail,
QuickBooks, Buildium, Follow Up Boss, etc.). It is one of the most
load-bearing tabs in the product: nothing Plaino does has value until a
connection exists, so this is the on-ramp to all real work.

Files and what each does:

- `integrations/page.tsx` — the marketplace grid. Loads
  `IntegrationCredential` rows + the `listIntegrations()` catalog,
  filters by the workspace's vertical (`entryAppliesToVertical`), computes
  a status per tile (`connected` / `available` / `coming-soon`), and a
  counts strip ("X connected · Y available now · Z awaiting connection · N
  coming soon"). Header copy is good Brand-v2 voice: "Bring us into the
  tools you already use." Renders an empty-state when the vertical has no
  catalog entries.
- `integrations/MarketplaceFacets.tsx` — client component holding the
  discipline filter chips + the vertical badge ("your vertical · CPA").
  Counts each discipline against the vertical-filtered tiles, greys out
  empty disciplines. Renders the `IntegrationTile` grid.
- `integrations/ConnectionFlash.tsx` — one-time `ApPaperSheet` slide-over
  shown on return from an OAuth grant ("Gmail is connected."). Rewrites the
  URL on close so it doesn't re-fire. Routes back to onboarding vs.
  workspace depending on `onboardingComplete`.
- `integrations/[integrationId]/page.tsx` — the connection detail screen:
  description, connect CTA (OAuth or API-key form), coming-soon waitlist
  state, not-configured "your service partner wires it" state, and — when
  connected — a `connection details` table plus Test / Disconnect actions.
- `integrations/[integrationId]/actions.ts` — the disconnect server action.
  A careful three-phase teardown: delete the credential + write an audit
  row, purge that provider's ingested customer documents/embeddings, then
  audit the deletion counts. This is genuinely customer-owned data privacy
  and is the strongest code in the tab.
- `rent-collection/page.tsx` (buildium branch only) — a **vertical
  workflow dashboard**, not chrome: reads the Buildium rent roll, shows
  at-risk dollars + chase buckets (soft chase / formal notice /
  escalation), recent drafted chases, and a "sync now" button. Gated to
  `PROPERTY_MANAGEMENT` vertical (`notFound()` otherwise).
- `rent-collection/SyncButton.tsx` — POSTs to `/api/integrations/buildium/sync`
  and surfaces the plain-language result inline.

## Customer job (JTBD)

> "Let Plaino into my tools so it can actually do my work — and let me see
> at a glance whether it's wired up or still waiting on me."

A broken or missing connection is the #1 reason value silently never fires
(per the audit memory). So the real job this tab serves is **trust that the
plumbing is done**: "Is Plaino connected to my email / my books / my
property software? If not, what do I tap?" The customer does not care about
"integrations" as a category — they care that the work happens.

Rent-collection is a *different* JTBD ("chase my late rent for me") that
happens to depend on a connection. It is an outcome surface, not a setup
surface.

## Duplications

This is the biggest finding in the audit. **There are two near-identical
catalog surfaces:**

1. `/integrations` — the *connection* marketplace (Gmail, QuickBooks,
   Buildium…) with vertical + discipline facets and connect/disconnect.
2. `/marketplace` — the *skill* marketplace (`marketplace/page.tsx`),
   listing `SKILL_CATALOG` with install/uninstall + the same discipline +
   vertical facet pattern.

They share the mental model ("a filtered catalog of capabilities, faceted
by discipline and vertical") and even share the discipline list
(`listDisciplines()`). To the customer these are the same idea — "what is my
setup, and what can I turn on" — split across two tabs by an internal
distinction (a *connection* vs. a *skill*) the customer should never have to
learn.

Secondary duplications:

- **Facet machinery is reimplemented twice.** `MarketplaceFacets.tsx`
  (client, `useState`) and `marketplace/page.tsx` (server, URL `?discipline=`)
  solve the identical "filter a catalog by discipline" problem two different
  ways.
- **Connection status is told in three places.** The marketplace tile
  status, the detail page's `connection details` table, and the
  rent-collection page's "Buildium connected" badge each re-derive "is this
  ACTIVE" from `IntegrationCredential`.
- **The "not open for self-connect yet / your service partner wires it"
  message** appears as an inline flash (`page.tsx` `InlineFlash`), a detail
  empty-state, and the marketplace not-configured copy.

## Relationships

- **Onboarding** drives users here (the OAuth return routes back into
  onboarding via `ConnectionFlash`). Connections are step 2 of first-run.
- **Approvals** is downstream: rent-collection drafts land in
  `/approvals` (linked directly from the rent-collection copy). The whole
  value chain is connect → Plaino reads → drafts queue in Approvals.
- **Agents / Disciplines / Fleet** are the "what Plaino can do" side of the
  same setup story; `/integrations` is the "what it's connected to" side.
- **`/marketplace`** is the skill catalog — adjacent and overlapping (see
  Duplications).
- **Settings** owns pause/disconnect-adjacent controls; disconnect itself
  lives on the detail page here, with audit-trail guarantees.

## What's broken or confusing

1. **`/marketplace` and `/rent-collection` are orphaned routes.** Neither is
   in `layout.tsx`'s `NAV` array (the nav lists Overview, Talk, Disciplines,
   Fleet, Activity, Approvals, Agents, Compliance, Briefings, Integrations,
   Settings, Help — no Marketplace, no Rent collection). They are reachable
   only by deep link. A real killer workflow (rent autopilot) has no front
   door.
2. **Customer-vocab leaks (PR #249 violations):**
   - `ConnectionFlash.tsx`: "Once new mail or **webhooks** land, your
     **fleet** drafts…" — both "webhooks" and "fleet" are engineer-vocab on
     a customer surface.
   - `[integrationId]/page.tsx` connection-details table exposes **"token
     expires"**, **"granted scopes"** (raw scope strings), and "removes
     agentplain's **grant**" — OAuth internals the SMB owner shouldn't see.
   - `/marketplace` (the adjacent dup) is worse: it surfaces **"runtime"**,
     **"schema-only"**, **"won't fire"**, **agent slug**, **"kind"** — a
     wall of engineer language. (Relevant because if these merge, this copy
     must be rewritten, not carried over.)
3. **"awaiting connection" vs "available now"** is an honesty split driven
   by whether env vars are configured (`isIntegrationConfigured`). Correct
   and honest, but the four-way counts strip ("connected · available now ·
   awaiting connection · coming soon") is a lot of states for an owner to
   parse.
4. **Two facet systems, two UX behaviors** (client toggle vs. URL nav) for
   the same job — inconsistent and confusing if a customer moves between
   `/integrations` and `/marketplace`.
5. **rent-collection lives under `/rent-collection`** as a top-level
   workspace route but is really a property-management *outcome*, not a
   setup screen — its home is ambiguous.

## What's working

- **The disconnect teardown (`actions.ts`) is excellent** — three-phase,
  RLS-guarded, audits both the revoke and the data purge, surfaces real
  errors instead of silent success. This is genuine data-privacy
  craftsmanship and must survive any IA change unchanged.
- **Per-vertical catalog filtering is the right call** — a CPA never sees
  realty-only tiles. The vertical badge explains *why* the catalog is short.
- **Header + body voice is on-brand** — calm, plain, "nothing leaves your
  accounts and nothing sends without your hand on it." This is the model
  the rest of the bucket should match.
- **The honesty seams** (not-configured → "service partner wires it",
  coming-soon → waitlist) are correct and respectful — they never show a
  live-looking button that dead-ends.
- **rent-collection is a real killer-workflow surface** — at-risk dollars +
  bucket counts + "sync now" is exactly the value-at-a-glance an owner
  wants. It just needs a home and a front door.

## Verdict

**KEEP as the anchor of bucket C (Connections), and ABSORB the orphaned
`/marketplace` skill catalog into it.** Target bucket: **C) Connections.**

Recommendation in detail:

- **Integrations → Connections (bucket C), as the core of that bucket.**
  Rename to customer vocab ("Connections" — already the in-page eyebrow says
  "your connections" and the breadcrumb says "back to connections", so the
  product already calls it that internally). This is the right anchor: a
  connection is what lets Plaino do the work.
- **MERGE `/marketplace` (skills) INTO Connections.** The customer's mental
  model is one thing — "my setup: what Plaino is wired into and what it can
  do." Splitting connections from skills is an engineering distinction.
  Present them as one faceted "Setup" surface with two honest sub-sections
  ("Connected tools" and "What Plaino can do"), de-duplicating the facet
  machinery. **Agents / Disciplines / Fleet** are the same story and should
  fold in here too as the "what Plaino can do" view — Connections becomes
  *the* "your setup" surface, collapsing 4 of today's 13 tabs (Disciplines,
  Fleet, Agents, Integrations) plus the orphan Marketplace into one.
- **rent-collection → MOVE OUT of Connections.** It is a vertical *outcome*,
  not setup. It belongs with **Today (A)** or as a vertical workflow card
  surfaced from Today/Reports — wherever per-vertical "here's what Plaino
  did / is about to do" lives. Its *connect-Buildium* empty-state can deep
  link into Connections, but the dashboard itself is not chrome.

So: **Connections = integrations + skills/agents/disciplines as one "your
setup" surface.** Not integrations-only.

## Migration notes

1. **Wire the orphans first (pre-merge, do not lose them).** `/marketplace`
   and `/rent-collection` are not in `NAV`. Before any IA refactor, decide
   their fate explicitly — `/rent-collection` only exists on
   `buildium/adapter-and-killer-workflow` and will be lost if that branch
   isn't landed.
2. **Carry `actions.ts` disconnect verbatim.** The three-phase teardown +
   audit is load-bearing for the data-privacy story (PR #91). Do not
   "simplify" it during the merge.
3. **Rewrite the vocab on the way in (PR #249).** Before surfacing in
   Connections: kill "webhooks"/"fleet" in `ConnectionFlash`, hide "token
   expires"/"granted scopes"/"grant" from the detail table (keep an internal
   "Active / Reconnect needed" status only), and do NOT carry
   `/marketplace`'s "runtime"/"schema-only"/"won't fire"/"slug"/"kind" copy
   — translate to "Working / Setting up / Coming soon."
4. **Unify the two facet implementations** into one component (prefer the
   URL-driven server pattern for shareable/deep-linkable filter state).
5. **Collapse the counts strip.** Four states ("connected · available now ·
   awaiting connection · coming soon") is too granular for the owner;
   consider "X connected · Y you can add · Z coming soon," folding
   "awaiting connection" into a per-tile state.
6. **Preserve per-vertical filtering + the vertical badge** — they're
   correct and prevent the realty-tiles-in-a-CPA-workspace confusion.
7. **rent-collection's Buildium empty-state** should deep link into the
   Connections detail for Buildium (`/integrations/buildium` today) so the
   "connect → outcome" loop stays intact after the move.
