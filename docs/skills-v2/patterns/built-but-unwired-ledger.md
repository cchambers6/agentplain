# Dossier: the built-but-unwired ledger

Producers with no consumers, as recorded in the 2026-07-02 sweeps. This ledger exists because the class keeps refilling — check it before claiming any instrumentation "shipped," and add to it when a retro finds a new one.

| Producer | Missing consumer | Observed cost | Citation |
|---|---|---|---|
| `stampSessionCost` / `stampCvBarScore` (`lib/kaizen/session-stamp.ts`) | never called from dispatch completion | week-to-date spend **null** (not zero) for 3 weeks; two re-tier audits aborted "insufficient data"; the single most agreed-on fix across four retros | kaizen 07 friction-1; MASTER kaizen-agreement-1 |
| `recordSavedTime` | 1 caller on ~8 creation paths | 4/7 guarantee actions wrote 0 minutes → **wrongful full refunds** + false "we failed you" emails | MASTER improvement-3; audit MASTER-SYNTHESIS fix-11 |
| Registry entries missing `runtime: 'live'` | `isSkillInstalledByDefault()` false → cron skips every workspace | killer workflows **silently never fire**; PR #223's registry-truth CI guard exists for exactly this | `feedback_runtime_live_flag_required_in_registry` |
| Librarian charter | executor never registered | YAML data layer never hydrates; `session-costs.yaml` 17 days stale | kaizen 10 friction-1 |
| `notifyApprovalQueued` | on 1 of ~8 paths | approvals land unannounced | MASTER F1 |
| `{{CALENDLY_LINK}}` | booking URL never wired | every outreach draft dead-ended at a literal token | outreach kit 03 (→ [[placeholder-never-ships]]) |
| Health score | fully spec'd, zero implementation | dashboards read as designed, deliver nothing | MASTER F1 |
| L3 governor | designed, never scheduled | the whole loop dormant (PR #349) | `project_loop_v3_nine_tracks_2026_07_03` (→ [[scheduled-task-liveness]]) |

**The general law** ([[wired-not-just-built]]): "done" = called + registered + fired once + output cited. A null metric gets a producer-consumer trace before any other diagnosis. Money-touching paths run human-review until their writers are verified wired. The claims corollary ([[truth-wave-check]]): an unwired capability is an unclaimable capability — "a wrong number on the proof shelf is worse than an empty shelf."
