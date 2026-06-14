# Approvals — IA audit

Tab: **Approvals** (`/approvals`)
Source read: `app/(product)/app/workspace/[id]/approvals/{page.tsx, ApprovalsList.tsx,
ApprovalCard.tsx, renderApprovalPayload.ts, actions.ts}` plus cross-refs in
`page.tsx` (Overview), `fleet/page.tsx` + `fleet/TodoBoard.tsx`, and `layout.tsx`
(nav). `ApprovalRowItem.tsx` named in the brief does not exist on disk or at HEAD.

## What this tab IS today

The human-in-the-loop gate. `page.tsx` loads up to 50 `WorkApprovalQueueItem`
rows with `status: "PENDING"` for the workspace (RLS-scoped, newest first),
decrypts each payload, and runs it through `renderApprovalPayload` into a
display-safe `RenderedApproval` shape. Headline copy is strong and on-brand:
"Decisions waiting for you." / "Nothing leaves agentplain on its own. We draft;
you decide; your existing system is what actually sends."

`ApprovalsList.tsx` is the client surface. It does three things:

1. **Discipline filter chips** — `all` plus one chip per discipline
   (`listDisciplines()`), each with a live count, deep-linkable via
   `?discipline=` (`asDisciplineId` in `page.tsx`).
2. **Three buckets** via the pure `bucketApprovals` helper: "Needs you
   specifically" (only `admin.priority === "critical"`), "By discipline"
   (grouped cards), and "All recent" (untagged fallback so nothing is lost).
3. **Per-card actions** — each `ApprovalArticle` renders approve / edit /
   reject. Approve and reject post to `decideApprovalAction`; edit opens an
   `ApPaperSheet` with a textarea seeded from `rendered.editableBody` and posts
   to `editApprovalDraftAction`.

`actions.ts` is the real spine. `decideApprovalAction` re-checks the row is still
PENDING, writes the decision + `decidedByUserId` + reason, writes an immutable
`auditLog` row, and — on reject-with-reason — best-effort captures a preference
signal (`captureDraftRejectSignal`) so the next draft learns. `editApprovalDraftAction`
rewrites the encrypted payload body, audit-logs `work_approval.edited`, and
captures an edit signal. These learning seams are the quiet differentiator; no
other tab writes them.

`renderApprovalPayload.ts` is a 700-line defensive renderer with an **exhaustive
switch over 23 `WorkApprovalKind` values** (`_exhaustive: never` guard). It never
prints raw JSON (design-language §4.6 ban) and degrades to a calm fallback line.
It carries a rich `admin` extension for office-admin items (verification codes,
password-reset links, trial/billing notices, security alerts) with their own card
layouts in `ApprovalCard`/`ApprovalArticle`.

## Customer job (JTBD)

