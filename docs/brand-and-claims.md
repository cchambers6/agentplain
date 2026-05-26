# agentplain — Brand & Claims Spec

**Canonical, in-repo source of truth.** This doc exists so any task — copywriting, visual design, marketing build, sales collateral — can read agentplain's brand meaning, positioning, visual system, mission, pricing, and claims-vs-reality discipline natively from the repo. The orchestrator memory at `~/.claude/projects/C--agentplain/memory/` is authoritative for *active* work in flight; this doc is the public-to-the-fleet flat copy.

> If anything here conflicts with `MEMORY.md` in the orchestrator memory, the orchestrator memory wins for active builds — but file a follow-up to bring this doc back into sync.

---

## 1. Brand meaning (load-bearing)

**agentplain = "agent + the PLAINS."** Open prairie. Heartland. Where things take root.

This is not airplane wordplay. The brand is rooted in the geography of local America — small towns, county seats, family businesses, the working land where ordinary people run their lives and livelihoods. Our agents are the work that gets done quietly, reliably, in the background, while the people we serve do the work they're actually good at.

The tagline **"Intelligence rooted in reality"** is the literal metaphor: AI planted in real local-business soil — actual inboxes, actual contracts, actual customer files — not floating in cloud-tech abstraction.

### Banned

- Airplane / flight wordplay (takeoff, runway, altitude, ascend, cleared-for-landing, etc.)
- Sleek coastal-SaaS aesthetics (gradient meshes, neon glow, glass-morphism, "OS"-style chrome)
- Cloud / scale / deploy language as primary metaphor
- Sleek geometric or robotic-letterform marks
- SMB / "knowledge worker" framing — we serve **local businesses**

### Acceptable imagery

- Plains, horizon, big sky
- Wheat, grain silos, lone tree, soil + roots
- Sunrise / dawn light
- Working-land textures (paper, cream, earth)
- Gate-and-signature motif for "nothing leaves without your approval"

---

## 2. Visual system

Editorial, not technological. Tactile, not chromed.

### Primary palette

| Role | Color | Hex | Use |
| --- | --- | --- | --- |
| Primary | Forest green | `#1F3D2E` | Logo, links, footer, body emphasis |
| CTA accent | Clay / terracotta | `#B85540` | CTA buttons only — never decorative |
| Surface | Warm cream paper | `#FBF7F0` | Page backgrounds |
| Support | Wheat | `#C9A961` | Editorial highlights |
| Support | Soil | `#5B4636` | Heavy editorial accents |

### Typography

- **Display + headings:** Fraunces (serif). Fallback: Georgia.
- **Body:** System sans (humanist preferred). Fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif.
- Editorial rhythm: generous leading, long measure on body, italic Fraunces for pull-quotes and section subtitles.

### Diagram language

A shared motif governs every system diagram and explainer visual:

- **Horizon line** — implicit ground, never floating in air.
- **Roots** — the system is planted in real customer data (files, CRMs, inboxes).
- **Dawn / sunrise** — the loop runs while the operator sleeps; work is ready at start of day.
- **Gate-and-signature** — every outbound action passes through a human approval gate. Never animate work past the gate without a signature.

---

## 3. Positioning — service partnership, not software

agentplain sells a **service partnership**, not a self-serve software product.

> **We run it for you.** Managed AI ops. Your AI ops team.

This is the load-bearing differentiator versus Anthropic's Claude for Small Business (the DIY tool — free or near-free with a Claude license, requires the customer to be AI-fluent). agentplain installs, runs, customizes, monitors, escalates, and reports. The customer doesn't need to learn anything to get the value loop running. They keep doing relationship work; we run the operational tail.

### Banned framings

- "Self-serve AI platform"
- "DIY agentic workflows"
- "Try our tool"
- "Build your own agent"
- "Configure your AI in minutes"

### Acceptable framings

- "We run it for you."
- "Managed AI ops for local businesses."
- "Your AI ops team."
- "Installed, monitored, customized — by us, for you."
- "You approve everything. We handle the rest."

---

## 4. Mission (verbatim)

> "People get to do more relationship building and more of the work they enjoy, while outsourcing the work that takes their time and money that they can't and don't want to do."

