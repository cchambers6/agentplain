# Agents — IA audit

> Tab under audit: **Agents** (`/agents`) plus its closely-coupled sibling
> **Marketplace** (`/marketplace`). Read-only planning doc. Files cited:
> `agents/page.tsx`, `agents/AgentsFleetGrid.tsx`, `agents/[slug]/page.tsx`,
> `marketplace/page.tsx`, `marketplace/actions.ts`, and for comparison
> `disciplines/page.tsx`, `fleet/page.tsx`, `layout.tsx`.

## What this tab IS today

`agents/page.tsx` renders a **grid of capability cards** — one per entry in the
workspace's vertical roster (`getVerticalContent(verticalSlug).agentRoster`).
Each card shows: the raw `agent.slug` (mono, uppercase), a display name, a
one-line `job`, a derived status sentence, a "Needs a connector" badge when a
`liveRequires` connector is unfulfilled, and a discipline tag. The page header
reads *"Your fleet — each capability scoped to one job."* and links out to
`/disciplines` for on/off control.

`AgentsFleetGrid.tsx` is a client component adding **discipline filter chips**
(all / analytics / research / marketing / …) over that same grid. Clicking a
card routes to `agents/[slug]/page.tsx`.

`agents/[slug]/page.tsx` is the **per-capability detail page**: it resolves the
slug to its roster name/job, then shows two real-data sections — *"awaiting your
decision"* (PENDING `WorkApprovalQueueItem` rows for that `agentSlug`) and
*"recent handoffs"* (`HandoffLogEntry` where `fromAgent`/`toAgent` matches). It
surfaces raw `item.kind`, `refTable:refId`, and `fromAgent → toAgent` strings.

`marketplace/page.tsx` is a **catalog of every skill** in `SKILL_CATALOG`, with
discipline + vertical facet filters and per-skill install/uninstall forms wired
to `marketplace/actions.ts` (`installSkillAction` / `uninstallSkillAction`,
which upsert `WorkspaceSkillInstallation` + write an audit row). Its header also
reads *"Your fleet — install, uninstall, keep honest."*

**Critical structural finding:** Marketplace is **NOT in the nav** — `layout.tsx`
`NAV` array (lines 16–30) lists Agents but has no `/marketplace` entry. The
catalog where a customer *adds* capability is an orphan route, reachable only by
deep link or facet cross-links from Disciplines. The discovery path is broken.

## Customer job (JTBD)

A local-business owner ("I hired a done-for-you AI partner") has at most two
honest jobs near this surface:

1. *"Show me the team behind Plaino so I trust there's real machinery."* — a
   reassurance/transparency job. Low frequency; once or twice, early.
2. *"Add a capability — Plaino isn't doing X yet, can it?"* — a growth job. This
   is the Marketplace's job, and it's the only **action-bearing** one.

The per-agent detail page ("what has *this* agent been doing") is an
engineer's mental model, not an owner's. An owner asks "what got done this
week" (Activity / Weekly report) or "what needs me" (Approvals) — never "what
did the `follow-up-chaser` slug do." There is **no owner JTBD** that requires a
13-card roster grid plus 1 detail page per card.

## Duplications

This is one of the three most-duplicative tabs. **Agents, Disciplines, and Fleet
all render the same roster three ways:**

- **Agents** (`agents/page.tsx`) — flat grid, one card per `agentRoster` entry,
  discipline filter chips, per-agent drill-down. *Granularity: the agent.*
- **Disciplines** (`disciplines/page.tsx`) — the same roster **grouped by
  discipline**, each card a worker count + on/off toggle
  (`toggleDisciplineAction`). *Granularity: the discipline (a bucket of agents).*
- **Fleet** (`fleet/page.tsx`) — a "Fleet map" panel renders the **same roster
  again** (grouped live/rooting), bundled with a to-do board, activity stream,
  and talk-to-the-fleet box. *Granularity: mission-control dashboard.*

So the roster is drawn **3×**. Concretely:
- Agents' status derivation (live / rooting / needs-connector / handoff count)
  overlaps Disciplines' `deriveStatus` and Fleet's grouped map.
- Both Agents and Marketplace headers literally say *"Your fleet"* — two
  different surfaces claiming the same name.
- Agents' per-card discipline tag + filter **duplicates** the entire
  Disciplines tab's reason for existing (discipline as an organizing facet).
- The agent-detail "awaiting your decision" section duplicates **Approvals**
  (same `WorkApprovalQueueItem` PENDING rows, just filtered by `agentSlug`).
- The agent-detail "recent handoffs" duplicates **Activity** and Fleet's
  activity stream (same `HandoffLogEntry` source).

Marketplace (skills) and Disciplines both filter by discipline + vertical and
both manage what's wired up — Marketplace at the skill grain, Disciplines at the
bucket grain. Same data domain ("what capability is on"), two surfaces.

## Relationships

- **Agents → Disciplines**: Agents header explicitly hands off on/off control to
  Disciplines ("to turn whole disciplines on or off … open your disciplines").
  Agents is read-only display; Disciplines is the control. They are two halves of
  one idea split across two tabs.
- **Agents detail → Approvals + Activity**: the detail page is a *filtered view*
  of those two tabs, scoped to one agent.
- **Marketplace → Integrations**: a skill's `liveRequires.connectors` means
  installing the skill is meaningless until the connector is wired in
  Integrations. The "Needs a connector" badge on Agents points at the same gap.
  Marketplace + Integrations together answer "what's wired up."
