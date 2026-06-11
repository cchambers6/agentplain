# Product Delivery Audit — agentplain.com — 2026-06-11

**Lens:** For every claim the site surfaces, does the product deliver it TODAY on `origin/main` + production? Read-only.
**Auditor:** product-delivery-audit-wave2
**Ground truth refs:** `origin/main @ d77ffce` (fetched 2026-06-11); live `agentplain.com` / `app.agentplain.com`.

---

## 1. Executive summary

The marketing surface remains honest in *posture* (service-partnership framing, approval-gate language, claims-vs-reality discipline) but is **shipping three concrete promises the product does not keep today**: (a) the two flagship killer workflows — **invoice-chase (general) and home-services estimate-followup — still silently never fire** because their registry entries are missing/mis-flagged on `origin/main` (both 2026-06-10 killers UNCHANGED); (b) the live LLM is **still in degraded/paused state** — the public Plaino widget returns `degraded:true` "Plaino's resting" right now, meaning a new signup's first-hour experience is the same broken one the prior audit flagged; and (c) **vertical pages price by vertical** — `/cpa` renders "$299 Partner", `/law` renders a "Max · quote-based" sales wall — contradicting `/pricing` ("tier = service intensity, not vertical") and the explicitly-banned vertical→tier mapping. Separately, the FLEET-RUNS-FLEET memory claiming "BUILD DONE" is **overstated**: of PRs #216–#225, only #216/#217/#218/#222 actually merged to main — **#219 (vertical gating + refund), #220, #221, #223 (registry-truth CI guard), #224 (E2E) are NOT in main**, so the very wave that would have fixed the registry killers did not land. Net: the funnel is good, the product under it is gated/broken at exactly the points the customer pays for.

---

## 2. Top 5 integrity gaps

| # | Gap | Sev (1-5) | Deceived/blocked? |
|---|---|---|---|
| 1 | **invoice-chase-general never fires** — no `invoice-chase-general` slug in `SKILL_CATALOG`; the sweep's install check returns `false` for an unregistered slug → every workspace skipped every day. Homepage + general on-ramp promise invoice chasing. | **5** | A QuickBooks-connected owner who signed up for "chased invoices" gets zero. Silent. |
| 2 | **home-services estimate-followup never fires** — catalog entry exists but has **no `runtime` field** → defaults `'schema-only'` → `isSkillInstalledForWorkspace` returns `false` → silent skip. `/home-services` page sells exactly this. | **5** | The home-services killer workflow the page sells does nothing. Silent. |
| 3 | **Live LLM degraded/paused in prod** — `POST /api/chat` returns `{"degraded":true,..."Plaino's resting just now"}` on 2026-06-11. The same paused-key state means onboarding first-fire writes FAILED rows. The marketing chat widget itself can't answer a single product question live. | **5** | First product touch is a dead/"resting" assistant; first-hour autonomous output is zero. |
| 4 | **Vertical→tier pricing surfaced to customers** — `/cpa` = "$299 Partner", `/law` = "Max · quote-based engagement", `/home-services` (`tier:"plus"`) = $299. Directly contradicts `/pricing` and the banned vertical→tier mapping (`project_stripe_both_surfaces.md`). | **5** | A solo CPA/lawyer is quoted 1.5×–quote-wall vs the $199 the same buyer sees on /pricing. Feels bait-and-switch. |
| 5 | **Signup card-capture promise vs prod behavior** — signup page copy says "card captured at signup"; code default (`STRIPE_CHECKOUT_ENABLED` defaults `true`) routes to Stripe Checkout; but prod is silently hitting the **degrade-to-trial-first fallback** (2026-06-10 walk saw zero Stripe calls). Copy and behavior disagree depending on env. | **4** | Customer is told one thing; billing does another. Trust risk at the commitment moment. |

---

## 3. Claims → delivery table