This is the verbatim mission. Do not paraphrase, condense, or reorder. Adjacent short forms in active use:

- **Public mission (locked in `MEMORY.md`):** "We lift up local businesses by doing the work that takes their time and money away from the people they serve."
- **Vision:** "Local businesses can thrive through access to affordable, best-in-class tools and services."
- **Tagline:** "Intelligence rooted in reality."

---

## 5. The nine questions

Every customer-facing surface — homepage, vertical landing pages, sales decks, one-pagers, demo scripts — must answer these in order. **Story-arc rule:** what-is-this → is-this-for-me → how-does-it-work → why-believe → pricing → vision → CTA. Filler that doesn't earn its place gets cut.

1. **Why exist?** — local businesses are drowning in operational tail; relationship work is the asset.
2. **What is agentplain?** — managed AI ops team, installed and run for you.
3. **What's the app?** *(per vertical)* — the specific agents that ship today for this vertical.
4. **What makes it unique?** *(per vertical)* — service partnership, vertical-shaped workflows, gates-and-signatures architecture, runs on your real files.
5. **Why is it easy?** *(per vertical)* — we install, we customize, you approve. No AI fluency required.
6. **Why believe?** — proof: live verticals, live integrations, the verified claims table (see §10 + `visuals-claims-verification-2026-05-25.md`).
7. **ROI?** *(per vertical)* — hours back per week, faster response times, fewer compliance misses, no missed follow-ups.
8. **Future of work?** — relationship + judgment moves up; operational tail moves to agents under your sign-off.
9. **Why now?** — model capability + integration MCP standards finally cleared the bar; the work is ready.

### All-ten-verticals rule

Every marketing surface page 1 must show **all 10 locked verticals** (not just the active sales focus), even when only a subset has live customer logos. We do this so a prospect from any vertical recognizes themselves and self-selects.

Locked verticals: real estate, cpa, law, ria, insurance, mortgage, home services, recruiting, property management, title & escrow. Plus the **general / on-ramp** crew (inbox triage, follow-up chaser, process-doc drafter, chief-of-staff scheduler) that ships across all verticals.

---

## 6. Replace / Integrate / Augment

Customer messaging frames three relationships to the customer's existing stack. Use this language verbatim when describing what we touch.

| Stance | What it means | Realtor example |
| --- | --- | --- |
| **INTEGRATE** | Their tool stays. We feed it and read it. | CRM, lead gen tools, email, transaction-management tools |
| **REPLACE** | Their tool / manual process goes away. | Listing copy writing, marketing builds, compliance review, manual chasing of contractors / lenders / clients |
| **AUGMENT** | Every existing process gets a "can AI make this better?" default question. | Showing scheduling, weekly status reporting, recruiting candidate updates |

Apply per vertical. Default question on every workflow: "Can AI make this better?"

---

## 7. Pricing

Three customer-facing tiers under a single service-partnership lock, plus a `/custom` path for bespoke capability builds.

| Tier | Price | What's included |
| --- | --- | --- |
| **Regular** | $99–$199 per seat / month | Full agent suite for the vertical, onboarding bundled, monthly check-in, standard integration set |
| **Partner** | $199–$299 per seat / month | Everything in Regular + 4 hours / month of named service-partner time (Plaino), priority response, monthly working session |
| **Max** | Ad-hoc, quote-based | Higher service intensity, custom integrations, on-call ops, multi-team coordination |

`/custom` — per-scope custom engagements (typical $5K–$15K + $200–$500/mo retainer) for vertical-shaped capability builds outside the standard suite.

### Pre-PMF friction-reduction policy

While we earn first proof:

- **No pilot fees.** The pilot doesn't have a separate price.
- **First month free** on Regular and Partner.
- **Month-to-month.** No annual lock.
- **No seat minimums.**

This is a Conner-set policy. Revisit once we have ≥3 paying customers with retention >90 days.

### Pricing copy bans

- No 3-column "tier comparison feature matrix" pages. The tiers do not differ by feature surface; they differ by service intensity.
- No vertical-to-tier mapping copy ("Realtors should be on Plus, CPAs on Max"). The tier is a service-intensity decision, not a vertical decision.

