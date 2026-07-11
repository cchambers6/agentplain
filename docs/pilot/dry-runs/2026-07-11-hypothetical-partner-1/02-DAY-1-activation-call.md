# Day 1 — Monday Jul 20, the 90-minute activation call

> SAMPLE — not a real partner. See `00-README.md`.

Runbook under rehearsal: `docs/pilot/week-1-runbook/01-DAY-1-activation-call.md`. This is where the dry-run stops being a checklist walk and starts finding the product.

## Call-morning checklist — verdict

Fresh smoke draft, handoff sheet, staged caps, screen-share check, consent line: all executable (Day-0 notes carry over). ✅

## Segment 1 (0:00–0:10) — Frame and promises

Script only, no surfaces. Executes as written. One line to watch: *"The first evening a lead comes in after you've knocked off, you'll get a notification that a reply is drafted and waiting"* is promised again in Segment 5. **The product cannot currently deliver that notification to Sarah** (P0-1, evidence below) — this segment is where the promise gets made to her face.

## Segment 2 (0:10–0:22) — Live signup and the workspace

- Sarah signs up on her own machine via the `/real-estate` landing CTA → `/app/sign-up?vertical=real-estate` → magic-link interstitial → workspace born knowing its vertical. **Verified real** (`app/(product)/app/sign-up/page.tsx` reads `vertical`). ✅
- Today tab in demo mode with the lead-triage story: the demo-mode machinery exists (`lib/demo/demo-mode.ts`, wired into `app/(product)/app/workspace/[id]/page.tsx`). ✅ The honest sentence in the script ("That's a demonstration on sample data") matches what renders.
- Five-tab walk: the IA is the ratified five (PR #288). ✅
- **Caps at minute 12:** the moment Sarah's workspace row exists, Conner (second screen, operator session) sets $40/$5 on `/operator/workspaces/[id]`. Works; rehearse the two-screen choreography once, because doing it live for the first time on the call is where a $NO_CAP workspace slips through.

## Segment 3 (0:22–0:45) — Connections and config

- **FUB connect, her hands:** disclosure → api-key form → verify-on-submit. ✅ real. (Simulated wrinkle: we ran the §1 failure mode — key fails verify. The recovery script in doc 05 §1 is executable as written: retry once, pivot to email OAuth, hard promise on FUB by end of day. The pre-planned pivot is genuinely rehearsable. In this dry-run the retry succeeded.)
- **Email second (Gmail OAuth):** exists, read-access by design (PR #282). ✅
- **Config table decisions:** briefing time, skills on (lead triage + inbox drafts), named operator — all real settings. ✅
- **"Approval notifications: On, to their phone/email, and tested."** ❌ **This config row cannot be satisfied on main.** Verified:
  - The only approval-queued notifier is `notifyApprovalQueued` (`lib/push/notify.ts`), and its only call site is `lib/skills/persist-artifacts.ts` — the *inbox* chain. The lead-triage path (`PrismaLeadTriageApprovalSink`, used by the hourly FUB sweep) creates PENDING cards **silently**. Grep confirms zero notify calls in the sink or the sweep.
  - Even where the notifier fires, the channel is **mobile push to device tokens** (`/api/mobile/push/register`) — and the mobile app has never shipped (EAS blocked since PR #167). Sarah has no device token and no way to get one. There is **no email fallback** for approval notifications.
  - Net: "tested to her phone" fails in front of her, or gets quietly skipped. Either way Day-1 success criterion 2 is unmeetable. **P0-1.**
- **"Watch the first fire land, live."** ⚠️ For lead triage, the first fire arrives via the **hourly** FUB sweep (`FOLLOW_UP_BOSS_SYNC_CRON = '0 * * * *'`). Nothing triggers a sync at connect time. The onboarding first-fire handler (`onboarding-first-fire.ts`) runs at wizard step 4, *before* FUB is connected in this call's order, and has no lead-triage runner in its map anyway. If Sarah connects at 10:37, the first triage fires at 11:00 at the earliest — possibly inside Segment 4, possibly not. The script's "never dead-air a spinner" line papers over a structural gap. **P0-4** (manual workaround exists: Conner fires the sweep's trigger event from the operator side, but no documented affordance).

## Segment 4 (0:45–1:10) — The first approval

- With FUB connect fresh and the sweep not yet fired, the queue seeds from **inbox drafts** (Gmail connected in Segment 3, inbox chain runs, and that path both persists and notifies). The runbook anticipated exactly this ("the queue seeds from the connected inbox drafts") — it holds. ✅
- **"Ask them to edit something."** ✅ Edit-before-approve is real (`ApprovalsList.tsx` passes approve / edit / reject). The single highest-value beat of the call is supported by the UI.
- **Reject-with-reason** also real (`lib/approvals/decisions.ts` persists `decisionReason`; the card UI captures it). ✅
- Sarah approves two inbox drafts, edits one. Success criterion 1 (≥1 real item approved, her hands) **passes** — via the inbox path, exactly the flex doc 05 §1 allows.

## Segment 5 (1:10–1:30) — Cadence, support, close

Script-only. Executes — except it re-plants the two promises the week can't keep yet: the after-hours phone notification (P0-1) and "Friday morning you'll get an email from Plaino showing what it did all week" (P0-2). The week-1 contract line ("open the queue each morning with your coffee") is the right hedge and survives both.

## Day-1 success criteria — dry-run verdict

| # | Criterion | Verdict |
|---|---|---|
| 1 | ≥1 real item approved live, her hands | ✅ via inbox drafts |
| 2 | FUB connected + workflow "Working/Watching" **+ notifications tested to her phone** | ❌ **first half passes; the notification half cannot pass on main (P0-1)** |
| 3 | Watched the demo, then saw her own data | ✅ (demo story + inbox items; her first *lead* card waits for the top of the hour — P0-4) |
| 4 | Friday series accepted; Day-2 check scheduled | ✅ |
| 5 | Case-study "before" fields filled, on record | ✅ (see doc 06) |

**Day 1 verdict: the call converts — on the strength of the inbox path.** The killer workflow the partner was actually sold makes its first appearance an hour late and will never send her a notification. That gap is invisible on the call itself and lethal on Tuesday night.
