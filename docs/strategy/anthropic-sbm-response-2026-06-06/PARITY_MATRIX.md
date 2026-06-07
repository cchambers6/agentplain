# Feature Parity Matrix — agentplain vs. Claude for Small Business

**Compiled 2026-06-06.** Every factual claim about Claude for Small Business ("Claude SBM") below cites a source URL with the access date. Per the no-guesses rule, nothing here is asserted from training data — Claude SBM launched 2026-05-13, after the model's knowledge cutoff, so all of it is web-researched or verified against the installed `small-business:*` plugin in our own environment.

## Sources (all accessed 2026-06-06)

- [Introducing Claude for Small Business — Anthropic](https://www.anthropic.com/news/claude-for-small-business) — official launch page ("ANT-OFFICIAL")
- [Claude for Small Business: QuickBooks, HubSpot, Square — DigitalApplied](https://www.digitalapplied.com/blog/claude-for-small-business-quickbooks-hubspot) — deep-dive on connectors + the 15 skills ("DA")
- [Claude for Small Business — wotai.co](https://wotai.co/blog/claude-for-small-business) — plugin/Cowork delivery
- [How to Give Claude Cowork Memory — prompt-guide.com](https://prompt-guide.com/en/blog/comment-donner-memoire-claude-cowork) and [Claude Cowork Projects — ryanandmattdatascience.com](https://ryanandmattdatascience.com/claude-cowork-projects/) — Cowork memory model ("MEM")
- [Anthropic launches Claude Marketplace — Techzine](https://www.techzine.eu/news/applications/139359/anthropic-launches-claude-powered-app-marketplace-without-taking-a-cut/) and [SiliconANGLE](https://siliconangle.com/2026/03/06/anthropic-launches-claude-marketplace-third-party-cloud-services/) ("MKT")
- [Anthropic adds services track, partner hub — Channel Dive](https://www.channeldive.com/news/anthropic-claude-partner-program-services-track/821936/) ("SVC")
- **Primary artifact:** the `small-business:*` plugin is installed in our own build environment; its skill surface (`cash-flow-snapshot`, `invoice-chase`, `month-end-prep`, `tax-season-organizer`, `lead-triage`, `customer-pulse`, `content-strategy`, `job-post-builder`, `contract-review`, `ticket-deflector`, `business-pulse`, `margin-analyzer`, `crm-maintenance`, `smb-onboard`, `run-campaign`, `plan-payroll`, `close-month`, `monday-brief`, `friday-brief`, `tax-prep`, `price-check`, `handle-complaint`, `quarterly-review`, `customer-pulse-check`) was read directly from the session skill registry, not inferred ("PLUGIN").

## What Claude SBM actually is (so the matrix is honest)

Per ANT-OFFICIAL + wotai + DA: Claude SBM is **a plugin you install from `claude.com/plugins/small-business` and toggle on inside Claude Cowork** (the desktop app). It bundles **15 ready-to-run agentic workflows and ~15–25 skills** across finance, operations, sales, marketing, HR, and customer service, plus native connectors to QuickBooks, PayPal, HubSpot, Canva, Docusign, Google Workspace, Microsoft 365, Slack, Square, and Stripe. There is **no separate fee** — it runs on an existing Claude plan (Pro $20/mo, Max $100–200/mo, Team Standard $25/seat/mo, 5-seat min); the connected SaaS subscriptions are billed separately (ANT-OFFICIAL, DA, accessed 2026-06-06).

This is a genuinely strong product. It is also, structurally, a **self-serve toolkit**: the owner installs it, connects their own tools, picks the job, authors their own context, and runs it. That structural fact — not any deficiency in the model — is the entire wedge. The matrix is organized so that distinction stays visible.

---

## The matrix

Legend for "Who wins": **SBM** / **agentplain** / **Tie** / **Depends**. "Wins" means *better outcome for a non-technical local-business owner who does not have an engineer*, which is our buyer — not "more capable in absolute terms."

### 1. Integrations (Gmail / QuickBooks / HubSpot / M365)

| | Detail |
|---|---|
| **They ship** | Native connectors to QuickBooks, PayPal, HubSpot ("first CRM connector for Claude"), Canva, Docusign, Google Workspace (Gmail, Calendar, Drive, Docs, Sheets), Microsoft 365 (Outlook, Calendar, OneDrive, Word, Excel), Slack, Square, Stripe, Webflow. OAuth scopes are the permission boundary: "If an employee can't see something in QuickBooks or Drive today, they can't see it through Claude." (ANT-OFFICIAL, DA, accessed 2026-06-06) |
| **We ship** | Connectors to email/calendar/CRM/docs per vertical, behind the adapter layer (`lib/integrations/`, MCP smoke-verified waves 2–3, PRs #143/#148). Our integration *count* is smaller and growing; their breadth is wider today. |
| **Customer experiences** | SBM: the owner clicks Connect, picks the job, and runs it — but *they* decide which connector, which job, which scopes. agentplain: a human configures the connections during done-for-you onboarding; the customer never picks a connector. |
| **Who wins** | **SBM on raw breadth and self-serve speed.** This is their strongest category and we should say so. Our counter is not connector count — it's that connection is configured *for* the customer, and that the connected work is gated through approval + a per-vertical compliance scan they don't have to think about. **Honest call: SBM today.** |

### 2. Memory management

| | Detail |
|---|---|
| **They ship** | Claude Cowork **does not retain memory between sessions**; persistent context is achieved by the user authoring `CLAUDE.md` / context files (bio, brand voice, working style) that Claude reads at session start, and/or by using Projects (released March 2026) for project-scoped persistent memory + instructions. The owner writes and maintains these files. (MEM, accessed 2026-06-06) |
| **We ship** | Managed memory as a *service*: `lib/plaino/memory/` (prisma-backed store, extract-from-conversation, migration) plus the orchestrator memory discipline we run on ourselves. We curate, prune, and version what goes in. The customer never writes a `CLAUDE.md`. |
| **Customer experiences** | SBM: a blank `CLAUDE.md` and the burden of knowing what to put in it, what to keep, and what's gone stale — exactly the work most owners don't know how to do. agentplain: memory is run for them; it stays current because maintaining it is our job, not theirs. |
| **Who wins** | **agentplain — decisively, and durably.** Anthropic can ship a better memory *primitive* (and will). They cannot ship the *judgment* of what belongs in a real-estate broker's memory vs. a CPA's, kept fresh as the business changes. This is pillar 2 of the wrapper thesis and it holds. **agentplain.** |

### 3. Skill library

| | Detail |
|---|---|
| **They ship** | ~15–25 horizontal skills, verified against the installed PLUGIN: `cash-flow-snapshot`, `invoice-chase`, `month-end-prep`, `tax-season-organizer`, `lead-triage`, `customer-pulse`, `content-strategy`, `job-post-builder`, `contract-review`, `ticket-deflector`, `business-pulse`, `margin-analyzer`, `crm-maintenance`, `smb-onboard`, `run-campaign`, `plan-payroll`, `close-month`, `monday-brief`, `friday-brief`, `tax-prep`, etc. All **horizontal** — finance/ops/sales/marketing/HR/CS, not industry-specific. (PLUGIN + DA, accessed 2026-06-06) |
| **We ship** | A per-vertical fleet: office-admin (`lib/skills/office-admin/`), realty agent suite (listing-coordinator, buyer-inquiry-router, showing-scheduler, compliance-sentinel, crm-hygiene, production-reporter, recruiter-assistant), plus the horizontal back-office work. Built on the same Claude skills primitive, but pre-wired and vertical-shaped. |
| **Customer experiences** | SBM: a strong generic library the owner browses and assembles. agentplain: the right skills for *their* trade are already on, on day one, with no assembly. |
| **Who wins** | **Tie on horizontal back-office** (their `invoice-chase` and ours do the same job — and note our `small-business:*` names mirror theirs; the primitive is shared). **agentplain on vertical depth.** The horizontal layer is commoditizing fast; do not defend it. Defend the vertical fleet. **Depends — Tie horizontal, agentplain vertical.** |

### 4. Agent specialization

| | Detail |
|---|---|
| **They ship** | Generic agentic workflows that chain skills; human-in-the-loop by default, "approve the plan first or let it run end-to-end," with the option to "graduate to autonomous execution." (ANT-OFFICIAL, DA, accessed 2026-06-06) Specialization is by skill selection, not by role. |
| **We ship** | Named, role-shaped agents per vertical with durable cold-start-safe state (`feedback_cold_start_safe_agents`), cron-fired, coordinated through the dispatcher — and one named partner, Plaino, across every surface. |
| **Customer experiences** | SBM: a tool you direct task by task. agentplain: a partner that runs standing responsibilities and brings you a short list of decisions. |
| **Who wins** | **agentplain on the partner model;** SBM on flexibility for a hands-on owner who *wants* to direct it. Our buyer explicitly does not want to direct it. **agentplain (for our ICP).** |

### 5. Compliance depth

| | Detail |
|---|---|
| **They ship** | **No compliance-specific features** documented. Approval gating + OAuth permission inheritance are the safety story; there is no per-industry regulatory corpus (fair housing, RESPA, TCPA, SEC Marketing Rule, GLBA). (DA "What it does NOT do," accessed 2026-06-06) |
| **We ship** | Per-vertical counsel-reviewed compliance corpora in `lib/agents/sentinel/` with a `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` go-live gate; the sentinel scans drafts *before* a human ever approves them. Nothing leaves without passing both the scan and a human. |
| **Customer experiences** | SBM: the owner is responsible for catching a fair-housing or RESPA violation in a draft before they send it. agentplain: the draft that would have been a fileable violation is caught as a draft. |
| **Who wins** | **agentplain — the widest, most defensible gap in the matrix.** This requires years of per-vertical corpus work + counsel sign-off + (next move) liability backing. Anthropic builds horizontal infrastructure; per-vertical regulatory liability is structurally not their business. **agentplain, durably.** |

### 6. Approval workflow

| | Detail |
|---|---|
| **They ship** | Human-in-the-loop per workflow, graduating to autonomous execution; nothing sends/pays/modifies without confirmation. (ANT-OFFICIAL, DA, accessed 2026-06-06) |
| **We ship** | Draft-and-propose only, no-outbound architecture (`project_no_outbound_architecture`): the fleet never sends, never moves money, never commits; the customer's connected systems execute on an approved draft. Plus the fire-gate (`gateSkillFire`) enforcing pause/schedule windows per caller (PR #147). |
| **Customer experiences** | Functionally similar at the "approve before send" moment. The difference: SBM lets you *turn approval off* and go autonomous; we structurally cannot auto-execute, which we frame as a feature (the compliance scan + human are always in the path). |
| **Who wins** | **Tie on the mechanism.** Our no-outbound stance is a deliberate trust posture, not a capability gap; with the compliance scan in front of it, it's a stronger *guarantee*. **Tie, edge to agentplain on guarantee.** |

### 7. Multi-tenant operator

| | Detail |
|---|---|
| **They ship** | **No multi-tenant operator model** documented. SBM is per-account inside one business's Cowork; team tooling is whatever Google/M365 already provide. (DA "What it does NOT do," accessed 2026-06-06) |
| **We ship** | A full operator plane: `/operator/workspaces/[id]` deep-dive, `/operator/leads`, `/operator/fleet`, per-workspace budget seam (`lib/billing/budget.ts`), tier override, audit. We run *many* customer workspaces from one console — the thing that makes done-for-you economically possible. |
| **Customer experiences** | SBM: each business is on its own. agentplain: a human operator can watch, tune, and intervene across the whole book of customers. |
| **Who wins** | **agentplain — and this is the moat under the service model.** Without it, done-for-you doesn't scale. Anthropic has no reason to build a competitor-to-its-own-customers operator console. **agentplain.** |

### 8. Vertical-specific knowledge

| | Detail |
|---|---|
| **They ship** | **No vertical specialization** (healthcare, legal, real estate variants not shipped). Horizontal across all SMBs. (DA, accessed 2026-06-06) |
| **We ship** | 10 active verticals with JTBD tables, vertical content, vertical compliance corpora, and (next move) per-vertical Plaino persona. The whole company is organized around verticals. |
| **Customer experiences** | SBM: a realtor and a CPA get the same product. agentplain: a realtor gets MLS/fair-housing-aware work; a CPA gets filing-window-aware work. |
| **Who wins** | **agentplain.** Anthropic's distribution logic is horizontal-first; verticalization is precisely the layer they leave to partners (see SVC). **agentplain, durably.** |

### 9. Pricing model

| | Detail |
|---|---|
| **They ship** | $0 incremental for the plugin; rides Claude Pro $20/mo or Max $100–200/mo or Team $25/seat/mo (5-seat min). Connected SaaS billed separately; example solo all-in ~$72/mo. The owner also absorbs the *configuration cost* in their own time. (ANT-OFFICIAL, DA, accessed 2026-06-06) |
| **We ship** | One productized Regular tier, per-seat $199→$99 sliding by team size, 14-day free trial, plus Custom engagements for bespoke/100+ seats (`project_stripe_both_surfaces`). Bundled — the model tokens, the configuration, the memory upkeep, and the human service are inside the fee. |
| **Customer experiences** | SBM looks cheaper on the sticker. The honest comparison is *sticker + the owner's configuration-and-upkeep hours* vs. our all-in done-for-you fee. For an owner whose time is the scarce input, the bundled fee is the lower total cost. |
| **Who wins** | **SBM on headline price; agentplain on total cost of ownership for a time-poor owner.** Never argue the sticker — argue TCO and the value of never touching a setup wizard. **Depends — be honest that they're cheaper on paper.** |

---

## Scorecard

| Category | Who wins |
|---|---|
| Integrations breadth | **SBM (today)** |
| Memory management | **agentplain** |
| Skill library (horizontal) | Tie |
| Skill library (vertical) | **agentplain** |
| Agent specialization | **agentplain** (for our ICP) |
| Compliance depth | **agentplain (widest gap)** |
| Approval workflow | Tie (edge agentplain) |
| Multi-tenant operator | **agentplain** |
| Vertical knowledge | **agentplain** |
| Pricing (sticker) | **SBM** |
| Pricing (TCO, time-poor owner) | **agentplain** |

## The one-paragraph read

Claude SBM wins on connector breadth and headline price — say so plainly; pretending otherwise gets us caught. We win on everything that is *service*, not *software*: managed memory, vertical-shaped skills, counsel-reviewed compliance, the multi-tenant operator plane that makes done-for-you scale, and a true total-cost-of-ownership story for an owner whose time is the scarce resource. The model is the commodity Anthropic sells to everyone; the configured, run-for-you, compliance-backed service is the thing they have explicitly chosen to leave to partners (SVC). That is the wedge, and the matrix says it holds where it's built on years of vertical work and erodes where it's built on generic capability.
