# SIGNUP-TO-GO AUDIT — 2026-06-10

**Method:** 11 parallel stage auditors over (a) a local **integration preview** = main `cfe91af` + all 14 open PRs #201–#214 merged in the prescribed order (`[POST-MERGE]` findings), and (b) the **live prod** sites agentplain.com / app.agentplain.com (`[LIVE-NOW]`, pre-merge). Browser walkthrough screenshots at `C:/agentplain/.audit-screenshots/`.

---

## 1. Executive summary

**~95 findings: 13 🚨 Blockers · ~21 🔴 Critical · ~38 🟡 Important · ~16 🟢 Polish · ~8 ⏸️ Conner-gated.**

**The single biggest blocker is a pair:** the paused `ANTHROPIC_API_KEY` makes every LLM first-fire skill write `FAILED` rows as the customer's first product experience — and even after key restore, **the two flagship killer workflows can never fire for any workspace** because of silent skill-registry gaps:

- `invoice-chase-general` is **absent from `SKILL_CATALOG`** → `isSkillInstalledForWorkspace` returns false → every workspace skipped on every 6 AM tick (`lib/skills/registry.ts:174` + `invoice-chase-general-sweep.ts:136`).
- `home-services-estimate-followup` has **no `runtime` field** → defaults `'schema-only'` → same silent skip (`registry.ts:898`).

