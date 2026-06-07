# The Competitive Landscape Map
**agentplain · 2026-06-06**

_Live web research, June 2026. Player placements derive from the per-vertical and horizon deep-dives in this directory; sources are cited there._

---

## The two axes that actually matter

After mapping ~55 products across 10 verticals + 4 horizons, two axes explain almost all of the strategic separation:

- **X — Breadth:** Horizontal / generic ←——→ Vertical-deep (industry compliance + workflow)
- **Y — Execution posture:** Autonomous auto-execute (sends/dials/wires/books on its own) ←——→ Human-approval / no-outbound (drafts, the human sends)

A third axis — **DIY toolkit vs. done-for-you service** — is the one the platform giants can't easily cross, and is treated as a secondary lens below.

```
                        HUMAN-APPROVAL / NO-OUTBOUND (draft, human sends)
                                          ▲
                                          │
   Fyxer (draft-only inbox)              │   ★ AGENTPLAIN ★
   Claude for Small Business ────────────│   (vertical + approve-gate + done-for-you)
   (approve-before-send, generic)        │   Roots/Bevaya (insurance, approve-gate, enterprise)
   ChatGPT/Claude direct                 │   Capacity (mortgage, parallel-to-LOS)
   Pipedrive AI (suggests)               │   Rilla (home svc coaching, read-only)
                                         │   FinMate AI (RIA notetaker)
   HORIZONTAL / GENERIC ◀────────────────┼────────────────▶ VERTICAL-DEEP
                                         │
   Lindy / Zapier Agents / Relevance AI  │   Lofty · BoldTrail · Ylopo · Sierra (real estate)
   11x (auto-SDR)                        │   Jump · Zocks (RIA)          Harvey · Eve (law)
   Apollo (auto-sequences)               │   EliseAI · Entrata (prop mgmt)
   HubSpot Breeze / Agentforce (agents)  │   Avoca · ServiceTitan · Sameday (home svc)
   Google Gemini / MS Copilot agents     │   Qualia · HomeLight EVA · Propy (title)
                                         │   Black Ore · Canopy (CPA)  Paradox · Sense (recruiting)
                                          ▼
                        AUTONOMOUS AUTO-EXECUTE (sends/dials/wires/books on its own)
```

**The headline geography:** the entire *funded, vertical-deep* population sits in the **bottom-right** (auto-execute + vertical). agentplain occupies the **top-right** — vertical-deep *and* human-approval — a quadrant that is **nearly empty in 8 of 10 verticals.** The only neighbors are Roots/Bevaya (insurance, but enterprise/up-market), Capacity (mortgage), Rilla (home services, read-only coaching), and FinMate (RIA notetaker). None of them combine our breadth + price + service.

The danger is the **top-left**: generic, approve-gated platforms (Claude for Small Business, Fyxer, ChatGPT/Claude direct) drifting *rightward* by adding shallow vertical templates. That is the encroachment vector, not the vertical incumbents drifting up.

---

## Secondary lens — DIY vs. done-for-you

| | **DIY / build-it-yourself** | **Done-for-you service** |
|---|---|---|
| **Horizontal** | Lindy, Zapier Agents, Relevance AI, n8n, Claude SMB, Gemini, Copilot | _(largely empty — SeekOut "Spot" is a managed service but enterprise)_ |
| **Vertical** | Most CRM-native AI; Qualia; configurable AMS/PM AI | **★ agentplain (Plaino)**, Paradox (managed onboarding), Avoca (managed) |

agentplain is one of the very few **vertical + done-for-you** offerings priced for a 1–99-seat local business. The platform giants are all **horizontal + DIY** — which is precisely why a non-technical, compliance-exposed owner is underserved by them, and precisely the gap that closes if Anthropic/Microsoft add a partner channel.

---

## Horizon 1 — Vertical incumbents (the bottom-right cluster)

