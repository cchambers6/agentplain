# Talk to Plaino — IA audit

Tab: **Talk to Plaino** (`/talk`), nav item #2 of 13 (`layout.tsx:18`).
Files audited (under `app/(product)/app/workspace/[id]/`): `talk/page.tsx`,
`talk/talk-view.tsx`, `talk/TalkComposer.tsx`, `talk/actions.ts`,
`talk/loading.tsx`, `talk/memory/page.tsx`, `talk/memory/actions.ts`.
Source ref: `origin/main` (audit worktree HEAD).

## What this tab IS today

`/talk` is the **real conversational surface** with Plaino: a persisted,
two-party thread where the customer types a message and Plaino replies inline.
It is the only in-workspace surface that produces an actual Plaino reply.

- `talk/page.tsx` is the server shell: asserts `BROKER_OWNER` membership,
  runs `checkDegradedMode()` first (the honesty seam — if `ENCRYPTION_KEY` /
  `ANTHROPIC_API_KEY` are missing it renders a calm "Plaino is offline"
  notice and skips the chat store entirely), then reads the persisted thread
  via `PrismaChatStore`, resolves per-turn link state (drafted support
  replies, `PLAINO_INSTRUCTION` approval states), and renders `TalkThread` +
  `TalkComposer`.
- `talk/actions.ts` (`sendPlainoMessageAction`) is the write path: validates
  the body (≤4000 chars), re-checks degraded mode, loads history (last 12
  turns), capability snapshot, memory store, and the customer-files
  knowledge substrate, then calls `runPlainoTurn(...)`. On failure it triages
  to an honest customer line, emits a structured Sentry event, and pages a
  human for credential-class failures (the post-2026-06-13-outage
  SILENT-FAIL-LOUD wiring).
