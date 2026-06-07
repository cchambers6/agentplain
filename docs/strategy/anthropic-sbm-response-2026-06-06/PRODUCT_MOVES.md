# Product Moves — doubling down on the moat that holds

**Compiled 2026-06-06.** Six concrete product moves over the next twelve months. Every one deepens the part of the moat the parity matrix says holds — vertical depth, done-for-you service, compliance liability — and none of them is a feature Anthropic would plausibly ship horizontally. Each move states: what it is, why it widens the wedge Anthropic can't easily close, scope (small / medium / large), and prerequisite work.

The selection rule: **we spend zero on the (b) moat** (generic workflow, generic memory primitive, integration count — see `INVESTOR_NARRATIVE.md`). Every move below is on the (a) list.

---

## Move 1 — Counsel-reviewed compliance corpora, all ten verticals

**What it is.** Extend the per-vertical compliance corpus in `lib/agents/sentinel/` from today's real-estate-live state to all ten active verticals, each reviewed and signed off by counsel before the `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` gate lets it fire. Mortgage and insurance are already tightened to counsel-handoff-ready (`project_compliance_corpus_lives_in_sentinel`).

**Why it widens the wedge.** Claude SBM ships no industry compliance layer at all ([digitalapplied.com](https://www.digitalapplied.com/blog/claude-for-small-business-quickbooks-hubspot), accessed 2026-06-06). A horizontal platform won't take on fair-housing / RESPA / SEC-Marketing-Rule / GLBA review for ten trades — it's not their business model. Each vertical we close turns the matrix's widest gap into a moat with a legal signature on it.

**Scope.** Large (per-vertical corpus authoring + counsel review is the gating cost, not the code; the scanner seam exists).

**Prerequisite.** Counsel engaged and returning per-vertical sign-offs; the `loadCorpusFor` + scanner + counsel-packet plumbing already exists — extend in place, do not re-architect.

---

## Move 2 — Compliance-as-a-service with insurance backing

**What it is.** agentplain takes named liability for the output of the compliance scan, backed by legal review + an insurance policy. If the sentinel passes a draft and it turns out to be a violation, that's on us, not the customer. This converts compliance from a feature into a product with risk-transfer economics underneath.

**Why it widens the wedge.** This is the single move Anthropic structurally cannot match. A model vendor selling to millions of businesses cannot underwrite per-customer regulatory liability — the exposure model doesn't work at platform scale. For us, scoped to ten verticals with counsel-reviewed corpora, it's an insurable, priceable product. It also re-frames the entire pitch: not "AI that helps you stay compliant" but "we stand behind it."

**Scope.** Large (legal structure + underwriting + actuarial pricing + a claims process — this is a business-model build, not just a code build).

**Prerequisite.** Move 1 substantially complete (you can't insure an unreviewed corpus); counsel + an insurance partner; a clean audit log of every scan decision (the audit-log immutability hardening in `project_production_growth_plan` is a dependency — you must be able to prove what the scan saw and decided).

---

## Move 3 — Per-vertical Plaino persona

**What it is.** One named partner, Plaino, stays constant (`project_plaino_named_agent`), but the conversational voice + domain knowledge specializes per vertical: the realtor's Plaino leads with MLS/showing/fair-housing fluency, the CPA's Plaino with filing-window/IRS fluency. Driven off the existing marketing + support prompt builders (`lib/plaino/marketing-prompt.ts`, `support-prompt.ts`) plus a per-vertical knowledge layer.

**Why it widens the wedge.** SBM is horizontal — a realtor and a CPA get the same product ([digitalapplied.com](https://www.digitalapplied.com/blog/claude-for-small-business-quickbooks-hubspot), accessed 2026-06-06). A recognizably different partner per trade is vertical depth a horizontal product can't carry without becoming ten products. It also makes the "this was built for *my* business" feeling concrete on first contact.

**Scope.** Medium (prompt builders already take vertical context; the work is authoring the per-vertical knowledge + voice layer and wiring it through both surfaces).

**Prerequisite.** Per-vertical JTBD + knowledge content (partly exists in `lib/verticals/`); voice calibration against the locked heritage tone so personas differ by *knowledge*, not by drifting off-brand.

---

## Move 4 — Done-for-you onboarding (no wizard)

**What it is.** An agentplain human configures the workspace — connects the integrations, sets the vertical, seeds the memory, turns on the right skills — before the customer's first login. The customer never sees a setup wizard; they see a workspace already working.

**Why it widens the wedge.** This is the literal inverse of SBM's model, where the owner installs the plugin, picks connectors, and authors their own context ([anthropic.com](https://www.anthropic.com/news/claude-for-small-business), accessed 2026-06-06). Self-serve configuration is the friction we remove and they don't. It's also our pricing-power story: you're paying for never having to do the setup, and the bundled fee is justified the moment the customer skips the wizard.

**Scope.** Medium (the operator plane to configure a workspace on a customer's behalf largely exists at `/operator/workspaces/[id]`; the work is an onboarding runbook + the human-process design + a clean handoff state).

**Prerequisite.** Operator workspace deep-dive (exists); a documented onboarding runbook per vertical; the seed-test-workspace seam as a starting point for provisioning.

---

## Move 5 — Customer-handoff intelligence

**What it is.** Codify escalation as a first-class product surface: what the fleet routes to a human operator, when, and why — with the reasoning visible. Builds on the existing fire-gate and support draft-into-review paths (`gateSkillFire`, `SUPPORT_HANDLER_REPLY_DRAFT`) and the operator review queue.

**Why it widens the wedge.** SBM's escalation story is "you approve or you don't" — the human in the loop is the *customer*. Our differentiator is a second human: an agentplain operator who catches the thing the customer would miss. Codifying *what to escalate, when, why* is the judgment layer of the service, and it's exactly what the multi-tenant operator plane monetizes. Anthropic won't build escalation-to-a-competitor's-operator.

**Scope.** Medium (the review-queue plumbing and fire-gate exist; the work is the escalation policy engine + the why-surfaced reasoning + operator-facing triage UX).

**Prerequisite.** Operator plane + review queue (exist); a taxonomy of escalation triggers per vertical (partly implied by the compliance corpora — a sentinel flag is one escalation trigger).

---

## Move 6 — Per-customer voice fine-tuning on approval history

**What it is.** The longer a customer uses agentplain, the more the fleet's drafts sound like them — learned from their own edits and approvals. Built on the existing approval history + the preference/memory layer (`lib/plaino/preference-memory.ts`, `lib/plaino/memory/`), kept cold-start-safe (`feedback_cold_start_safe_agents`) so the learned voice is durable state, never session memory.

**Why it widens the wedge.** This is compounding switching cost. A fresh SBM plugin install starts from zero every time; an agentplain workspace that's learned a customer's voice over a year is a sunk asset they'd lose by leaving. It also makes the drafts *better the longer you stay*, which is the opposite of commodity. Anthropic could build per-account adaptation, but the asset accrues to *our* relationship, not to the engine.

**Scope.** Large (learning loop from approval edits → durable voice profile → applied at draft time, with guardrails so it adapts to the customer without drifting off the locked brand constraints on Plaino's own voice).

**Prerequisite.** Approval-history capture (exists); preference-memory seam (exists); a clean separation between *Plaino's brand voice* (locked) and *the customer's drafted-output voice* (learned) so the two never bleed.

---

## Sequencing and the one-line logic

| Move | Scope | Depends on |
|---|---|---|
| 1. Compliance corpora ×10 | Large | counsel returning |
| 2. Compliance-as-a-service + insurance | Large | Move 1 + audit-log immutability + insurer |
| 3. Per-vertical Plaino persona | Medium | per-vertical knowledge content |
| 4. Done-for-you onboarding | Medium | operator plane (exists) |
| 5. Customer-handoff intelligence | Medium | operator plane + review queue (exist) |
| 6. Per-customer voice fine-tuning | Large | approval history + preference memory (exist) |

**Fastest to ship for immediate differentiation:** Moves 4 and 5 (operator plane already exists — these are process + UX, not new primitives). **Highest moat-per-dollar:** Move 2 (the one thing a platform structurally cannot match). **Already in motion:** Move 1.

The through-line: every move pushes us from *"we run Claude for you"* up to *"we carry your compliance liability and sound like you"* — the part of the value chain Anthropic's own marketplace + services-track strategy says it wants partners to own ([channeldive.com](https://www.channeldive.com/news/anthropic-claude-partner-program-services-track/821936/), accessed 2026-06-06).
