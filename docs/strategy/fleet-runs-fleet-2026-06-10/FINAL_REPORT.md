# FLEET-RUNS-FLEET — final report: what survives Conner (2026-06-10)

One-night build of the layer above customer value: the fleet detecting its own failures and either healing them or putting them in front of a named human within 24h. **9 PRs, all open + mergeable. 6 pillars + registry-truth + 108 cross-pillar E2E tests. Zero waves shipped below the 4/5 Conner-dead bar.**

## 1. What landed

| PR | What | Score |
|---|---|---|
| #216 | Plan — pillars, sequencing, decision queue | — |
| #217 | pfd-1 credentials: `pageHuman` seam · Anthropic key-rotation wrapper · quarterly credential-test cron | 5/5 |
| #218 | pfd-5 counsel gate: per-vertical `ComplianceCounselSignoff`, fail-closed; scan/flag stays live; operator sign-off/revoke | 5/5 |
| #219 | pfd-4 vertical gating: registry-truth signup gate (fail-closed to waitlist) · leak-path auto-refund (ships OFF = detect+page) · teardown-gap fixes | 4.5/5 |
| #220 | pfd-6 fleet health: 06:00 ET heartbeat, 7 metrics, breach digest w/ recommended actions, Monday all-green, operator panel | 4.5/5 |
| #221 | pfd-3 L1 support: escalate-first triage → KB auto-answer >0.80 → bounded auto-resolve → draft floor; deterministic escalation corpus fires even LLM-dead; gateSkillFire fix | 4.5/5 |
| #222 | pfd-2 integration self-heal: daily health cron with honest REAL_READ/CREDENTIAL_ONLY labels · durable idempotent retry queue + dead-letter paging · degraded hold-and-flush | 4.5/5 |
| #223 | pfd-8 registry truth: invoice-chase catalog entry · CPA + law production callers · CI guard killing the silent-no-op class | 4.5/5 |
| #224 | pfd-7 E2E: 108 offline tests pinning all six failure modes in CI forever | 4.5/5 |

The CI guard proved itself before merge: integrating the seven branches, it flagged pfd-3's live skill with an undeclared caller — exactly the bug class that silently killed two killer workflows in the master build. One-line fix, caught in minutes instead of in production.

## 2. Merge order (all mergeable now)

**#216 → #217 → #220/#221/#222 (any order) → #219 → #223 → #218 (any time) → #224 LAST** (it contains all pillar branches; after they merge its net diff is just the test layer + one manifest line).

## 3. Conner decisions owed (ranked by what they unlock)

1. **Set `FLEET_TRUSTED_HUMAN_EMAIL`** — THE single remaining point of failure. Until set, every page falls back to your own inbox; the system works but its dead-man coverage terminates at you.
2. **Restore primary `ANTHROPIC_API_KEY` + provision `ANTHROPIC_API_KEY_SECONDARY`** — restores the product's brain and arms the failover. Then run the #213 restore harness for proof.
3. **Counsel sign-off** — real-estate compliance REWRITES are now gated (scan/flag unaffected) until you upload the counsel artifact + click sign-off at `/operator/compliance-signoff`. Deliberate behavior change; reversible per-vertical.
4. **Ratify auto-refund policy** — $500/workspace, once per lifetime; flip `UNSUPPORTED_VERTICAL_AUTO_REFUND=on` when comfortable (until then: detect + page, zero money moves).
5. **Ratify L1 escalation defaults** — 0.80 KB confidence · $200 dispute floor · 24h deadline · auto-resolve rides the #204 autonomy toggle.
6. **Ratify fleet-health thresholds** (defaults in #220 body) + **PAST_DUE grace** (carried from #215, still unresolved — fleet-health counts it either way).

## 4. The honest verdict

**If Conner died tomorrow and a customer signed up the day after (post-merge + key restore):**

✅ **Survives perfectly (self-heals):** Anthropic key failure (with secondary provisioned) — invisible failover. Routine support questions — answered by Plaino in minutes, honestly signed. Unsupported-vertical signups — honest waitlist, no money taken, fail-closed even if the registry itself breaks. Unreviewed legal text — structurally impossible to ship. The next silently-dead skill — red build, not a silent customer no-op.

🟡 **Self-routes (named human, context, deadline):** both LLM keys dead → calm customer copy + critical page. Broken integrations → customer banner + one reconnect email, >72h → page; queued work resumes idempotently on reconnect, dead-letters loudly. Escalation-class support (legal, disputes >$200, distress, "I want a human") → paged with 24h deadline. Unsupported-vertical leak with money taken → detected + paged (auto-refund once ratified). Any health threshold breach → 06:00 ET digest with a recommended action per item; Monday all-green proves the pipe.

🚨 **Fails loud (known, bounded):** Resend (the email channel) dying kills email paging itself — the loud artifacts are OpsFlag + AuditLog rows on the operator panel; inherent until a second paging channel exists. `FLEET_TRUSTED_HUMAN_EMAIL` unset → everything routes to Conner's inbox (the gap is the unset var, and the operator banner + every email say so). home-services killer workflow waits on #207's merge (one-row flip, documented).

**What does NOT survive him:** credential custody (Vercel, Stripe, GitHub App, Anthropic console) and the BUILD layer (the fleet can run but not legally hold keys). That's estate/operations, not code — the system now assumes a successor exists and gives them a daily briefing, but someone must hold the accounts.

## 5. Top 3 day-after priorities

1. **Merge the stack, set the two env vars, restore the key, run the #213 harness** — turns this build from latent to live in ~30 minutes of Conner time.
2. **Convergence wave (small):** fold pfd-4's temp `notify-human` into `pageHuman`; converge pfd-6's vertical reader onto pfd-4's canonical resolver; wire the remaining retry-queue producers (HubSpot/Salesforce/Sierra/inbox webhook); per-provider REAL_READ probes.
3. **Second paging channel** — mobile push already exists code-complete (#167); the EAS project ID unlocks push-paging the designated human when email is the thing that died.
