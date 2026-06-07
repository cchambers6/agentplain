# Investor Narrative — supplier-as-competitor, addressed head-on

**Compiled 2026-06-06. ~3 pages.** For investor conversations, the board update, and the data-room "key risks" section. The thesis: Anthropic shipping Claude for Small Business made supplier-as-competitor our #1 platform risk, and the same evidence that names the risk also bounds it. We do not hand-wave this. We show exactly which part of the moat holds, which part doesn't, and what we're doing over twelve months to widen the part that holds.

---

## The setup, stated plainly

On 2026-05-13 Anthropic launched Claude for Small Business — a plugin inside Claude Cowork bundling ~15 workflows and ~15–25 skills with connectors to QuickBooks, HubSpot, Google Workspace, Microsoft 365 and more, at no incremental cost on top of a Claude subscription ([anthropic.com/news/claude-for-small-business](https://www.anthropic.com/news/claude-for-small-business); [digitalapplied.com](https://www.digitalapplied.com/blog/claude-for-small-business-quickbooks-hubspot); accessed 2026-06-06). Our supplier now ships a product adjacent to ours. Any investor who's paying attention will ask the same question a prospect asks: *why not just use Claude?*

The honest answer is that Anthropic built the engine and a generic toolkit, and **deliberately chose not to build the service**. That is not our spin — it's their stated strategy, and it's the spine of this narrative.

---

## (a) The moat that holds

Three things compound, and none of them is "we use a good model."

**1. Per-vertical compliance depth, with liability behind it.** We carry counsel-reviewed compliance corpora per vertical (`lib/agents/sentinel/`), gated on a legal sign-off before they fire (`COMPLIANCE_CORPUS_COUNSEL_REVIEWED`). Claude SBM ships **no industry compliance layer** ([digitalapplied.com](https://www.digitalapplied.com/blog/claude-for-small-business-quickbooks-hubspot), "What it does NOT do," accessed 2026-06-06). This is years of per-vertical corpus work plus counsel review plus (a 12-month move) insurance backing. A horizontal-infrastructure company does not take on fair-housing, RESPA, and SEC-Marketing-Rule liability for ten regulated trades — it's structurally not their business.

**2. Done-for-you service, run from a multi-tenant operator plane.** The thing that turns "powerful tool you configure" into "service that runs your business" is human operators managing many customer workspaces from one console (`/operator/*`, per-workspace budget seam). Anthropic's customer is the business owner; they have no reason to build the console a *competitor to their own customer* would run. This is the layer that makes our margins work and it's the layer they won't build.

**3. Per-vertical skill libraries built on real corpus work.** Our `small-business:*` horizontal skill names mirror theirs — the primitive is shared and that's fine. What doesn't transfer is the realty fleet (listing-coordinator, compliance-sentinel, buyer-inquiry-router…) shaped by actual brokerage operations, and the curated, maintained memory that knows what belongs in *this* trade's context. Managed memory is a service judgment, not a feature: Cowork doesn't persist memory between sessions and leaves the owner to author and maintain context files ([prompt-guide.com](https://prompt-guide.com/en/blog/comment-donner-memoire-claude-cowork); [ryanandmattdatascience.com](https://ryanandmattdatascience.com/claude-cowork-projects/), accessed 2026-06-06).

**The strongest external evidence that the moat holds is Anthropic's own behavior.** In March 2026 they launched a Claude Marketplace and took **no commission**, and on 2026-06-03 they announced a **three-tiered services partner track** with referral credits and deal protection, having certified 10,000+ consultants from 40,000+ applicant firms ([techzine.eu](https://www.techzine.eu/news/applications/139359/anthropic-launches-claude-powered-app-marketplace-without-taking-a-cut/); [channeldive.com](https://www.channeldive.com/news/anthropic-claude-partner-program-services-track/821936/), accessed 2026-06-06). Anthropic is *recruiting* the services layer to partners, not building it. We are the kind of partner that thesis requires — just pointed at local businesses and verticals instead of the enterprise.

---

## (b) The moat that doesn't

We are equally clear about what we cannot defend, because an investor trusts the founder who names the soft spots.

**Generic agentic workflow does not hold.** The horizontal back-office skills — invoice chasing, lead triage, content drafting — are converging. Theirs and ours do the same job. We will not build a business on owning generic workflow; we treat it as table stakes that ride the engine.

**Generic memory primitive does not hold.** Anthropic will ship better memory infrastructure than us, repeatedly. Our defensible position is the *managed* judgment on top of the primitive, not the primitive. If we ever find ourselves defending "our memory store is better," we've lost the plot.

**Integration count does not hold.** Their connector breadth already exceeds ours and the gap may widen. Competing on number of connectors is a losing race against a platform company. Our position is configured-for-you + compliance-gated integration, not most-integrations.

The discipline is to never spend a dollar or a sentence defending the (b) list. Every defensive dollar goes to the (a) list.

---

## (c) Twelve months of moves that widen the holdable moat

Sequenced so each one deepens vertical + service + compliance — the three that hold — and none of them is a feature Anthropic would ship horizontally. (Detail and scope in `PRODUCT_MOVES.md`.)

1. **Counsel-reviewed compliance corpora across all ten verticals** (in motion; real estate live). Turns the widest gap into a moat with a legal signature on it.
2. **Compliance-as-a-service with insurance backing** — agentplain takes named liability for the compliance scan output. This is the single move Anthropic structurally cannot match, and it converts compliance from a feature into a product with a risk-transfer business model underneath.
3. **Per-vertical Plaino persona** — distinct voice + knowledge per trade, so the realtor's partner and the CPA's partner are recognizably different. Vertical depth a horizontal product can't carry.
4. **Done-for-you onboarding** — humans configure the workspace; the customer never sees a wizard. This is the literal inverse of SBM's self-serve install, and it's our pricing-power story.
5. **Customer-handoff intelligence** — codified escalation: what goes to a human, when, why. The judgment layer of the service, which is exactly what the operator plane monetizes.
6. **Per-customer voice fine-tuning on their own approval history** — the longer a customer stays, the more the fleet sounds like them. Compounding switching cost a fresh plugin install can't replicate.

The strategic logic across all six: **move up the stack from "we run Claude for you" to "we carry your compliance liability and sound like you," because that is the part of the value chain Anthropic has told the market it wants partners to own.**

---

## The risk section, written the way it should be in the data room

> **#1 platform risk: supplier-as-competitor (Anthropic).** Our core engine vendor ships an adjacent product (Claude for Small Business, 2026-05-13) and could deepen it. *Mitigation:* (1) we build on, not against, Anthropic — if the engine improves, our service improves; (2) our defensible value is the service, compliance, and vertical layers Anthropic has publicly chosen to route to partners (services track, 2026-06-03; marketplace, 2026-03), not the model; (3) our architecture is engine-portable by design (`project_living_portable_architecture`) — every model call sits behind an abstraction, so a future shift in supplier economics doesn't break the customer-facing service; (4) the 12-month roadmap moves us into compliance-liability and per-customer adaptation, which raise switching costs and sit outside a horizontal platform's business.

The shape of the story: the supplier didn't enter our market — they enlarged it, validated the category, and told the market the service layer belongs to partners. We're the partner built for the segment they reach least well: time-poor, compliance-bound local businesses who want the outcome and not the operating manual.
