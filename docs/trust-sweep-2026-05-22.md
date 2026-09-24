# agentplain — Trust Sweep (presents-as-working but isn't), 2026-05-22

**Trigger:** Two "merged/deployed but broken for a real user" incidents — (1) `agentplain.com` apex served a stale build (no passkey, old session handling), fixed by binding the apex as a production-tracking domain via `vercel domains add`; (2) the passkey button was unreachable because the user was on that stale apex. Question: *are there other pieces like this?*

**Scope:** READ-ONLY. The gap between "merged/deployed" and "works end-to-end for a real user." No fixes applied. Production source of truth = `origin/main` @ `34731c6` (PR #55, overnight B1–B8), inspected in a detached worktree. Live hosts probed via authed Vercel CLI (`cchambers6`) + `curl`.

**Method:** Vercel domain/alias enumeration + live build fingerprinting (host-by-host `/_next/static/chunks/` hash compare + feature-marker probes); 3 parallel code lenses (config-gated crashes; unreachable/stub; integration-honesty + Stripe wiring). Every claim cites `file:line`, a command's output, or a live header. `[UNKNOWN]` = couldn't verify.

**Dedup:** Cross-checked against `docs/product-improvement-roadmap-2026-05-21.md` (B1–B13, OQ-1–4) and `docs/overnight-build-handoff-2026-05-22.md`. Known-open items are listed in §3, not re-reported as new. New findings are §1–§2.

---

## 0. What's CONFIRMED healthy (so we trust it)

- **Apex fix holds.** `agentplain.com` and `app.agentplain.com` serve the **identical current build** — `/app/sign-in` chunk fingerprint `192a812…` on both, passkey marker present on both. Apex no longer stale. ✅
- **`isIntegrationConfigured` seam is honestly applied** on the two customer self-serve surfaces (integrations index tile + onboarding CTA): both gate the "connect" affordance on real env config and only show "connected" for an ACTIVE `IntegrationCredential` row, never on env presence. (`integrations/page.tsx:79`, `IntegrationTile.tsx:96-102`, `onboarding/page.tsx:332,406-413`.) ✅
- **OAuth start route fails gracefully** — redirects to a branded `notice=not-configured` banner, no raw JSON 503. (`app/api/integrations/[integrationId]/oauth/start/route.ts:130-132,167-171`.) ✅
- **No advertised-but-unimplemented integrations** — every `available` marketplace entry has an OAuth callback route + MCP route + lib adapter on disk. (adapter *correctness* unexecuted = `[UNKNOWN]`, but the wiring exists.) ✅
- **No hardcoded test-mode Stripe price IDs** — checkout resolves prices by `lookup_key` from the env-supplied key (`lib/billing/stripe-provider.ts:99-116`); the `price_…` literals only live in the verification doc. ✅
- **Vendor providers (billing/email/auth/LLM/Notion) are lazy** — invoked inside handlers, not at module/render load. The prior eager-throw Notion-500 was the only one of its kind and is fixed. ✅

---

## 1. NEW findings — ranked punch list

### 🔴 P0-1 — `www.agentplain.com` serves a STALE build (no passkey) — *the exact bug, on a host that was missed*
- **Presents as:** the live agentplain site (200 OK, correct title "agentplain — Intelligence rooted in reality.", same Plaino/rooted copy).
- **Actually true:** it's an **~8-day-old deployment** that predates the passkey + consolidated/overnight PRs. Same failure mode Conner just hit on the apex — sign-in has **no passkey button**.
- **Evidence:**
  - `www` home chunk fingerprint `110ea77…` ≠ apex/app `c54279…` (different compiled build; `www` even ships a `/_next/static/css/d0bd50e66f4ce534.css` the current build doesn't).
  - `www/app/sign-in` → **passkey markers: 0**; `agentplain.com` and `app.agentplain.com` → **1**. (`curl … | grep -ciE "passkey|webauthn"`.)
  - `www` response header `Age: 723447` (~8.4 days cached); apex/app return fresh (no stale Age).
  - `vercel domains inspect agentplain.com` lists only `app.agentplain.com` under the project's assigned Domains; apex was just added, **`www` is not a production-tracking domain** → drifting on an old pin. `[UNKNOWN]` exact bind (old `vercel alias set` pin vs untracked) — but the drift itself is verified.
  - No canonical redirect exists: apex stays on `agentplain.com`, www stays on `www.agentplain.com` (both 200, neither 308s to the other).
- **Root-cause class:** DEPLOY/DOMAIN DRIFT (identical to the apex incident).
- **User impact:** anyone who types `www.agentplain.com` lands on the old build and cannot use passkey sign-in — the precise dead-end Conner reported, still live.
- **Fix owner:** **Fleet-fixable** (CLI is authed as `cchambers6`). Mirror the apex fix — `vercel domains add www.agentplain.com` as production-tracking **or** add a 308 `www → apex` redirect. *Recommend Conner picks redirect-vs-track* (shared prod-domain change), but no new credential is needed.

### 🔴 P0-2 — Realty "FLEET": 7 agents advertised, **0 of 7 bind to a runnable skill** *(B12 — now CONFIRMED, was `[UNKNOWN]`)*
- **Presents as:** a working 7-agent fleet on `…/workspace/[id]/agents` (Listing Coordinator, Buyer Inquiry Router, Showing Scheduler, Compliance Sentinel, CRM Hygiene, Production Reporter, Recruiter Assistant).
- **Actually true:** the roster slugs (`realty-*`, `lib/verticals/real-estate/content.ts:19-53`) match **none** of `SKILL_CATALOG`'s 4 slugs (`office-admin`, `invoice-chasing-realestate`, `lead-triage-realestate`, `month-end-close-cpa` — `lib/skills/registry.ts:62-217`, the only 4 dirs under `lib/skills/`). The per-agent handoff `_count` keys on `realty-*` (`agents/page.tsx:26-34`), so **every card shows "rooting in — first handoff lands soon" permanently** (`agents/page.tsx:85`); the detail page resolves name/job only and runs nothing (`agents/[slug]/page.tsx:50-53`).
- **Evidence / count:** **0 / 7 advertised realty agents resolve to a runnable skill.**
- **Root-cause class:** STUB masquerading as real.
- **User impact:** the lead/proof vertical's headline surface is display-only — a demo-killer the moment anyone clicks an agent.
- **Status:** **Known-open (roadmap B12, L)** — this sweep upgrades it from `[UNKNOWN]` to **confirmed 0/7**. Fleet-fixable (reconcile roster ↔ skills; B4 already landed the abstraction).

### 🔴 P0-3 — Stripe **live-mode catalog never provisioned** → a real charge would fail *(OQ-3 — confirmed)*
- **Presents as:** working checkout (sound code path; webhook pinned to API version `2026-04-22.dahlia`).
- **Actually true:** checkout calls `prices.list({lookup_keys:[…]})` (`lib/billing/stripe-provider.ts:99-116`). `scripts/stripe/setup-products.ts` has only ever run against **TEST** mode (`docs/stripe-e2e-verification-2026-05-18.md:172-175,260`). If `STRIPE_SECRET_KEY` is a live key with no live catalog, checkout throws **`lookup_key not found`** at `stripe-provider.ts:110-112`. Test-vs-live is set in Vercel env, **not distinguishable from code** (`lib/env.ts:86-87`, same `required()` accessor).
- **Root-cause class:** BILLING / CONFIG-GATED.
- **User impact:** a real paying customer cannot complete checkout until the live catalog is created.
- **Status:** **Known-open, Conner-gated** — needs live key + one run of `setup-products.ts` against live + a single live test charge to confirm. (Not re-counted as new; confirmed still open.)

### 🟠 P1-4 — Entire `/operator/*` surface is unreachable; leadership-board is empty + its refresh is a no-op
- **Presents as:** a built operator/leadership console (5 routes: `inquiries`, `integrations`, `leadership-board`, `support`, `workspaces`).
- **Actually true:** **zero inbound links** from any live UI — no `/operator` index, marketing header and workspace nav never reference it; `middleware.ts:52` only *gates* the path. Within the surface, only `workspaces/page.tsx:181,187` cross-links (to inquiries + integrations); `leadership-board` and `support` are orphans. `leadership-board` reads `public/leadership-snapshot.json` which is currently `{"source":"empty","observations":[]}`, and its `refreshAction` (`leadership-board/page.tsx:48-57`) is a documented **no-op** (cache-bust only).
- **Root-cause class:** UNREACHABLE-BUT-MERGED + STUB (no-op action).
- **User impact:** **internal** (Conner's operator surface, not customer-facing) — must memorize URLs; the leadership board renders empty with a button that does nothing. Lower customer impact, but it "presents as built, isn't usable."
- **Fix owner:** Fleet-fixable (add nav/index; wire or hide the refresh; populate or honestly empty-state the snapshot).

### 🟠 P1-5 — Integration **detail page** CTA bypasses the `isIntegrationConfigured` honesty seam
- **Presents as:** a live "connect {name}" button on `…/integrations/[integrationId]` for any non-coming-soon, non-connected provider.
- **Actually true:** that page (`integrations/[integrationId]/page.tsx:109-126`) does **not** call `isIntegrationConfigured` (unlike the tile + onboarding). It's not a false "connected" claim, and the click dead-ends *safely* at the start-route redirect (§0), but it shows a live-looking connect button that bounces to "not open for self-connect yet" — inconsistent with the honesty pattern everywhere else.
- **Root-cause class:** INTEGRATIONS HONESTY (minor / consistency).
- **User impact:** low — reached by direct URL; safe dead-end. Fleet-fixable (gate the CTA like the tile does).

### 🟠 P1-6 — `ENCRYPTION_KEY` read raw (bypasses env seam); `decrypt()` throws `MissingKeyError` on the credential path
- **Presents as:** centralized env discipline (there's an `env.encryptionKey()` accessor at `lib/env.ts:144`).
- **Actually true:** `lib/security/encryption.ts:45` reads `process.env.ENCRYPTION_KEY` **directly** (the `env.encryptionKey()` accessor is dead/unused). `decrypt()` → `loadMasterKey()` throws `MissingKeyError` (`encryption.ts:46`), called by `decryptCredential` (`lib/integrations/index.ts:169-171`). Fires the moment any path touches a connected integration's tokens.
- **Root-cause class:** CONFIG-GATED + hygiene. `[UNKNOWN]` whether any *server-component render* calls `decryptCredential` without a catch (would 500); it is not eager on a bare page render, and only matters **after** an integration is connected (post-OAuth, currently gated).
- **User impact:** latent — only bites once OAuth go-live + a missing/rotated `ENCRYPTION_KEY` coincide. Fleet-fixable (route through the env seam; ensure callers catch).

### 🟡 P2-7 — `SESSION_PASSWORD` eager throw on any authed render
- `readSession()` calls `env.sessionPassword()` *before* the try/catch when a session cookie is present (`lib/auth/session.ts:55-59`), on every authed page via `requireUser`. Missing key → error boundary on every product page. **Infra-tier secret, present in all real deploys** → low practical risk; flagged for completeness. Fleet-fixable (move inside the catch / validate at boot).

### 🟡 P2-8 — Settings: 3 rows are `href="#"` no-ops
- "team members", "drafting tone", "notifications" (`settings/page.tsx:81-97,138-153`) are non-link `<div>`s tagged **"coming soon"** — honestly labeled, non-deceptive, non-functional. Low impact; listed so it's tracked, not hidden.

---

## 2. Preview/branch aliases (low risk, noted not flagged)
`vercel alias ls` shows the usual auto git-branch preview aliases (e.g. the 3h-old `agentplain-git-feat-overnight-impro-…`). These track their branch and auto-update on push — **not** a stale-serving trust issue for a normal user, *unless* a stale preview link is circulated externally. No action; monitor only.

---

## 3. KNOWN-OPEN items (already captured; status confirmed, not re-reported as new)
From the overnight roadmap/handoff — these remain open and are NOT new findings:
- **B12** — realty FLEET ↔ skill binding → **confirmed 0/7** above (P0-2). *Open, fleet-fixable.*
- **OQ-3 / Stripe live catalog** → confirmed above (P0-3). *Open, Conner-gated.*
- **OQ-2 — Google + Microsoft OAuth not live** (client creds + Pub/Sub topic + Graph subscription). *Open, Conner-gated.* The loop's **receiver** end can't run on a real inbox until supplied; B1's seed makes everything downstream demonstrable meanwhile.
- **B9** — WebhookEvent backlog alarm (unprocessed-rows watchdog + Inngest cron + Sentry). *Open, fleet-fixable.*
- **B10** — realty compliance corpus is 1 rule (fair-housing only) vs 6–7 for other verticals; wants a counsel pass (OQ-4). *Open, fleet-fixable + counsel.*
- **B11** — tier picker is the first thing on signup; design says default `regular` and defer the choice. *Open, fleet-fixable (isolated PR).*
- **B13** — `(operator)`/`(marketing)` route groups lack own `error.tsx`/`not-found.tsx` (inherit root). *Open, low.*
- **OQ-1 — pricing memory conflict:** code implements **3-tier** Regular/Plus(="Partner")/Max (`lib/pricing/tiers.ts:31,38`; Max is quote-only via `/custom`, no checkout path), while `project_stripe_both_surfaces.md` memory says "Regular + Custom only, 3-column banned." **Needs a Conner ruling** to retire the stale doc — code state noted, not resolved here.
- **Pre-existing test failure:** `knowledge-substrate.test.ts` `CROSS_CUSTOMER===0` assertion (byte-identical to main, predates overnight branch). *Open, flagged separately.*

---

## 4. Triage shortlist (recommendation)
1. **P0-1 www drift** — fastest, highest-trust win; mirror the apex fix today (fleet can run it; Conner picks track-vs-redirect).
2. **P0-3 Stripe live catalog** — Conner-gated; blocks real revenue. Provision live Prices + one live test charge.
3. **P0-2 realty fleet 0/7** — biggest demo-credibility gap; reconcile roster ↔ skills (B12, L).
4. Then P1-4/5/6 (operator reachability, detail-page honesty, encryption-key seam) as fleet work.

*Read-only sweep — no code changed. Live probes were GET-only; no Stripe charge attempted.*
