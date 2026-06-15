# Activity — IA audit

## What this tab IS today

A reverse-chronological feed of every handoff the fleet has executed inside the
workspace. Source: `activity/page.tsx` reads up to 200 `handoffLogEntry` rows
(`take: 200`, `orderBy: occurredAt desc`) under RLS, decrypts each payload, and
maps them into `ActivityRow`s rendered by `activity/ActivityFeed.tsx`.

Each row shows `fromAgent → toAgent · stepLabel`, a one-line payload summary,
and a timestamp. Clicking a row opens an `ApPaperSheet` (`PayloadDetail`) with
when / outcome / from / to / type / subject and a flat key-value dump of the
decrypted payload (`RenderedPayload`).

The page's real differentiator is **outcome classification**. `classifyOutcome`
(unit-tested, pure) derives `ok | skipped | failed` from the persisted step
record (`handoffType` ending in `.error` or payload `{ ok: false, errorCode }`).
Failed rows get:

- an attention banner at the top ("needs a look — N steps didn't complete"),
  deep-linking to `?kind=issues`;
- a `PlainoStatus state="alert"` pose, a "didn't complete" badge, and a
  plain-language reason mapped from `errorCode` via `ERROR_REASONS`
  (e.g. `TOKEN_EXPIRED` → "A connected account needs to be reconnected").

`NOT_APPLICABLE` reads as a benign "skipped", never a failure. A `FilterStrip`
offers chips: all / drafts / schedules / reads / flags, plus an `issues` chip
that only appears when `counts.issues > 0`. Empty states use
`ApRootedEmptyState` with Plaino watching copy.

This page was explicitly built to fix site-audit finding **P1-4**: "a failed
skill was indistinguishable from a quiet day." That fix is the load-bearing
reason the tab exists in its current form.

## Customer job (JTBD)

"Show me what Plaino actually did for my business — and tell me, in plain
English, when something needs my attention." The local-business owner is not
auditing a distributed system; they want reassurance that work happened and a
clear, non-technical nudge when a connection broke or a step stalled.

The owner does NOT want a raw event log keyed by agent identifiers. The page
partly serves the job (failure surfacing, plain reasons) and partly fights it
(see leaks below).

## Duplications

This tab overlaps three other surfaces:

1. **Fleet's ActivityStream / SkillFiresFeed** — per the prompt, Fleet renders a
   live stream of fleet activity. Both draw from the same handoff/skill-run
   substrate (`handoffLogEntry` here; skill-fire records there). Two feeds of
   "what the fleet did" is a genuine duplication of the canonical "activity
   feed" concept.
2. **Overview** — the workspace home surfaces recent activity / what Plaino is
   working on. The Activity feed is a longer-tail version of the same content.
3. **Approvals & Compliance** — the page's own copy admits the routing: "flagged
   items move to Compliance, drafts move to Approvals." So Activity's `drafts`
   and `flags` filter chips re-list items that have a dedicated home elsewhere.
   Activity is the read-only mirror; the actionable copies live in those tabs.

The unique, non-duplicated payload is the **failed-step surfacing** — no other
tab is documented to render `outcome === "failed"` with plain reasons. That is
the one thing Activity owns.

## Relationships

- **Reads from:** `handoffLogEntry` (RLS-scoped), `decryptPayloadForRead`,
  `servicePartnerForWorkspace` (Plaino name), `persistSkillRunArtifacts`'s
  `{ ok, errorCode }` contract (`lib/skills/persist-artifacts.ts`).
- **Links out to:** Compliance (flags), Approvals (drafts) — named in body copy.
- **Shares concept with:** Fleet's ActivityStream/SkillFiresFeed, Overview's
  recent-activity block.
- **Depends on outcome contract:** the `.error` suffix + `errorCode` written by
  the skill runner. If that contract drifts, failure surfacing silently breaks.

## What's broken or confusing

