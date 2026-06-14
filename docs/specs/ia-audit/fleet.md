# Fleet — IA audit

> Source read from `C:\agentplain` @ HEAD (the `-ia-audit` dir holds only this doc).
> Files: `app/(product)/app/workspace/[id]/fleet/{page,FleetMap,ActivityStream,SkillFiresFeed,TodoBoard,TalkToFleet,actions,loading}.tsx`.
> Nav confirmed in `app/(product)/app/workspace/[id]/layout.tsx` — Fleet sits between Disciplines and Activity.

## What this tab IS today

Fleet is a single scrolling "mission control" page (`page.tsx`) that stacks five panels top-to-bottom:

1. **FleetMap** (`FleetMap.tsx`) — the workspace roster (from `lib/verticals/<slug>/content.ts`) split into two groups: "awake" and "rooting". Each capability is a card showing its slug, name, one-line job, a status dot, and a handoff count. Links out to `/agents` and `/agents/<slug>`.
2. **TodoBoard** (`TodoBoard.tsx`) — three columns: "drafting" / "ready for you" / "ratified", derived from `WorkApprovalQueueItem` rows (PENDING, APPROVED/AUTO_APPROVED) plus in-flight `HandoffLogEntry` rows. Only "ready for you" links into `/approvals`.
3. **SkillFiresFeed** (`SkillFiresFeed.tsx`) — last 20 `WorkApprovalQueueItem` rows rendered as a "what fired" log: skill slug + discipline + timestamp + outcome, each linking to `/approvals?focus=<id>`.
4. **ActivityStream** (`ActivityStream.tsx`) — last 10 `HandoffLogEntry` rows, links to `/activity`.
5. **TalkToFleet** (`TalkToFleet.tsx`) — a textarea that files a request as a `HandoffLogEntry` (`fromAgent: "you" → toAgent: "plaino"`) via `actions.ts`. No conversational reply by design.

The page header sells it as "See your fleet. Talk to your fleet." with a Plaino avatar. The data is honest — every panel reads real durable state, nothing is fabricated (the file comments are explicit about this, per `feedback_no_quick_fixes.md`).

This is the single most engineer-shaped customer surface in the product. It is a developer's internal admin console — a roster table, an audit log, a queue board, and a job-submit box — relabeled with heritage copy. A local-business owner did not ask for a "fleet map."

## Customer job (JTBD)

The genuine jobs a local-business owner has on this page reduce to two, both of which already have homes elsewhere:

- **"What did Plaino do, and is anything waiting on me?"** → that is the Today/Overview job, and the Approvals job.
- **"I want to give Plaino a new job."** → that is the Talk to Plaino job.

Nobody whose job is running a real-estate office wants to study a "fleet map" of capability cards grouped by "awake" vs "rooting," read a "skill fires" log, or reconcile a "drafting → ready → ratified" board against a separate activity stream. Those are operator/engineer mental models. The customer's actual question is "what needs me right now, and what got handled" — singular, named-partner, calm. Fleet answers that question four different ways on one page and buries it under jargon.

## Duplications

This tab is almost entirely composed of other tabs. Brutally:

- **ActivityStream ≡ Activity tab.** `ActivityStream.tsx` is explicitly "a 10-row slice... Full feed at /activity" and links there. It reads the same `HandoffLogEntry` source. Pure duplication — a preview of a tab that exists.
- **SkillFiresFeed ≡ Activity + Approvals.** Reads `WorkApprovalQueueItem` (same source as Approvals) and renders it as an event log (same shape as Activity), then links every row to `/approvals?focus=<id>`. It is a third feed of data the customer already sees twice. The panel's own header comment admits there's "no SkillRun table yet" — it's a stand-in feed built from the approval queue.
- **TodoBoard "ready for you" column ≡ Approvals tab.** It reads PENDING `WorkApprovalQueueItem` and its only actionable affordance is a link to `/approvals`. It is a styled preview of the Approvals queue. The "drafting" and "ratified" columns are read-only context with no equivalent action.
- **TodoBoard ≡ Overview.** "N decisions waiting on you" / "Nothing waiting on you" is the canonical Overview/Today headline. Overview almost certainly shows the same pending-count.
- **TalkToFleet ≡ Talk to Plaino tab.** Both are "give Plaino a job" inputs. TalkToFleet is the degraded version — it files a log row with no reply, while `/talk` is the named conversational surface. Two doors to the same job, and this one is the worse door.
- **FleetMap ≡ Agents tab (and overlaps Disciplines).** FleetMap's own comment: "see /agents for the same source-of-truth roster." It links to `/agents` ("open fleet detail →") and to `/agents/<slug>`. It is a second rendering of the Agents roster, grouped differently.

Net: of five panels, **four are previews/duplicates of Activity, Approvals, Talk, and Agents**, and the fifth (FleetMap) is a re-skin of Agents. Fleet originates almost no unique surface.

## Relationships

- **Outbound links:** `/agents`, `/agents/<slug>`, `/activity`, `/approvals`, `/approvals?focus=<id>`, `/integrations`. Fleet is a hub that mostly points elsewhere — a router page wearing a dashboard's clothes.
- **Shared data sources:** `HandoffLogEntry` (with Activity, Overview, Talk), `WorkApprovalQueueItem` (with Approvals, Overview), vertical `agentRoster` (with Agents, Disciplines).
- **Write surface:** the only thing Fleet *does* that no link could is `submitFleetRequestAction` (`actions.ts`) — and that write is the same intent as Talk to Plaino, just without a reply.

## What's broken or confusing

