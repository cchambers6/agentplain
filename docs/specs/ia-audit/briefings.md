# Briefings — IA audit

> Tab 9 of 13. Source files: `briefings/page.tsx`, `briefings/actions.ts`.
> Cross-referenced: `reports/weekly/page.tsx`, `overview-view.tsx`, `page.tsx`
> (Overview loader), `layout.tsx` (nav).

## What this tab IS today

The Briefings tab (`briefings/page.tsx`) is a **14-day archive of Plaino's
periodic written briefs**. It reads `WorkspaceBriefing` rows (the most recent
14, newest first), decrypts each body, and renders them as a vertical list of
paper cards. Each card is dated, with an eyebrow flag for state: `EMPTY`
("quiet day"), `WEEKLY_READY` ("weekly proof-of-value digest"), or
`WEEKLY_EMPTY` ("weekly digest · quiet week"). The header copy is "Two weeks
of mornings" and promises one briefing per workday at ~9 ET.

The page carries four distinct surfaces, not one:

1. **The brief archive** — the dated list of daily + weekly briefs.
2. **A mute / unmute control** (`muteBriefingsAction`) toggling
   `WorkspacePreference.briefingsMutedAt`. The generator cron skips muted
   workspaces. This is a notification preference.
3. **A "what we learned from your feedback this week" section**
   (`FeedbackLoopSection`) — a digest of the corrections the owner left on
   /approvals this week, plus what Plaino is "considering" in response.
   Derived from `PreferenceFeedback` rows. Renders nothing on a zero-feedback
   week.
4. **A one-tap "one tap from done" action card** (`StagedActionCard`) — pulls
   the top pending approval pre-staged on the latest brief's `summary` JSON,
   re-verifies it is still PENDING, and offers an inline Approve button
   (`decideTopApprovalFromBriefingAction`) plus a "review on approvals →"
   link.

So the tab is really four jobs welded together: an archive, a notification
toggle, a feedback-loop report, and a do-now approval shortcut.

## Customer job (JTBD)

The headline job: **"Catch me up — tell me what happened and what you handled
while I wasn't looking."** For a local-business owner this is the morning-
coffee read: a calm, plain-language summary so they trust Plaino is working
and know if anything needs them. The staged-action card extends the job to
"...and let me clear the one thing that needs me without digging."

This is a *daily/periodic digest* job. It is squarely a "Today + Reports"
intent, not a destination the owner navigates to deliberately each day. They
want the latest brief surfaced, not a 14-row backlog to scroll.

## Duplications

This tab is the **most duplicated surface in the product.** Three overlaps:

1. **Daily brief ↔ Overview/Today.** `overview-view.tsx` already renders a
   `TodaysBriefing` card ("today's briefing", line 430) on the main Overview
   page. The single latest daily brief is therefore shown in TWO places. Worse:
   the two pull from **different data sources** — Overview reads via
   `getBriefingsProvider().fetchBriefings()` (the legacy Notion-era provider,
   `page.tsx`), while the Briefings tab reads `WorkspaceBriefing` rows from the
   new generator cron. Same concept, two pipelines = a live drift hazard.

2. **Weekly digest ↔ Weekly report tab.** The Briefings list already renders
   weekly digests inline (`WEEKLY_READY`/`WEEKLY_EMPTY`, titled
   "Week of {date} · what Plaino did for you"). The separate Weekly report tab
   (`reports/weekly/page.tsx`) renders "What {partner} did for you, week by
   week" from `computeWeeklyReportData`. Both are "Plaino tells you what it did
   this week." The *framing copy is nearly identical* ("what Plaino did for
   you"). Two tabs, one concept.

3. **Staged approval card ↔ Approvals tab.** The `StagedActionCard` is a
   thin mirror of `/approvals` — same `decideApproval` core, same item. It
   even links straight to /approvals. It is a shortcut, not a home; the
   real surface is the Approvals tab.

The feedback-loop section is the one **non-duplicated** thing here — it exists
nowhere else in the product.

## Relationships

- **Overview/Today** — parent. Today's brief belongs at the top of Today;
  Briefings is the archive behind it.
- **Weekly report** — sibling. Same "what Plaino did" family; weekly digests
  already coexist in this list, so the two are already half-merged in the data
  model.
