# Creative-Asset Capability — Architecture

> How the routing layer + human handoff fit together, and how they wire into the
> Media discipline. Companion to `SKILL_AUDIT.md` and `JOB_TO_TOOL_MATRIX.md`.
> (feat/creative-asset-capability-2026-06-06)

---

## The problem we're solving

A creative request used to land on whatever agent caught it, which then
*improvised* — most painfully, 350+ turns of raw-SVG/PNG pixel-art logo work
that hit a craft ceiling and got rejected. There was no step that asked **"what
is the right tool for this, and is this even an agent's job?"** This capability
inserts that step and makes it unskippable.

```
                         ┌─────────────────────────────────────────────┐
   any creative   ───▶   │            media-creative-router            │
   asset request         │   "ask first, improvise never" — reads      │
                         │       JOB_TO_TOOL_MATRIX.md, decides         │
                         └───────────────┬─────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                 ▼
  [ready] skill                  [needs-connection]                  [human] /
  (pptx, docx, OG,               figma / adobe / canva               no-tool-meets-bar
   layout, ROI,                  → stand up connection                       │
   diagrams, schema)              or use listed fallback                     ▼
        │                                │                          lib/creative-handoff
        ▼                                ▼                          createDraftBrief()
   asset produced  ◀───────── (video → AI_VIDEO_STACK.md             │
   → Creative Director review      via media-video-producer)         ▼
                                                              CreatorBrief (DRAFT)
                                                                     │
                                                                     ▼
                                                          /operator/creative-briefs
                                                          dispatch → deliver → accept
```

---

## Layer 1 — The router (`media-creative-router` skill)

A new skill at `~/.claude/skills/media-creative-router/SKILL.md`. It is the
**single front door** for creative-asset requests inside the Media discipline.
It owns no production work; it **decides and dispatches**:

- Reads `JOB_TO_TOOL_MATRIX.md` and runs the 5-step decision (brand-defining? →
  ready skill? → needs-connection? → video? → human).
- For tool jobs, names the exact skill and hands off to the right maker
  (`media-static-designer`, `media-video-producer`, etc.).
- For brand-defining / no-tool-meets-bar jobs, calls into `lib/creative-handoff`
  to assemble a `CreatorBrief` and stops — **it never renders the asset.**
- Enforces the prohibition: **no raw-SVG/PNG improvisation of a brand asset.**

The other media SKILLs were updated to point at it:
- `media-creative-director` — added a **Tool selection** section referencing the
  matrix; the Creative Director routes through the router before briefing a maker.
- `media-static-designer` — its tools now name **Figma + Adobe Express as the
  primary design surfaces**, with `canvas-design`/`frontend-design` as the
  self-contained fallbacks, explicitly **not "improvise SVG."**
- `media-video-producer` — already pointed at `AI_VIDEO_STACK.md`; reinforced.

## Layer 2 — The human handoff (`lib/creative-handoff/`)

A small, pure-core module:

| File | Responsibility |
|---|---|
| `packet.ts` | **Pure.** Builds a portable `CreatorBriefPacket`: a frozen brand-token snapshot (`lib/brand/tokens`), the anti-slop guardrails, references, a per-kind delivery spec, and per-kind acceptance criteria. A creator who never saw our system can act on it. |
| `lifecycle.ts` | **Pure.** The `CreatorBrief` status machine: `DRAFT → BRIEFED → DELIVERED → ACCEPTED`, with `REJECTED` (re-briefable) and `CANCELLED` side-exits. One definition of "legal move" shared by the UI and any agent caller. |
| `store.ts` | Persistence under `withSystemContext` (operator-only RLS): `createDraftBrief`, `listBriefs`, `transitionBrief` (lifecycle-guarded). |
| `index.ts` | Public surface. |

**Why pure-core + thin-store** mirrors `lib/billing/budget.ts`
(`project_budget_seam_shared`): the packet shape and the state machine are
testable without a database (`packet.test.ts`, `lifecycle.test.ts` — 23 cases),
and the persistence layer just lands them.

### Data model — `CreatorBrief` (Prisma)

- Operator-only RLS, identical posture to `LeadCapture`
  (`USING current_setting('app.is_operator') = 'true'`). The router persists
  under `withSystemContext`; the operator console reads/decides under the same
  clause.
- `workspaceId` is an **optional** FK — a platform-level brand brief (e.g. the
  robot-dog mark itself) carries no workspace; a vertical hero illustration links
  to its workspace.
- `packet` + `delivery` are JSON columns mirroring the `lib/creative-handoff`
  types. **No encryption** — a creator brief carries brand tokens + a
  public-facing spec, not customer PII (the acceptance review keeps PII out by
  construction).
- `id` created **without** a DB default → Prisma client-side `@default(uuid())`
  → **zero new drift-baseline entries** (`project_schema_drift_baseline_for_raw_indexes`).
- Migration: `prisma/migrations/20260607000000_creator_brief_handoff/`.

## Layer 3 — The operator surface (`/operator/creative-briefs`)

- Lists briefs with a status filter (open / draft / briefed / delivered /
  closed / all), newest first, under the operator RLS clause.
- Each card renders the **full brief packet** (collapsible): guardrails,
  delivery spec, acceptance criteria, references.
- Status-aware action forms drive the lifecycle. Each form only offers the
  **legal** transitions for the row's current status; `transitionBrief`'s
  lifecycle guard is the backstop if a stale form posts an illegal move:
  - `DRAFT → BRIEFED` (record the creator)
  - `BRIEFED → DELIVERED` (paste the delivered asset ref + note)
  - `DELIVERED → ACCEPTED | REJECTED` (acceptance review; stamps deciding
    operator + time)
  - `REJECTED → BRIEFED` (re-brief)
  - `DRAFT|BRIEFED|REJECTED → CANCELLED`
- **Nothing outbound fires** — the operator reaches the creator from their own
  channel (`project_no_outbound_architecture`); the surface only records the
  dispatch, the delivered asset, and the decision on the row. Registered in the
  operator nav strip (`app/(operator)/layout.tsx`).

---

## How it integrates with the Media discipline (PR #156)

The Media discipline is the **production + platform-execution arm of Marketing**
(`project_media_discipline`), with Head of Media → Creative Director → makers
(video / static / copy / voice). This capability slots in **above the makers**:

1. A request enters the discipline → **`media-creative-router`** decides.
2. Tool job → the matching maker produces with the **named tool** (not improv).
3. Brand-defining job → a `CreatorBrief` packet, dispatched by an operator to a
   human creator; the **Creative Director runs the acceptance review** against
   the packet's criteria when it comes back.
4. The existing approval cascade (maker → Creative Director → Head of Media →
   CEO tier → Conner) is unchanged; the router just makes sure the *right tool
   or the right human* does the work in the first place.

## What's deliberately out of scope tonight (Phase 5+)

- **Creator-marketplace API integration** (Fiverr / 99designs / Dribbble) —
  `creatorRef` is a free-form string today; a future adapter behind a
  `lib/creative-handoff` interface can resolve it to a real marketplace order
  (`feedback_runner_portability` — adapter pattern when we get there).
- **Auto-placing delivered assets** into Vercel Blob + wiring them to the brand
  pipeline — today the operator pastes the ref; a follow-on can ingest on
  delivery.
- **Standing up the Tier-2 MCP connections** (Figma/Adobe/Canva) — a deliberate
  ops task, not a code change (see `SKILL_AUDIT.md` recommendation #2).
