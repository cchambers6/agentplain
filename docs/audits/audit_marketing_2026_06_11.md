# Marketing Audit — agentplain.com — 2026-06-11
**Date:** 2026-06-11 · **Lens:** Senior B2B SaaS marketing (positioning + lifecycle + SEO) · **Scope:** agentplain.com (all public pages) + app.agentplain.com entry + repo source for metadata/structured data · **Mode:** read-only audit

**Overall lens score: 3.6 / 5.** The homepage, /about, /pricing, /custom, and /verticals index are genuinely strong — disciplined story-arc, on-brand voice, banned framings scrubbed, vertical-specific depth that reads like an operator wrote it. The site is held back from a 4+ by one structural positioning bug (vertical pages contradict the pricing model), a real-estate-only social card that misrepresents the whole company, and thin answer-engine/SEO scaffolding (no per-vertical FAQ schema, no Article/blog surface, no canonical/OG-image-per-page). None of these are cosmetic; the first two actively mislead a buyer or a SERP.

---

## 1. Executive summary

agentplain.com is a well-built, doctrine-aligned marketing site. The homepage answers all nine positioning questions in arc order, names all ten verticals on page one, leads with the locked mission line and tagline, and frames the Claude relationship correctly ("Claude gives you the tool. We run it for you."). Vertical pages show deep operational fluency — /real-estate speaks dotloop/MLS/fair-housing, /cpa speaks IRC §6694/Circular 230/8879, /home-services speaks Xactimate/EagleView/supplement reclamation, /law speaks ABA Model Rule 1.6/privilege logging. That depth is the differentiator and it is real. The site's three problems are: (1) **the vertical pages still price by vertical** — CPA and home-services show "$299 / Partner," law and RIA show "Max / quoted" — which directly contradicts /pricing and the FAQ, both of which say tier = service cadence and "most shops fit Regular." A CPA visitor sees $299 on /cpa and $199 on /pricing for the same product; that is a trust-breaking, conversion-killing inconsistency. (2) **The site-wide social card** (the OG image served for agentplain.com) hardcodes "The agentic operating layer for the independent brokerage" — real-estate-only framing plus the banned "agentic" buzzword, shown every time anyone shares the homepage. (3) **SEO/AEO is shallow for a vertical land-grab play**: good base metadata and Organization/Service/FAQPage JSON-LD, but no per-vertical FAQ schema, no Article/guide content to rank on long-tail vertical queries ("AI for CPA firms," "fair housing compliance tool"), no per-page OG images, and an undated "robots Host" directive that's non-standard. Fix the pricing contradiction and the OG card this week; the SEO depth is the quarter's growth work.

---

## 2. Top 5 issues

### Issue 1 — Vertical pages price by vertical, contradicting /pricing and the FAQ · **Severity 5/5** · CV bar 5
`lib/verticals/cpa/content.ts:28` (`tier: "plus"` → renders "Partner $299"), `home-services/content.ts:30` (`tier: "plus"`), `law/content.ts:31` (`tier: "max"` → "quoted"), `ria/content.ts:30` (`tier: "max"`). Rendered by `components/vertical/PricingTierBanner.tsx`.
The 2026-05-15 three-tier model (verified in `app/(marketing)/pricing/page.tsx` and `components/FAQ.tsx` item "What's the difference between Regular, Partner, and Max?") defines tier as **service cadence** — Regular monthly, Partner weekly, Max ad-hoc — explicitly stating "most local-business shops fit Regular" and (verticals index, `verticals/page.tsx:51`) "the tier choice... is about cadence and depth of service partnership, **not which vertical you're in**." Yet the vertical pages hard-assign a tier per vertical, the exact "Vertical→tier copy" pattern `project_stripe_both_surfaces.md` bans ("All verticals are Regular... no tier-specific copy"). Net effect: a CPA prospect reads "$299/Partner" on /cpa and "$199/Regular, most shops fit here" on /pricing — same product, two prices, two stories. This is the single highest-value fix on the site: it both violates locked doctrine and directly damages conversion at the moment of price discovery.
**Fix:** set every vertical's `tier` to `"regular"` so the per-vertical pricing banner shows the Regular ladder ($199→$99) with a "step up to Partner/Max" cross-link, matching /pricing. (Or, if vertical-specific pricing is genuinely intended, re-ratify the model — but the current doctrine says it is not.)