"**Show me what Plaino did for me that needs my OK, let me approve / fix / kill it
in one tap, and prove nothing went out without me.**" This is the #1 recurring
daily job. Every other tab is browse/configure/read; this is the only tab where
the owner *acts on work product* and where the trust promise ("nothing leaves on
its own") is literally enforced. For a non-engineer local-business owner, this is
the product — the drafted reply, the proposed meeting time, the flagged
compliance item, sitting in a clean queue with approve/edit/reject.

## Duplications

This is the most-duplicated surface in the app. The same PENDING
`WorkApprovalQueueItem` set is read and rendered in **three places**:

1. **Overview (`page.tsx`)** — loads `pendingApprovals` count, renders a
   "Decisions waiting." `ApPaperCard` linking to `/approvals` (line ~504), AND
   injects "Review N drafts ready to send" as the top next-action (line ~628).
   Overview is a thin mirror of the Approvals headline.
2. **Fleet → TodoBoard (`fleet/page.tsx` + `TodoBoard.tsx`)** — the "ready for
   you" column IS the PENDING queue, rendered as kanban cards, with header copy
   "N decisions waiting on you." and an "open approvals queue →" link. This is a
   near-total functional duplicate (same data, same count language, same
   destination) minus the approve/edit/reject controls.
3. **`agents/[slug]/page.tsx`, `disciplines/[disciplineId]/page.tsx`,
   `talk/page.tsx`** all also read `workApprovalQueueItem` for per-scope counts.

Within the tab itself there is a **dormant duplication**: `ApprovalCard.tsx`
(untracked, 270 lines) is a clean DB-free extraction of the inline
`ApprovalArticle` in `ApprovalsList.tsx` — same JSX, same `AdminCardContent`,
same `adminBorderClass`/`formatRelativeTime`/`formatExpires` helpers — but nothing
imports it yet. It exists for `tests/customer-approvals.test.tsx`. Two copies of
the card body are now maintained in parallel; the migration should finish the
extraction (list passes `footer` slot into `ApprovalCard`) and delete the inline
copy.

## Relationships

- **Overview** depends on this tab for its single most important widget; it is a
  pointer, not a peer.
- **Fleet/TodoBoard** is the same data in a different metaphor (pipeline vs.
  queue). Fleet adds two columns Approvals lacks: "drafting" (in-flight handoffs
  not yet a decision) and "ratified" (recently approved — proof the loop closed).
- **Activity** is the audit trail this tab *writes* (`auditLog` rows on every
  decide/edit). Approvals = the open queue; Activity = the closed history.
- **Talk to Plaino** can produce `PLAINO_INSTRUCTION` approvals that land here.
- **Preferences/learning** — `actions.ts` feeds `lib/preferences` so edits and
  rejects tune future drafts. This binds Approvals to the quality of every other
  drafting surface.

## What's broken or confusing

- **Customer-vocab leaks (PR #249 violations) are everywhere on this surface:**
  - Card eyebrow prints `row.agentSlug` raw (e.g. `realty-buyer-inquiry-router`)
    — an engineer label on the highest-trust customer surface. `ApprovalCard.tsx`
    makes it worse: "drafted by **{agentSlug}**".
  - Empty-state component is literally named `ApRootedEmptyState` with
    `motif="lone-tree"`; body copy "Plaino is sitting ready, **fetching** … and
    **herding** work." "Herding" appears on nearly every card ("herded in by
    Plaino"). "Fetching"/"herding"/"rooting" are internal poses.
  - Headline body still says routine work is "auto-marked **APPROVED**" and
    flagged items need "explicit **ratification**" — enum + legalese.
  - "Held for your review — confidence below the **persist threshold**" exposes
    runtime internals to the owner.
  - `kindLabel` is mostly humanized, but several stay engineer-y: "inbox triage",
    "process doc draft", "Plaino instruction".
- **Three-place duplication is genuinely confusing**: an owner sees "N decisions
  waiting" on Overview, again on Fleet's board, and again here — three counts
  that can drift, three routes to the same action.
- **"Needs you specifically" is too narrow**: gated solely on
  `admin.priority === "critical"`. A compliance flag or an expiring-trial draft
  that isn't tagged critical never elevates — the most urgent items can sit in
  "All recent."
- **Heavy IA inside one tab**: discipline chips + three stacked sections (Needs
  you / By discipline / All recent) is a lot of structure for what is usually a
  short list. For a 2-item day it reads as over-built.

## What's working

- The **core loop is excellent and load-bearing**: approve / edit-in-sheet /
  reject, each transactional, status-guarded, audit-logged, and preference-
  capturing. This is real, not scaffolding.
- **Trust framing is best-in-app** and matches the locked positioning ("nothing
  leaves agentplain on its own; your existing system sends").
- **`renderApprovalPayload` is robust** — exhaustive, never leaks raw JSON,
  degrades calmly, and the office-admin card variants (verification code,
  reset link, "confirm this was you") are genuinely well-designed and safe
  (Plaino hands the link/code; the owner acts).
- **Discipline deep-linking** (`?discipline=`) lets other surfaces route straight
  to a filtered queue.

## Verdict

**KEEP — and PROMOTE to the default landing surface. Bucket A (Today).**

Approvals is the single highest-value daily surface and the literal enforcement
point of the brand promise. It should not be merged *into* a Today tab as one
widget — it should **BE the spine of Today**, and Overview should be absorbed
into it, not the reverse. The right move:

- **Approvals becomes "Today" (bucket A)** and the default route for a workspace.
- **Overview is killed as a tab**; its two useful pieces (the "what Plaino is
  working on" framing + the next-action nudges) fold into Today as a header strip
  above the queue. Overview today is ~90% a pointer back here anyway.
- **Fleet's TodoBoard collapses into Today's optional "pipeline" view.** The
  drafting → ready-for-you → ratified columns are a nice progress story, but
  "ready for you" is just this queue. Make it a toggle/section within Today, not
  a separate Fleet tab reading the same rows.
- **Activity stays separate** (it's history/audit, a different job) but can be the
  "recently ratified" tail of Today.

So the recommendation is explicitly: **Approvals absorbs Overview + Fleet's board
into one "Today" landing tab**, rather than Approvals being demoted into a
sub-section of an Overview-led Today.

## Migration notes

1. **Rename the route concept to "Today"**; default the workspace root to it.
   Keep `/approvals` as an alias or fold the queue into root `page.tsx`.
2. **Fix the vocab leaks before promoting** (this becomes the most-seen surface):
   - Replace raw `agentSlug` in eyebrow/"drafted by" with a friendly
     discipline/Plaino label (a slug→name map already exists via
     `listDisciplines()`); never surface the slug.
   - Rewrite headline body: drop "auto-marked APPROVED" / "ratification" /
     "persist threshold" → "routine work goes through quietly; anything that
     needs your call waits here."
   - Replace "fetching"/"herding"/"rooting"/"sitting ready" with
     "Working"/"Watching"/"drafted"/"ready for your OK." Rename or reskin
     `ApRootedEmptyState`.
3. **Finish the `ApprovalCard.tsx` extraction**: wire `ApprovalsList` to render
   `ApprovalCard` with a `footer` slot for the action forms; delete the inline
   `ApprovalArticle` duplicate so there is one card definition (the one the unit
   tests already target).
4. **Single source of truth for the count.** Compute "decisions waiting" once and
   reuse it on the (now-folded) header and any per-agent badges — kill the
   drifting Overview/Fleet/Approvals triplicate.
5. **Widen "Needs you specifically"** beyond `admin.priority==="critical"` to
   include compliance flags and time-sensitive (expiring) items, so genuine
   urgency surfaces.
6. **Preserve untouched**: `decideApprovalAction` / `editApprovalDraftAction` /
   `renderApprovalPayload`'s exhaustive switch / audit-log writes / preference
   signals. These are correct and load-bearing — the IA change is presentation
   and routing only, not the action layer.
7. **Cross-tab redirects**: when Overview/Fleet tabs are retired, 301 their
   routes to the Today landing so deep links and the existing `?discipline=`
   filter keep working.