| Vertical | Top credible AI-ops players | Dominant posture | Threat to agentplain |
|---|---|---|---|
| Real estate | BoldTrail/kvCORE, Lofty, Ylopo, Sierra, Structurely | Auto-text/dial leads in <60s | **High** — speed-to-lead is the buying metric |
| Mortgage | Blend (Autopilot MCP), Tavant, Maxwell, Capacity, TrustEngine | Auto borrower comms / origination automation | **Med-High** — incumbents own the LOS rails |
| Insurance | Roots/Bevaya, Liberate, Insurvoice, Applied (Indio/Tarmika) | Autonomous voice + back-office execution | **High** — Bevaya architecturally near, but up-market |
| CPA | Black Ore, Canopy, TaxDome AI, Karbon AI, Anchor | ">98% touchless" prep; auto-bill/move money | **High** — most contested vertical studied |
| RIA | Jump, Zocks, Zeplyn, FinMate | Auto follow-up + CRM update, moving to auto-send | **High** — Jump/Zocks own category + capital |
| Law | Clio Duo, Lawmatics, Eve, CoCounsel, Harvey | Ops (Clio) vs. legal-reasoning (Harvey/CoCounsel) | **High on ops** (Clio gravity), Low on reasoning |
| Recruiting | Paradox, Sense, hireEZ, SeekOut, Juicebox | Auto-source + auto-contact candidates | **High** — most auto-contact-native vertical |
| Home services | Avoca, ServiceTitan, Sameday, Hatch, Rilla | Answer the phone + book the job | **High** — worst-fit; we structurally can't |
| Property mgmt | EliseAI, Entrata ELI+, AppFolio Realm-X, Stan AI | Auto-respond to tenants 24/7 | **High** — opposite-posture, well-funded |
| Title & escrow | Qualia Clear, HomeLight EVA, Propy, alanna.ai | Autonomously wire funds / escrow-officer agents | **High** — strongest agentic competition of any vertical |

**Cross-vertical pattern:** in *every* vertical, the flagship buying criterion is an *outbound action agentplain refuses to take.* Our win condition is to move the buying criterion from "does the AI act for me?" to "can I trust what the AI does, and does it know my industry's rules?" — a re-education sale, hardest in home-services/recruiting, easiest in title/RIA/insurance where the liability of the autonomous action is most visible.

## Horizon 2 — Horizontal SMB agent platforms (bottom-left)

11x, Lindy, Relevance AI, Fyxer, Onyx, Cognosys, Zapier Agents, Make+AI, n8n. **Build-it-yourself canvases.** A semi-technical owner could stitch Fyxer ($30/mo, draft-only) + a Lindy/Zapier agent for under $100/mo and get a real slice of value — a genuine competitive *floor*. None carry a vertical compliance corpus; the capable ones auto-execute by default. **Threat: Medium-High** via "good-enough perception" + superior distribution, lowest against the non-technical compliance-exposed owner. Full analysis: `HORIZONTAL_AGENTS.md`.

## Horizon 3 — CRM-native AI (the "good enough" gravity)

HubSpot Breeze, Salesforce Agentforce, Pipedrive AI, Close, Attio, Apollo. The owner **already pays for the CRM**, so bundled AI carries zero new vendor/contract — the strongest structural pull in the landscape. It is genuinely good enough for generic in-CRM drafting/summarizing/scoring. The gap is *only* visible on vertical compliance, cross-tool reach (it only sees the CRM), and send-control (Breeze/Agentforce/Apollo auto-fire). **Threat: High.** Full analysis: `CRM_AI_THREATS.md`.

## Horizon 4 — Platform adjacents (the encroachment vector)

Generic ChatGPT/Claude, **Anthropic's Claude for Small Business**, Google Workspace+Gemini, Microsoft 365 Copilot. These sit top-left but are drifting right. The decisive event: **Claude for Small Business (2026-05-13)** — agentic workflows + connectors + approve-before-send, free to Claude subscribers, from agentplain's own supplier. **Threat: High / strategic.** Full analysis: `ADJACENT_PLATFORM_THREATS.md`.

---

## Where this leaves agentplain

agentplain owns a real, mostly-uncontested quadrant — **vertical-deep + human-approval + done-for-you, priced for the local business.** The position is defensible on *compliance depth × service*, not on the approval gate (now commoditized) or connectors (we're behind). The strategic question the rest of these documents answer: how do we widen the compliance-and-service moat faster than the top-left platforms add vertical templates and a partner channel?
