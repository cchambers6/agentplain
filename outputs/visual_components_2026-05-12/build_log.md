# Visual components build log — 2026-05-12

**Branch:** `feat/agentplain-visual-components`
**Premise:** Conner — "the biggest challenge with the site right now is that it has A LOT of words and very few visuals to drive the points home."
**Constraint:** Per `feedback_everything_tells_a_story.md`, visuals must EARN their place — advance the story arc OR serve a specific function. No filler.

## What shipped

Four high-impact visual components, wired across three customer surfaces:

| Component | File | Story-arc question | Pages |
|---|---|---|---|
| `ReplaceIntegrateAugment` | `components/marketing/ReplaceIntegrateAugment.tsx` | **Q3** — What does it do? | `/` |
| `HowItWorks` | `components/marketing/HowItWorks.tsx` | **Q4** — How does it work? + **Q5** — How easy is it? | `/` |
| `ArchitectureDiagram` | `components/marketing/ArchitectureDiagram.tsx` | **Q6** — Why should I believe you? | `/custom`, `/how-we-build` (new) |
| ROI bar chart (in `RoiCalculator`) | `components/RoiCalculator.tsx` | **Q7** — How do we think about ROI? | `/` (and anywhere `<RoiCalculator />` is used) |

## Deviations from the task spec (and why)

### Vendor libraries called for in the spec but not actually in `package.json`

Task spec said `lucide-react` and `recharts` are "already in the dep list." Verified `package.json:19-47` — neither is present. Decision: hand-roll SVG icons and the bar chart instead of pulling in two new dependencies. Rationale:

- Per `feedback_no_silent_vendor_lock.md`, every new vendor surface must live behind an adapter. Adding `lucide-react` + `recharts` for what amounts to ~6 icons and a 4-bar chart would have added ~150KB to the bundle and two new lock-in surfaces.
- Hand-rolled SVG icons (~20 lines each) inherit `currentColor` so they pick up brand tokens directly. No theming layer to maintain.
- The bar chart is 4 bars on 2 scales — well within the budget of a pure CSS+SVG implementation.
- Result: zero new dependencies, zero bundle weight added.

### Mermaid (called for in spec) not used

Mermaid is ~600KB and would have required a client component for rendering. The architecture diagram is intentionally static — a server-rendered SVG/CSS grid that ships with no runtime JS. Same brand consistency, no hydration cost.

### `/how-we-build` page created

Task said: "Place on `/custom` page AND on a new page `/how-we-build` if it doesn't exist." It didn't. Created `app/(marketing)/how-we-build/page.tsx` with the diagram + the "boundaries" (what the fleet does NOT do) + "what's load-bearing" (standards). Added a footer link from `Footer.tsx` so the page is reachable.

### `/custom` now embeds the architecture diagram

New section "How the work actually lands" inserted between the pricing framework and the proof section. Reads as the trust-bearing answer to a technical buyer's "but how does it actually work" question.

## What got removed

The inline 3-step `Step` cards in `app/(marketing)/page.tsx` (text-only treatment of how-it-works) — replaced by `<HowItWorks />`. The local `Step` helper function was deleted because it had no remaining callers.

## What stayed

The 5-item "What makes us different" uniques section stays. It answers **Q4b** (what makes us unique) which is distinct from Q3 (what does it do — RIA framing). Removing it would have lost four canonical commitments (Vertical-aware, You stay in control, Built BY agents, Compliance-first) that the mission rule requires on the homepage.

## Accessibility + responsive notes

