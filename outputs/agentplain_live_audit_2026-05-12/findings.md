# agentplain.com — Live production audit, 2026-05-12

**Auditor:** Claude Code (read-only third-party-visitor audit)
**Branch:** `chore/agentplain-live-sanity-audit`
**Method:** `curl -sL` from the public internet against `https://agentplain.com`, no auth, no headers spoofed. Raw HTML responses saved at `outputs/agentplain_live_audit_2026-05-12/raw/`.
**Source-of-truth ratified at audit start:** `git rev-parse main` → `76b56443141d756ce9d4747143cbe2e258ff07f0` (PR #12 merge — homepage narrative rebuild). Local `npm run build:no-migrate` against this ref → **PASS** (after `npm install`; route table reproduces every page the audit looked for).

---

## TL;DR — one-paragraph headline

**The live `agentplain.com` deploy is stale. It does not reflect the last ~13 commits on `main` (everything since `f33629a` 2026-05-11 22:51 EDT).** What customers see today is a pre-narrative-rebuild, pre-pricing-collapse, pre-mission-lock build that still carries every one of the explicitly-banned framings (`v0`, `pilot phase`, `Seven agents`, `Verticals at v0: Realty`, `pre-trained AI agent fleet for small-to-mid brokerages`, footer `v0 · pilot phase` strip). Three customer-conversion routes (`/pricing`, `/custom`, `/signup` and `/app/sign-up`) and **all 10 vertical landing pages** (`/real-estate`, `/mortgage`, `/insurance`, `/property-management`, `/title-escrow`, `/recruiting`, `/home-services`, `/cpa`, `/law`, `/ria`) plus `/verticals` return **HTTP 404 → Next.js "404: This page could not be found."** The dead route `/pilot` (deleted in `main`) is still 200 OK in production. Net effect: a customer landing on the homepage today cannot reach pricing, cannot reach any vertical page, cannot sign up, cannot submit the /custom inquiry form (it 404s), and is presented with every framing the team killed over the last 48 hours. **This is a deploy-pipeline incident, not a content incident.** Local source on `main` is clean; production is not serving it.

Headline numbers: **17 distinct findings · 5 P0 · 7 P1 · 5 P2.**

Top 3 items Conner should know before any customer demo:

1. **P0 — Production is serving a build at least ~13 commits behind `main`.** Every banned framing Conner killed on 2026-05-11 is live. Customer demo of `https://agentplain.com` today contradicts everything in the brand and positioning lock. **Fix:** trigger a fresh production deploy of `76b5644` on Vercel and bust the CDN cache (`X-Vercel-Cache: HIT` confirms edge serving cached HTML; `Age: 536083` on the homepage response = ~6.2 days of cached drift). Do **not** demo on `agentplain.com` until a re-deploy completes and a clean `curl` of `/` shows the new mission line + the missing routes return 200.
2. **P0 — `/pricing`, `/custom`, all 10 vertical pages, `/verticals`, `/signup`, `/app/sign-up`, `/app` are 404 in prod.** The customer conversion path is entirely broken. Homepage CTAs link to `/pilot` (a dead route in `main`); there is no route from the homepage to anything the team has shipped in the last week.
3. **P0 — The deployed homepage hero contains the exact stat block (`Agents in the fleet: 7 / Pilot length: 30 days / Verticals at v0: Realty`) that triggered the entire 2026-05-11 narrative rebuild.** This is the precise component flagged in `feedback_everything_tells_a_story.md` line 41. It's gone from `main` (PR #10 rewrote `app/(marketing)/page.tsx`); it's still live.

`/custom` form-submission test result: **NOT POSSIBLE.** `https://agentplain.com/custom` returns HTTP 404. The `/api/custom-inquiry` route exists in `main` (`app/api/custom-inquiry/route.ts` — compiled into the build) but there is no rendered form to submit from. No test email was sent. Re-run this test once the deploy is unstuck.

Lighthouse-style scoring was not run as a separate pass — given the homepage is a stale build and 12 routes are 404, scoring the broken state would not inform the right fix (which is "redeploy"). Re-run Lighthouse against the fresh deploy before next customer demo.

---

## Surface-by-surface result, with citations

### 1. Homepage `/` — STATUS 200, 70182 bytes

Raw: `outputs/agentplain_live_audit_2026-05-12/raw/home.html`
Live response headers (verbatim): `X-Vercel-Cache: HIT`, `Age: 536083`, `Etag: "732085fa58c7fb8c2533e56f00ab6019"`, `X-Vercel-Id: iad1::bsjwd-1778612983192-8112325ff1bd`. The `Age` field is seconds-of-CDN-cache-residency; 536083 s / 86400 = 6.2 days. Whether the underlying Vercel deploy itself is stale or the edge ISR cache is, the bytes the customer receives represent a pre-2026-05-11-evening state of the codebase.

The deployed homepage contains the following verbatim strings, extracted with `curl … | grep`. Each one violates a memory rule in force at `main`:

| Live string (verbatim) | Where in the rendered HTML | Memory rule violated |
|---|---|---|
| `v0 · pilot phase · invite only` | `<p class="eyebrow mb-6">` immediately above the hero `<h1>` | `feedback_everything_tells_a_story.md` §"Banned in copy" — `V0`, `pilot phase`, `pre-pilot`, `pilot pricing` all named explicitly |
| `Seven agents handle the recurring operational work…` | hero sub-paragraph under the `Intelligence. Rooted in reality.` H1 | `project_agentplain_mission_and_positioning.md` §"Banned variants" — `"X agents" specific count` ("the fleet" is the unit, not a count); also `feedback_everything_tells_a_story.md` §"Banned in copy" (`"X agents" specific count`) |
| `pre-trained AI agent fleet for small-to-mid brokerages` | hero sub-paragraph (same `<p>` as above) | `feedback_everything_tells_a_story.md` §"Banned in copy" (`Real-estate-narrow framing`); `project_agentplain_mission_and_positioning.md` §"Banned variants" (`Any framing that omits "local businesses" as the subject`) |
| Stat block: `Agents in the fleet · 7 \| Pilot length · 30 days \| Verticals at v0 · Realty` | three-column `<div>` immediately below the hero CTAs | The exact element flagged in `feedback_everything_tells_a_story.md` line 41 (`"AGENTS IN THE FLEET: 7" / "VERTICALS AT V0: Realty" / "PILOT LENGTH: 30 days" — these are not story; they're stale internal metrics surfaced to people who don't know what an agent is yet. Banned.`) |
| H2 `A small fleet, doing the work brokerages keep deferring.` | Section 2 of the page (per `grep -oE '<h[12]…'` extraction) | `feedback_everything_tells_a_story.md` §"Banned in copy" (`Realty as the only vertical mentioned`; `Real-estate-narrow framing`) |
| H2 `Seven agents. Each one scoped to one job.` | Section 3 of the page | `project_agentplain_mission_and_positioning.md` §"Banned variants" (specific agent count) |
| H2 `A 30-day pilot. Opt-in at the end.` | Section 4 of the page | `project_stripe_both_surfaces.md` §"What this rule banishes" (`"Pilot fees" / "pilot pricing" / "30-day pilot"`) — also `feedback_everything_tells_a_story.md` §"Banned in copy" |
| Nav anchors: `<a href="/pilot">Pilot</a>` · `<a href="/pilot">See the pilot</a>` (header) + `<a href="/pilot">Pilot programs</a>` (footer Product column) | `components/Header.tsx`-rendered nav + `components/Footer.tsx`-rendered footer (in the OLD build) | `feedback_everything_tells_a_story.md` §"Banned in copy" — pilot framing banned; `project_stripe_both_surfaces.md` (no pilot pricing) |
| Footer bottom strip: `© 2026 agentplain · v0 · pilot phase` | `<div class="border-t border-rule">` at end of `<footer>` | Already deleted in `main` per commit `2ec5bc4 fix(marketing): remove last "v0" bleeds + footer status strip; pin banned framings in CI`; still in prod |
| 2 occurrences of `SMB` in homepage body text | (in `grep -ioE` count) | `project_agentplain_mission_and_positioning.md` §"Audience language" — `SMB` explicitly banned |

What's **missing** from the deployed homepage (every one of these is required by the story-arc rules):

| Required element | Memory rule | Live homepage occurrences |
|---|---|---|
| Locked mission line "We lift up local businesses by doing the work that takes their time and money away from the people they serve." | `project_agentplain_mission_and_positioning.md` §"Mission (LOCKED)" | **0** |
| Locked vision line "Local businesses can thrive through access to affordable, best-in-class tools and services." | same §"Vision (LOCKED)" | **0** |
| Audience term "local businesses" / "local business owners" / "entrepreneurs" anywhere in body | same §"Audience language" | **0** (only "small-to-mid brokerages") |
| 10-vertical chip row on page 1 (real estate, mortgage, insurance, property management, title & escrow, recruiting, home services, CPAs, law firms, RIAs) | `feedback_everything_tells_a_story.md` §"Q2 Is this for me?" + `project_agentplain_mission_and_positioning.md` §Q2 | **1** vertical mentioned ("Realty"), 9 missing |
| Regular per-seat ladder pricing teaser ($199 → $179 → $149 → $119 → $99) | `project_stripe_both_surfaces.md` §"Homepage pricing teaser" | **0** (no pricing teaser at all in the OLD build) |
| `/custom` link in nav + footer | `project_stripe_both_surfaces.md` §"What this rule REQUIRES" + §"Marketing nav" | **0** (nav only has `/pilot` + `/about`) |

The deployed `<title>` tag does carry the locked tagline (`agentplain — Intelligence. Rooted in reality.`), suggesting the site `metadata` block was updated separately at some earlier point but the body copy never followed. This is consistent with the staleness pattern — `app/layout.tsx` metadata changed, `app/(marketing)/page.tsx` body did not deploy.

### 2. `/pricing` — STATUS 404

Raw: `outputs/agentplain_live_audit_2026-05-12/raw/pricing.html`
Response body `<title>` is literally `<title>404: This page could not be found.</title>`. The new `/pricing` page is in `main` at `app/(marketing)/pricing/page.tsx` and is in the local production route table (`npm run build:no-migrate` output line `├ ○ /pricing 2.03 kB 96 kB`). Same root cause as homepage staleness: not deployed.

### 3. `/custom` — STATUS 404

Raw: `outputs/agentplain_live_audit_2026-05-12/raw/custom.html`
404 page. The new `/custom` page is in `main` at `app/(marketing)/custom/page.tsx` (`├ ○ /custom 17.8 kB 112 kB` in the local build). Companion API route `app/api/custom-inquiry/route.ts` is also in `main` (`├ ƒ /api/custom-inquiry`) but cannot be exercised end-to-end while the form-rendering page is 404.

**Form test attempt:** the audit specced a real end-to-end submission against the live `/custom` form to verify the API + the inquiry email lands. Because `/custom` is 404, **no form was submitted**. Re-run this test as the first acceptance step after the deploy lands. Recommended payload for the re-run: `{ name: "Audit Test 2026-05-12", email: <alias the auditor controls>, vertical: "real-estate", scope: "audit test — please ignore" }`, then verify the destination mailbox (whatever `lib/email/` is wired to) receives the inquiry within ~60s.

### 4. Vertical pages — `/real-estate`, `/mortgage`, `/insurance`, `/property-management`, `/title-escrow`, `/recruiting`, `/home-services`, `/cpa`, `/law`, `/ria` — all STATUS 404

Raw: `outputs/agentplain_live_audit_2026-05-12/raw/vertical_*.html` (10 files, each 16627 bytes — Next.js 404).
Local build prerenders all 10 (`├ ● /[vertical]` with explicit slugs in the route table). Confirmed `app/(marketing)/[vertical]/page.tsx` exists and the `lib/verticals/*` content tables are present. Same root cause.

### 5. `/verticals` index — STATUS 404

Raw: `outputs/agentplain_live_audit_2026-05-12/raw/verticals.html`
Same pattern. Locally prerenders (`└ ○ /verticals 204 B 94.1 kB`). Not deployed.

### 6. `/about` — STATUS 200, 21338 bytes

Raw: `outputs/agentplain_live_audit_2026-05-12/raw/about.html`
The page renders, but the deployed copy is **also stale** — same root cause as homepage. Surveyed strings:

| Live string | Memory rule violated |
|---|---|
| H1 `Quiet software for brokerages.` | Real-estate-narrow framing — banned in `feedback_everything_tells_a_story.md` |
| H2 `See if a pilot makes sense for your office.` | `pilot` banned per same rule + `project_stripe_both_surfaces.md` |
| 2 occurrences of `Seven agents` | specific count banned per `project_agentplain_mission_and_positioning.md` |
| 4 occurrences of `v0` in body | `V0` banned per `feedback_everything_tells_a_story.md` |
| Mission line "We lift up local businesses…" | **0 occurrences** in body |
| Vision line "Local businesses can thrive…" | **0 occurrences** in body |
| "Not magic" callout | not present (required per `project_agentplain_mission_and_positioning.md` §"Mission, Vision, Tagline" — the tagline framing) |

### 7. `/signup` — STATUS 404; `/app/sign-up` — STATUS 404; `/app` — STATUS 404

The audit task asked for `/signup` specifically. **The canonical route in `main` is `/app/sign-up`**, not `/signup` (`app/(product)/app/sign-up/page.tsx`; route table line `├ ƒ /app/sign-up 1.24 kB 95.2 kB`). Documented as two distinct findings:
- **The canonical `/app/sign-up` route is 404 in prod** (same root cause; deploy hasn't shipped the product surface). P0.
- **The `/signup` short-link does not exist** (no rewrite/redirect to `/app/sign-up` configured). If the marketing copy elsewhere ever sends people to `/signup`, that link will 404 even after the deploy unsticks. P1 — recommend adding a rewrite in `next.config.js` so `/signup → /app/sign-up`.

### 8. `/pilot` — STATUS 200, 42593 bytes — should be 410 / 404 / redirect

Raw: `outputs/agentplain_live_audit_2026-05-12/raw/pilot.html`
`/pilot` was deleted from `main` (no `app/.../pilot/page.tsx` exists; absent from the local build route table). It is still 200 OK in production. H2s on this page: `Pick the smallest tier that covers what you want to test.` / `A working engagement, not a demo.` / `Honest about the lift on your side.` / `Ready to start, or still deciding?` — every framing is `pilot pricing`, which `project_stripe_both_surfaces.md` says is banned site-wide. Severity P0 because every legacy CTA in nav still points here, so a customer who lands on the homepage is one click from a page that contradicts the new pricing model.

### 9. Header — STATUS: stale build serving old nav

Live nav (from the deployed HTML, verbatim): `<a href="/pilot">Pilot</a> · <a href="/about">About</a> · <a href="/pilot">See the pilot</a>`. The audit specced (per the homepage-rebuild task that this audit follows up on): `Verticals → How it works → Pricing → Custom → About`. The new `components/Header.tsx` on `main` matches the new spec — production does not.

### 10. Footer — STATUS: stale build serving old footer

Live footer columns (verbatim from raw HTML): **Brand column** (`agentplain` wordmark + "Intelligence. Rooted in reality." + sub-line `A pre-trained agent fleet for small-to-mid brokerages.`) + **Product column** (`/pilot`, `/#fleet`, `/#faq`) + **Company column** (`/about`, `mailto:hello@agentplain.com`). Bottom strip: `© 2026 agentplain · v0 · pilot phase` (the strip explicitly killed in commit `2ec5bc4`). The required elements per the rebuild spec (mission line in brand column, full Verticals column, `/custom` link) are missing.

---

## Severity-graded action list

`P0` = customer-impact-now (blocks demo / contradicts brand). `P1` = fix-this-week. `P2` = polish-later.

| # | URL / surface | Issue (specific + reproducible) | Severity | Recommended fix | Owner | Memory rule violated |
|---|---|---|---|---|---|---|
| 1 | All routes | Production deploy is ≥13 commits behind `main`. `X-Vercel-Cache: HIT` + `Age: 536083s` on `/` confirm CDN edge is serving stale bytes. Local `main` builds clean (route table reproduced). | **P0** | Force a fresh Vercel production deployment of `76b5644`; bust the CDN cache (Vercel dashboard → Deployments → "Promote to Production" + "Redeploy" with cache invalidation, or `vercel --prod --force`). Verify with `curl -I https://agentplain.com/` — `Age` should reset toward 0 and `<title>`/body should reflect new copy. Re-run this audit against the fresh deploy. | devops / `flatsbo-devops` agent | n/a (operational) |
| 2 | `/pricing` `/custom` `/real-estate` `/mortgage` `/insurance` `/property-management` `/title-escrow` `/recruiting` `/home-services` `/cpa` `/law` `/ria` `/verticals` `/app/sign-up` `/app` (15 routes) | All return HTTP 404 in production. All present in `main` build route table. | **P0** | Fixed by Finding #1 (redeploy). No code change needed — these routes work locally. | devops | n/a — caused by Finding #1 |
| 3 | `/` (homepage) | Hero eyebrow `v0 · pilot phase · invite only` — three banned framings in 6 words. Live in production right now. | **P0** | Fixed by Finding #1 (redeploy promotes `main` which has this deleted). | devops via redeploy; otherwise b2b-eng-frontend | `feedback_everything_tells_a_story.md` §"Banned in copy" |
| 4 | `/` (homepage hero stat block) | Live stat block "Agents in the fleet: 7 / Pilot length: 30 days / Verticals at v0: Realty" — the literal element flagged in `feedback_everything_tells_a_story.md` line 41 as the 2026-05-11 incident that triggered the rebuild rule. | **P0** | Fixed by Finding #1 (redeploy). PR #10 + #12 already deleted it from `main`. | devops via redeploy | `feedback_everything_tells_a_story.md` line 41 verbatim |
| 5 | `/pilot` | Page is 200 OK in production, but was deleted from `main`. Header CTAs and footer "Product → Pilot programs" link to it. Every H2 on the page violates `pilot pricing` ban. | **P0** | Add a permanent redirect in `next.config.js` (`{ source: '/pilot', destination: '/pricing', permanent: true }`) so the dead link doesn't drop customers on banned content even if a search engine has it indexed. Fix Finding #1 first so `/pricing` actually exists at the redirect target. | b2b-eng-frontend | `project_stripe_both_surfaces.md` §"What this rule banishes" |
| 6 | `/` body | Mission line "We lift up local businesses…" — required on customer surfaces by `project_agentplain_mission_and_positioning.md` §"How this rule applies" — has 0 occurrences in live HTML. | **P1** | Fixed by Finding #1 (commit `cc530fa` added the locked mission line to `app/(marketing)/page.tsx`). | devops via redeploy | `project_agentplain_mission_and_positioning.md` §"Mission (LOCKED)" |
| 7 | `/` body | Vision line "Local businesses can thrive through access to affordable, best-in-class tools and services." — required on homepage — 0 occurrences in live HTML. | **P1** | Same — already in `main`, awaits redeploy. | devops via redeploy | same §"Vision (LOCKED)" |
| 8 | `/` audience copy | 2 occurrences of "SMB" and reference to "small-to-mid brokerages" — banned audience labels per mission rule §"Audience language" (`SMB` named explicitly). | **P1** | Already replaced with "local businesses" / "local business owners" in `main`; awaits redeploy. | devops via redeploy | `project_agentplain_mission_and_positioning.md` §"Audience language" |
| 9 | `/` Q2 vertical chip row | Only "Realty" mentioned on page 1. Story arc requires all 10 verticals (`feedback_everything_tells_a_story.md` §"Q2 Is this for me?"). | **P1** | Already shipped in `main` (the 10-vertical chip row is in `app/(marketing)/page.tsx` per the rebuild audit at `outputs/homepage_narrative_audit_2026-05-12/audit.md` line 41). Awaits redeploy. | devops via redeploy | `feedback_everything_tells_a_story.md` §"Q2" + `project_agentplain_mission_and_positioning.md` §Q2 |
| 10 | `/` pricing teaser | No pricing teaser at all in the live homepage. `project_stripe_both_surfaces.md` §"Homepage pricing teaser" requires the Regular per-seat ladder ($199 → $179 → $149 → $119 → $99) + "Need more? Build with us →" link to `/custom`. | **P1** | Already shipped in `main` (commit `ebc79f5 feat(marketing): collapse pricing to single tier + add /custom engagement surface`). Awaits redeploy. | devops via redeploy | `project_stripe_both_surfaces.md` §"What this rule REQUIRES" |
| 11 | Header nav | Live nav only carries `Pilot`, `About`, `See the pilot` (CTA). Required nav order per rebuild spec: `Verticals → How it works → Pricing → Custom → About`. | **P1** | Already in `main` `components/Header.tsx`. Awaits redeploy. | devops via redeploy | `project_stripe_both_surfaces.md` §"Marketing nav" + brand lock |
| 12 | Footer | Bottom strip `© 2026 agentplain · v0 · pilot phase` — already deleted in `main` commit `2ec5bc4`. Still live. | **P1** | Already shipped in `main`. Awaits redeploy. | devops via redeploy | `feedback_everything_tells_a_story.md` §"Banned in copy" (`v0`); `2ec5bc4` commit message |
| 13 | Footer brand column | Missing mission line; sub-line says "A pre-trained agent fleet for small-to-mid brokerages." (banned audience + banned framing). | **P1** | Already replaced in `main`. Awaits redeploy. | devops via redeploy | `project_agentplain_mission_and_positioning.md` §"Audience language" |
| 14 | `/signup` short-link | The path `/signup` returns 404 even after the deploy unsticks (canonical route is `/app/sign-up`). Any marketing copy that drops users at `/signup` will dead-end. | **P1** | Add `next.config.js` rewrite: `{ source: '/signup', destination: '/app/sign-up' }`. Same for `/sign-up`, `/login`, `/sign-in` as convenience redirects. | b2b-eng-frontend | n/a — defensive URL ergonomics |
| 15 | `/custom` form end-to-end | Could not be tested because `/custom` is 404. Audit acceptance criterion #4 unsatisfied. | **P1** | Re-run the form-submit test as the first acceptance step after Finding #1 lands. Submit `{ name, email, vertical, scope }` payload; verify inquiry email arrives at the destination mailbox within 60s; verify the success toast / page state on the form side. | auditor (re-run); QA agent | `feedback_integration_acceptance_is_functional.md` §"Acceptance = read + categorize + coordinate + draft" (the same principle: shipping the form is not the same as a working form) |
| 16 | `/about` body | Stale build: H1 "Quiet software for brokerages." + H2 "See if a pilot makes sense for your office." + `Seven agents` (×2) + `v0` (×4). Missing mission line, vision line, and "Not magic" callout. | **P1** | Already corrected in `main`. Awaits redeploy. | devops via redeploy | `project_agentplain_mission_and_positioning.md` + `feedback_everything_tells_a_story.md` |
| 17 | All surfaces | No Lighthouse / accessibility / performance scoring run as part of this pass. Stale-build state makes the numbers misleading (the broken state isn't what we want to optimize). | **P2** | After Finding #1 redeploy, run `npx lighthouse https://agentplain.com/ --preset=desktop` and same for `/pricing`, `/custom`, and one vertical (`/real-estate`). Target ≥90 on Accessibility + Best Practices, ≥80 on Performance. File any score-driven issues as follow-ups. | design / b2b-eng-frontend | `feedback_no_quick_fixes.md` (no premature optimization on a broken build) |

---

## Why this is a single dominant finding (deploy staleness) and not 17 independent issues

Findings #2 through #13 and #16 all have the same root cause and the same fix: the `main` branch already contains the correct content, the production deploy does not reflect `main`. None of the customer-facing copy issues need a content PR — they need a deployment.

`outputs/homepage_narrative_audit_2026-05-12/audit.md` (the audit Conner ran earlier on the same day) reached the same conclusion at line 23: *"What Conner is seeing on live `agentplain.com` is a stale Vercel deployment of a pre-polish commit."* That audit was written **before** PR #12 merged. The merge happened at `2026-05-12 12:13 EDT`. This audit was run at `2026-05-12 19:09 UTC` (≈15:09 EDT, ~3h after merge) and still observed stale bytes — meaning either the post-merge production build did not run successfully or did not promote, or the edge CDN has not yet revalidated. Either way, the customer-facing state is the same and the fix is the same.

The narrowly-scoped non-deploy follow-ups remaining after Finding #1 lands are: Finding #5 (`/pilot` permanent redirect), Finding #14 (`/signup` rewrite), Finding #15 (re-test `/custom` form), Finding #17 (Lighthouse). Each is small and earns its own PR.

---

## Acceptance checklist — what this audit's PR should look like

- [x] `outputs/agentplain_live_audit_2026-05-12/findings.md` written (this file)
- [x] `outputs/agentplain_live_audit_2026-05-12/raw/*.html` saved for every page audited (homepage, /pricing, /custom, /about, /signup, 10 verticals, /verticals, /pilot, /app, /app/sign-up — 18 files)
- [x] No application source files touched (`git diff main…HEAD -- ':!outputs'` should be empty when this PR is opened)
- [x] PR description summarizes total issue count + severity breakdown + top 3 + /custom form test result
- [x] Local `npm run build:no-migrate` confirmed clean against `main` (after `npm install`)

## What this audit deliberately did NOT do

- Did not modify `app/`, `components/`, `lib/`, `prisma/`, `next.config.js`, `package.json`, or any code source file (per `feedback_no_quick_fixes.md` and the read-only audit scope)
- Did not touch `lib/verticals/*` or `lib/skills/*` (parallel tasks own those files per the audit prompt)
- Did not run Vercel CLI / promote any deploy (deploy action is a separate, blast-radius operation — Conner's decision)
- Did not submit a form to `/custom` (the page is 404; nothing to submit against)
- Did not page on a 500 (homepage and /about return 200, so the audit did not invoke the "hard-stop incident" clause from the task — Finding #1 is surfaced as the dominant P0 instead)
