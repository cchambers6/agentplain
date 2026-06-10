# FLEET-RUNS-FLEET — self-healing build plan (2026-06-10)

**The bar for every wave:** *if Conner died tomorrow, does this surface still PROTECT customers OR SURFACE the problem to a designated human within 24h?* Three acceptable outcomes — ✅ self-heals, 🟡 self-routes (human paged with context + deadline), 🚨 fails loud (graceful degrade + human paged + customer told). Silent failure is the only failure.

This build sits ON TOP of the customer-value layer (#201–#215, now merging into main). It does not add customer features; it makes the existing ones survivable.

---

## CONNER DECISIONS (answer on mobile, any order — none block the build start)

1. **Designated human email** — set `FLEET_TRUSTED_HUMAN_EMAIL` in Vercel. Until set, all fleet-health alerts go to your own email (so you can verify the pipe works) and the operator UI shows a "set a fallback human" banner. *Who gets paged if you're unreachable?*
2. **Secondary Anthropic key** — provision a second key (separate billing/quota if possible) and set `ANTHROPIC_API_KEY_SECONDARY` in Vercel. We wire automatic failover on 401/429/quota; until the secondary exists, failover pages the designated human instead.
3. **Auto-refund authority cap** — unsupported-vertical workspaces with zero value delivered for 7 days get auto-refunded + apologized to + offered the waitlist. **Proposed cap: $500/workspace, one auto-refund per workspace lifetime.** Above cap → routes to designated human instead of executing. Ratify or amend.
4. **L1 support escalation criteria** — proposed: Plaino auto-answers from KB at >80% confidence; auto-resolves bounded account actions (reconnect prompt, workspace reset, refund ≤ the cap above); ALWAYS escalates legal/compliance, billing disputes > $200, vulnerability reports, distress signals, data-deletion requests, and any explicit "I want a human". Ratify or amend thresholds.
5. **PAST_DUE behavior** (carried from audit #215 §3.7) — the fleet-health cron counts PAST_DUE >7d workspaces either way, but the copy/code contradiction (banner promises grace; gate pauses immediately) must resolve before the first failed card. Recommend: grace through period end (code change).

---

## Pillars → waves

| Wave | Pillar | Branch | Depends on | Conner-dead outcome targeted |
|---|---|---|---|---|
| pfd-1 | 1 Self-healing credentials | `pfd/self-healing-credentials` | — (lands the shared `pageHuman` seam) | ✅ key failover self-heals; both-keys-dead fails loud with customer-safe copy |
| pfd-2 | 2 Integration self-heal | `pfd/integration-self-heal` | pfd-1 (pageHuman) | 🟡 breakage detected daily, customer prompted to reconnect, queued actions auto-resume |
| pfd-3 | 3 Plaino L1 support | `pfd/l1-support-triage` | pfd-1 (escalation seam) | ✅ most tickets auto-answered; humans-only cases self-route with deadline |
| pfd-4 | 4 Unsupported-vertical gating | `pfd/vertical-gating-refund` | — (parallel) | ✅ honest waitlist, no charge; leak path auto-refunds within cap |
| pfd-5 | 5 Compliance counsel gating | `pfd/compliance-counsel-gate` | — (parallel) | ✅ unreviewed legal text can never ship; customer sees honest banner |
| pfd-6 | 6 Fleet health cron + trusted-human config | `pfd/fleet-health-cron` | pfd-1 (pageHuman) | 🟡 every breach reaches a named human ≤24h; weekly all-green digest proves the pipe |
| pfd-7 | Phase 3 E2E failure-mode tests | `pfd/conner-dead-e2e` | all above | CI permanently asserts the Conner-dead bar |
| report | Phase 4 | `report/fleet-runs-fleet` | all above | the honest verdict |

**Sequencing:** pfd-1 fires first and alone (it owns `lib/ops/page-human.ts`, the seam everything else pages through). pfd-4 + pfd-5 fire in parallel with it (no dependency). pfd-2/3/6 fire as soon as pfd-1's branch is pushed, stacked on it (merge order: pfd-1 → 2/3/6 in any order). pfd-7 after all pillars push. **Estimated 9 PRs total** (this plan + 6 pillars + E2E + report). Time-to-ready: pillars within ~12–18h, E2E + report by ~24–30h.

## Pillar acceptance criteria (Conner-dead bar)

**P1 — credentials.** `pageHuman({severity, summary, details, deadline})` in `lib/ops/page-human.ts`, Resend-backed, env-configured recipient with Conner-email fallback; ALL paging in the codebase routes through it. LLM stack gains a key-rotation wrapper (composes per `lib/llm/index.ts` order — wrapper, not inner swap): primary 401/429/quota → secondary, silent to customer; both dead → sentinel-style pause + customer-safe copy ("Plaino is briefly offline, we're already working on it") + page. Quarterly (and on-demand) credential-test cron for Stripe/Resend/Buildium/Qualia/Stripe-Connect: 401 → page + clean integration disable + customer reconnect prompt. Tested against fake keys (the real primary is sentinel-paused right now — that's fine, the mechanism is the deliverable).

**P2 — integrations.** Daily health cron per connected integration (real call where a cheap one exists, credential check otherwise — labeled which). Failure → in-app banner + reconnect email. New retry queue table for in-flight actions that failed on breakage; auto-resume on reconnect. Non-critical integration down (e.g. Slack notify) → action proceeds, notification held + flushed on reconnect. Builds on existing `integration-renewal-sweep`.

**P3 — L1 support.** `customer-support-triage` skill over the in-app help chat + support inbound. KB = FAQ + brand docs. >80% confidence → auto-answer signed "Plaino — agentplain support" (never claims to be human). Bounded account actions auto-resolve under the per-workspace autonomy rails (#204). Escalation list (decision 4) → `pageHuman` with deadline. Reuses `SUPPORT_HANDLER_REPLY_DRAFT` — no new approval kind.

**P4 — vertical gating.** Signup checks registry truth (killer workflow `runtime:'live'` + verified) per vertical. Unsupported → honest screen + waitlist email capture, NO charge. Leak path (manual/bypass signup, >7d, zero value-ledger entries) → auto-refund ≤ cap + apology email + waitlist offer + clean workspace teardown (and fix the teardown gaps #215 found while in there, if cheap).

**P5 — compliance gating.** Per-vertical `counselSignedAt` (sentinel corpus seam, `lib/agents/sentinel` — NOT a new lib/verticals path). Unsigned → rewrite-and-stage gated + customer banner ("counsel is reviewing auto-rewrite for your industry"). Operator uploads signed artifact + flips the flag. Replaces the all-or-nothing `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` env with per-vertical truth (env stays as global kill-switch).

**P6 — fleet health.** Daily 06:00 ET cron computing: API quota %, integration breakage rate, support backlog age, unsupported-vertical signups 24h, PAST_DUE >7d, pageHuman calls 24h. Any threshold breached → structured digest to designated human with severity + recommended action per item. All green → weekly Monday digest. `FLEET_TRUSTED_HUMAN_EMAIL` unset → alert Conner + operator banner.

**P7 — E2E (Phase 3).** On the #211 seeded-login harness, one test per failure mode: primary key dies → secondary silently serves; integration key dies → reconnect banner ≤24h (simulated clock); L1 fixture questions ≥80% auto-resolved; unsupported-vertical signup → waitlist not charge, leak path → refund + apology; unsigned counsel → rewrite gated; breached thresholds → digest rendered to the designated human.

## Standing constraints (baked into every wave prompt)
Worktree per wave (`C:\agentplain-pfd-<N>`) · rebase-first from origin/main · `PRISMA_GENERATE_NO_ENGINE=true` push, never HUSKY=0 · token via `node .claude/worktrees/mint-fleet-token.mjs` fresh per push · no merges by the fleet · PR body leads with "**If Conner died tomorrow, this surface…**" · self-score on the Conner-dead bar, <4 doesn't ship · no new approval kinds where one exists · adapter pattern, no direct vendor calls outside `lib/<domain>/` · don't break #201–#215 surfaces.