- **Pervasive engineer-vocab leaks** (violates PR #249 customer-vocab rule):
  - "fleet" / "your fleet" / "talk to your fleet" — the central metaphor is engineer/military jargon. The customer has one named partner, Plaino, not a "fleet."
  - **"rooting"** appears in FleetMap copy and the `statusLine` returns "rooting now," "rooting in — first handoff lands soon." This is the exact banned term; should be "Setting up."
  - **"live"** / **"awake"** as a status group — `runtime === "live"`. Banned; should be "Working" / "Watching."
  - **"skill fires" / "What... fired" / "Nothing has fired yet"** — `SkillFiresFeed` leans entirely on "fire." Banned engineer verb.
  - **"runtime"** — surfaced in FleetMap's "runtime still being built." Engineer word.
  - **"agentSlug" / raw slugs** rendered directly on cards (`a.slug`, `card.agentSlug`, `r.skillSlug`) in mono uppercase — the customer sees `realty-listing-coordinator`-style identifiers, not human names.
  - **"handoff" / "handoffs logged"** — internal log vocabulary surfaced as a customer count.
  - **"ratified"** — legalistic; the customer "approved" something.
  - **"file the request" / "filing…" / "one job per ticket"** — ticketing-system language.
- **Mission-control density conflicts with brand v2** (calm heritage partner, NOT a SaaS dashboard). Five stacked feeds, a status-dot map, and a kanban board is exactly the "mission-control dashboard" the brand explicitly rejects.
- **Three feeds of nearly the same events** (TodoBoard, SkillFiresFeed, ActivityStream) on one page is genuinely confusing — the customer cannot tell why a draft shows in all three or why "skill fires" differs from "activity."
- **TalkToFleet sets a false expectation:** it accepts a request but returns no reply ("No reply appears here"). Next to the full conversational `/talk` tab, this is a worse, more confusing second input.
- **"Weekly report" is not actually in the nav** (the live `layout.tsx` NAV has Help, not Weekly report) — noting only because the audit brief listed 13 tabs; Fleet itself is confirmed present.

## What's working

- **The data honesty is exemplary.** Every panel reads real durable state and the code refuses to fabricate (no fake LLM reply, no placeholder cards for half-drafts). This discipline should be preserved wherever these panels land.
- **The TodoBoard "drafting → ready for you → ratified" mental model is the one genuinely valuable idea here** — "where does work sit relative to me?" is a real customer question. But it belongs in Today/Overview or Approvals, not on a "Fleet" tab.
- **TalkToFleet's `submitFleetRequestAction` + AuditLog attribution** is clean, cold-start-safe server-action plumbing worth keeping — just route it into the `/talk` surface.
- **FleetMap's "what's set up vs. still being prepared" split** is a reasonable onboarding signal — but it duplicates Agents and uses banned vocab.

## Verdict

**KILL the Fleet tab as a top-level nav item; redistribute its parts. Bucket: dissolves across A (Today), B (Plaino), C (Connections).**

Fleet is not load-bearing as a *destination* — it is a hub of previews that each link to a real tab. Nothing unique would be lost by removing the tab itself, provided three pieces are rehomed:

1. **TodoBoard's three-column "where does work sit" view** → bucket **A (Today)** or fold into **Approvals**. This is the one idea worth keeping; it's the closest thing to the customer's real "what needs me / what got handled" question.
2. **TalkToFleet's request-intake write path** → bucket **B (Plaino)**: merge into the Talk to Plaino tab so there is exactly one "give Plaino a job" door.
3. **FleetMap's roster** → bucket **C (Connections)**: it is the Agents roster; it belongs with agents/skills/disciplines.

Everything else — ActivityStream (→ Activity, which itself folds into A/Today), SkillFiresFeed (a synthetic feed of approval-queue data) — is pure duplication and should simply be deleted, not migrated.

So: **KILL the tab, MERGE its one good idea (the to-do board) into Today, MOVE its write-path into Plaino, and let its roster live under Connections.** Do not preserve "Fleet" as a concept or word on any customer surface.

## Migration notes

- **Remove** `{ href: "/fleet", label: "Fleet" }` from `layout.tsx` NAV.
- **Lift the to-do board** into the Today/Overview surface (bucket A). Reuse the PENDING/APPROVED `WorkApprovalQueueItem` queries from `page.tsx` and the `TodoBoard` component, but **rename columns to customer-vocab**: "drafting" → "Plaino is working on", "ready for you" → "Needs you", "ratified" → "Done". Drop "skill slug" lines; show the human capability name (`AgentRosterEntry.name`), never the slug.
- **Fold TalkToFleet into `/talk`** (bucket B). The conversational tab should own the single job-intake box; keep `submitFleetRequestAction` + its AuditLog write as the fallback "file it" path when no live reply is available (prod LLM is paused by policy — this honest no-reply path is actually correct for now).
- **Delete** `ActivityStream.tsx` and `SkillFiresFeed.tsx` outright — their data is already in Activity/Approvals. Do not migrate; they are duplicates.
- **Send FleetMap to Connections** (bucket C) as part of the Agents/roster view; it already links there. Strip the "fleet map" framing.
- **Scrub vocab on everything that survives** (PR #249): "fleet" → drop entirely or "your team of helpers" only if needed; "rooting" → "Setting up"; "live"/"awake" → "Working"/"Watching"; "skill fires"/"fired" → "drafted"/"done"; "runtime" → cut; "handoffs logged" → "things handled"; "ratified" → "approved"/"done"; "file the request"/"ticket" → "Ask Plaino". Replace all raw `slug` renders with `AgentRosterEntry.name`.
- **Preserve the no-fabrication discipline** in whatever surfaces inherit these panels — it is the best thing about this tab.
- **Auth/RLS unchanged:** all queries already run through `withRls(ctx, ...)` / `requireWorkspaceMember`; rehoming the panels carries that pattern forward with no schema change.
