# Audit 9/10 — Guarantee + time-savings tracking (per #300)

**Date:** 2026-07-02 · **Pin:** `origin/main` @ `f928400` (merge of #316) · **Worktree:** `C:\agentplain-wt-audit-9`
**Scope:** `lib/guarantee/*`, `components/guarantee/TimeSavingsCounter.tsx`, `components/guarantee/WalkAwayOffer.tsx`, `lib/inngest/functions/guarantee-evaluate.ts`, `app/(marketing)/guarantee/page.tsx`, plus the wiring around them (`lib/skills/persist-artifacts.ts`, `lib/customer-files/deletion.ts`, `lib/billing/stripe-provider.ts`, workspace overview page).

## Verdict

The plumbing is genuinely good — idempotent ledger, pure evaluation, owner-gated one-tap walk-away, capped Stripe refunds with human page-out, teardown-backed deletion, 25/25 unit tests green, zero new voice/brand-gate violations, vendor fully invisible. The failures are all at the **truth seam**: the system counts less than the fleet actually does (so it offers refunds it doesn't owe), and the copy claims more than the system actually does ("live" counter, "nothing of yours stays"). One P0, five P1s, six P2s.

## Scorecard vs the verify list

| Check | Result |
|---|---|
| Counter ticks live per action | ⚠️ FAIL as claimed — per-action recording is real (webhook runs via `persist-artifacts.ts:195`), but the counter is server-rendered + one-shot count-up; **no background refresh exists**. "Live" claims are untrue. → P1-2 |
| Calibration table not inflated | ✅ PASS — conservative floors, inline rationale per action, single source, bar flagged as PROPOSED pending Conner. Opposite problem exists: **undercounting** → P0-1 |
| Day-7 evaluation fires correctly | ⚠️ PARTIAL — cron auto-registered (registry `require.context`), disable-gated, monitored, once-per-lifetime guard, tests green. But candidate query has **no upper age bound** → backfill/legacy hazard → P1-1 |
| Walk-away one-tap, no friction | ✅ PASS — single button, no confirm dialog (deliberate), BROKER_OWNER-gated server action, idempotent executor, error path surfaces support |
| Refund automation end-to-end | ✅ PASS (mock) — happy path / paused-policy / billing-disabled / over-cap all tested; Stripe impl refunds whole charges newest-first under cap, per-charge idempotency keys, pages a human with a 72h deadline on any shortfall. Real-Stripe untested (no key in this environment) |
| Data-deletion GDPR-clean | ✅ PASS with copy caveat — reuses `tearDownWorkspaceData` (29 deleteMany sweeps incl. TimeSavingsEntry, AuditLog, OAuth credentials, chat, memory, embeddings), provable per-table counts in the audit payload, RLS enabled+forced on the ledger. Preserved rows contradict the absolute copy → P1-4; small teardown gaps → P2-6 |
| /guarantee renders promise honestly | ⚠️ PARTIAL — deliberately qualitative about the bar (correct), no auto-send implication, but "add up live" + "nothing lingers" overclaim, the 14-day money-back guarantee is never reconciled, and the page is an **orphan** (no sitemap entry, zero inbound links) → P1-2/4/5/6 |
| Voice-gate on all copy | ✅ PASS — `voice-gate.mjs`: 0 new (30 known baseline, none in guarantee files) |
| Model-vendor invisible | ✅ PASS — zero Claude/Anthropic mentions across all guarantee surfaces, emails sign "Plaino" |
| Heritage Plains styling | ✅ PASS — ApPaperCard/ApEyebrow, paper/ink/clay/rule tokens, Section tones; `brand-gate.mjs`: 0 new |
| Mobile counter layout | ✅ PASS (static) — counter lives in a stacking `aside` under `lg:grid-cols-[2fr_1fr]`, no fixed widths, tabular-nums inline spans wrap; WalkAwayOffer button row is `flex-wrap`. Not verified in a live browser (no DB in audit env) |

## P0

### P0-1 · Guarantee systematically undercounts → offers refunds the fleet earned back
`recordSavedTime` has exactly one caller: `persistSkillRunArtifacts` (`lib/skills/persist-artifacts.ts:195`), which is invoked only from `process-webhook-event.ts` — the webhook-driven inbox path. Its attribution (`guaranteeActionForOutcome`, `lib/guarantee/saved-time.ts:188`) maps only 3 of the 7 calibrated actions (drafted-email, meeting-scheduled, admin-task-handled). **invoice-sent, document-chased, tenant-notice-posted, and lead-enrichment have no writer anywhere in the codebase.** The vertical killer-workflow sweeps — including invoice-chase, the flagship $500/mo workflow — contribute **zero minutes** to the ledger.

Consequence: the Day-7 evaluation compares an undercounted total against the 5-hour bar, so workspaces the fleet genuinely served get the under-bar walk-away email and a full-refund offer. The error direction is "honest" (never inflates) but it is money out the door and a false "we failed you" message — recurring, not one-time. The saved-time.ts doc comment acknowledges this ("those call recordSavedTime directly as they wire in") but nothing tracks the gap.

**Fix:** wire `recordSavedTime` into each sweep's persist path (the sweeps already have durable source rows to use as dedupe keys); until then, exclude workspaces whose value came from sweeps from the walk-away offer, or gate the cron.

## P1

### P1-1 · Day-7 sweep has no upper age bound — legacy backfill + broken email promise
`defaultListCandidates` (`guarantee-evaluate.ts:196`) selects every ACTIVE, setup-complete workspace with `createdAt <= now - 7d`. No upper bound, no trial-state check. On the first fire after deploy (~2026-06-19), every pre-existing workspace — however old, however settled, however much pre-ledger work the fleet did — was swept once, got "You're a week into your agentplain trial" (factually wrong), and a full-refund offer computed from a ledger that didn't exist for most of its life. Residual defect that persists for any late reader: the email says "Both options are on your workspace," but the in-app card renders only while `ageDays <= evaluationDays + 7` (`workspace/[id]/page.tsx:146`) — open the email after day 14 and the promised one-tap option is gone. **Fix:** bound candidates to a window (e.g. `ageDays ∈ [7, 14]`), and state the window in the email.

### P1-2 · Counter is not live, but two surfaces say it is
`TimeSavingsCounter.tsx` doc comment: "refreshing in the background so the number ticks as the fleet works" — there is no polling, no `router.refresh()`, no revalidation anywhere; props are server-rendered once and the count-up is a mount animation. `/guarantee` step 01: "You watch the total add up live inside your workspace." The number is *true* but only as of page load. This is precisely the Truth-Wave claim-vs-code class (#262/#290). **Fix:** add a lightweight refresh interval to the overview counter, or change both copies to "adds up in your workspace" (drop "live"/"watch").

### P1-3 · "Nothing of yours stays on our systems" is an absolute the system doesn't meet
Walk-away receipt email (`walk-away.ts:348/375`), in-app confirmation (`WalkAwayOffer.tsx:59`), and /guarantee ("Nothing of yours lingers on our systems"). Actually preserved after walk-away: the Workspace row **including the business name** and closureReason, Membership rows, the User account, Subscription/WorkspaceInvoice/BillingEvent (lawful tax retention, disclosed on the closure screen), the walk-away OpsFlag, and two post-teardown AuditLog rows. Same absolutes class Conner flagged on /security. **Fix:** scrub `Workspace.name` on walk-away closure and soften to "We've deleted your workspace data. Billing records we're required to keep are retained."

### P1-4 · Two overlapping guarantees, never reconciled
Sitewide copy promises a **14-day money-back guarantee** (home:732, pricing:15/137/342, terms:69, FAQ, RoiCalculator). /guarantee describes a **conditional Day-7 walk-away**. Neither surface mentions the other; a buyer can't tell whether the refund is unconditional (terms) or bar-conditional (/guarantee). Also: CPA/Law run 14-day trials but are evaluated at day 7 while /guarantee frames the check as "the end of your trial" / "Try it for a week." **Fix:** one reconciliation paragraph on /guarantee (walk-away is the proactive form of the 14-day money-back, which always applies) + vertical-aware trial copy; mention the walk-away in terms.

### P1-5 · /guarantee is an orphan page
Not in `app/sitemap.ts` MARKETING_ROUTES, zero inbound links from header, footer, home, or pricing. The strongest trust asset on the site is reachable only by typing the URL. **Fix:** sitemap entry + footer link + a pricing cross-link ("backed by the guarantee").

## P2

1. **Boundary rounding contradiction** — `formatMinutes(297..299)` renders "5 hrs" (one-decimal round-up) while the bar is 300 min, so the walk-away card can read "it has saved you 5 hrs — short of the 5 hrs we hold ourselves to." Floor the display or format saved/bar consistently. (`evaluation.ts:60`)
2. **`scheduling-needed` credits 8 min on category alone** — `guaranteeActionForOutcome` fires on `outcome.category === 'scheduling-needed'` even when the run produced no proposal and no draft; the counter footnote promises "every minute is a real action the fleet completed." Require an artifact. (`saved-time.ts:192`)
3. **Doc drift on AuditLog** — `delete-customer-data.ts:23-28` says AuditLog is "PRESERVED by design"; `tearDownWorkspaceData` hard-deletes it (correct, per the #306 alignment). `walk-away.ts` likewise claims "the audit trail must outlive the workspace"; only the two post-teardown rows do. Fix the comments before someone "fixes" the code to match them.
4. **`GUARANTEE_WALKAWAY_OFFERED_` flag is write-only** — set at `guarantee-evaluate.ts:148`, read nowhere. Either read it (e.g. to suppress a second nudge) or document it as an ops breadcrumb.
5. **Non-atomic email → evaluated-flag** — a crash between the offer email and the guard set re-emails the same owner the next day. At-least-once is acceptable; noting for completeness.
6. **Teardown residue** — workspace-scoped `DisciplineHead` rows survive teardown (config, low-PII); `PushDevice` is user-scoped and survives with the account (pushes stop because the workspace is CLOSED). The no-op `property-management` override in the calibration table equals base (cosmetic).

## Verified good (don't re-litigate)

- **Ledger integrity:** append-only, idempotent via `(workspaceId, sourceTable, sourceId, actionType)` unique key + `skipDuplicates`; RLS ENABLE + FORCE + workspace_or_operator policy in migration `20260618000004`; recording is post-commit best-effort so it can never poison the primary artifact write.
- **Evaluation:** pure function, env-resolved at the edge, single answer for cron and surface; overview computes eligibility live so the card is correct even with the cron paused.
- **Walk-away executor:** once-per-lifetime OpsFlag guard read-first, DB-read-failure treated as already-handled (can't double-refund on a blip), workspace-stable Stripe idempotency key, money-first-then-delete ordering with Stripe IDs preserved on the Workspace row, refunded-charge filter makes even a >24h idempotency-expiry retry safe, human paged with 72h deadline on every shortfall path (paused policy, over-cap, API error).
- **Stripe refunds:** whole-charge only (no statement-muddying partials), newest-first under a $500 default cap, per-charge idempotency suffix.
- **Cron hygiene:** auto-registered via the build-time registry, `runWithDisableGate` + `withCronMonitor` + error reporting, per-workspace failures counted not thrown.
- **Tests:** 25/25 pass (`node --test` over `lib/guarantee/*.test.ts` + `guarantee-evaluate.test.ts`).
- **Gates:** voice-gate 0 new / brand-gate 0 new; no vendor names anywhere in the surface; Heritage Plains tokens throughout.

## Suggested fix order

1. P0-1 + P1-1 together (one PR: sweep-side `recordSavedTime` wiring + candidate window) — this is the money.
2. P1-3 + P1-2 copy pass (+ optional counter refresh) — cheap, high trust.
3. P1-4 + P1-5 marketing reconciliation + discoverability — one copy PR.
4. P2 batch.