- `talk-view.tsx` is DB-free presentation. Each Plaino turn can carry a
  footer derived from `metadata.kind`: citations, `DECLINE_HONESTLY` ("can't
  fetch yet: <gap>"), `REGISTER` (drafted-reply link to approvals),
  `INSTRUCT` (an `InstructionTile` that walks drafting → ready-for-review →
  approved/rejected), and `PREFERENCE` (a "saved as feedback" link to
  memory). It also renders the additive `PlainoCardView` "what next" card off
  `metadata.card`.
- `talk/memory/` is a **sub-page** (`/talk/memory`): the durable facts Plaino
  fetches on every turn, grouped into four kinds (USER "about you", FEEDBACK
  "how I should work", PROJECT "what you're moving", REFERENCE "where things
  live"), with pin / edit / delete. Reachable only from the `memory →` link
  in `TalkHeader`; it is NOT a top-level nav item.

So the tab is really two things behind one nav entry: **the chat** and
**Plaino's memory**.

## Customer job (JTBD)

"When I have a question about my business or a piece of work I want handled,
I want to ask my service partner in plain English and either get an answer or
hand off the work — without learning a tool." This is the single highest-
intent customer surface in the product: it is where the named partner becomes
real. Memory's sub-job: "show me / correct what Plaino knows about me so I
trust its answers." Both are core daily-use jobs, not chrome.

## Duplications

This is the headline finding. There are **three conversational-Plaino
surfaces inside one workspace**, plus a fourth on marketing:

1. **`/support` tab (nav #12) is a second Plaino chat.** `support/page.tsx`
   mounts `PlainoSupportChat`, which talks to `/api/chat` with `mode=support`
   — an authenticated, workspace-grounded chat that can draft a SupportRequest
   into review. From the customer's POV this is *the same act* as `/talk`:
   type to Plaino, get a reply, optionally hand off work. Two nav tabs
   (`Talk to Plaino` and `Support` / `Get help`) both open "chat with Plaino."
   This is the most confusing duplication in the whole nav for this tab.
   Note the two are built on **different backends**: `/talk` →
   `runPlainoTurn` server action + `PrismaChatStore`; `/support` → `/api/chat`
   route + `PlainoConversation`. Same customer job, two codepaths.

2. **Fleet's `TalkToFleet.tsx` (nav #4) is a near-twin composer.** Same
   eyebrow language ("talk to your fleet" / "Give Plaino a job"), same 4000-
   char one-job textarea, same "filing…" submit. Critically it is
   *intentionally reply-less*: its own comment says "There is no
   conversational reply: we are not going to fabricate a fake AI response." It
   files a request to the activity log instead. So the workspace ships two
   "give Plaino a job" boxes — one that replies (`/talk`) and one that
   doesn't (Fleet) — with no signposting of the difference. A customer cannot
   know which box to use.

3. **Marketing `PlainoWidget.tsx`** is the fourth surface (`/api/chat`
   `mode=marketing`). Out of workspace scope, but it means Plaino-chat code
   lives in four places sharing only the `/api/chat` route for two of them.

Internal duplication within the tab is minor: `formatTimestamp` is defined in
both `talk-view.tsx` and `memory/page.tsx` (copy-paste, harmless).

## Relationships

- **→ Approvals (nav #6):** every work hand-off from `/talk` lands here. The
  `REGISTER` and `INSTRUCT` footers deep-link to `/approvals`. Talk is an
  *entry point* to the approval queue; the queue is where the work resolves.
- **→ Activity (nav #5):** Fleet's twin box files into activity; `/talk`'s
  work also surfaces there. The two action queues (approvals + activity) are
  the natural downstream of any "give Plaino a job."
- **→ Memory (`/talk/memory`):** owned by this tab; the `PREFERENCE` footer
  writes here and links back.
- **→ Disciplines (nav #3):** `INSTRUCT` turns carry a `targetDiscipline`
  ("herding through the marketing team") — Talk references disciplines by
  name.
- **Shared lib:** `lib/plaino` (chat store, memory store, `runPlainoTurn`,
  degraded-mode, capability snapshot) is the backbone for `/talk`;
  `/api/chat` (support + marketing) is a *parallel* backbone. Convergence
  candidate.

## What's broken or confusing

- **Two chat tabs for one job (P0):** `Talk to Plaino` vs `Support` both =
  "chat with Plaino." A customer will not know that one is for "questions /
  work" and the other for "help with the product." This is the strongest
  argument for the whole IA collapse.
- **Reply vs no-reply ambiguity (P1):** `/talk` replies; Fleet's `TalkToFleet`
  deliberately doesn't. Identical-looking boxes, opposite behavior.
- **Engineer-vocab leaks (P1, violates PR #249).** Customer-facing copy in
  `talk-view.tsx` uses internal verbs the vocab rule bans or strains:
  - `"herding this through the team — drafting now"`, `"herding through the
    {targetDiscipline} — drafting now"` — "herding" is brand-cute but reads
    as jargon; acceptable under heritage voice but verify against the
    approved map.
  - `"saved as feedback: scope=<scope> →"` — `scope=` is raw engineer syntax
    on a customer surface. Should read "saved how you like things done."
  - `INSTRUCT` / `REGISTER` / `PREFERENCE` / `DECLINE_HONESTLY` are internal
    `kind` enums; they don't render as labels (good) but the surrounding copy
    is built around them. The `kind`-driven footer is fine as long as no enum
    string leaks — confirmed none do today.
  - Memory kind labels are correctly humanized ("about you" / "how I should
    work") — good model to copy elsewhere.
- **Memory is buried (P2):** the only door to `/talk/memory` is a small
  `memory →` link in the header. Trust-critical content (what Plaino knows
  about you) is one faint link deep.
- **Degraded copy says "Plaino is offline" in clay/alert styling** — calm and
  honest (good), but it's the customer's only signal; fine.

## What's working

- **Honesty seam is excellent and load-bearing.** `checkDegradedMode()` runs
  before any decrypt; failed turns page a human for credential-class outages.
  This is the surface that caught the kind of silent outage that went
  unnoticed on 2026-06-13. Do not regress it in any migration.
- **Brand voice is on-target:** "What do you need fetched, herded, or figured
  out?", the empty state ("Plaino's waiting at the workspace door"), the
  contextual loader. Calm heritage partner, not SaaS dashboard.
- **Single named partner** (`PlainoMark`, "Plaino") is consistent.
- **Encrypted-at-rest** thread + memory; RLS contexts threaded through.
- **The `kind`-driven footers** (citations, honest decline, drafted-link,
  instruction tile) are a genuinely good pattern — they turn a chat reply
  into a tracked piece of work.

## Verdict

**KEEP top-level — as the spine of bucket B (Plaino).** Talk is the core
chat surface and clearly anchors proposed bucket **B**. Two structural moves
go with the keep:

- **MERGE `/support` chat INTO this surface.** The in-app `Support`/`Get
  help` chat (`mode=support`) is the same customer job and should collapse
  into the one Plaino chat in bucket B — one place you talk to Plaino.
  Product-help vs work-request is a routing detail Plaino can handle, not two
  nav tabs. (The human-escalation "Get help" form can live in **E) Account**
  as support/help chrome; the *chat* belongs in B.)
- **MERGE Fleet's `TalkToFleet` box INTO this surface or retire it.** Two
  "give Plaino a job" composers is one too many. Either unify on `/talk`'s
  replying composer or keep Fleet's as a visualization-only panel with the
  composer removed.
- **`/talk/memory` → keep in bucket B (Plaino)**, NOT Settings. It is
  Plaino's knowledge of the customer and is referenced live by the chat
  (`PREFERENCE` footer). It is not account chrome. Promote it from a buried
  header link to a visible sub-tab within B ("Plaino" → Chat | Memory).

## Migration notes

- **Bucket B = "Plaino": Chat (this tab) + Memory + Plaino's current
  state/visibility.** Land `/talk` as the default view; `/talk/memory` as a
  visible second view; Fleet's "what Plaino's working on" visualization
  (FleetMap/ActivityStream, minus the duplicate composer) can also live here
  as Plaino's-state.
- **Unify the two chat backbones deliberately, not in the IA PR.** `/talk`
  uses `runPlainoTurn` + `PrismaChatStore`; `/support` uses `/api/chat`
  (`mode=support`) + `PlainoConversation`. Merging the *nav* is cheap;
  merging the *backends* is a follow-up — pick `runPlainoTurn` as the
  survivor (richer: capability snapshot, memory, kind-typed footers,
  pageHuman wiring) and fold support's draft-into-review handoff into it.
- **Preserve the honesty seam verbatim.** `checkDegradedMode()` must run
  before any store/decrypt on the merged surface; keep the SILENT-FAIL-LOUD
  Sentry + `pageHuman` path in `actions.ts`. This is the single most
  load-bearing behavior in the tab.
- **Copy fixes to do during migration (PR #249):** replace `scope=<scope>`
  with "saved how you like things done"; re-check "herding…" against the
  approved customer-vocab map; keep memory's humanized kind labels as the
  template for any new labels.
- **Do not introduce a new approval `kind`** when folding support in — reuse
  `SUPPORT_HANDLER_REPLY_DRAFT` (the existing drafted-reply contract that
  `page.tsx` already reads).
- **Dedupe `formatTimestamp`** (defined twice) into a shared helper while the
  files are open.
- **Conner-time / human-in-the-loop framing** in any merged copy must stay
  Max/Custom-tier only — the current `/talk` copy correctly says "herds work
  through the team," not "a human will personally do this."
