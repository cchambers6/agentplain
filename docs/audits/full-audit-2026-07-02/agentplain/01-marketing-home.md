# Full-product audit 2026-07-02 — Department 1/10: Marketing home + nav + footer

- **Pinned to:** `origin/main` @ `f928400` (merge PR #316; Heritage rollout #320 confirmed in history at `008bc03`)
- **Scope:** `/` (home), global nav header, footer, `/privacy`, `/terms`, `/about`, `/aup`, `/security`, 404, cookie banner
- **Method:** static verification against source in isolated worktree; repo gates (`voice-gate`, `brand-gate`) run mechanically; every finding carries file:line evidence. Inventory only — no fixes applied.
- **Note on scope deltas:** `/contact` and `/data` (named in the audit brief) do not exist as marketing routes and **nothing links to them** — contact is `mailto:hello@agentplain.com` throughout; "Your data" references in privacy/terms point at the in-product workspace surface (`app/(product)/app/workspace/[id]/data/`), styled as text, not links. No dead link. Cookie banner: none exists and **none is required** — zero third-party tracking scripts, no analytics, no cookie mentions in the privacy policy (`app/layout.tsx` loads fonts only).

---

## Top findings (P0/P1)

### 1. 🚨 P0 — Stale redirect makes `/how-it-works` unreachable; primary nav item never lands on its page
- **Evidence:** `next.config.mjs:22-25` (`source: "/how-it-works", destination: "/#how", permanent: true`) vs `app/(marketing)/how-it-works/page.tsx` (standalone SEO page, shipped PR #283, with its own `opengraph-image.tsx`).
- **What happens:** Next.js applies `redirects()` **before** filesystem routes. Every click on the header's "How it works" (`components/Header.tsx:38`) 308s to the home anchor. The entire standalone page — hero, five-step loop, OG image — has been dead since #283 merged. The page's own comment ("The Header nav now points here instead of the home anchor") describes an intent the config silently defeats.
- **Compounding:** `app/sitemap.ts:56` lists `/how-it-works` at priority 0.8 — a sitemap URL that permanently redirects is a crawl error and burns index trust. And because the redirect is `permanent: true`, **browsers cache the 308**, so returning visitors will keep bouncing even after the redirect is removed (mitigation for the fix wave: consider serving the page and keeping cache-busting in mind; the redirect must be deleted, not just reordered).
- **Customer impact:** the #2 question in the visitor story arc ("what does it do?") never reaches its dedicated answer; SEO/AEO investment in the page is producing zero.
- **Fix:** delete the `/how-it-works` redirect block from `next.config.mjs`.

### 2. P1 — Public `/security` page names the sole holder of production access by full name
- **Evidence:** `app/(marketing)/security/page.tsx` §06 (~line 137-139): "Internal access to the production environment is limited to the workspace owner (Conner Chambers) and is gated behind multi-factor authentication on the Vercel account."
- **Customer impact / risk:** publishing *who* the single point of production access is, on the same page that enumerates the exact vendor stack (Vercel, Neon, Stripe, Resend, Sentry, Inngest), is a targeted-phishing / social-engineering blueprint. Transparency about the *process* (MFA, no shared admin, Git-only deploys) carries all the trust value without the name.
- **Fix:** replace with "the workspace owner" (or "a single named owner").

### 3. P1 — Proof card publishes a `$2,900–$10,600/mo` value range with no substantiating source
- **Evidence:** `lib/marketing/home-content.ts` (proof card "ROI math, not vibes") claims "$2,900–$10,600/mo value vs $99–$199/mo subscription." The `$99–$199` end is real (`lib/pricing/tiers.ts:106-131`), but the value range appears nowhere else in code: `RoiCalculator.tsx:63-78` computes ~$4,300/mo from its labeled defaults (10 hr/wk × $100/hr × 4.3 wk). No floor/ceiling derivation exists.
- **Customer impact:** the one proof card whose *label* is "not vibes" is the one number on the home page that can't be traced to an artifact — exactly the failure class Truth Wave (#290) exists to prevent.
- **Fix:** derive the range from the calculator's stated input bounds and cite it, or drop the numbers and let the interactive calculator carry the claim. (Check `project_pricing_value_anchor.md` — if the range is ratified there, add the citation comment; the code currently has none.)

### 4. P1 — No root `app/not-found.tsx`: multi-segment unknown URLs render Next's unbranded default 404
- **Evidence:** `app/not-found.tsx` does not exist; `app/(marketing)/not-found.tsx` exists (heritage-styled, correct). Single-segment unknowns (`/bogus`) are rescued by the `[vertical]` dynamic route calling `notFound()` (`app/(marketing)/[vertical]/page.tsx:64`) → branded 404 with header/footer. But any *deeper* unknown path (`/pricing/x`, `/blog/anything`, stale multi-segment inbound links) matches no route and falls through to Next's default unstyled 404 — no nav, no brand, no path back.
- **Customer impact:** the first heritage-brand impression for anyone arriving on a mistyped deep link is a white default error page.
- **Fix:** add `app/not-found.tsx` reusing the `ApRootedEmptyState` pattern from the marketing 404.

### 5. P1 — `/guarantee` page is fully orphaned: zero inbound links, absent from sitemap
- **Evidence:** `app/(marketing)/guarantee/page.tsx` exists (PR #300 Day-7 walk-away surface). `grep` across `app/`, `components/`, `lib/` finds **no** `href="/guarantee"`; `app/sitemap.ts` has no entry. Meanwhile the home closing CTA (`page.tsx:732`) and FAQ verbally promise the "14-day money-back guarantee" without linking it.
- **Customer impact:** the single strongest risk-reversal asset on the site is undiscoverable by customers and crawlers alike.
- **Fix:** link it from the closing CTA + footer Company column + FAQ answer; add to sitemap.

### 6. P1 — Legal surfaces live without counsel sign-off; two claims on them need verification
- **Evidence:** source comments on all three legal pages (privacy ~line 14, terms ~line 13, aup ~line 13) state counsel review is a follow-up; the pages render with "Last updated: June 17, 2026" and no draft marker. Two specific claims to verify before counsel packet: (a) `terms/page.tsx:179-180` asserts compliance corpora are "clearly labeled as draft vs. counsel-reviewed inside the product" — verify that label actually renders in-product or soften; (b) US data-residency claim (`terms:111-123`, echoed on `/security`) needs confirmation against actual Neon/Vercel production region.
- **Customer impact:** truthful-shaped but legally unratified terms are a liability exposure, and an in-product-labeling claim that doesn't hold would itself be a Truth-Wave violation.
- **Fix:** route privacy/terms/aup/security as one counsel packet (already a TODOS item); verify (a) and (b) first.

---

## Per-clickable inventory

Status key: ✅ works as claimed · ⚠️ works with a caveat · ❌ broken · ❓ unverifiable from code.

### Global header (`components/Header.tsx`)

| Clickable | Claims / does | Status | Sev | Notes |
|---|---|---|---|---|
| Logo lockup → `/` | brand home | ✅ | — | tokens only, no hardcoded hex |
| Verticals → `/verticals` | index of ten | ✅ | — | `app/(marketing)/verticals/page.tsx` |
| How it works → `/how-it-works` | standalone explainer | ❌ | **P0** | 308-redirected to `/#how` by `next.config.mjs:22` — page unreachable (finding 1) |
| Pricing → `/pricing` | pricing page | ✅ | — | resolves |
| Custom → `/custom` | custom engagements | ✅ | — | resolves |
| About → `/about` | positioning page | ✅ | — | resolves |
| Sign in → `/app/sign-in` | product auth | ✅ | — | `app/(product)/app/sign-in/page.tsx` |
| Start free trial → `/app/sign-up` | 7-day trial | ✅ | — | matches `lib/billing/facts.ts:27` (7d; CPA/Law 14d stated in FAQ) |
| Mobile hamburger (`<details>` drawer) | full nav + sign-in | ⚠️ | P2 | server-rendered, no JS — but native `<details>` doesn't close on outside click/Escape; `role="menu"` on a plain div without keyboard menu semantics |

### Home page (`app/(marketing)/page.tsx`)

| Clickable / claim | Status | Sev | Evidence |
|---|---|---|---|
| Hero mission line (locked wording) | ✅ | — | exact match to ratified text; `tokens.tagline` correct (`lib/brand/tokens.ts:141`) |
| Hero CTAs → `/app/sign-up`, `/#how` | ✅ | — | anchor `id="how"` exists at page.tsx:337 |
| 10 vertical chips → `/{slug}` | ✅ | — | all 10 slugs + `/general` covered by `[vertical]/generateStaticParams` |
| "Don't see your industry?" → `/general` | ✅ | — | ON_RAMP_SLUGS |
| "The chain runs every five minutes" | ✅ | — | Inngest cron `*/5 * * * *` + test asserting the schedule |
| "7-day free trial, card at signup" | ✅ | — | `CARD_REQUIRED_AT_SIGNUP = true`, `TRIAL_PERIOD_DAYS = 7` (`lib/billing/facts.ts`) |
| "14-day money-back guarantee" (closing CTA) | ⚠️ | P1 | true (`facts.ts:51`) but `/guarantee` page unlinked + orphaned (finding 5) |
| SEED_COUNTS knowledge stats | ✅ | — | computed at build from real corpus arrays (`lib/knowledge/seed-data.ts`), not invented |
| Proof card "$2,900–$10,600/mo value" | ❌ | **P1** | no substantiating source in code (finding 3) |
| Proof card "brokerage in production, ~35 cron-fired agents" | ❓ | P2 | consistent with doctrine (`seed-data.ts:634`) but not externally verifiable from code; acceptable dogfooding claim |
| Uniques (5 cards) | ✅ | — | no "fully automated"/"replaces your team"/outcome guarantees |
| FAQ (`components/faq-items.ts`) | ⚠️ | P2 | content truthful (trial policy exact, HIPAA honesty, vendor-generic) but 6 lines carry 3–5 em-dashes each (voice-gate baseline lines 38/50/66/71/95/99) + page.tsx:287 — residual AI cadence on the highest-traffic surface |
| RoiCalculator | ✅ | — | defaults labeled conservative + editable; "illustrative… your numbers will vary" caveat present; prices locked to billing source |
| Tier CTAs (Regular→sign-up; Partner/Max→mailto) | ✅ | — | consistent `hello@agentplain.com` |
| "Build with us" → `/custom` | ✅ | — | resolves |
| JSON-LD (5 blocks) | ✅ | — | no aggregateRating/reviews; offer prices derived from billing source; vendor-generic |
| Closing CTA row (4 links) | ✅ | — | all resolve |
| PlainoWidget (floating, all marketing routes) | ✅ | — | vendor-neutral greeting, honest degraded state → email hand-off ("a real person will reach out. no drip, no spam"), POSTs to `/api/leads/capture` |

### Footer (`components/Footer.tsx`)

| Clickable | Status | Sev | Notes |
|---|---|---|---|
| 6 vertical links + "All ten →" + `/general` | ✅ | — | all resolve |
| How it works → `/#how` | ✅ | — | footer deliberately targets the anchor (works); header targets the shadowed page (doesn't) — inconsistent destination for the same label, resolve with finding 1 |
| Pricing / Build with us / Join the list (`/waitlist`) / FAQ (`/#faq`) / trial / sign-in | ✅ | — | all resolve; anchor `id="faq"` at page.tsx:706 |
| About / Privacy / Terms / Acceptable use / Security | ✅ | — | all resolve |
| `hello@agentplain.com` mailto | ✅ | — | consistent across all 8+ occurrences site-wide |
| Social links | — | P2 | none exist (nothing broken; note: no social presence surfaced anywhere) |
| Bottom strip "10 verticals · 3 service-partnership tiers · 7-day free trial" | ⚠️ | P2 | all true; omits the 14-day CPA/Law exception (stated in FAQ + terms — acceptable but inconsistent with the precision elsewhere) |
| Heritage styling | ✅ | — | forest-deep + cream, `Logo variant="inverted"`, no SaaS regressions |

### Legal + company surfaces

| Surface | Status | Sev | Verdict |
|---|---|---|---|
| `/privacy` | ⚠️ | P1/P2 | Clean on vendor rule (Anthropic in subprocessor list = the sanctioned home). No banned data-claims. Two-bucket story **implicit, not explicit** — Bucket-1 (account-lifetime working memory) vs Bucket-2 (pass-through connector data) must be inferred from lines ~74-88; counsel should ratify explicit phrasing (P2). Counsel gate open (finding 6). |
| `/terms` | ⚠️ | P1 | Trial policy exact (7d/14d CPA-Law/14d money-back, `terms:66-70`); liability boundaries clear; no vendor names. Two claims need verification (finding 6). |
| `/aup` | ✅ | P1* | Clean. *Counsel gate only (finding 6). |
| `/security` | ⚠️ | P1 | "Conner Chambers" named as sole prod-access holder (finding 2). Anthropic appears twice (§02 TLS list, §07 subprocessors) — **allowlisted** in `brand-gate-allow.json` ("same rationale as privacy page", ratified PR #164), so not a violation, but the memory doctrine says "vendor name only on /privacy"; doctrine and allowlist should be reconciled (P2). No absolute security claims ("bank-grade" etc. absent). |
| `/about` | ✅ | — | Truthful-shaped: "Atlanta · 2026", flatsbo dogfooding claim consistent with doctrine, "What we are not" disclaimers present, no invented team/funding/customers. |
| 404 (`(marketing)/not-found.tsx`) | ⚠️ | P1 | heritage-styled, works for single-segment unknowns via `[vertical]` notFound; multi-segment gap (finding 4) |
| error boundary (`(marketing)/error.tsx`) | ✅ | — | heritage voice, reports to observability, digest shown as reference |
| Cookie banner | ✅ | — | not required: no tracking scripts, no analytics, no cookies claimed |

---

## Compliance sweeps (mechanical)

| Gate | Result | In-scope residue |
|---|---|---|
| `voice-gate` (LLM-ese A–D + em-dash E) | OK — 30 baseline, **0 new** | 7 baselined em-dash violations render on home: `page.tsx:287` + `faq-items.ts:38,50,66,71,95,99` (P2 — grandfathered but customer-visible) |
| `brand-gate` (vendor names, hype, rounded corners, hex) | OK — 11 baseline, **0 new** | 6 baselined Anthropic strings in `lib/plaino/turn-failure.ts` (customer-rendered Plaino failure copy — outside this department's surfaces but flagged for the product-department audit); zero on marketing |
| Truth-Wave (manual) | 1 fail | the $2.9K–$10.6K proof range (finding 3); no customer counts, no "as seen in", no named clients, no fabricated ratings anywhere on these surfaces |
| Model-vendor invisibility | pass | customer surfaces vendor-generic; sanctioned exceptions only (privacy + allowlisted security subprocessor lists) |
| Heritage Plains #320 | pass | all audited surfaces on tokens (paper/ink/clay/forest/wheat), letterpress + grain present in `globals.css`, forest-deep footer, no `bg-white`/`bg-gray-*`/`rounded-*`/hex regressions on marketing |
| Data-minimization framing | pass w/ note | no banned phrases ("nothing stored"/"forgets"/"auto-deletes") anywhere; two-bucket story implicit on `/privacy` (P2 above) |

## Link resolution summary

68 internal hrefs enumerated across header/footer/home/legal/PlainoWidget: **65 resolve, 3 redirect, 0 dead**. The one *functional* break is not a 404 but the redirect shadowing in finding 1. Full table in the sections above; redirects: `/pilot→/#pricing`, `/how-it-works→/#how` (the P0), plus two workspace back-compat redirects.

---

*Department 1/10 · audit-2026-07-02 · worktree `C:\agentplain-wt-audit-1` @ `f928400` · inventory only, no fixes applied.*