### Issue 2 — Site-wide OG card is real-estate-only + uses banned "agentic" · **Severity 4/5** · CV bar 4
`app/opengraph-image.tsx:59`: "The agentic operating layer for the independent brokerage." This is the image rendered for `agentplain.com` and shown in every LinkedIn/Slack/iMessage/X share of the homepage. It tells the world agentplain is a brokerage tool — losing the CPA, lawyer, and insurance broker before they ever click — and uses "agentic," an AI buzzword the story-arc rule bans on customer surfaces. The same real-estate-only line is the `headline` in `lib/verticals/real-estate/content.ts:101` (correct *there* — it's the real-estate page), but it must not be the whole-site card.
**Fix:** change the OG subline to the mission/all-verticals framing (e.g. "Your AI ops team — without hiring one. Built for ten kinds of local business."). One-line change; high blast radius.

### Issue 3 — No answer-engine / long-tail SEO surface for a vertical land-grab · **Severity 4/5** · CV bar 4
The site has solid technical SEO basics (sitemap with all 19 URLs, robots.txt, Organization + Service + FAQPage JSON-LD on home, BreadcrumbList + per-vertical Service JSON-LD on vertical pages — `lib/seo/structured-data.ts`). But for a strategy whose whole thesis is owning ten verticals, there is **no content surface to rank or be cited on**: no blog/guides/resources, no per-vertical FAQ schema (the FAQPage JSON-LD only fires on the homepage; vertical pages carry none), no comparison/"vs" pages, no glossary. Answer engines (ChatGPT, Perplexity, Google AI Overviews) and Google's long-tail both reward depth-per-query; agentplain currently has exactly one indexable page per vertical and no content answering "how do I handle fair-housing compliance," "AI for tax season," "supplement reclamation software," etc. Competitors who publish vertical guides will own the top-of-funnel discovery agentplain's ICP actually searches.
**Fix (deep work):** a per-vertical guide/article surface (`/[vertical]/guides/...` or `/resources`) with Article + FAQPage JSON-LD, 6–10 cornerstone pieces mapped to the highest-intent vertical queries. This is the quarter's growth lever.

### Issue 4 — Homepage ROI says "15x–50x," FAQ says "15x–110x," memory says "15x–107x" · **Severity 3/5** · CV bar 4
Homepage hero/ROI section surfaces "15x to 50x"; `components/FAQ.tsx` item "What's the ROI math?" says "15x to 110x"; the canonical anchor is 15–107x. Three different ceiling numbers on the same site reads as either sloppy or inflated, and ROI credibility is exactly where a skeptical $10K/mo-problem owner pressure-tests you. Per-vertical multipliers (real-estate 26x, CPA 12–18x, home-services 14–21x, law 15x) are fine and specific — the problem is the *aggregate* range is inconsistent surface-to-surface.
**Fix:** pick one substantiated aggregate range and use it verbatim everywhere; reconcile to the `project_pricing_value_anchor.md` 15–107x figure or update the anchor.

### Issue 5 — Login/app entry is unreachable for audit + likely thin top-of-funnel handoff · **Severity 3/5** · CV bar 4
`app.agentplain.com/login` returns 404; the real surfaces are `/app/sign-in` and `/app/sign-up` (linked from marketing). I could not fetch them (auth-gated/redirect), so the signup→trial conversion moment is unverified from the live side. The marketing→app handoff is the highest-leverage conversion seam in the funnel and it is currently a black box to anyone auditing externally. From source, the CTAs are correct ("Start free trial" → `/app/sign-up`), but there is no marketing-side reassurance copy at the seam (what happens after I click, do I need a card, how long to first value) beyond "first month free."
**Fix:** verify the signup page live (separate auth'd pass) and add a one-line "no card to start · first drafts within days" reassurance at every primary CTA.

---

## 3. Per-page findings

### Homepage `/` — **4.5/5**
Strongest page on the site. Arc is textbook: tagline eyebrow → locked mission H1 → "Your AI ops team — without hiring one" → service-partnership explainer → all-10-vertical chip row → Why we exist → Read/Categorize/Coordinate/Schedule/Draft → 5 uniques → "Claude gives you the tool, we run it" two-column contrast → real-estate day-in-the-life with deep-link to other verticals → knowledge-substrate proof (build-time counts, honest) → "rooted in reality" proof → 3-tier pricing + ROI calc → vision → FAQ → closing CTA. Banned framings absent (no agent counts, no "pilot," no "SMB," no real-estate-only, Claude framing complementary). Minor: surfaces "~35 cron-fired agents" as proof — this is an agent count, but it's an *eat-our-own-cooking proof point about flatsbo*, not a product spec, so it's defensible; flag only if Conner wants zero counts anywhere. ROI "15x–50x" here vs FAQ "15x–110x" (Issue 4).

### `/about` — **4.5/5**
On-doctrine: mission, tagline, "we run it on ourselves first" (flatsbo / ~35 agents), "where we're going" (vision), "what we are not." No Claude mention (acceptable on about), no banned framings. Honest, calm, heritage voice. Could add the named-counsel proof point once counsel returns.

### `/pricing` — **4.5/5**
Clean three-tier model done right: tiers = service shape (Regular monthly / Partner weekly / Max ad-hoc), "most shops fit Regular," ROI calculator anchored to Regular, "when to choose what" guidance, shared guarantees, /custom delineated from Max. "No pilot fees" present. This page is the *correct* source of truth — which is exactly why the vertical pages contradicting it (Issue 1) is so damaging.

### `/custom` — **4/5**
Solid: six custom shapes, four-step process (scoping call → spec → 4–6wk build → handoff+maintenance), pricing framework ($5K–$15K + $200–$500/mo), clear delineation from Max. Reads as a real page, not a stub. Could use one concrete example engagement ("a 12-attorney firm needed X; here's what we built") to make it tangible — currently all categories, no story.

### `/verticals` (index) — **4.5/5**
"Ten verticals. Different ops. Same value loop." Names tier model correctly and *explicitly* says tier is about cadence not vertical (line 51) — which makes the vertical pages' per-vertical pricing (Issue 1) a direct self-contradiction within two clicks. On-ramp (/general) handled honestly below the grid as a surface, not an 11th vertical. Metadata good.

### `/real-estate` — **4.5/5 (content) / flag on OG**
Deepest page. dotloop, MLS submission, counter-offers, comparables, broker-of-record, FMLS/GAMLS, RESO Web API, fair-housing with the specific $26,262 HUD first-offense penalty, Sarah's-9:14pm-counteroffer day-in-the-life, role-split JTBD (broker-owner vs agent), 26x/$5,300/mo ROI with shown math. This is what every vertical page should aspire to. "Independent brokerage" framing is correct *here*. Tier renders "Regular" (correct).

### `/cpa` — **4/5 content, pricing WRONG**
Excellent tax fluency (IRC §6694, Circular 230, AICPA Code, 8879, K-1, March-17 deadline scenario, $42K/staff value). But renders **$299 / Partner** (Issue 1) — contradicts /pricing's "most shops fit Regular $199."

### `/home-services` — **4/5 content, pricing WRONG**
Authentic trades depth (Xactimate, EagleView, AccuLynx, ServiceTitan, adjuster scopes, supplement rebuttals, hailstorm 73-call scenario, $50K/yr supplement reclamation, 14–21x). Renders **$299 / Partner** (Issue 1).

### `/law` — **4/5 content, pricing WRONG**
Deep (ABA Model Rules 1.6/1.7/1.18/7.1, privilege logging, discovery 4,200-doc scenario, 60→14hr, $150K/3-attorney-firm). Renders **Max / quoted** (Issue 1) — a solo lawyer who'd happily pay $199 is told "talk to sales, quoted to scope," a conversion wall.

### `/ria` — **~4/5 content (not fully fetched), pricing WRONG**
`tier: "max"` → quoted (Issue 1), same wall as /law.

### `/mortgage`, `/insurance`, `/property-management`, `/title-escrow`, `/recruiting` — **assumed ~4/5, pricing correct**
All `tier: "regular"` (verified in content files). Not individually fetched this pass; spot-check recommended but they follow the same template and tier correctly.

### `/general` (on-ramp) — **4/5**
Honest "lighter scaffolding" framing, universal-admin value loop, Regular pricing, common-denominator tools only. Correctly positioned as a surface, not an 11th vertical.

### `/privacy`, `/terms`, `/security` — **not deep-audited (out of marketing core)**
In sitemap, linked in footer. The FAQ defers data-handling/subprocessor specifics to /privacy, so /privacy must actually name Anthropic + OpenAI as subprocessors and the per-workspace isolation model — verify in a compliance/legal pass.

### App entry (`/app/sign-in`, `/app/sign-up`) — **unverified, see Issue 5**
`app.agentplain.com/login` 404s; real routes auth-gated. From `components/Header.tsx` the CTAs route correctly. Needs an authenticated pass to score the signup→first-value experience (passkey/Apple/Google options, card-or-not, time-to-first-draft messaging).

---

## 4. Strategic gaps (vs. what a strong competitor would do)

1. **No top-of-funnel content engine.** A strong vertical-SaaS competitor publishes 2–4 cornerstone guides per vertical, ranks on the queries the ICP searches, and gets cited by answer engines. agentplain has one page per vertical and zero educational content. For a ten-vertical land-grab, this is the biggest growth gap. (Issue 3.)
2. **No social proof with attribution.** The proof section is honest ("we run it on flatsbo") but there are no customer logos, named testimonials, or case studies — because they don't exist yet, which is correct discipline. But the moment one design partner consents, a "what early partners say" attributed quote belt should ship; it's the single biggest believability lever a skeptical $10K/mo-problem owner wants.
3. **No comparison pages.** "agentplain vs hiring a VA," "agentplain vs Claude for Small Business (do-it-yourself)," "agentplain vs [vertical incumbent software]" capture high-intent bottom-funnel search and let agentplain frame the contrast on its own terms. The homepage two-column Claude contrast is good but isn't an indexable page.
4. **No lifecycle/email-nurture visible from the marketing surface.** The CTA is binary (start trial / email us). A "not ready to start? get the vertical ROI breakdown" lead-magnet → nurture sequence would capture the 90% who won't trial on first visit. The /custom contact form exists but there's no lighter-weight capture for the trial-hesitant.
5. **Plaino is invisible on the marketing surface.** The named service partner / robot-dog brand (`project_plaino_named_agent.md`, `project_plaino_brand_system_2026_06_06.md`) does not appear on any public page audited. The "service partner" is referenced abstractly ("a named service partner") but never as Plaino, and the brand mark/character isn't surfaced. A named, illustrated partner is a memorability and warmth asset the heritage voice is built for — currently unused on the funnel.
6. **No per-page OG images.** Every page shares the one (real-estate-only) root card. Per-vertical OG cards ("Built for CPA firms — Intelligence rooted in reality") would dramatically improve share CTR for vertical pages, which are the pages most likely to be shared into a vertical community.

---

## 5. Quick wins (≤1h each)

1. **Set all vertical `tier` fields to `"regular"`** (4 files: cpa, home-services, law, ria) — resolves Issue 1, the highest-value fix. ~10 min + verify render. *(Or get Conner's ratification if per-vertical pricing is actually intended.)*
2. **Rewrite the root OG subline** in `app/opengraph-image.tsx:59` to drop "agentic" + "independent brokerage," use the all-verticals mission framing — resolves Issue 2.
3. **Reconcile the ROI ceiling number** to one figure (15–107x) across homepage ROI section + FAQ — resolves Issue 4.
4. **Add per-vertical FAQPage JSON-LD** by feeding each vertical's JTBD/objections through the existing `faqPageJsonLd()` builder (already exists in `lib/seo/structured-data.ts` and is "loose enough" per its own comment to drive a vertical sub-FAQ). Per-vertical FAQ schema = answer-engine citations on vertical queries.
5. **Add a visible "no card to start · first drafts within days" reassurance line** at the primary CTA on home + every vertical page — de-risks the trial click.
6. **Surface Plaino by name** in the "your service partner" copy on home + /about as a quick warmth/memorability win (full brand-character rollout is deeper work).

## 6. Deep work (>1d, high impact)

1. **Per-vertical content/guide surface** (`/[vertical]/guides` or `/resources`) with Article + FAQPage JSON-LD, 6–10 cornerstone pieces mapped to the highest-intent queries per vertical. This is the top-of-funnel acquisition engine the strategy needs and currently lacks. (Issue 3.) Highest growth ROI on the list.
2. **Comparison-page set:** "vs do-it-yourself Claude," "vs hiring a VA/admin," "vs [incumbent vertical software]" per vertical — bottom-funnel intent capture, framed on agentplain's terms.
3. **Per-page OG image generation** (extend `opengraph-image.tsx` to a per-vertical dynamic card sourced from each content file's hero) — share-CTR lift on the pages most likely to be shared.
4. **Verified signup→first-value walkthrough** (authenticated pass): audit the trial onboarding, time-to-first-draft, card-gating, and the marketing↔app voice continuity. The funnel's last mile is currently unaudited.
5. **Lead-nurture capture** for the trial-hesitant: a lightweight "get your vertical's ROI breakdown" capture → sequence, distinct from the /custom sales form.

## 7. What I'd cut

- **Nothing structural.** The site is admirably free of filler — the story-arc discipline is holding. The only things to *remove* are the **specific contradictions**, not sections: cut the per-vertical tier pricing (replace with Regular), cut "agentic" from the OG card, cut the inconsistent ROI ceilings down to one number.
- **Possible trim:** the homepage knowledge-substrate "what the fleet knows on day one" stat block (build-time chunk counts) is honest and well-caveated, but chunk counts ("X vertical knowledge chunks") are abstract to a non-technical owner and edge toward the "stat block without context" the story-arc rule warns about. Consider whether it advances the buyer's arc or whether the "rooted in reality" proof section already carries that weight better. Low priority — it's defensible, just the weakest-earning section on an otherwise tight page.

---

## Appendix — findings below the customer-value bar (CV <4)

- **robots.txt `Host:` directive** (CV 2) — `Host: https://agentplain.com` is a non-standard/Yandex-only directive ignored by Google; harmless but cruft. Canonical host is better enforced via redirects + canonical tags.
- **No `lastmod` in sitemap** (CV 2) — sitemap lists URLs without lastmod/changefreq/priority; minor crawl-efficiency miss, not a ranking blocker at this scale.
- **"~35 cron-fired agents" as a surfaced count** (CV 3) — defensible as a flatsbo proof point, but technically an agent count on a customer surface; only act if Conner wants zero counts anywhere.
- **Mobile nav "Menu" affordance** (CV 2) — server-rendered details/summary, accessible and fine; noting only that it was a prior WCAG fix per the Header comment — verify it still renders on live mobile in a visual pass.
- **/custom lacks a concrete example engagement** (CV 3) — all categories, no story; would strengthen but doesn't block.

---

## Post-audit drift check (2026-06-11 EOD — main@47237e0, prod cabf36f)

- **STILL TRUE:** vertical→tier pricing (Issue 1) — all four `content.ts` `tier` fields unchanged (`cpa:28 "plus"`, `home-services:30 "plus"`, `law:31 "max"`, `ria:30 "max"`), `/cpa` live-renders $299 Partner today; no per-vertical FAQ JSON-LD or content surface (Issue 3).
- **FIXED:** the OG-card concern (Issue 2) is now fully closed — the served dynamic OG was already clean, and the stale static `public/brand/og-image.svg` no longer carries "agentic"/"independent brokerage" (brand waves #227–#234). Plaino now has a ratified two-family icon system on customer surfaces (#232), partially addressing the "Plaino invisible" gap.
- **NOT RE-VERIFIED:** ROI ceiling inconsistency (Issue 4) — copy churned in the brand waves; re-grep before fixing.

## Estimated effort to clear backlog
- **Quick wins:** ~4h in the Truth-Wave PR (4 tier fields → `"regular"`, ROI reconcile, per-vertical FAQPage JSON-LD via the existing builder, CTA reassurance line).
- **Deep work:** per-vertical guide/content engine 1–2 wks (the quarter's growth lever); comparison pages ~3d; per-page OG cards ~1d.
- **Total: 1 PR (quick) + 1 content program (quarter).** Lens moves 3.6 → ~4.2 on the tier fix alone.