- **Marketplace → Disciplines**: cross-linked via shared `?discipline=` /
  `?vertical=` facets; Disciplines page imports marketplace helpers.

All five surfaces (Agents, Marketplace, Disciplines, Fleet-map, Integrations)
are facets of a single customer question: **"What is Plaino set up to do, and
what's wired up to power it?"** — i.e. proposed **bucket C, Connections.**

## What's broken or confusing

- **Brand violation — multi-agent machinery leaks.** The whole tab contradicts
  "Plaino is ONE named partner." It surfaces a 13-card roster of named "agents,"
  each with a slug, inviting the owner to think of a *team of bots* rather than
  one partner. The per-agent page deepens this ("what *this* agent has been
  doing"). Per PR #249 customer-vocab rule, this is the single biggest tension.
- **Raw engineer vocab on the surface.** Cards print `agent.slug` in mono
  uppercase (`follow-up-chaser` etc.). The detail page prints `item.kind`,
  `refTable:refId`, and `fromAgent → toAgent` handoff strings — pure internal
  plumbing. "handoffs," "runtime," "rooting" (in `rootingNote` fallbacks),
  "fires" (Fleet) all leak. These are exactly the banned terms.
- **Marketplace is undiscoverable** — not in nav (confirmed `layout.tsx`). The
  one action-bearing surface in this cluster is an orphan.
- **Two surfaces both titled "Your fleet"** with different content = confusing.
- **"install / uninstall" framing** is app-store/engineer language for a
  done-for-you owner who was told Plaino is configured *for* them. It also
  partly contradicts the done-for-you promise ("we set it up" vs "you install").
- **Empty by default.** Status sentences are almost all "Setting up — first
  activity lands soon" / "Watching — ready when triggered" because prod LLM is
  paused by policy. A grid of "setting up" cards reads as a dead tab.

## What's working

- **Honest status derivation.** `liveRequiresSatisfied` + the status ladder
  degrade a card to "Connect Google Calendar to activate…" instead of faking
  live — genuinely good and load-bearing trust logic. This is the one piece
  worth preserving wherever the roster lands.
- **Customer-vocab status strings** ("Setting up" / "Working — N items
  surfaced" / "Watching — ready when triggered") already follow the PR #249 map
  on the *status line* — the slug above it is what breaks the rule.
- **Marketplace honesty.** "coming online" badge + "install now, activates when
  it goes live" copy is honest about schema-only skills (audit §9 #5).
- **Per-agent detail reuses real data** (approvals, handoffs) — no fabrication.
- **Accessibility** on the filter chips (`aria-pressed`, focus rings) is solid.

## Verdict

**MERGE INTO Connections (bucket C) — and REPLACE the per-agent grid model.**

Specifically:
- **Agents tab as it exists → KILL** as a standalone nav item. Its honest
  job ("the team behind Plaino") is a *trust panel*, not a 13-card management
  grid, and its status logic should be absorbed.
- **Agents + Disciplines → COLLAPSE into one "Connections / Your setup"
  surface** (bucket C). Disciplines (bucket-grain on/off) is the right
  granularity for an owner; the flat agent grid is the wrong one. Keep
  discipline cards as the primary view; demote the individual-agent list to an
  optional expandable "who's on this team" disclosure inside a discipline — re-
  voiced so it never reads as "13 bots."
- **Marketplace → MOVE into the same Connections bucket** as the "add a
  capability" tab, and **put it in the nav** (it currently isn't). Re-frame
  "install/uninstall" as "turn on / pause" to fit done-for-you + the Plaino
  one-partner voice.
- **Per-agent detail (`[slug]/page.tsx`) → KILL.** Its two sections are already
  Approvals and Activity filtered; redirect those needs to those tabs.

Net: three roster renders (Agents/Disciplines/Fleet-map) collapse toward one
owner-grain Connections surface, and the engineer-grain agent roster stops being
a top-level customer destination.

## Migration notes

- **Preserve the honesty engine.** `liveRequiresSatisfied`, `formatConnectors`,
  and the status ladder in `agents/page.tsx` are the load-bearing trust logic —
  lift them into the Connections/Disciplines surface; do not lose them in the
  merge. The "Needs a connector" affordance is the one thing customers act on.
- **De-slug before merging.** Strip `agent.slug` from any customer view; lead
  with `name`/`job`. Audit the detail page's `item.kind` / `refTable:refId` /
  `fromAgent → toAgent` strings — none can survive on a customer surface.
- **Marketplace must enter the nav** (`layout.tsx` `NAV`) as part of bucket C,
  or be folded as a tab within the Connections surface. Today it's an orphan —
  fixing discovery is a prerequisite, not a nicety.
- **Resolve the "Your fleet" title collision** — only one surface keeps a
  brand-safe name (e.g. "Your setup" / "What Plaino's doing"); neither should
  say "fleet" to a customer ("fleet" is internal vocab too).
- **Detail-page redirects.** If `[slug]` pages are killed, 301/redirect
  `agents/[slug]` → Approvals or Activity pre-filtered, so no deep links 404.
- **Decision for Conner:** does the "team behind Plaino" transparency view
  survive at all? If yes, it's a *read-only reassurance panel* inside
  Connections (re-voiced as Plaino's capabilities), **not** a manageable grid.
  This is a brand call, not an engineering one — flag it explicitly.
- **Sequencing:** Disciplines is the better-built control surface; treat it as
  the host that absorbs Agents, rather than the reverse.