The internal `Plus` and `Max` Stripe tiers exist in `lib/pricing/tiers.ts` but Max is quote-only and the comparison surface presents the three customer-facing tiers above. See `lib/pricing/tiers.ts:29-42` for `SELF_SERVE_TIERS` enforcement.

---

## 8. Plaino — the named service partner

One named character across every workspace: **Plaino.** Replaces the earlier "name pool" approach (each customer gets a different agent persona). Plaino is consistent, calm, heritage-voiced — not chirpy or tech-startup-bright.

- Source of truth: `lib/onboarding/service-partner.ts` → `PLAINO_PARTNER`.
- UI: `PlainoAvatar` component.
- Voice: warm, plainspoken, unhurried. Heritage tone — closer to a county-extension agent or a long-tenured operations manager than a chatbot.

---

## 9. Brand-locked text

These strings are locked. No paraphrasing in copy without ratification.

- **Tagline:** "Intelligence rooted in reality."
- **Mission (public):** "We lift up local businesses by doing the work that takes their time and money away from the people they serve."
- **Vision:** "Local businesses can thrive through access to affordable, best-in-class tools and services."
- **Audience term:** "local businesses" — never "SMB," never "knowledge workers," never "small and mid-market businesses."
- **Service framing:** "We run it for you" / "Managed AI ops" / "Your AI ops team."
- **Differentiation framing vs Claude for Small Business:** "Claude for Small Business is the tool. agentplain is the team that runs it."

---

## 10. Claims-vs-reality discipline

**Standing rule:** marketing and sales copy may not claim a capability that isn't TRUE in the verified code table. HALF claims may be referenced with the gating condition stated alongside. NOT-YET claims may only appear as roadmap (clearly labeled).

The verified table lives at **[`docs/visuals-claims-verification-2026-05-25.md`](./visuals-claims-verification-2026-05-25.md)**. Re-run the verification before any major marketing launch.

Current snapshot (2026-05-25):

| Capability | Verdict | Gating |
| --- | --- | --- |
| Continuous loop (Inngest crons) | TRUE | — |
| Five-phase value loop (read → categorize → coordinate → schedule → draft) | TRUE | — |
| Nothing auto-sends; approval queue is unconditional | TRUE | — |
| Preference-learning loop | TRUE | — |
| Per-customer file ingestion + retrieval | HALF | Google OAuth client ID/secret + `ENCRYPTION_KEY` (Drive ingestion) |
| MCP-first connectors with OAuth gate | TRUE | — |
| Compliance sentinel — realty/HUD literal-match scope | TRUE | — |
| 10 verticals live (≥1 agent each) + general on-ramp | TRUE | — |
| Billing mechanics (add-payment / change-plan / cancel / portal) | HALF | Live Stripe keys + run `scripts/stripe/setup-products.ts --live` once |
| Observability (Sentry + cron watchdog) | HALF | `SENTRY_DSN` env in Production |

### Standing gates (Conner-side config, not code)

1. **Google OAuth + `ENCRYPTION_KEY`** — turns the loop onto real customer Drive data; also unlocks customer-files retrieval beyond fixtures.
2. **Live Stripe** (`sk_live_*` + webhook secret + live catalog provisioning) — turns billing from code-complete to live charging.
3. **Sentry DSN** — turns observability from no-op to live error + cron health capture.

None of the three require code changes. They are operator-side environment configuration in Production. Mention them honestly in claims-vs-reality copy; do not pretend they're already live.

---

## 11. How to use this doc

- **Marketing tasks:** treat §§1, 3, 5, 6, 7, 9, 10 as binding. Never write copy that violates a "banned" rule.
- **Design tasks:** §§1, 2 are binding; §3 governs service framing in any UI surface.
- **Sales tasks:** §§3, 5, 6, 7 are the pitch backbone. §10 is the proof posture.
- **Engineering tasks** building customer-facing surfaces: §10 governs what you may *say* the system does. Never put a capability claim in copy that isn't TRUE in `docs/visuals-claims-verification-*.md`.
- **Any task that needs the *full* canonical positioning context** (including the 9 questions in their authoritative form): cross-reference `~/.claude/projects/C--agentplain/memory/project_agentplain_mission_and_positioning.md` from orchestrator memory. This doc is the in-repo flat copy of the binding rules; the orchestrator memory is the live source of truth for ratified updates.
