# 06 — CPA pilot week-1 runbook (adapted)

**Lineage:** `docs/pilot/week-1-runbook/` (RE, PR #366) is the parent and its spine transfers whole: Day 0 = the hour after signature, Day 1 = the 90-minute activation call, Days 2–3 = silent internal checks, Day 4 = Thursday prep, Day 5 = the first Friday call with case-study capture inside it. The prod-key preflight, per-workspace caps ($40/mo + $5/day staged before onboarding), the any-red-reschedule rule, and the exit criteria all apply unchanged. This file records **only the CPA deltas** — running it requires the parent open in the next tab.

## Delta 1 — Day 0: the credential ask changes

The RE welcome email asks for a Follow Up Boss API key. The CPA welcome email asks for two things, both zero-risk to name in writing:

1. **Admin access to the firm's QuickBooks Online** (they'll click Connect on the call — OAuth, no key to hunt). One line: "have the login that can authorize a connection handy."
2. **A working list of 8–12 clients with genuinely outstanding items** — missing documents, unanswered requests, stalled follow-ups — in whatever form it exists (a spreadsheet, a folder, memory). This is the Day-1 config input: the pilot's first drafts chase real outstanding work, so value shows up in the first queue.

Signup path to walk on Day 0: `/signup?vertical=cpa` end-to-end (the workspace must be born knowing its vertical — trial logic and tile relevance both key off the slug). Verify the marketplace shows TaxDome/Karbon as coming-soon, not connectable — a partner who clicks a dead tile on day 1 is an own-goal the catalog exists to prevent.

## Delta 2 — Day 1: connection order inverts

RE connects FUB first, email second. CPA has no FUB equivalent live, and the killer workflow (client-doc-chase, doc 04) is email-native. So:

| Decision | CPA default | Why |
|---|---|---|
| First connection | **Their email** (Gmail / Outlook OAuth) | The chase and the client replies live here; it unlocks Client Inbound — the live CPA roster card |
| Second connection | **QuickBooks Online** | The chase's context (unpaid invoice, unreconciled account, missing statement) and the books-recon path |
| Third connection | DocuSign **only if** engagement-letter or 8879-routing pain was named in discovery; otherwise week 2 | One workflow that runs beats three that confuse |
| Skills on | Client Inbound + the doc-chase configuration seeded from their 8–12-client list | Their named pain first; nothing speculative |
| Named operator | The partner personally for week 1, with a named staff reviewer identified for week 2+ | Partner buys in by using it; staff-review is the conversion-era shape |
| Approval notifications | On, tested, to the partner's phone/email | Unchanged from RE |

**The demo segment honesty note carries over from doc 04:** the autoplay demo story is RE-flavored today. If the CPA demo story hasn't shipped by partner #1's Day 1 (activation checklist item), skip the autoplay entirely and go straight to the real queue — with email connected, real drafts exist within the call. A CPA partner is the persona *least* tolerant of a demo that resembles fiction.

## Delta 3 — PII discipline (higher stakes than RE, explicit rules)

- **Screen-share rule:** Conner never drives screens that show client tax documents. Orientation happens on the synthetic workspace; anything touching their real client data happens with **their hands on their machine**, Conner watching only what they choose to share.
- **The data-disclosure screen is read together, not clicked past.** For this persona it's the trust asset — a firm owner who reads it and proceeds has internalized the two-bucket answer and will repeat it to their own clients.
- **Recordings:** the call-recording consent line stays, and one clause is added: *"if a client's information comes up on screen, tell me and that section is off the record"* — the case-study framework's end-client-protection rule applied live, at capture time.
- **The 8–12-client chase list** is pilot working material, not case-study material. Client names never leave the partner's systems and never appear in capture files — the case study refers to counts and turnaround times only.

## Delta 4 — the save-motion triggers get a seasonal clause

The parent's graduated ladder (queue unopened 2 days → nudge; approvals <5 on the week → Friday-call agenda item; missed Friday call → same-day personal note) transfers as-is, plus:

- **Deadline-week awareness.** If week 1 collides with a filing deadline (the 15ths: Jan, Mar, Apr, Jun, Sep, Oct), a quiet queue is not a churn signal — it's a calendar. The save-motion pauses; a one-line "I know what week it is — everything holds until you surface" note replaces the nudge. Scheduling rule upstream of this: **don't start a pilot week that collides with a 15th.** Day 0 books around it.
- **The Friday call flexes to their rhythm, not ours.** If the partner's week peaks Thursday (payroll clients) or month-end, the weekly call moves once, permanently, on their word — the cadence surviving matters more than the weekday.

## Delta 5 — Day 4–5: what the first check-in measures

The Thursday brief keeps the parent's shape (approvals by day, per-run trace, saved-time ledger with the Truth-Wave scrutiny rule, edits digest). The CPA-flavored metrics added to it:

1. **Doc-collection turnaround:** for each chase drafted and approved this week — request sent → items received, in days, from the thread timestamps. This is the case-study metric (doc 07) and it accrues from week 1 or it doesn't exist.
2. **Client-reply latency on inbound:** question arrived → approved reply sent. The before-number came from discovery; the delta is the story.
3. **The edit pattern on tone.** CPA client communication is more formal than RE; expect week-1 edits to cluster on register (too casual) rather than content. That cluster is the voice-calibration input, and it's worth naming to the partner on Friday: "it's learning that your firm doesn't use exclamation points."

Friday-call questions, data walk, feedback capture, and exit criteria: parent verbatim (≥5 approvals on the week, one agreed week-2 change, capture artifacts or their honest absence). The week-2 proposal menu for CPA: DocuSign connect (engagement letters / 8879 routing), the books-recon draft path, or briefing-time shift — one, not five.