- **Approvals** — the staged-action card is a satellite of Approvals.
- **Activity** — adjacent but distinct: Activity is the raw event feed ("every
  action, timestamped"); Briefings is the *narrated, periodic synthesis* of
  that feed. Activity is the ledger; Briefings is the letter. They should not
  merge — different altitude.
- **Settings** — the mute toggle is a notification preference and belongs in
  an email/notifications settings group, not on the reading surface.

## What's broken or confusing

- **Engineer-vocab leaks** (PR #249 violations):
  - `StagedActionCard` renders the raw approval kind:
    `action.kind.toLowerCase().replace(/_/g, " ")` — surfaces internal enum
    strings (e.g. "support handler reply draft") to the owner.
  - `FeedbackLoopSection` prints `g.targetSkillSlug` in mono font directly to
    the customer — a literal **agent/skill slug**, exactly the "agent slug"/
    "skill" leak the vocab rule bans. Same section uses "skill"
    ("change a skill this week").
  - The `· stale` flag on Overview's twin brief is borderline engineer-speak.
- **Two-source drift** for the daily brief (see Duplications #1) — Overview
  and Briefings can disagree about "today's brief."
- **Four jobs on one page** with no hierarchy — the owner lands on an archive
  list but the action card, feedback report, and mute control are stacked
  above/around it with equal weight. The thing they came for (the latest
  brief) is buried below three other modules.
- **Failure strings shown to customer**: `safeDecrypt` surfaces
  "(briefing body could not be decrypted: {reason})" — an internal error in
  customer voice. Defensive intent is right; the wording is not.
- **"Two weeks of mornings"** framing presumes daily cadence, but the same
  list silently mixes in weekly digests — the mental model wobbles.

## What's working

- **The content job is the heart of the product.** "Plaino caught me up" is
  the single highest-trust moment for a done-for-you service. This is
  load-bearing.
- **The feedback-loop section is genuinely differentiated** — "here's what we
  learned from your corrections" closes the trust loop and exists nowhere
  else. Worth preserving as a first-class idea (just de-slug it).
- **The staged one-tap action** is a strong pattern: turn a backward-looking
  read into a do-it-now surface, with correct re-verification (only renders if
  still PENDING) and graceful ALREADY_DECIDED degradation via the shared core.
- **No-outbound discipline is honored** — nothing here mutates customer-facing
  state; mute is a preference, approve is a decision, sends stay external.
- **RLS, audit logging, and decrypt-safety** are all correct and page-safe.

## Verdict

**MERGE / SPLIT → bucket A (Today) + bucket D (Reports).** Do not keep
Briefings as a standalone tab. It is secretly load-bearing *as content*, but
its content already lives across Today, Weekly report, and Approvals. Split it
along its natural seams:

- **Daily brief → bucket A (Today).** The latest morning brief becomes the
  top of the Today tab (Overview already renders it). Collapse the two data
  sources into one (`WorkspaceBriefing`); retire the Notion provider path.
  "Yesterday/older daily briefs" become a "see earlier" expander, not a tab.
- **Weekly digest → bucket D (Reports).** Fold the weekly-digest rows into the
  single **Reports** surface alongside Weekly report — they are already the
  same "what Plaino did this week" content with the same copy. One Reports tab,
  daily-roll-up at the Today level, weekly digest under Reports.
- **Feedback-loop section → bucket D (Reports)** (or a "what Plaino learned"
  card on Today). It is periodic and reflective — Reports fits.
- **Staged action card → already covered by Approvals**, which lives in
  bucket A (Today). Keep the one-tap pattern *on Today's brief card*, drop the
  standalone instance.
- **Mute toggle → bucket E (Account/Settings)**, under email/notification
  preferences (next to `weeklyReportEnabled`, which is already a settings-style
  toggle on the Weekly report page — same family).

Net: Briefings as a tab disappears; its four jobs distribute to Today (daily
brief + one-tap), Reports (weekly digest + feedback loop), and Settings (mute).

## Migration notes

1. **Unify the daily-brief data source first.** Point Overview's
   `TodaysBriefing` at `WorkspaceBriefing` (the generator-cron rows) and retire
   `getBriefingsProvider()`/Notion for this purpose. Until this is done, any
   merge will show two different "today's briefs."
2. **Move the daily-brief archive under Today** as a "see earlier briefs"
   expander reading the same 14-row query that exists in `briefings/page.tsx`.
3. **Move weekly digest rows + the Friday weekly report into one Reports
   surface.** The data already coexists (`WEEKLY_READY`/`WEEKLY_EMPTY` rows +
   `computeWeeklyReportData`); reconcile to one renderer so the inline-digest
   copy and the Weekly report copy stop diverging.
4. **Lift `FeedbackLoopSection` verbatim** into Reports, but **fix the slug
   leak**: map `targetSkillSlug` → a customer-facing capability label and drop
   the word "skill." This is the only net-new content and must not be lost.
5. **Fix vocab leaks on move** (PR #249): the `action.kind` raw-enum render in
   the staged card, the `targetSkillSlug` mono render, "skill", and the
   "(briefing body could not be decrypted...)" string.
6. **Relocate the mute toggle** to Settings notifications; keep the
   `muteBriefingsAction` server action and its audit-log entries intact (move
   the form, not the logic).
7. **Preserve the shared-core decision path** — keep
   `decideTopApprovalFromBriefingAction` routing through
   `lib/approvals/decisions#decideApproval` wherever the one-tap card lands, so
   the audit trail never forks.
8. **Redirect** `/briefings` → Today (with the archive expander) so existing
   email/deep links don't 404. The mobile briefing route
   (`app/api/mobile/workspace/[id]/briefing/route.ts`) should follow the same
   unified `WorkspaceBriefing` source.