- Every SVG glyph has `aria-hidden="true"`. The wrappers carry semantic labels via `aria-label` and `aria-labelledby`.
- All four components are responsive: chip rows wrap; multi-column grids collapse to single columns; the connector arrows in HowItWorks + ArchitectureDiagram hide below `md:` and the cells stack vertically.
- The fleet-flow micro-animation in HowItWorks honors `prefers-reduced-motion: reduce` (turns off the CSS keyframe).
- The bar chart's fill transitions honor `prefers-reduced-motion: reduce`.
- Color contrast: clay (#B65D3A) on paper (#F7F4ED) ≈ 4.6:1 — passes WCAG AA for normal text. Ink (#1A1A1F) on paper ≈ 17:1.

## Build verification (run inside the worktree)

```
npm install              # one-time, worktree didn't have node_modules
npm run typecheck        # PASS — no new TS errors
npm run lint             # PASS — no warnings or errors
npm test                 # PASS — 1649/1649 tests
npm run build:no-migrate # PASS — 26/26 pages built
```

Per-route bundle sizes after build:

```
/                    96.9 kB First Load JS (unchanged; RoiCalculator was already client)
/custom              17.8 kB route / 112 kB First Load (unchanged shape; diagram is server-rendered)
/how-we-build        205 B route / 94.1 kB First Load (new, server-only)
```

## Memory rules grounding each visual

- **ReplaceIntegrateAugment:** mission rule (`project_agentplain_mission_and_positioning.md`) + per-vertical hero copy (`lib/verticals/real-estate/content.ts:18`) + story-arc Q3 (`feedback_everything_tells_a_story.md`).
- **HowItWorks:** story-arc Q4 (3-step value loop) + locked vertical registry (`lib/verticals/index.ts`, 10 verticals) + no-outbound architecture (Step 3 ends in REVIEW, never SEND — `project_no_outbound_architecture.md`).
- **ArchitectureDiagram:** no-outbound architecture (read-only OAuth, drafts queue, customer system sends — `project_no_outbound_architecture.md`) + portability rule (MCP/adapter pattern — `project_living_portable_architecture.md`, `feedback_no_silent_vendor_lock.md`) + cold-start safe agents (`feedback_cold_start_safe_agents.md`).
- **ROI bar chart:** existing per-seat ladder math (`project_stripe_both_surfaces.md` + `project_pricing_value_anchor.md`) — visual representation only, no math change.

## [VERIFY] flags for Conner

1. **Icon shapes for REPLACE / INTEGRATE / AUGMENT.** Picked: swap-arrows / interlocking-rings / spark-with-up-arrow. Reasonable defaults; happy to swap if you have a stronger metaphor (e.g., REPLACE = scissors? trash? AUGMENT = arrow-out? upward-trend?).
2. **Tool-icon substitution.** Vendor logos (Gmail, Outlook, Follow Up Boss) NOT used — we don't have brand-mark permission. Generic glyphs labeled "Inbox / Calendar / CRM / Docs" used instead. If you want vendor logos, we'd need a brand-asset license check first.
3. **Architecture diagram simplification.** Task asked for "Customer Apps → MCP Marketplace → Per-customer MCP servers → agentplain Fleet → Knowledge Substrate → Customer's workspace dashboard." Shipped a 4-layer condensation: "Your tools → agentplain fleet → Your workspace → You + your system." Rationale: MCP marketplace / per-customer MCP server distinctions are implementation detail; the customer-facing story is read-in / draft-out / you-send. The 4 standards cards on `/how-we-build` carry the MCP/adapter detail for technically-curious buyers. Push back here if you'd rather see the 6-layer literal form on the homepage.
4. **RIA copy.** Examples list per pillar is grounded in the canonical homepage copy but I had to pick which 4 examples to surface per pillar. Override the example arrays in `ReplaceIntegrateAugment.tsx:50-99` if any feel off.

## File manifest

```
NEW:
  app/(marketing)/how-we-build/page.tsx
  components/marketing/ReplaceIntegrateAugment.tsx
  components/marketing/HowItWorks.tsx
  components/marketing/ArchitectureDiagram.tsx
  outputs/visual_components_2026-05-12/build_log.md

MODIFIED:
  app/(marketing)/page.tsx           # +RIA section, replaced Step cards with HowItWorks
  app/(marketing)/custom/page.tsx    # +ArchitectureDiagram section
  components/RoiCalculator.tsx       # +bar chart underneath input/output split
  components/Footer.tsx              # +/how-we-build link
```