**Engineer-vocab leaks (PR #249 violations) — the biggest problem:**

- Every row leads with raw `fromAgent → toAgent` rendered in `font-mono` — these
  are **agent slugs**, exactly the "engineer label" PR #249 bans. A business
  owner sees `chief-of-staff → follow-up-chaser`, not a job.
- The detail sheet exposes `from` / `to` (slugs), `type` (raw handoff type), and
  `subject` as `relatedSubjectTable:relatedSubjectId` — a **table name and row
  id**. That is database internals on a customer surface.
- `RenderedPayload` dumps **every** string/number/boolean payload key verbatim
  (`errorCode`, internal status strings, etc.) with raw key names as labels.
- Body copy says "the ones that didn't go through" and "anything that fails
  surfaces here" — acceptable, but the empty state says "once new mail or a
  webhook **fires**" ("fires"/"webhook" = engineer vocab leak).
- `stepLabel` only strips the `.error` suffix; the rest of the handoff type
  (e.g. `inbox_sweep`, `reply_draft`) shows through `humanType` as
  underscore-flattened internal step names, not customer phrasing.

**Conceptual confusion:**

- "Handoff" is itself an engineer framing. The owner doesn't think in agent-to-
  agent handoffs; they think in completed jobs.
- Filter chips `reads` / `schedules` derive from regex over handoff-type
  strings (`matchesKind`), so categorization is brittle and opaque.
- The page is BROKER_OWNER-gated (`requireWorkspaceMember(..., ["BROKER_OWNER"])`)
  — fine for access, but the realty-flavored role name is another internal leak
  if ever surfaced.

## What's working

- **Failure surfacing is genuinely excellent** and is the product's honesty
  promise made visible: nothing fails quietly, every failure carries a plain
  reason and a "nothing was sent" reassurance in Plaino's calm voice.
- `classifyOutcome` is pure and unit-tested — the most defensible code on the
  tab.
- The attention banner + conditional `issues` chip is the right pattern: a work
  queue that doesn't carry a permanent "issues" tab reading 0.
- Empty states and failure copy are on-brand (calm heritage partner, Plaino
  named correctly via `servicePartnerForWorkspace`).
- `NOT_APPLICABLE` → "skipped" distinction prevents benign skips from reading as
  alarms — good signal hygiene.

## Verdict

**MERGE INTO bucket A (Today) — as the "What Plaino did" + "Needs a look"
sections of the Today tab.** A standalone Activity tab does NOT earn its place
in a 4–5 tab IA.

Rationale: the canonical home for "the activity feed" should be **one** place,
and "Today" (action queue + recent activity + what Plaino is working on) is
exactly that place by definition. Activity, Fleet's ActivityStream, and
Overview's recent-activity block are three renderings of one substrate; collapse
them into Today. Activity contributes the two pieces worth keeping:

1. the **recent-work feed** (becomes Today's "what Plaino did" section, with
   slugs translated to job language), and
2. the **failed-step surfacing** (becomes Today's "needs a look" attention block
   — arguably the single most valuable thing this tab produces).

The full 200-row drill-down history is real but secondary. If anything survives
as a deep view, it's a "Full history" link inside Today (or a Reports-bucket
sub-view), not a top-level tab.

**Is Activity secretly load-bearing?** Partially yes — not the feed, but the
**outcome-classification + failure-surfacing logic** (`classifyOutcome`,
`ERROR_REASONS`, the attention banner) is load-bearing UX that closes audit
finding P1-4. That logic must be carried into Today, not dropped. The feed
chrome and the raw-payload drill-down are NOT load-bearing and can be
simplified hard.

## Migration notes

1. **Carry, don't drop, the failure path.** Move `classifyOutcome`,
   `ERROR_REASONS`, the attention banner, and the `issues` deep-link into
   Today's "needs a look" section. This is the P1-4 fix — losing it regresses
   a shipped audit resolution.
2. **Pick ONE feed substrate.** Reconcile `handoffLogEntry` (this tab) with
   Fleet's skill-fire feed before merging so Today doesn't show two
   inconsistent histories. Determine which is canonical; the other becomes a
   view over the same data or is retired.
3. **Translate slugs to jobs (PR #249).** Replace `fromAgent → toAgent` mono
   slugs with a customer sentence ("Plaino drafted a reply to a buyer inquiry").
   Drop the agent-to-agent "handoff" framing entirely on the customer surface.
4. **Hide DB internals in the drill-down.** Remove `relatedSubjectTable:Id`,
   raw `errorCode` (keep it operator-only), and the verbatim payload key dump.
   Whitelist a few human fields (subject, recipient, count) instead of dumping
   all keys.
5. **Fix vocab leaks in copy.** "fires"/"webhook" → "once new mail comes in";
   underscore step names → human step labels; "handoff" → "step" or the job
   name.
6. **Keep the deep history as a secondary view, not a tab.** A "See full
   history" link inside Today is enough; most owners only need the recent slice
   plus the failure flags.
7. **Preserve the BROKER_OWNER gate** semantics on the merged Today view, but
   never surface the role label to the customer.