Both are one-line fixes. CPA close (#205) and law conflict screen (#206) are module-complete but have **no production caller at all** (no cron, no vertical-router dispatch).

**% of journey working end-to-end today [LIVE-NOW]:** Awareness ~95% → Signup ~70% → **First hour ~15%** → Steady-state ~62% → Mobile distribution ~10%. Weighted: **~40%**.

**Honest verdict (§6): NO** — a real SMB owner who signs up today gets a clean marketing funnel, a working signup, a workspace… and then a first-fire panel full of raw `UPSTREAM_LLM_ERROR: PAUSED` strings and zero autonomous work. **The fix is small:** merge + 2 Conner actions + 1 fleet wave.

What's genuinely strong: marketing surface (0 console errors, 0 dead links across 147 checks, 0 banned-word violations), approvals UX (web+mobile parity, production-grade), workspace isolation (defense-in-depth, no blockers found), per-workspace autonomy controls (#204 verified end-to-end), and the email/Stripe webhook plumbing.

---

## 2. Per-stage gap report

### S0 Awareness/Marketing — ~78% at bar
| Sev | Finding | Evidence | Fix | Effort | Who |
|---|---|---|---|---|---|
| 🔴 | [LIVE-NOW] /pricing Partner mid-bands show $269/$239 vs canonical $279/$249 (`lib/pricing/tiers.ts`); vertical-page banner shows the correct numbers → two conflicting prices visible today | `pricing/page.tsx:43`, `home-content.ts:39` vs `tiers.ts:111` | derive from canonical tiers | S | fleet |
| 🟡 | /security names Conner Chambers personally as sole prod-access holder | `security/page.tsx:137` | role title | S | Conner wording |
| 🟡 | "~35 cron-fired agents" on /about + /custom violates the no-agent-counts rule the homepage itself documents | `about/page.tsx:113`, `custom/page.tsx:142` | drop the count | S | fleet |
| 🟢 | All 28 Plaino scene slots are gray placeholders (credibility gap at $199–499/seat) | `PlainoScene.tsx` SRC map | commission per visual-system doc | L | Conner |
| ⏸️ | Vercel Blob possibly missing from subprocessors list | `privacy/page.tsx:113` | confirm + add | S | Conner |

Works: all 19 sitemap pages 200, OG images resolve, tagline + 3-tier headline pricing correct, story arc covered by `/#how` + `/#faq` anchors, widget degrades gracefully.

### S1 Signup/Auth/Recovery — ~72% at bar
| Sev | Finding | Evidence | Fix | Effort | Who |
|---|---|---|---|---|---|
| 🚨 | No rate limit on magic-link issuance (per-email or per-IP); double-submit also yields stale-link confusion | `lib/auth/flows.ts:226`, `api/auth/magic-link/route.ts` | 60s per-email cooldown row | S | fleet |
| 🔴 | `?next=` deep-link param set by middleware but never consumed by verify or passkey routes — users always dumped on dashboard | `middleware.ts:40` vs `verify/route.ts:70` | same-origin allowlist redirect | M | fleet |
| 🔴 | `unsealSessionToken` returns `{}` not null on malformed seals; downstream casts hide undefined `userId` (no live bypass found — membership checks save it) | `lib/auth/session.ts:71` | one-line userId guard | S | fleet |
| 🟡 | `<title>agentplain — agentplain</title>` on sign-in/up [LIVE-NOW verified] | `(product)/layout.tsx` | per-page metadata | S | fleet |
| 🟡 | Signup label "brokerage / firm name" + deflating non-realty vertical note | `SignUpForm.tsx:122,309` | copy | S | fleet |
| 🟡 | No account-deletion path (workspace closure only) while terms reference GDPR | `lib/customer-data` | deletionRequestedAt flow | L | Conner decision |
| ⏸️ | Cross-host session cookie (apex vs app.) still deferred from #171 | `session.ts:37` | `domain: .agentplain.com` | S | Conner call |

Works: magic-link crypto correct (32B, SHA-256, single-use, 15-min TTL), anti-enumeration, passkey conditional UI (#171 landed), Stripe-down fallback never blocks signup, zero LLM in the auth path.

### S2 Onboarding/First hour — ~15% LIVE-NOW · ~55% post-merge+key — **the stage that fails the bar**
| Sev | Finding | Evidence | Fix | Effort | Who |
|---|---|---|---|---|---|
| 🚨 | [LIVE-NOW] Key paused → all 7 first-fire skills write FAILED; watch panel renders raw `UPSTREAM_LLM_ERROR…` strings to the customer | `onboarding-first-fire.ts:82`, `FirstFireWatch.tsx:171` | restore key + map error codes to customer-safe copy | S | **Conner + fleet** |
| 🔴 | Literal `{partner}` rendered as text in step-4 helper (string prop, not template) | `onboarding/page.tsx:660` | template literal | S | fleet |
| 🔴 | Connect step is vertical-blind: `available[0]` = always Gmail; CPA told to connect Gmail while card says TaxDome | `onboarding/page.tsx:473` | resolve from killer-workflow spec | S | fleet |
| 🔴 | LAW + RIA activation card never transitions to "see it run" (`unlockedBy: null` → connected always false) | `killer-workflow.ts:123,176,250` | real provider key or always-live | S | fleet |
| 🔴 | `inbox-triage-general` + `office-admin` offered in picker but have no RUNNERS entry → silent no-op, watch panel stalls | `picked-skills.ts:40`, `onboarding-first-fire.ts:73` | remove from picker or add runners | S | fleet |
| 🔴 | "broker-of-record review screen" copy shown to all 10 verticals | `onboarding/page.tsx:413,646` | generalize | S | fleet |
| 🟡 | /talk degraded+empty shows blank thread (empty-state suppressed exactly when needed) | `talk/page.tsx:95` | decouple conditions | S | fleet |
| 🟡 | #212 card attaches to replies only — empty /talk thread shows no activation card | `dispatcher.ts:309` | standalone card under TalkEmptyState | S | fleet |
| 🟡 | OAuth denial shows raw `google_returned_error access_denied` | `integrations/page.tsx:223` | error-code copy map | S | fleet |
| 🟡 | TaxDome/Karbon trust-on-first-call: wrong key accepted silently | `taxdome/connect/route.ts` | advisory copy | S | fleet |
| 🟡 | Integration "health" = credential status only, no live provider call | `[integrationId]/health/route.ts:78` | label or real check | M | fleet |

Integration reality: Gmail/Outlook/QuickBooks/HubSpot/Salesforce/Notion/Slack/DocuSign env-gated OAuth; TaxDome/Karbon/FUB/Sierra API-key forms. **MCP HTTP routes missing for HubSpot, Salesforce, Notion, FUB, Sierra** (lib servers exist; Inngest sweeps work; /talk tool-calls can't reach them).

### S3/S4 Core app — ~62% at bar
| Sev | Finding | Evidence | Fix | Effort | Who |
|---|---|---|---|---|---|
| 🚨 | **Customer never sees a dollar value**: value ledger is operator-only; the only customer-visible ROI figure is prose buried in Monday's briefing body | `operator/.../value-ledger/page.tsx:25`; no customer route | ValueSummaryCard on Overview from `computeWorkspaceValueLedger` | M | fleet |
| 🚨 | First-fire watch leaks internal error strings (same as S2 #1) | `FirstFireWatch.tsx:171` | error map | S | fleet |
| 🔴 | Compliance page read-only — flags can't be acknowledged/closed by the customer | `compliance/page.tsx` (zero buttons) | acknowledge action | M | fleet + Conner policy |
| 🔴 | Weekly digest renders as wall of prose; structured `b.summary` JSON (hoursSaved, dollarsInfluenced) exists but is never read by the page | `briefings/page.tsx:189` vs `weekly-digest.ts:283` | metric card from existing JSON | S | fleet |
| 🔴 | Degraded /talk composer stays fully interactive → type, submit, fail | `TalkComposer.tsx` | disabled state + copy | S | fleet |
| 🟡 | Marketplace absent from main nav (settings-only link) | `layout.tsx:15` NAV | add or contextual link | S | Conner call |
| 🟡 | LoopPreview shows real-estate sample copy to every vertical | `overview-view.tsx:356` | vertical-branched samples | S | fleet |

Works: approvals surface is production-grade (approve/edit/feedback/reject, shared decisions core), all 13 nav routes resolve, every page has an empty state (10 of 14 score 2–3/3), support draft-into-review well-architected, weekly digest email twin wired.

### S4b Settings/Trust/Billing — ~68% at bar
| Sev | Finding | Evidence | Fix | Effort | Who |
|---|---|---|---|---|---|
| 🚨 | PAST_DUE copy/code contradiction: banner promises "fleet keeps running through period end"; gate pauses fires immediately | `workspace-paused-gate.ts:13,46` vs `settings/billing/page.tsx:164` | pick one (recommend grace in code) | S | **Conner decision** |
| 🚨 | Closure copy promises audit-log deletion; teardown keeps AuditLog (SetNull) + misses OpsFlag/SkillConfig/PushDevice/Plaino rows | `deletion.ts:255`, `schema.prisma:996`, `settings/data/page.tsx:218` | fix copy + extend teardown | M | fleet |
| 🔴 | `instruction-handler-on-create` + `support-handler-on-create` skip `gateSkillFire` (vacation/schedule not honored) | both files, no call | add gate | S | fleet |
| 🔴 | One-click cancel subscription, no confirmation | `settings/billing/page.tsx:285` | confirm modal | S | fleet |
| 🟡 | 4 skill-config fields "saved" but not live | `settings/skills/page.tsx:11` | wire or hide | M | Conner call |
| 🟡 | `setup_intent.succeeded` unhandled → stale defaultPaymentMethodId window | `webhook-dispatch.ts:72` | explicit handler | M | fleet |

Works: **#204 per-workspace autonomy verified end-to-end** (owner sets per-class toggle + ceiling; decision path reads identical resolvers; fail-closed master), 10/12 settings pages real with verified persistence, closure state machine clean, export double-scoped.

### Engine (autonomy) — ~30% at bar
| Sev | Finding | Evidence | Fix | Effort | Who |
|---|---|---|---|---|---|
| 🚨 | `invoice-chase-general` not in SKILL_CATALOG → every workspace silently skipped daily | `registry.ts:174`, sweep:136 | add entry `runtime:'live'` | S | fleet |
| 🚨 | `home-services-estimate-followup` runtime defaults `schema-only` → same silent skip | `registry.ts:898` | `runtime:'live'` | S | fleet |
| 🔴 | CPA month-end close: no production caller (no cron, router only dispatches realty) | `vertical-router.ts:66` | wire dispatch | M | fleet |
| 🔴 | Law conflict screen: no production caller | same | wire dispatch | M | fleet |
| 🟡 | FUB/HubSpot/Salesforce sweeps skip `gateSkillFire` | each sweep ~:110–148 | add gate | S | fleet |
| 🟡 | `BOUNDED_AUTO_EXECUTE_MASTER` is one fleet-wide env flip (per-workspace rows are only the guard rails) | `bounded-execute.ts:254` | confirm blast radius | — | **Conner decision** |
| ⏸️ | `LIVE_INBOX_FETCH` off → FixtureLeadDraftPersister; real Gmail drafts need consent + gmail.compose | `drafts-persister.ts:97` | flip after consent | S | Conner |

Verified good: all 35 functions behind `runWithDisableGate`; sentinel no-throw seam works (briefings fall back to templates); **all three persister:null holes fixed** (FUB/HubSpot/Salesforce); #211 harness needs 4 env vars; #213 registry is fleet-runnable offline, notes 4 killer-workflow surfaces still unregistered.

### Mobile — code 85% · distribution 10%
| Sev | Finding | Evidence | Fix | Effort | Who |
|---|---|---|---|---|---|
| 🚨 | EAS projectId is literal `"REPLACE_WITH_EAS_PROJECT_ID"` → push tokens never register on devices | `app.json:71`, `push.ts:31` | create EAS project, paste ID | S | **Conner** |
| 🚨 | `/.well-known/apple-app-site-association` 404s live → magic-link email opens Safari, never the app | live curl; `app.json:21` | serve AASA (needs Apple team ID) | S | Conner + fleet |
| 🔴 | No `eas.json` → no build profile | dir listing | `eas build:configure` | S | after EAS |
| 🟡 | Approval cards headline = raw `agentSlug` | `approvals.tsx:247` | human label | S | fleet |
| 🟡 | No settings screen; sign-out buried in Integrations tab | — | minimal settings tab | M | fleet |

Works: all 9 mobile API routes 401-clean live; swipe approve/reject/edit/feedback fully wired via shared core; push trigger + dead-token eviction correct. Distribution checklist (8 ordered steps) in the PR report.

### Live walkthrough [LIVE-NOW] — public journey ~85%
| Sev | Finding | Evidence | Fix | Effort | Who |
|---|---|---|---|---|---|
| 🚨 | Sign-up completes with **zero Stripe calls** while form copy says "card captured at signup"; confirmation says add card later. (Code has checkout + graceful trial fallback → prod is likely falling back silently = Stripe env misconfig OR intentional trial-first with stale copy) | walkthrough step 7, network log | Conner: check `STRIPE_CHECKOUT_ENABLED` + price IDs in Vercel; then fix copy or wiring | S–M | **Conner decision** |
| 🔴 | Sign-up form anchors "from $99/seat" (50+ seat floor) — solo buyer pays $199 → 2× billing surprise | step 7 vs /pricing | copy | S | fleet |
| 🔴 | /custom shows "Regular ($199 → $99 per seat)" reading as discount arrow | /custom ×2 | copy | S | fleet |
| 🟡 | /faq → 404 (footer uses /#faq, but external links break); /how-it-works redirects fine | step 9 | redirect /faq → /#faq | S | fleet |
| 🟡 | /api/chat returns **400** when sentinel-paused (should be 503/degraded header) | step 4 console | status code | S | fleet |

Zero console errors on all 6 marketing pages at 1280/768/390; no overflow; protected routes redirect with `?next=`; /custom form submits clean.

### Cross-cutting
- **Links/images/banned words: ALL PASS** — 147 checks, 0 dead links, 0 broken images, 19/19 sitemap URLs 200; only "SMB" hits are the approved Claude-for-Small-Business FAQ comparison.
- **Email:** 7 transactional templates wired (magic-link, inquiry, support, trial warnings, abandoned-signup, daily briefing, weekly digest). **Missing: payment-failed email (🚨 — customer's fleet pauses with zero explanation), approval-notification email (🔴), pause-notification (🟡).** `webhook-dispatch.ts:537`.
- **Isolation: no blockers.** 38 tables ENABLE+FORCE RLS, membership asserted on every route checked, cron fan-out binds per-workspace context. Gaps: **7 workspace-scoped tables lack RLS policies** (Team, TeamMembership, DisciplineHead, SkillRun, WorkspaceLifecycleEvent, WorkspacePauseConfig, SkillScheduleWindow) and **no CI workflow runs the isolation test** (only schema-drift.yml exists). Both 🟡, ~3h total.

---

## 3. Conner-action gates (by value-per-minute)

1. **Merge PRs #201–#214** (~15 min, mobile) — everything below assumes it. Order: #203→#207→#208 sequential; #212 after #209.
2. **Restore `ANTHROPIC_API_KEY` in Vercel** (~5 min) — unblocks first-fire on all 10 verticals, ria killer workflow, briefings-with-LLM; then fleet runs the #213 27-surface restore harness for proof.
3. **Check Stripe env in Vercel** (`STRIPE_CHECKOUT_ENABLED`, price IDs) (~10 min) — explains the no-Stripe signup; decide trial-first (fix copy) vs card-at-signup (fix wiring).
4. **Buildium API key** (~15 min self-serve) — unlocks property-management killer workflow (best vertical unlock, per #201).
5. **EAS project ID** (~20 min) — unlocks mobile push end-to-end; then fleet PRs eas.json + AASA (needs your Apple team ID; enrollment $99 if not done).
6. **DECISION: `BOUNDED_AUTO_EXECUTE_MASTER`** — one env flip auto-approves allowlisted kinds across ALL opted-in workspaces. Per-workspace ceilings are the guard rails. Flip when?
7. **DECISION: PAST_DUE behavior** — grace through period end (code change) or immediate pause (copy change). Must resolve before first paying customer's card fails.
8. **Google OAuth consent + gmail.compose → `LIVE_INBOX_FETCH=true`** — converts realty first-touch from fixture drafts to real Gmail drafts; also gates insurance/mortgage/title-escrow inbox workflows.
9. **DECISION: customer-visible value card** — ship the Overview ValueSummaryCard (recommended; it is the renewal evidence).
10. EZLynx / Encompass / Qualia (partner-gated, unchanged from #201).

---

## 4. Cross-cutting issues
- **Silent registry gating bit twice in one build night** (invoice-chase missing entry; home-services missing runtime). Pattern: skills ship code-complete but the marketplace/registry seam silently no-ops them. Recommend a CI assertion: every Inngest sweep slug resolves to a `runtime:'live'` SKILL_CATALOG entry.
- **Raw internal strings reach customers** at 3+ seams: first-fire reasons, OAuth error codes, mobile agentSlug headlines. One error-copy map fixes the class.
- **`gateSkillFire` coverage decays**: 5 callers added in #202–#213 skip it (FUB/HubSpot/Salesforce sweeps, instruction-handler, support-handler) — exactly the drift memory `project_fire_gate_must_wire_all_skill_callers` warned about.
- **Pricing copy drift**: 3 surfaces ($269/$239 mid-bands; "$199 → $99" arrow; "from $99" anchor) all stem from hand-copied numbers instead of deriving from `lib/pricing/tiers.ts`.

## 5. What works end-to-end (celebrate)
- Marketing funnel: 19 pages, 0 errors, 0 dead links, 0 broken images, brand-clean, responsive at 390/768/1280.
- Magic-link auth + passkeys (incl. #171 rpId fix verified in conditional UI), anti-enumeration, Stripe-down resilience.
- Approvals: web + mobile, approve/edit/feedback/reject, shared core, optimistic UI — the best surface in the product.
- Per-workspace autonomy (#204): owner-controlled, fail-closed, audited.
- Workspace isolation: RLS + app-layer membership, operator gate, MCP dispatch auth — no blockers.
- Transactional email + Stripe webhook plumbing (signature, idempotency, lifecycle).
- /custom inquiry → operator + confirmation emails, live-verified submit.

## 6. The honest verdict
**Would a real SMB owner sign up today and have an autonomous fleet running within the first hour? NO.**

Today they get: great marketing → working signup → workspace → onboarding wizard → **FAILED first-fire rows with raw error codes, an activation card pointing (for 3 of 10 verticals) at the wrong or never-completing integration, and zero autonomous output.** Even post-merge with the key restored, the flagship invoice-chase never fires for anyone until one registry line lands.

**Shortest critical path to YES** (general-vertical owner with QuickBooks):
1. Conner merges #201–#214 + restores the API key (~20 min).
2. One fleet wave ("registry truth + first-hour polish"): 2 registry one-liners, first-fire error map, the 5 S-effort onboarding fixes, /faq redirect, pricing-copy derivations. (~1 day, all S-effort.)
3. Conner answers the Stripe-at-signup question (copy vs wiring).
→ After that, a QuickBooks-connected general or home-services owner genuinely wakes up to chased invoices/estimates pending approval — the $500/mo moment. Realty needs Gmail consent for real drafts; CPA/law need their callers wired (M); the other 5 verticals stay READY-ON-UNLOCK.

## 7. Recommended next build (top 5 themes)
1. **Registry-truth wave** — wire all 5 killer-workflow production callers + CI guard (sweep slug ⇒ live catalog entry). Closes the two 🚨 engine gaps + CPA/law.
2. **First-hour polish wave** — the 8 S-effort onboarding fixes (vertical-aware connect, {partner}, LAW/RIA card, picker drop, error map, talk empty state, OAuth copy, step bar at 390px).
3. **Proof-loop surfacing** — customer ValueSummaryCard + weekly-digest metric card from existing `b.summary` JSON. This is the renewal engine.
4. **Billing-trust wave** — PAST_DUE resolution, payment-failed email, cancel confirm, signup price anchor, /custom arrow copy, deletion-promise accuracy, partner-band derivation.
5. **Hardening wave** — magic-link rate limit, `?next=` consumption, unsealSessionToken guard, gateSkillFire on the 5 uncovered callers, RLS on 7 tables + CI test workflow, AASA + eas.json PR.
