# Day 0 — the hour after the signature

**Scope:** design partner #1, a Georgia real-estate broker-owner or solo agent, signs the short pilot letter (standard ToS + letter covering the weekly call, on-record testimonial, reference willingness, and case-study rights — the interim path from `docs/sales/deep-dive-2026-07-02/02-design-partner-program.md` §4). The clock below starts the moment the signed letter is in hand.

**Why an hour matters:** the partner's belief peaks at signing and decays every silent day after. The design-partner program's scarcest asset is founder weeks; the second scarcest is this window. Everything below is Conner's next 60 minutes, in order, with nothing that can wait allowed in.

**Ratified frame this runbook operates inside (2026-07-03):** first partner is Georgia RE · prod-key un-pause is scoped to their workspace only (CEO Pass 1, Option B) · 3 months free · weekly Conner call during the pilot · Truth Wave — no fabricated numbers anywhere, including in enthusiasm.

**Canonical calendar alignment:** the plan assumes a Friday signature (end of week 2 from the Monday sends). Day 1 = the next business day (Monday). Days 2–3 = Tuesday–Wednesday. Day 4 = Thursday (prep). Day 5 = Friday (check-in call + case-study capture). If the signature lands mid-week, keep the *spacing*, not the weekday names — but always land Day 5 on a real Friday if it costs at most one extra day, because the Friday weekly report email is the artifact that call runs on.

---

## The 60 minutes, in order

### 0:00–0:05 — Calendar first, everything else second

Book two holds before touching anything technical:

1. **Day-1 activation call: 90 minutes, next business day.** Morning if their discovery answers said they're a morning-email person; otherwise their stated quiet block. The invite carries the video link and one line of agenda ("we set it up together; you approve your first item before we hang up"). Onboarding within 48 hours of the signed letter is the CS-plan hard rule — same-week momentum is the point of this whole document.
2. **The recurring weekly 30-minute call**, starting Day 5 (Friday). Send it as a recurring series now, not after the activation call — hunting for times later is how weekly calls die. The Day-1 call closes by *confirming* this invite, not by proposing it.

Both invites come from Conner's own calendar. No scheduling-tool branding on the invite body; the booking link (`NEXT_PUBLIC_BOOKING_URL`) is for prospects, not for a signed partner who now gets direct access.

### 0:05–0:15 — The welcome message (Conner's inbox, not automated)

Send within the first 15 minutes. Personal, short, zero product tour. Template — adapt the bracketed parts to the discovery call, keep the shape:

> Subject: Welcome aboard — here's Monday
>
> [Name] — glad to have you as our first partner. Here's everything that happens next, so there are no surprises:
>
> **Monday [date], [time] — setup call (90 min, invite attached).** We do the whole setup together on that call. You don't need to prepare anything except one item below.
>
> **The one thing to have ready:** your Follow Up Boss API key. In Follow Up Boss: Admin → API → Create API Key. Copy it somewhere handy — takes about two minutes. That key is what lets the service watch your leads. (If you hit any trouble finding it, just reply — don't burn time on it.)
>
> **What you'll get from the pilot, restated plainly:** three months free, a 30-minute call with me every Friday, and your say in what we build next. What you agreed to give back: those Friday calls, an honest on-record quote once you've seen real value, and a case study you approve word by word before anything is public.
>
> **Your only job in week 1** (starting after Monday): open your queue each morning with your coffee and approve or toss what's there. Ten minutes.
>
> Anything at all, reply here or hello@agentplain.com — during the pilot you'll usually hear back from me directly, same business day.
>
> — Conner

Rules baked into that template, do not drift from them: customer vocabulary only (`feedback_customer_vocab_not_engineer` — no "LLM," no "prod key," no runtime states); no model or vendor names anywhere (the subprocessor list on /security is the sole sanctioned disclosure); restate the signed terms, add no new promises; the FUB key ask goes in writing now so the Day-1 call never stalls on credential hunting.

### 0:15–0:35 — Prod-key un-pause, scoped to their workspace (the technical block)

Execute the fin-ops preflight (`docs/departments/2026-07-03/finance-ops/04-per-workspace-budget-cap-spec.md` §3) — it is designed to run in under an hour; at Day 0 it should take twenty minutes because the merge-blocking items (BREACH alert, fleet breaker, cap tests) were required to be green *before* this day, not on it. Both preflight preconditions now hold by definition: the activation path is verified (below) and a design-partner conversation is not just in flight, it's signed.

In order:

1. **Set the partner workspace's caps the moment the workspace exists** (or stage them if the partner signs up live on Day 1 — the recommended path): `tokenBudgetUsdMonthly = $40`, `tokenBudgetUsdDaily = $5`. Full config, breach behavior, and reconciliation with the CS plan's $50 figure: `06-prod-key-per-workspace-cost-guardrails.md`.
2. **Verify zero `NO_CAP` rows among active workspaces** via the fleet budget snapshot. Option B's "their workspace only" is enforced here: the key is workspace-agnostic once rotated, so the scoping *is* the caps — the partner's workspace has generous pilot headroom; every other active workspace is capped or dormant. An uncapped stray workspace is a preflight failure, not a judgment call.
3. **Rotate the real key in** (replace the paused sentinel), confirm the pause no longer short-circuits, run one governed smoke call, and confirm a draft generates end-to-end on the seeded dry-run workspace. This smoke draft, dated today, is the "pipeline is warm today, not last week" gate the CS runbook requires before any onboarding call.
4. **Stamp the un-pause in the ops digest:** date, workspaces live, caps in force, who approved. One line, but it exists — the first un-pause is a company event, and the audit trail starts honest.

**If any preflight item is red: the Day-1 call moves, full stop.** Rescheduling a signed partner by one day with an honest reason costs a little; running the unrepeatable first call against a resting or ungoverned product costs the reference. The CS runbook's rule ("any red = reschedule") is inherited here unchanged.

### 0:35–0:50 — Workspace path verification (not pre-creation)

The recommended pattern from the CS runbook stands: **the partner signs up live on the Day-1 call**, on their own machine, with their own email — they should see their own front door, and the workspace is born knowing its vertical via `/signup?vertical=real-estate`. Day 0's job is to make that path boringly reliable:

- [ ] Walk the exact path yourself today: `/real-estate` → signup → magic-link interstitial → workspace creation → Today tab in demo mode with the lead-triage story autoplaying. Every screen, this afternoon, not "it worked last week."
- [ ] Verify the Follow Up Boss connect path: disclosure screen → api-key form → verify-on-submit against the live provider (a test key if available, or confirm the form's failure state reads honestly).
- [ ] Confirm the degraded/paused banner **no longer shows** post-rotation — the partner must not be welcomed by a "paused" notice on pilot day 1.
- [ ] Pull the discovery handoff sheet (their named repetitive task, email system, QuickBooks yes/no, named daily operator, degraded-tolerance answer) into the call notes doc. That sheet is the Day-1 config; there is no re-discovery on the call.

If the partner is the eager type who will click the signup link tonight: fine — the caps get set the moment their workspace row exists (step 1 above runs again, against the real workspace), and Day 1's Segment 2 becomes a two-minute tour of what they already made instead of a live signup. Never block enthusiasm to preserve a script.

### 0:50–0:60 — Internal wiring

- [ ] Open the partner's folder (per the CS support-playbook folder scheme): signed letter filed, discovery sheet in, call-notes doc created, case-study file opened from the template (`docs/sales/deep-dive-2026-07-02/05-case-study-template.md`) with the permissions checklist at the top — every box unchecked, on purpose. The study is written forward from today, not reconstructed at day 90.
- [ ] Schedule the internal, silent Day-2 data check (no partner touch — see `02-DAY-2-3-first-workflow-run.md`).
- [ ] One line to the Friday scoreboard: partner #1 signed, activation call booked [date]. The CS reporting rule (approvals per week, per partner) starts counting from Day 1.

## Exit criteria for Day 0 (all five, same day)

1. ☐ Welcome message sent from Conner's inbox within the hour, FUB key instructions included.
2. ☐ Day-1 activation call (90 min, within 48h) and the recurring Friday call both accepted or at least sent.
3. ☐ Preflight green: caps staged/set, zero `NO_CAP` actives, key rotated, same-day smoke draft on record.
4. ☐ Signup and FUB-connect paths walked end-to-end today, degraded banner confirmed gone.
5. ☐ Partner folder open, case-study file started, Day-2 silent check scheduled.
