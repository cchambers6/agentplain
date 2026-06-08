# Org-chart honesty — activate / defer / prune the dormant charters

**Date:** 2026-06-07 · **Wave:** 8 (audit-resolution roadmap, plan PR #175) · **Status:** ⛔ CONNER DECISION REQUIRED

> **The decision in one line:** the fleet pride audit (2026-06-07) found 20+ internal org-chart charters scoring **1/5 — "modeling departments we don't staff yet; they dilute the median."** This packet recommends one ACTIVATE (the competitive-signal feed, shipped in this wave), the rest DEFER, and a small set PRUNE-or-merge. Nothing is deleted without your call.

---

## Why this is a decision, not a build

The audit's own guidance (`docs/decision-packets/fleet_pride_audit_2026_06_07.md`, TL;DR + "What this audit says about the business"):

> *"The org-chart agents (Media, Insights, internal directors) can wait; they're modeling departments we don't staff yet and they dilute the median. Cut the audit's attention to the Customer layer, wire the data, and ship bounded autonomy — that's the whole game."*

Two facts make this a clean defer, not a cut:

1. **They cost ~nothing while dormant.** Every internal cron registers as an honest stub through the same disable-gate + observability stack and **does not call Anthropic** (see `lib/inngest/functions/b2b-ceo-daily.ts`, `media-*.ts`). A dormant charter is a `SKILL.md` + a registered no-op — zero token cost, zero customer surface.
2. **They are not wrong, just early.** The Media/Creative split is ratified (`project_creative_vs_media_disciplines_2026_06_06`), the roster is the source of truth (`lib/fleet/roster.ts`), and the charters encode real future roles. Pruning them loses design work; deferring them costs nothing.

**The one thing worth building now** is the audit's theme #18 — a *real* competitive-signal feed for the vertical heads, replacing the dormant quarterly "watch memo" idea. That is shipped in this wave (`lib/competitive-signals/` + `lib/inngest/functions/competitive-signal-feed-sweep.ts`) regardless of the activate/defer/prune call below.

---

## Recommendation summary

| Verdict | Count | What it means |
|---|---|---|
| **ACTIVATE** | 1 (capability) | The competitive-signal feed — has a real job + real data (web research) now. Shipped this wave. |
| **DEFER** | 18 charters | Real future role, no customer pull yet. Keep as honest stubs; activate on a named trigger. |
| **PRUNE / MERGE** | 2 charters | Redundant with an existing role or with each other; fold rather than staff. |

Counts below are charters in `lib/fleet/roster.ts` + the `~/.claude/skills/*` SKILL.md set. "Internal directors" = the leadership-tier charters inside the dormant arms (Media Head, Media Director, Insights Head).

---

## The packet — per charter

Authoritative roster: `lib/fleet/roster.ts` (Media + Creative arms) and the Insights skill set (`insights-*` SKILL.md). All scored **1/5** in the pride audit (Media n=13 median 1; Insights n=7 median 1).

### Media arm (13 charters) — `arm: 'media'` in `lib/fleet/roster.ts`

| Charter (slug) | Tier | Verdict | Rationale + activation trigger |
|---|---|---|---|
| `media-head` | leadership | **DEFER** | Internal director. Activate when a media *budget envelope* exists to plan against. No ad spend today (`project_no_outbound_architecture`). |
| `media-director` | leadership | **DEFER** | Internal director. Activate alongside `media-head`. Owns the two distribution crons — both are honest stubs awaiting the CronDefinition runner port. |
| `media-meta` | platform | **DEFER** | Platform specialist. Activate per-channel only when that channel runs a real campaign. |
| `media-tiktok` | platform | **DEFER** | Same — channel-by-channel activation. |
| `media-youtube` | platform | **DEFER** | Same. |
| `media-linkedin` | platform | **DEFER** | Most likely first B2B channel to activate (vertical-head GTM). Trigger: first paid B2B test greenlit by you. |
| `media-x` | platform | **DEFER** | Same. |
| `media-google-ads` | platform | **DEFER** | Same. |
| `media-pinterest` | platform | **PRUNE / MERGE** | Commerce-channel; agentplain sells B2B SaaS, not commerce. Lowest fit of the 8. Recommend folding into `media-director`'s purview until a commerce vertical exists. (Already `sonnet`-tier — the roster already flags it as low-leverage.) |
| `media-reddit` | platform | **DEFER** | Community/AMA fit is real for a dev-adjacent B2B audience; defer until there's a community motion to run. |
| `media-influencer-partnerships` | earned | **DEFER** | Real future role; activate when there's a creator budget. |
| `media-pr-earned` | earned | **DEFER** | Highest-value of the earned trio for a young brand (founder-led PR). Candidate for *earliest* activation if you want press now. |
| `media-analytics-attribution` | earned | **DEFER** | Activate when there's paid spend to attribute — circular with the platform specialists; no spend → nothing to measure. |

### Insights discipline (7 charters) — `insights-*` SKILL.md

| Charter (slug) | Verdict | Rationale + activation trigger |
|---|---|---|
| `insights-head-of-department` | **DEFER** | Internal director. Activate when there are ≥2 active insights analysts to coordinate — premature with zero operational. |
| `insights-product-analytics` | **DEFER** | Real job the day we have product usage to analyze at scale. Today the operator leadership board + `lib/operator/leadership-data-snapshot.ts` cover the read. Trigger: customer count where manual reads break down. |
| `insights-advanced-analytics` | **DEFER** | Same dependency as product-analytics, downstream of it. |
| `insights-reporting` | **PRUNE / MERGE** | Overlaps `insights-product-analytics` + the existing analytics-weekly-pulse cron. Recommend merging into `insights-product-analytics` rather than staffing a separate reporter. |
| `insights-agent-measurement` | **DEFER** | Measures the fleet's own performance — genuinely useful, but the scorecard/observability stack already covers the live signal. Activate when the fleet is large enough that per-agent ROI needs a dedicated owner. |
| `insights-survey-research` | **DEFER** | Ties to audit theme #20 (seller ICP survey). Activate *with* that survey, not before — it has a real job the moment a survey is fielded. |
| `insights-adhoc` | **DEFER** | By design a reactive role; nothing to defer-vs-activate — it fires when asked. Keep as-is. |

### Internal directors (counted within the arms above)

`media-head`, `media-director`, `insights-head-of-department` — all **DEFER**. They model a leadership layer above teams that have zero operational members. Activating a director before any of its reports fire would be the clearest "org chart before the work" inversion the audit warns about.

---

## What ACTIVATE looks like (shipped this wave)

**Competitive-signal feed** — `lib/competitive-signals/` + `lib/inngest/functions/competitive-signal-feed-sweep.ts`.

- Replaces the dormant quarterly "watch memo" idea with a **scheduled feed** (Mondays 16:00 UTC) that pulls competitive movements — launches, pricing changes, funding, regulatory shifts — for the **three verticals we run a head for** (`b2b-head-of-realty`, `b2b-head-of-insurance`, `b2b-head-of-home-services`) and drafts a sectioned digest those heads consume.
- **Provider behind an abstraction** (`CompetitiveSignalProvider`): fixture provider (network-free, dev/preview/test default) + flag-gated live web-research adapter fronting the Bright Data MCP search port the roster already lists as a vertical-head primaryTool. The live adapter falls back to fixtures **and names the gap** until the MCP dispatch is wired — never fabricates live claims.
- **Draft-and-propose, no outbound.** The digest is a working document for the heads; nothing is bought, sent, or posted.
- **Fire-gate honored.** The cron calls `gateSkillFire` against the configured internal fleet workspace (fails open when none is configured — internal GTM work has no customer to pause).

This is the audit's recommended single activation: it has a *real job* (competitive intelligence the heads currently lack) and *real data* (web research) today — the bar the other 18 charters do not yet clear.

---

## The ask

**⛔ CONNER DECISION #4:** For the 18 DEFER + 2 PRUNE/MERGE charters above —

- **DEFER (recommended default):** leave them as honest, zero-cost stubs; add the named activation triggers above to their charters so the next person knows exactly when to flip each one on.
- **PRUNE:** if you'd rather the roster reflect only roles we'll staff in the next two quarters, delete `media-pinterest` + `insights-reporting` (or merge per the table) and trim the roster.
- **ACTIVATE more:** if any deferred charter has customer pull I'm not seeing (e.g. you want founder-led PR running now → `media-pr-earned`), name it and it activates next wave.

No charter is changed in this PR beyond shipping the competitive-signal feed. This packet exists so the call is yours, made against the real roster and the audit's own numbers.
