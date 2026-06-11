# Conner-Dead Simulation — 2026-06-11

30-day adversarial walk of a new customer against the fleet-runs-fleet stack (main + PR #224's diff, audited at `pfd/conner-dead-e2e@30aa598`). Every claim cites a file. Classification per failure mode: **SELF-HEALS** / **SELF-ROUTES** (pages a designated human ≤24h with context) / **FAILS-LOUD** (customer sees honest state + path forward) / **SILENT** (unacceptable).

## TL;DR — Survival window

**First broken customer promise: Day 2–3.** The first support ticket a customer files lands as a draft in the *operator* review queue (`lib/inngest/functions/support-handler-on-create.ts` → `SUPPORT_HANDLER_REPLY_DRAFT`); with no operator alive, `/help` says "a human is reviewing it now" (`lib/support/recent-status.ts`) and no reply ever goes out. The fleet-health heartbeat notices the aging backlog (`oldestSupportBacklogHours`, `lib/inngest/functions/fleet-health-check.ts:366`) and pages — **but every page in the entire stack funnels to `FLEET_TRUSTED_HUMAN_EMAIL`, falling back to Conner's own inbox** (`lib/ops/page-human.ts:207-223`). If that var is unset or points at Conner, the self-route tier is dead letters and the window is just the support SLA.

**Core killer-workflow value: survives ~30 days** in the no-incident case. Customer-owner approvals (not operator) gate the drafts, the signup gate blocks bad verticals, billing pause works, the LLM stack degrades calmly. **Any single fleet-key incident (Anthropic primary dies, no secondary in env) converts to permanent degradation from that day** — calm copy, no drafts, Stripe keeps charging.

**Expected case (incidents at observed base rates): ~10–14 days** before at least one workspace is in a degraded state nobody is acting on.

### Production-truth preconditions (as of audit time)
1. **main is undeployable right now** — duplicated block in `ApprovalCard.tsx` from union-merge `72c172a` broke every Vercel deploy of main. Fix is green twice over: PR #224 (carries it at `30aa598`) and PR #235 (standalone). **Until one merges, prod is frozen at the last good deploy.**
2. **PR #222 never reached main.** Its base was `pfd/self-healing-credentials`, merged 28s *after* #217 landed on main (merged_at 02:37:16Z vs 02:36:48Z) — the entire Pillar-2 runtime (health-probe, retry-queue, degraded-notify, health sweep, migration) is stranded and only #224's diff carries it. **Live prod today has NO integration self-heal.** Merging #224 is the unlock.

### Top 3 breakage points (by customer impact)
1. **The pageHuman dead-letter problem.** Six pillars self-route through one email var. Unset/Conner-pointed = the entire "self-routes" tier silently becomes "nobody". 0.5h fix, highest leverage in the stack.
2. **Support loop requires a living operator.** Drafts land in seconds, replies never send (bounded-resolve rides bounded-execute, whose master env defaults OFF — `lib/skills/bounded-execute.ts:69`). Customer-visible lie by Day 2–3.
3. **Anthropic key incident with no secondary.** Failover code is correct (`lib/llm/key-rotation-provider.ts`) but `ANTHROPIC_API_KEY_SECONDARY` existence in prod env is **unverifiable from this audit** (env listing is permission-gated). If absent: one 401 = fleet-wide calm-copy degradation + a page to (see #1).

### Counts
- **SILENT (must fix): 7** — S1–S7 below.
- **SELF-HEALS: 9** — key failover, integration recovery + queue flush, signup gate, Stripe webhook retry absorption, billing pause, prompt-cache/budget/sentinel stack, schema-drift autoheal (`lib/ops/schema-drift-autoheal.ts`), counsel fail-closed gate, retry-queue resume sweep.
- **SELF-ROUTES: 8** — all conditional on a real human behind `FLEET_TRUSTED_HUMAN_EMAIL`: fleet-health breach digest, both-keys-dead page, 72h integration escalation, retry dead-letter page, refund detect-only page, support escalation classifier (distress/legal/data-deletion/$-threshold/explicit-human, `lib/skills/customer-support-triage/escalation.ts`), credential-sweep invalid-key page, unsupported-signup metric.
- **FAILS-LOUD: 5** — Plaino `PLAINO_PAUSED_REPLY` calm copy (`app/api/chat/route.ts:273`), honest waitlist screen (`app/(product)/app/actions.ts:87-110`), `/help` honest status, integration banner + reconnect email, PAST_DUE billing banner.

---

## The silent-failure catalog (the existential list)

| # | Mode | Where | Sev | Detail |
|---|------|-------|-----|--------|
| S1 | **Unset `ANTHROPIC_API_KEY` serves fake drafts** | `lib/llm/index.ts:224-241` | 5 | Key absent (not invalid — *absent*, e.g. env mangled in a redeploy) falls through to `TestLlmProvider` heuristic mode. Customers get plausible-shaped fake drafts. One log line, no page, no banner. The WTF-est mode in the stack. |
| S2 | **Support replies never send without an operator** | `support-handler-on-create.ts`, `bounded-resolve.ts:84` | 4 | Draft-in-seconds works; send requires operator approval; bounded auto-resolve master defaults OFF. `/help` copy becomes false by Day 2–3. Heartbeat pages — into S4's funnel. |
| S3 | **Dead Resend key is invisible for up to ~90 days** | `credential-test-sweep.ts:59` (cron `0 8 1 1,4,7,10 *`) | 4 | Probe is QUARTERLY. Between probes: reconnect emails, trial warnings, refund notices, and **the pages themselves** all silently stop. Fleet-health reads the *flag*, which only the quarterly sweep updates (`fleet-health-check.ts:347-356`). pageHuman persists AuditLog rows nobody is reading. |
| S4 | **All pages funnel to one possibly-dead inbox** | `lib/ops/page-human.ts:207-223` | 5 | `FLEET_TRUSTED_HUMAN_EMAIL` unset → first `OPERATOR_EMAIL_ALLOWLIST` entry (Conner) + an in-body nudge *that only the dead man would read*. Whether the var is set in prod is unverifiable from this audit — *that's the point: nothing in the system proves a live human is on the other end.* No ack-tracking, no escalation-on-no-ack. |
| S5 | **Pending approvals rot with zero nag** | no aging sweep exists; briefings/digests don't mention approvals (verified by grep across `lib/inngest/functions/`) | 4 | BOUNDED_AUTO_EXECUTE master OFF + owner ignores the queue = killer workflow produces drafts into a void. Customer pays $99–199/mo for value that stalled at their own unread queue. No email, no card, nothing. |
| S6 | **Fleet-health readers degrade to GREEN** | `fleet-health-check.ts:230-257` | 3 | Every reader's failure fallback is the healthy value (`0`, `false`, `[]`). A DB hiccup on `brokenWorkspaceIntegrations` reads as "no broken integrations" → all-green Monday digest while customers sit broken. The watchdog can lie green. |
| S7 | **Billing is uncoupled from value delivery** | no code path links degraded-mode duration to subscription state | 4 | LLM paused for 20 days, or integration dark for 3 weeks → Stripe charges anyway. The refund sweep (`unsupported-vertical-refund-sweep.ts`) covers only *unsupported-vertical* leaks, not *degraded-supported* workspaces. This is the "burn their money" mode. |

Lower-severity silent modes noted, not counted: welcome/reconnect email bounces unhandled (no bounce webhook; sev 2), compliance corpus staleness vs. a regulatory change while the sign-off row reads valid (sev 3, mitigated because every draft still passes the customer's own approval), CREDENTIAL_ONLY health probes can't see vendor-side revocation for non-OAuth providers (`lib/integrations/health-probe.ts:77-108` — only GOOGLE/M365 get live probes; FUB is mitigated by its sync sweep writing credential status; QuickBooks/Buildium/etc. need per-provider verification; sev 3).

---

## Per-vertical simulation

Registry truth (`lib/verticals/readiness.ts:103-118`): **3 of the locked 10 verticals are supported** — real-estate, cpa, law — plus the `general` on-ramp (invoice-chase). The other 7 (mortgage, insurance, property-management, title-escrow, ria, recruiting, **home-services**) hit the honest waitlist at signup. The mandate's premise of "5–6 supported verticals" is itself stale — home-services' killer skill (`home-services-estimate-followup`) is not `runtime: 'live'` and has no production caller. **Pillar 4 correctly turns this from a silent fraud into a gated waitlist.**

### Real-estate (killer: `lead-triage-realestate` — vertical-router + FUB/HubSpot/Salesforce sweeps)
| Day | Scenario | Outcome |
|-----|----------|---------|
| 0 | Card fails mid-checkout | Workspace exists (INCOMPLETE not gated, `workspace-paused-gate.ts:18-21`), runs free up to 7d, then abandoned-signup sweep sets `setupDeactivatedAt` → fires stop. **Partial-loud**: deactivation email coverage unverified; if absent, the Day-7 stop is silent (sev 3). |
| 0 | Picks unsupported vertical | Waitlist screen, no charge. **SELF-HEALS** (prevention). Fail-closed even if the registry import throws. |
| 0 | Malformed FUB key pasted | Connect-time validation + Day-1 health sweep `CREDENTIAL_ONLY` catch → banner + calm email. **FAILS-LOUD** (≤24h). |
| 0 | LLM times out during first-fire wizard | Event-driven first fire (`onboarding-first-fire.ts`); non-PAUSED errors retry via Inngest; PAUSED → degraded copy. **FAILS-LOUD**. But garbage-but-valid output ships to the approval queue — only the customer's own review catches it (acceptable; approval gate is the control). |
| 1–7 | Cron fires, FUB returns 401 | Sync sweep marks breakage; health sweep (daily 09:00 UTC) banners + emails owner once; held work enters retry queue. **SELF-HEALS → SELF-ROUTES at 72h** (`integration-health-sweep.ts:75,311-331`). |
| 1–7 | Owner never approves drafts | **S5 — SILENT.** Nothing nags. Engagement-drop detection (`customer-feedback-drift-sweep.ts`) exists but depth unverified. |
| 1–7 | "Where's my money?" to Plaino | Support chat has workspace name/vertical + KB (`run-for-request.ts:102-121`), not live billing introspection. Billing-dispute cues ≥ threshold escalate to a human (`escalation.ts:97`). **SELF-ROUTES** — into the S4 funnel. |
| 8–15 | IT rotates the Google OAuth secret | Live probe (GOOGLE/M365 get real provider checks) → unhealthy → banner + reconnect CTA → queue holds work → flush on reconnect. **SELF-HEALS.** The flagship Pillar-2 path, and it's genuinely good — *once #224 merges*. |
| 8–15 | GA reg change (license-ad rules) | Counsel gate fail-closed for *rewrites*; but a signed-off corpus doesn't know the law changed. Drafts pass the stale scanner; customer approval is the only catch. **SILENT-adjacent, sev 3.** |
| 16–30 | Stripe webhook dead 4h | Stripe retries for days; `webhook-dispatch.ts` consumes late events idempotently; PAST_DUE pause errs toward not-charging-for-nothing. **SELF-HEALS.** |
| 16–30 | Inngest outage | All sweeps stop including the heartbeat. Sentry cron check-ins exist (`lib/observability/cron-monitor.ts`) **iff** DSN + missed-check-in alerts configured (unverifiable here). Else detection = a human noticing no Monday digest: up to 7 days, not 1 hour. **Sev 4 conditional-SILENT.** |
| 16–30 | Anthropic primary 401s | Failover → sticky secondary, customer never sees it (**SELF-HEALS**) — if the secondary exists in prod env (**UNVERIFIED**). Both-dead → calm copy + page (**SELF-ROUTES**, S4 caveat) + **S7**: charging continues while dark. |

### CPA (killer: `month-end-close-cpa` — monthly sweep)
Same spine as real-estate with two amplifiers: **(a)** monthly cadence means one missed window (Inngest outage during month-end, integration dark during close week) = a whole month of lost flagship value — drift detection has a 30-day blind spot by construction (sev 4 if it overlaps an outage); **(b)** the QuickBooks credential gets `CREDENTIAL_ONLY` probing — vendor-side revocation may read healthy while the close sweep 401s; whether the sweep writes credential status back needs per-provider verification (sev 3, S-adjacent).

### Law (killer: `law-intake-conflict-screen` — daily sweep)
Spine as above. Vertical-specific: a missed conflict screen has *malpractice-adjacent* blast radius — but the no-outbound + customer-approval architecture means the fleet only ever *drafts* the screen; the lawyer approving is the control. Counsel gate correctly holds law rewrites closed absent a sign-off row. Data-deletion and legal-question escalation triggers fire to a human (`escalation.ts:61`). Honest state: **supported and conservatively safe; its failure modes are availability, not liability.**

### General on-ramp (killer: `invoice-chase-general` — daily sweep)
Explicitly exempted from the readiness gate (`actions.ts:94`) — defensible (horizontal fleet serves it) but it's the one signup path with **no registry-truth backstop**: if `invoice-chase-general`'s caller regresses, general signups still pay. The registry-truth CI guard (#223) mitigates at build time. FOLLOW_UP_NUDGE is on the bounded-execute allowlist (`invoice-chase-general-sweep.ts:17`) — the only near-term autonomy lever a customer can actually feel. Sev 2 watch item.

### Home Services (the "thought it was supported" case)
**This is Pillar 4's proof.** Skill is module-complete but not catalog-live, no caller → `resolveVerticalReadiness` says unsupported → signup waitlists, no charge (**SELF-HEALS**). A pre-gate paying workspace in this vertical is exactly the leak-path sweep's target: zero-value check, grace window, then **detect-only page by default** — auto-refund needs `UNSUPPORTED_VERTICAL_AUTO_REFUND=on` (`unsupported-vertical-refund-sweep.ts:6-7`). Conner-dead with detect-only + S4 = the customer keeps paying. **Flip the flag or staff the inbox; refund-by-email-to-a-dead-man is not a refund.**

### The waitlisted 6 (mortgage, insurance, property-mgmt, title-escrow, ria, recruiting)
Cannot sign up; cannot be charged; capture-interest screen is honest. Recruiting honestly has *no defined flagship at all* (`readiness.ts:58-61`). **No 30-day failure modes because no customers — the correct kind of nothing.**

---

## Cross-cutting pillar verdicts

- **Pillar 1 (self-healing creds)** — Failover logic correct and well-positioned (innermost, cache outside; doesn't fail over on network errors; paused-sentinel respected). Works for: 401/403/429/quota with a live secondary. Fails silent for: **S1** (unset key → fake drafts), **S3** (quarterly probe cadence), page-coalescing is per-process in-memory (`key-rotation-provider.ts:119-121`) so a serverless fleet can page once-per-15-min *per instance* (spam, sev 2).
- **Pillar 2 (integration self-heal)** — The best-engineered pillar: probe → banner → one calm email → 72h escalate → retry-queue hold → flush-on-recovery → dead-letter page at 5 attempts (`retry-queue.ts:45`). Two honest caveats: live probes only for GOOGLE/M365, and **none of it is in prod until #224 merges**.
- **Pillar 3 (L1 support)** — Triage + escalation classifier are genuinely good (distress > dispute > human-ask priority). But resolution autonomy rides a master switch that's OFF, so the pillar is **detect-and-draft, not resolve** — it needs either a staffed review queue or a deliberate autonomy flip. S2.
- **Pillar 4 (vertical gating + refund)** — Signup gate: the strongest single control in the stack (fail-closed, registry-derived, no hardcoded list). Refund: mechanism complete, **defaults to paging instead of refunding**. S4-dependent.
- **Pillar 5 (counsel gate)** — Fail-closed two-layer (env list AND durable sign-off row, no real-estate exemption anymore). Conner-dead = nothing unsafe ships, nothing new unlocks: correct freeze behavior. Blind spot: regulatory *drift after* sign-off.
- **Pillar 6 (fleet health)** — Right shape (daily snapshot, breach pages, Monday all-green proof-of-life, last-success flag). Three flaws: green-biased reader fallbacks (S6), watchdog dies with the watched (Inngest outage; Sentry check-ins unverified), and its output is email into the S4 funnel.

## Action queue — by survival-window impact

1. **Set `FLEET_TRUSTED_HUMAN_EMAIL` to a monitored, non-Conner inbox** (VA / answering service / co-founder). 0.5h Conner action. Converts 8 self-route modes from "dead letter" to functioning. Without it, the survival window IS the support SLA: ~Day 2–3.
2. **Merge #224** (one tap, CI green) — unbreaks main deploys AND puts Pillar 2 in prod. Then close #235 as superseded. 5 min.
3. **Provision + verify `ANTHROPIC_API_KEY_SECONDARY` in Vercel prod.** 0.5h. Converts the most probable fleet-killer from degrade-and-page to invisible self-heal.
4. **Kill the prod TestLlmProvider fallback** — when `NODE_ENV=production` and no key, return PAUSED, never heuristic. ~2h code. Closes S1.
5. **Approval-aging nag** — owner email + briefing line when PENDING > 48h. ~4–6h. Closes S5, directly protects the $99–199/mo value story.
6. **Move Stripe/Resend/Anthropic probes from quarterly to daily** (they're the cheapest read calls the vendors offer). ~1h. Closes S3's 90-day window to 1 day.
7. **Flip fleet-health reader fallbacks from green to "unknown = breach"** (or a distinct `degraded-metric` line in the digest). ~2h. Closes S6.
8. **Decide the refund posture**: `UNSUPPORTED_VERTICAL_AUTO_REFUND=on`, or accept detect-only + staffed inbox. 0h (decision) — and longer-term, couple degraded-mode duration to billing credit (S7, ~1–2d, builds on the Value Ledger).
9. **Verify Sentry cron monitors actually alert on missed check-ins** (DSN + alert rule). 0.5h. Turns Inngest-outage detection from ≤7d to ~minutes.

## What survives — give Conner this list (honest, not generous)

- The **signup gate**: nobody in an unserveable vertical can pay. Fail-closed even against its own bugs.
- The **LLM degradation ladder**: budget gate → sentinel → key rotation → calm PAUSED copy. No raw error ever reaches a customer (`app/api/chat/route.ts:273-276`).
- **Integration breakage UX** (post-#224): banner + one calm email + held-not-lost work + automatic flush on reconnect. Genuinely respectful of the customer.
- **Billing honesty**: PAST_DUE/PAUSED stops skill fires before any token is spent; abandoned signups get deactivated; Stripe webhook absorption is idempotent.
- **The counsel freeze**: no unreviewed legal text can ship, ever, including while nobody's home.
- **Customer-owner approval as the universal backstop**: every draft passes the person who knows their business. The fleet's conservatism is real, and it's the reason "Conner-dead" degrades to *stale* rather than *harmful*.
- **The audit trail**: every page, refund decision, health snapshot, and auto-execution writes AuditLog rows. A future human can reconstruct everything.

## What we tell the customer

If S2 (support latency) can't be staffed this week, send proactively to active workspaces:

> **Subject: How support works while we grow**
>
> Hi — quick honesty note. When you message us through Plaino, an assistant drafts an answer within seconds, and a person reviews it before it goes out. Right now that review can take up to a business day. If anything is ever urgent — billing, access, something broken — reply with the word URGENT and it goes to the top of the queue, or email us directly at [staffed address]. Nothing you send sits unread: every message is logged, drafted against, and answered in order. — the agentplain team

(Requires: the staffed address from Action 1. Do not send while the queue is actually unstaffed — it would be the lie the bar forbids.)

---
*Method: read-only audit of `origin/main` (26192e8) + PR #224 diff at `30aa598` in an isolated worktree; production env-var presence not inspectable (permission-gated) — every env-dependent claim is marked UNVERIFIED rather than assumed. Verticals, pillars, crons, and gates cited inline.*
