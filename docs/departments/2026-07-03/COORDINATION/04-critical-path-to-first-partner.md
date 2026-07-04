# Critical Path: Five Monday Emails → First Design Partner Signed and Activated

The exact chain from "Conner sends 5 emails Monday Jul 6" to "first design partner activated" (defined by CS: one approved draft, live on the onboarding call, with the weekly call scheduled). Every fleet task on the path is named; every Conner decision is marked **[CONNER]**; every node lists its failure mode and fallback.

```
N0 PRE-SEND GATES (Jul 3–5)
 ├─ merge train #348–#355 on main ................. Engineering   Jul 4
 ├─ four conversion breaks fixed on prod .......... Design        Jul 4 → live Mon 8am
 ├─ piece 1 (FUB comparison) gate-clean ........... Marketing     Jul 4 → live Mon 8am
 ├─ /security softening + claims spot-check ....... Legal+Mktg    before Jul 6
 ├─ short-form drafted → counsel Batch 1 .......... Legal         before Jul 6
 ├─ 3 must-fire events + booking-ref wired ........ Data+Eng      before Jul 6
 ├─ prod verification sweep (5 URLs) .............. Engineering   Sun Jul 5
 ├─ [CONNER] booking URL set ...................... Fri Jul 4
 ├─ [CONNER] 5 prospects in CRM, five confirmed ... Fri Jul 4
 └─ [CONNER] send-path copy rulings (ROI card,
     email destination) ........................... Fri Jul 4 EOD
      │
      ▼
N1 THE SEND ── [CONNER] Monday block, 60–90 min ... Mon Jul 6
 │   5 sends from Conner's inbox, 5 CRM rows at FIRST-TOUCH-SENT
 │   Rule: THE BLOCK NEVER BLOCKS — any N0 slip runs on fallbacks
 │   (links → / and /pricing; times proposed manually)
      │
      ▼
N2 REPLY (expected Tue Jul 7 – week 2)
 ├─ fleet monitors inbox; drafts reply ............ Sales (fleet)
 ├─ [CONNER] warm reply → booking reply ≤4 bus. hrs
 ├─ one-pager sendable (warm-yes promise) ......... Mktg+Design   Thu Jul 9
 ├─ reply logged in CRM ≤24h with disposition ..... Conner+fleet
 └─ follow-up chain day 5/12/21 with fresh pieces . Marketing     Jul 8/10/14/16
      failure: zero replies by Jul 17 → pre-decided: continue chain,
      5 fresh names week 3, rewrite nothing yet
      │
      ▼
N3 DISCOVERY CALL BOOKS (realistic: week 2)
 ├─ booking carries prospect ref (attribution) .... Data          wired at N0
 ├─ 20-min playbook + briefing prepped day before . Sales (fleet)
 ├─ demo state verified weekly (LLM-free runtime).. Product       Sun Jul 5, weekly
 ├─ piece 4 attached as pre-read at booking ....... Sales+Mktg    from Jul 14
 └─ Sales → CS + Product + Fin-Ops same-day signal (activation
     readiness + pilot workspace flagged BEFORE un-pause)
      │
      ▼
N4 THE CALL → YES (Conner runs it; fleet preps it)
 │   demo beat: draft in queue → edit → approve, on screen-share
 │   design-partner terms: founding cohort of five, 3 months free,
 │   weekly founder access
      │
      ▼
N5 SIGNATURE ≤48h of yes ── THE LEGAL GATE
 ├─ short-form counsel-blessed (Batch 1) .......... Legal         by Jul 10
 ├─ [CONNER] entity ruling ........................ by Jul 10 (conflict C2 —
 │    without it, no signature block; 48h promise breaks;
 │    fallback ruling from counsel: signable pre-formation y/n)
 └─ signed short letter BEFORE onboarding books ... Sales→CS      standing rule
      │
      ▼
N6 UN-PAUSE (trigger fired at N3 per ruling C1)
 ├─ [CONNER] un-pause bundle ratified ............. Tue Jul 7 (trigger/scope/cap)
 ├─ per-workspace cap wired + tested at ratified #. Engineering   by Jul 10
 ├─ workspace-scoped mechanism smoke-tested ....... Engineering   by Jul 10
 ├─ P3009 cleared via migrate resolve ............. Engineering   pre-Jul 11
 ├─ go/no-go one-pager → [CONNER] confirms ........ Eng+Fin-Ops   Jul 11
 └─ preflight step 1: caps on pilot workspace FIRST Fin-Ops       before key-on
      failure: unratified cap = NO_CAP = the one silence-unsafe
      default in the whole plan → partner waits or spend unbounded
      │
      ▼
N7 ONBOARDING CALL ≤48h of signature (90 min)
 ├─ runbook dry-run done, P0s fixed ............... CS+Product    by Jul 9
 │    exit test: one approved draft, screen-recorded
 ├─ onboarding-path states in customer vocab;
 │   three call-killing moments honest ............ Product       by Jul 9
 ├─ handoff sheet = onboarding config (5 fields,
 │   filled ≤24h of discovery call) ............... Sales→CS
 └─ demo→live cutover pre-verified ................ Engineering   by Jul 11
      │
      ▼
N8 ACTIVATED ✓  one approved draft live on the call + weekly call scheduled
 ├─ saved-time writers already landed (N0) — the case-study number
 │   accrues from week 1 .......................... Engineering   Jul 4
 ├─ activation timestamps queryable ............... Data          by Jul 10
 ├─ day-3 alert or manual daily check ............. Eng or Conner week 1
 └─ Friday synthesis + weekly report sanity-checked CS+Product    Jul 17
```

## The Conner decisions ON the path (six, in order)

1. Booking URL + prospects entered + send-path copy rulings — **Fri Jul 4**
2. The send itself — **Mon Jul 6** (the lever; no workaround)
3. Un-pause bundle (trigger/scope/cap) — **Tue Jul 7**
4. Entity ruling (or counsel's pre-formation fallback) — **by Jul 10**
5. Un-pause go/no-go read — **Jul 11**
6. Reply handling within 4 business hours + running the calls — continuous

## The one bottleneck

**The prod-key un-pause ratification (N6).** Reasoning against the other candidates:

- The **send (N1)** is the lever, not a bottleneck — it has a date, an owner, a rehearsed script, and the block-never-blocks rule; nothing upstream can stop it.
- The **booking URL** blocks reply conversion but has a stated manual fallback.
- The **entity ruling (N5)** can break the 48-hour promise, but counsel can produce a pre-formation fallback and the date only binds if a call converts fast.
- The **un-pause** is different in kind: it is the only node where (a) silence is affirmatively unsafe (NO_CAP), (b) no fleet fallback exists (only Conner can ratify spend exposure), and (c) failure converts the best possible news — an eager partner on a call — into the worst possible first impression: a resting product demo, per CS: "the entire runbook is fiction" without it. Three departments (CS, Eng, Fin-Ops) hold day-3-to-day-14 work hostage to the same missing ruling, which is why it appears in three plans under three names.

Clearing it costs Conner five minutes on Jul 7 against the recommended bundle in `02-conflicts-requiring-conner.md` C1. Everything else on the path is fleet-executable or has a rehearsed fallback.

## Path timing (if everything lands on plan)

Send Mon Jul 6 → first reply mid-week 1 → call booked early week 2 → yes on the call → signed ≤48h (~Jul 15) → onboarded ≤48h (~Jul 17) → **first partner activated at or just past the Jul 17 readback.** The 14-day window's honest success case is therefore "activated or in the 48-hour onboarding window" — which is exactly how the Jul 17 readback should score it.