| Claim | Where surfaced | Delivery status | Evidence |
|---|---|---|---|
| "Reads email, calendar, CRM, documents; categorizes, drafts, schedules, coordinates" | Home hero | **DELIVERED-GATED** | 5-phase loop is real (general skills `runtime:'live'` in `registry.ts`), but every LLM-fired skill is blocked on the paused key — live `/api/chat` `degraded:true`. |
| "Nothing leaves until your name is on it" (approval gate) | Home, /about | **DELIVERED** | Approval queue unconditional; SIGNUP-TO-GO rated approvals "best surface in the product." |
| Invoice chasing (general on-ramp) | Home / general crew | **NOT DELIVERED** | `lib/skills/invoice-chase-general/` + `invoice-chase-general-sweep.ts` exist, but **no `invoice-chase-general` slug in `SKILL_CATALOG`** (`registry.ts` slug list); `marketplace.ts:174-177` → unregistered slug returns `false`. |
| Home-services estimate follow-up | `/home-services` page | **NOT DELIVERED** | `registry.ts:961` entry has no `runtime` field → defaults `'schema-only'` (`marketplace.ts:176`) → install check `false`. PR #207 wired the cron but not the runtime flag. |
| Regular $199→$99, Partner $299→$199, Max quote, /custom $5K-$15K | /pricing | **DELIVERED (copy)** but **price-derivation drift** | `tiers.ts` PER_SEAT_MONTHLY_USD_CENTS = Partner mid-bands $279/$249; live /pricing renders **$269/$239** — page is not deriving from `tiers.ts`. |
| "Tier = service intensity, most shops fit Regular" | /pricing, FAQ | **OVERCLAIMED / contradicted** | `/cpa` & `/home-services` (`content.ts tier:"plus"`) render $299 Partner; `/law` & `/ria` (`tier:"max"`) render Max quote-wall via `PricingTierBanner` (`[vertical]/page.tsx:90`). |
| "First month free. Month-to-month. Cancel anytime." | Home, /pricing | **DELIVERED-GATED** | 30-day trial real (`TRIAL_PERIOD_DAYS`, `checkout.ts`); "cancel anytime" wired but one-click no-confirm (SIGNUP-TO-GO S4b). |
| "Card captured at signup" | sign-up/page.tsx:47 | **PARTIAL / env-dependent** | Code default Checkout-at-signup (`env.ts:127`, `actions.ts:128-141`); prod hitting fallback (`provisionTrialSubscriptionSafe`, actions.ts:153) → "add card later." Config mismatch. |
| "Typical ROI 15x to 50x" | Home, /pricing | **DELIVERED (as labeled illustrative)** | Calculator math present; FAQ elsewhere says "15x–110x" — internal inconsistency (Wave-1 #9), not a hard overclaim. |
| Encryption at rest AES-256-GCM, RLS tenant isolation, append-only audit log | /security | **DELIVERED-GATED** | Encryption + RLS real; SIGNUP-TO-GO notes 7 workspace tables still lack RLS policies + no CI isolation gate. No SOC 2 claimed (honest absence). |
| Production access limited to "Conner Chambers" w/ MFA | /security | **DELIVERED (copy)** | True but names a person as sole prod-access holder (SIGNUP-TO-GO S0 flagged as role-title fix). |
| 10 verticals live, ≥1 agent each + general crew | Home, vertical index | **PARTIAL** | All 10 have catalog entries, but only **`lead-triage-realestate` (+12 general) are `runtime:'live'`**; 9 of 10 vertical killer-workflow slugs are schema-only → silently inert. |
| "~35 cron-fired agents" (dogfood proof) | /about, /custom | **DELIVERED (claim about flatsbo)** but violates own no-agent-counts rule | `about/page.tsx:113` — SIGNUP-TO-GO S0 flagged drop-the-count. |
| Site OG: "agentic operating layer for the independent brokerage" | `public/brand/og-image.svg` | **STALE (low impact)** | Static SVG still has banned copy, but the SERVED card is the dynamic `app/opengraph-image.tsx` (no "agentic" string found) — the SVG is a documentation mirror, not the live render. Wave-1 over-rated this. |

---

## 4. Wave-1 open questions — RESOLVED

### Q1 — What does signup actually do (card-at-signup vs add-later)?

**Single truth:** The code's intended default is **card captured at signup via Stripe Checkout**. `env.ts:127-128` makes `STRIPE_CHECKOUT_ENABLED` default to `true`; `actions.ts:128-141` calls `createTrialCheckoutForSignup` and returns a `checkoutUrl`; `SignUpForm.tsx:70-77` bounces the browser to Stripe-hosted Checkout. The sign-up page copy (`sign-up/page.tsx:47`) correctly matches this: "card captured at signup."

**Why two audits saw different behavior:** there is a deliberate **silent degrade path** (`actions.ts:142-164`): if `STRIPE_CHECKOUT_ENABLED=false` **OR** `createTrialCheckoutForSignup` throws (e.g. missing live Stripe price/customer config, or `BILLING_PROVIDER=test`), it falls back to `provisionTrialSubscriptionSafe` → trial starts, notice becomes "add your card from billing once you sign in." The 2026-06-10 live walk saw **zero Stripe calls = the fallback path is what production currently runs.** So: **code intends card-at-signup; production is silently on add-card-later** because of a Stripe env mismatch in Vercel (price IDs / `BILLING_PROVIDER` / `STRIPE_CHECKOUT_ENABLED`). This is a config gap, not a code bug. The copy ("card captured at signup") is currently a small lie in production until the Stripe env is fixed or the copy is softened.

### Q2 — Does vertical→tier gating exist in the product, or only marketing rendering?

**Both — and it reaches billing, not just rendering.**
- **Marketing render:** `[vertical]/page.tsx:90` → `<PricingTierBanner tier={content.tier} />`. CPA/home-services `content.ts` set `tier:"plus"` (renders $299 Partner ladder); law/ria set `tier:"max"` (renders "Max · quote-based" + `/custom?type=max` CTA). **Confirmed live:** `/cpa` shows "$299 Partner", `/law` shows "Max · quote-based engagement."
- **Billing reach:** `lib/auth/flows.ts:100-101` — when signup does not pass an explicit tier, `verticalTierFromContentTier(verticalContent.tier)` makes the **vertical's content.tier become the workspace's `verticalTier`**, which drives the Stripe Product (`provisioning.ts:73`, `tierFromVerticalTier`). In the current signup action the picker default ("regular") overrides this (`actions.ts:92`), so the *default* signup lands Regular — **but the marketing vertical page already quoted the customer Partner/Max before they reach the picker**, and any deep-link/flow that omits the explicit picker tier would inherit the vertical tier.
- **PR #219 ("vertical gating + refund") — NOT MERGED to main** (verified: no `Merge pull request #219` in `origin/main` log). So whatever entitlement/refund enforcement #219 promised is **not delivered today.** The FLEET-RUNS-FLEET memory marking the build "DONE" is wrong on this point.

**Verdict:** vertical→tier is not a harmless rendering quirk — it is wired into the entitlement path and the customer is *quoted by vertical on the live site*. This is the banned mapping, surfaced.

---

## 5. Drift since the 2026-06-10 SIGNUP-TO-GO audit

| 2026-06-10 killer | Status on origin/main 2026-06-11 | Evidence |
|---|---|---|
| ANTHROPIC_API_KEY paused → broken first-fire | **STILL TRUE (live)** | `POST /api/chat` → `{"degraded":true}` "Plaino's resting" (maps to `PLAINO_PAUSED_REPLY`/transient, `route.ts:273-276`). LLM not answering in prod. |
| invoice-chase missing from SKILL_CATALOG | **STILL TRUE** | No `invoice-chase-general` slug in `registry.ts` catalog; sweep checks that exact slug (`invoice-chase-general-sweep.ts:138`); `marketplace.ts:175` returns false for unknown slug. |
| home-services runtime schema-only | **STILL TRUE** | `registry.ts:961` block has no `runtime:` field → default schema-only (`marketplace.ts:176`). |

**Why no drift fix landed:** the "registry-truth wave" that would have fixed #1/#2 was scoped into FLEET-RUNS-FLEET PRs #223 (registry-truth CI guard) and #219 — **neither merged.** Only #216/#217/#218/#222 of that build landed. So all three killers are intact. The merged work (#217 credential self-heal, #218 counsel gate, #222 integration self-heal) is real but orthogonal to the first-hour value loop.

**New positive drift:** the dynamic OG route (`app/opengraph-image.tsx`) no longer carries the banned "agentic/independent brokerage" copy (the stale string survives only in the unused `public/brand/og-image.svg` mirror) — Wave-1's SEV-4 on this is over-rated; downgrade to polish.

---

## 6. Quick wins (≤1h — copy fixes or one-line gate flips)

1. **Add `invoice-chase-general` to `SKILL_CATALOG`** with `runtime:'live'` (one entry, `registry.ts`). Unblocks the general killer workflow fleet-wide. *(unblocks Gap 1)*
2. **Add `runtime:'live'` to the `home-services-estimate-followup` catalog entry** (`registry.ts:961`). One line. *(unblocks Gap 2)*
3. **Set all four vertical `content.ts` `tier` fields to `"regular"`** (cpa, home-services, law, ria). Kills the vertical→tier pricing surfaced on /cpa, /law, /home-services, /ria. *(fixes Gap 4)*
4. **Derive /pricing Partner bands from `tiers.ts`** (currently hardcoded $269/$239 vs canonical $279/$249). *(fixes price contradiction)*
5. **Soften signup copy** "card captured at signup" → behavior-accurate phrasing until Stripe env is verified, OR (Conner) fix Stripe env in Vercel. *(fixes Gap 5 copy half)*
6. **/custom "$199 → $99" arrow** reads as a discount; rewrite to the band ladder. *(Wave-1 + SIGNUP-TO-GO)*
7. Map `degraded`/paused chat + first-fire error codes to customer-safe copy (SIGNUP-TO-GO error-map). *(masks Gap 3 until key restored)*
8. Drop "~35 cron-fired agents" count on /about + /custom (violates own no-agent-counts rule).

## 7. Deep work (>1d — build what's promised)

1. **Wire CPA month-end-close + law conflict-screen production callers** — modules complete (`month-end-close-cpa`, `law-intake-conflict-screen` in catalog) but `runtime` schema-only AND no cron/router dispatch (vertical-router only dispatches realty). Add callers + flip runtime.
2. **Land the registry-truth CI guard (#223 equivalent)** — assert every Inngest sweep slug resolves to a `runtime:'live'` catalog entry. This is the systemic fix; the same bug bit twice in one build night and is still un-caught.
3. **Land vertical entitlement/refund (#219 equivalent)** — currently unmerged; decide whether vertical-tier billing should exist at all (recommend it shouldn't — see §8).
4. **Customer-visible value card** (ValueSummaryCard on Overview) — renewal evidence; still operator-only.
5. **Restore real LLM + run the first-fire restore harness** (Conner key action + fleet proof).

## 8. What you'd cut (delete the claim rather than build)

1. **Vertical→tier pricing entirely.** Delete the `tier` field's pricing role from vertical content; every vertical → Regular by default. The banned mapping has leaked back twice; the cleanest fix is to remove the surface, not maintain two contradictory pricing truths. `/custom` already absorbs depth.
2. **The Max "quote-based engagement" wall on /law and /ria.** A solo lawyer hitting a sales-wall on a vertical landing page is the worst conversion outcome; route them to Regular like everyone else and reserve Max for the billing-page upgrade + /custom.
3. **The "~35 cron-fired agents" proof line** — it both violates the no-agent-counts rule and invites a "show me" the product can't yet satisfy for the customer's own workspace.
4. **Static `public/brand/og-image.svg`** stale copy — delete the mirror or regenerate; it's unused and only a liability if it ever gets wired.

---

## Appendix — below customer-value bar (<4)

- Pricing band derivation drift ($269 vs $279): visible to a careful comparison shopper; sev 3.
- /about names a person as prod-access holder: sev 2 (security-theatre nit).
- ROI "15x–50x" vs "15x–110x" inconsistency: sev 3 (both labeled illustrative).
- OG static SVG stale: sev 2 (not served).

---

## Post-audit drift check (2026-06-11 EOD — main@47237e0, prod cabf36f)

- **FIXED — Gap 1 CLEARED:** `invoice-chase-general` is now in `SKILL_CATALOG` with `runtime:'live'` (`lib/skills/registry.ts:687`). The general-on-ramp killer workflow can fire.
- **MERGE LEDGER SUPERSEDED:** #219 (vertical gating + refund), #224 (E2E + integration self-heal + ApprovalCard deploy fix), #225 all merged since the audit ref; #220/#221 confirmed merged by Wave 3. **Only #223 (registry-truth CI guard) remains unmerged** — the systemic fix for exactly the bug class below.
- **STILL TRUE — Gap 2:** `home-services-estimate-followup` (`registry.ts:1019`) still has **no `runtime` field** → schema-only → silently never fires. It is also the readiness flagship for home-services (`lib/verticals/readiness.ts:68`), so the #219 gate now honestly waitlists home-services signups — but `/home-services` still sells the workflow.
- **STILL TRUE — Gap 3:** live `POST /api/chat` → `{"degraded":true,"reply":"Plaino's resting…"}` verified today. Key still paused.
- **STILL TRUE — Gap 4:** vertical→tier intact in all 4 `content.ts` files AND still wired into billing (`lib/auth/flows.ts:101` `verticalTierFromContentTier`). `/cpa` live-renders $299 Partner.
- **NEW:** #226 added the Buildium adapter + `property-management-rent-collection-chase` flagship (runtime live) — supported verticals are now real-estate, cpa, law, property-management + the general on-ramp.

## Estimated effort to clear backlog
- **Quick wins:** one line (`runtime:'live'` on home-services) + 4 tier fields + signup-copy truth ≈ 2h, in the Truth-Wave PR.
- **Systemic:** merge/land #223's registry-truth CI guard (the same bug class bit three times now) ≈ merge-only if the branch is alive, else ~1d rebuild.
- **Conner gates:** key restore (minutes), Stripe env decision.
- **Total: 1 PR + 1 merge + 2 Conner gates.** Claims-vs-delivery moves from 2 NOT-DELIVERED to 0 with the one-liner + key restore.
