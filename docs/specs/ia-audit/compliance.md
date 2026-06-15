# Compliance — IA audit

## What this tab IS today

The Compliance tab (`compliance/page.tsx`, with `compliance/loading.tsx`) is a
single server-rendered list of open compliance flags raised against
customer-facing drafts before they leave the brokerage. It is gated to
`BROKER_OWNER` and reads under RLS.

Concretely the page renders four things:

1. **A headline counter** — "Nothing flagged for review." or "N open flag(s)."
2. **A "compliance checks" status block** (only when a corpus exists for the
   workspace's vertical). It tells the customer how many rules check every
   draft today vs. how many are written but "waiting on attorney review before
   they switch on." For real-estate it hard-codes "Real-estate fair-housing
   rules check every draft today."
3. **A counsel-gated banner** (`COUNSEL_GATED_BANNER_TEXT`) shown when a corpus
   exists but auto-rewrite isn't cleared by counsel yet.
4. **The flag list** — each row shows severity + rule code, the flagged claim,
   an optional suggested rewrite, and an SLA due time with a relative-time
   string. Sorted at the app layer by `SEVERITY_ORDER`
   (BLOCKER→HIGH→MEDIUM→LOW→INFO) then SLA.

When there are zero flags it falls through to `ApRootedEmptyState`
("Nothing flagged. Plaino is reading every draft before it goes out.").

So the page is **real and functional** — it reads a live `complianceFlag`
table and a live per-vertical corpus, computes a firing-vs-draft rule split,
and evaluates a counsel sign-off gate. It is NOT empty scaffolding. But for a
real-estate customer in steady state, the dominant rendered state is the
empty state plus a one-line "fair-housing rules check every draft today"
reassurance — i.e. it is **mostly a trust surface, occasionally a worklist.**

## Customer job (JTBD)

The local-business owner (e.g. a real-estate broker-of-record) has two distinct
jobs hiding in this one tab:

- **"Did Plaino catch anything I need to fix before it goes out?"** — an
  action job. When a flag exists, the broker must triage it (read the claim,
  accept/adjust the rewrite) before the draft ships. This is real, time-bound
  (SLA), and high-stakes.
- **"Am I protected? Is someone watching my drafts for legal landmines?"** — a
  reassurance/trust job. This is the moat made visible: the broker wants to
  *believe* fair-housing screening is happening, ideally without having to
  visit a dedicated tab to confirm it.

The action job is bursty and rare. The trust job is continuous but passive —
it does not warrant a daily click. Neither job is "manage compliance" as a
standing workspace; the customer never configures rules here (that's
counsel/operator territory).

## Duplications

This is the strongest finding. **Overview already surfaces this tab's entire
action job.** In `overview-view.tsx`:

- `openFlags` is a first-class stat tile: `<dt>compliance flags</dt>` with the
  count (line ~514).
- The next-steps builder injects a high-urgency CTA:
  `Triage N compliance flag(s)` → detail "The Compliance Sentinel surfaced
  these before the customer-facing draft ships." → `href: .../compliance`
  (lines ~599–607).
- The status sentence rolls `openFlags` into "flagged N items" (line ~261).

So Overview already shows the count, the urgency, and a deep link. The
Compliance tab is the **detail/triage destination** for a signal the customer
first meets on Overview. That's a healthy hub-and-spoke relationship — but it
means the tab does not need to be *top-level* nav; it's a drill-down.

Partial overlap with **Weekly report**: the weekly report frames Plaino as
"watching your inbox and your systems" but does not currently enumerate
caught/flagged compliance items as a section. So the "what Plaino watched and
caught this week" narrative is *implied* in two places but *owned* by neither.
That gap is the opening to fold compliance assurance into Reports.

No duplication with Approvals, Activity, Agents, or Disciplines — none of
those render `complianceFlag` rows.

## Relationships

- **Overview** → counter + CTA → deep-links here (parent).
- **Approvals** — sibling worklist; broker-of-record review "still gates every
  send" per this page's own copy, so an accepted compliance rewrite ultimately
  flows through the approval/send path.
- **Weekly report** — the natural home for the *assurance* half ("X drafts
  screened, Y caught, fair-housing checks active all week").
- **Settings / Integrations** — unrelated; compliance rule config is
  operator/counsel-side, never customer-configurable here.
- Backed by `lib/agents/sentinel` (corpus loader, counsel gate) and the
  `complianceFlag` model.

## What's broken or confusing

- **Engineer-vocab leaks (PR #249 violation).** Customer-facing copy says
  "Compliance **Sentinel**" (page header paragraph + the Overview CTA detail),
  "raised by your compliance **sentinel**," and the empty-state references
  internal machinery. "Sentinel" is an internal agent name and should read as
  "Plaino" or "your compliance review." The Overview next-step also leaks
  "the first **fire** lands inside the wizard" ("fire" is banned). These need a
  vocab pass regardless of where the tab lands.
- **Two jobs, one tab.** The trust job and the triage job are mashed together;
  in the common (zero-flag) state the page is 90% reassurance copy, which makes
  a top-level nav slot feel idle.
- **Raw rule codes exposed.** Rows render `f.rule` (e.g. a rule code) and raw
  severity enums (BLOCKER/HIGH) in mono-uppercase — engineer texture, not
  customer language. Acceptable for a power broker-of-record, but cold.
- **Counsel-gated banner is inside-baseball.** "Auto-rewrite · in counsel
  review" is honest but exposes internal pipeline state most owners won't parse.

## What's working

- The page is **genuinely populated and load-bearing logic-wise** — firing vs.
  draft rule split, counsel gate fail-closed, SLA-aware sort. This is real
  moat machinery, not a placeholder.
- **Honest maturity messaging** — it distinguishes rules that check drafts
  today from rules "waiting on attorney review," which is exactly the kind of
  truthful, non-overclaiming copy the brand voice wants.
- **Severity + SLA ordering** is the right shape for a triage worklist.
- The **suggested-rewrite inline** is the highest-value element: it turns a
  flag into a one-tap fix.

## Verdict

**MERGE INTO Reports (bucket D) — keep the word "Compliance" visible as a
prominent named section, not a top-level tab.**

Compliance is a real differentiator, so we do NOT kill it or bury it in
Settings. But it does not earn a top-level slot for a *daily* user: the action
job is already fully surfaced on Today/Overview (count + urgent CTA + deep
link), and the assurance job is a periodic "here's what Plaino watched and
caught" story that belongs in **Reports (D)** next to the weekly report and
value/analytics. A broker checks "am I protected?" on a weekly cadence, not a
daily one — Reports is exactly that cadence.

Mapping to target IA:
- **Today (A)** keeps the live triage signal: the "N flags to triage" CTA and
  count already live here. This is where an *open* flag is acted on.
- **Reports (D)** gets a standing **"Compliance assurance"** section: rules
  active this period, drafts screened, items caught + rewrites, fair-housing
  status — the trust badge with receipts.
- The triage *detail view* (the current flag list) becomes a drill-down
  reachable from both the Today CTA and the Reports section — same route can
  survive, it just loses its top-level nav entry.

This is the "fold into Reports, keep the word visible" outcome the brief flags
as the likely answer for a strategically-important-but-thin-in-steady-state
surface.

## Migration notes

- **Do not delete the route or the data path.** `compliance/page.tsx` keeps
  working as the triage drill-down; only its NAV entry in
  `layout.tsx` (line 24) is removed when the tab is collapsed.
- **Reports section, not a new query.** The assurance section in Reports can
  reuse the same `complianceFlag` read plus the corpus firing/draft split
  already computed here — lift that logic into a shared loader so Reports and
  the drill-down agree.
- **Today already wired.** Overview's `openFlags` tile + CTA require no change
  to keep the daily triage entry point; just ensure its deep link survives the
  nav collapse.
- **Vocab pass is a prerequisite, do it during the move.** Replace
  "Sentinel"/"compliance sentinel" with "Plaino"/"your compliance review";
  remove "fire" from the onboarding next-step copy; consider softening raw
  rule-code/severity display for non-counsel viewers. This is a PR #249
  cleanup that should ride along with the IA change, not after.
- **Preserve the honesty.** Keep the firing-vs-draft and counsel-gated
  distinctions when relocating — that truthful "what's live vs. waiting on
  attorney review" framing is brand-load-bearing and is the moat's credibility.
- **Keep the word "Compliance" in the Reports sub-nav / section header** so the
  differentiator stays legible to a prospect or a broker doing diligence — the
  goal is to demote the *tab*, not hide the *capability*.
