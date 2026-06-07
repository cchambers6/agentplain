# Product spec — building the claims-to-cash wedge

**Date:** 2026-06-06
**Depends on:** `WEDGE.md` (the wedge = supplement & claims-documentation depth, roofing
first). Read that first.

Every skill/agent below is **draft-and-advise only**, per
`~/memory/project_no_outbound_architecture.md`. Every provider SDK lives behind an
adapter in `lib/<domain>/`, per `~/memory/feedback_no_silent_vendor_lock.md` and the
two-implementation rule in `~/memory/feedback_runner_portability.md`. Every agent reads
durable state on each fire — provider session memory is performance, never correctness
(`~/memory/feedback_cold_start_safe_agents.md`).

---

## Current state (what exists, cited)

| Piece | Status | Citation |
| --- | --- | --- |
| Supplement agent (vertical card) | `rooting` — "comes online once Symbility or Xactimate adjuster scopes are connected" | `lib/verticals/home-services/content.ts:67-73` |
| Estimate-Followup skill | `live` (JSON-stub FSM today) | `lib/skills/home-services-estimate-followup/types.ts`; `content.ts:54-65` |
| Estimate agent | `rooting` — needs EagleView/AccuLynx/Hover | `content.ts:46-52` |
| `EstimateLookup` provider port | exists (FSM SDKs stay behind it) | `home-services-estimate-followup/types.ts:62-66` |
| Sentinel home-services compliance corpus | DRAFT, not firing; covers FTC/Magnuson-Moss/lien/cooling-off | `outputs/counsel-handoff-packets/home-services.md`; `~/memory/project_compliance_corpus_lives_in_sentinel.md` |
| FSM / roofing-CRM / Xactimate / EagleView / CompanyCam connectors | **none shipped** — all `planned` Q4 2026 | `lib/integrations/marketplace.ts` (no such `status:'available'` entries); `content.ts:298-315` |

So: the *names* exist, the *ports* partly exist, the *integrations the wedge depends on
do not*. This spec is the build that turns `rooting` into `live`.

---

## Build sequence — value × effort

Ordered so each slice ships value without blocking on the next. Effort is relative
(S/M/L), not a calendar estimate (`~/memory/feedback_no_guesses_no_estimates.md`).

### Slice 1 — Supplement skill on an upload seam (highest value, lowest dependency)

**The insight that unblocks everything:** the Supplement agent is blocked on "connect
Xactimate/Symbility," but a contractor can **export the adjuster scope as a PDF/ESX from
day one**. We do not need a live Xactimate API to deliver the wedge — we need to read the
scope the contractor already has in hand. This is the same move that made Estimate-Followup
`live` on a JSON stub before any FSM shipped.

- **Name:** `home-services-supplement` skill → `lib/skills/home-services-supplement/`
- **Owner:** new skill, bound to the existing **Supplement** agent card
  (`content.ts:67`), flipping it from `rooting` to `live` on the upload seam.
- **Inputs (READ):** an uploaded adjuster scope (Xactimate PDF/ESX export, or Symbility
  PDF) + the contractor's own estimate/measurement + photos from Drive/OneDrive (already
  `available` connectors).
- **Output (DRAFT):** a line-by-line supplement: each missed/underpriced line item, the
  evidence citation (code section, measurement, photo ref), and the re-price to the
  carrier's price list. Drafted for owner sign-off; the owner's system sends to the
  carrier. **Every line cites its source — never invent scope** (mirrors the existing
  augment claim, `content.ts:292`).
- **Adapter:** `ScopeReader` port (parse Xactimate PDF/ESX vs. Symbility PDF as two
  implementations — satisfies the two-implementation rule on day one).
- **Value-loop demo:** *"Adjuster scoped your hail job at $9,400. Upload the PDF.
  agentplain reads it against your EagleView measurement and your photos, finds 11 missed
  or underpriced line items — drip edge, ice-and-water per code, detach-and-reset gutters,
  steep-pitch and two-story access — and drafts a $6,800 supplement with the code cite and
  photo reference on every line. You review it, sign it, and send it from your own email.
  That's $6,800 the carrier owed you that you would have left on the table."*
- **Effort:** M. The hard part is the ESX/PDF parser and the price-list re-pricing logic.
  Bounded because the input is a file, not a live integration.

### Slice 2 — Evidence binder (makes supplements approvable)

A supplement gets denied when the evidence is thin. This slice assembles the proof packet.

- **Name:** `home-services-evidence` skill → `lib/skills/home-services-evidence/`
- **Owner:** new skill; supports the Supplement agent (not a separate customer-facing
  card at launch — it's the "how" behind the supplement, per `WEDGE.md` "fold it in").
- **Inputs (READ):** photos (CompanyCam connector — *new*, or Drive/OneDrive folders
  today), measurements (EagleView/Hover — *new*, or uploaded measurement report today),
  the drafted supplement from Slice 1.
- **Output (DRAFT):** an evidence binder per line item — photo + measurement + code cite,
  formatted to the carrier's submission expectations. Drafted; owner attaches and sends.
- **Adapter:** `PhotoSource` port (CompanyCam vs. Drive-folder) and `MeasurementSource`
  port (EagleView vs. uploaded report).
- **Value-loop demo:** *"Every line in your supplement now carries its proof: the photo
  of the drip edge, the EagleView pitch measurement, the IRC code section. The adjuster
  has nothing to push back on."*
- **Effort:** M (S if launched on Drive-folder + uploaded-report sources before the
  CompanyCam/EagleView connectors land).

### Slice 3 — Compliance-documentation pack (the moat layer)

Turns the wedge from "supplement writer" into "claims-to-cash workspace." Leans on work
already partly done.

- **Name:** extend Sentinel's home-services corpus + a `home-services-docs` drafting skill.
- **Owner:** Sentinel for the scan (`lib/agents/sentinel/corpus/home-services/`, per
  `~/memory/project_compliance_corpus_lives_in_sentinel.md` — extend in place, do not
  create `lib/verticals/.../compliance/`); new drafting skill for the document templates.
- **Inputs (READ):** the signed contract, the supplement, state + trade.
- **Output (DRAFT):** state-specific lien waiver, certificate of completion, EPA RRP
  record, Magnuson-Moss-compliant warranty language. Sentinel flags deceptive-advertising
  / warranty-designation issues in homeowner-facing copy
  (`outputs/counsel-handoff-packets/home-services.md` — 22 candidate triggers already
  drafted, awaiting counsel red-line).
- **Gate:** Sentinel does NOT fire on this vertical until counsel signs off and the
  `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` env go-live gate flips
  (`~/memory/project_compliance_corpus_lives_in_sentinel.md`). Drafting can ship before
  the *firing* gate; the scan stays dark until reviewed.
- **Value-loop demo:** *"Job's done. agentplain drafts your Georgia lien waiver, the cert
  of completion, and the EPA RRP record — and flags that your 'lifetime warranty' line
  needs a Magnuson-Moss 'limited warranty' designation before it goes on the invoice."*
- **Effort:** M. Corpus scaffolding exists; the work is templates + counsel loop.

### Slice 4 — Carrier-aware supplement cadence (retention layer)

Supplements get approved, partially approved, or denied — then re-submitted. This tracks
the back-and-forth so nothing dies in the adjuster's inbox.

- **Name:** `home-services-supplement-cadence` skill (pattern-mirrors the existing
  Estimate-Followup cadence engine — reuse `stageFor` / threshold design from
  `home-services-estimate-followup/types.ts:139-148`).
- **Owner:** Supplement agent.
- **Inputs (READ):** supplement status (submitted / partial / approved / denied), days
  since submission, carrier.
- **Output (DRAFT):** the right-stage adjuster follow-up draft, or a re-submission packet
  for a denied line, or an owner handoff for a stalled claim. Owner's system sends.
- **Value-loop demo:** *"Three supplements have been sitting with adjusters for 12+ days.
  agentplain drafts the follow-up for each, and for the one that came back partial, drafts
  the re-submission on the two denied lines with stronger photo evidence."*
- **Effort:** S — reuses the cadence/stage machinery already built and tested.

### Slice 5 — Live integrations (deepens, doesn't gate)

Now wire the real connectors so uploads become automatic. Sequenced by how much they
amplify the wedge, not by trade coverage.

| Integration | New MCP/adapter | Why this order | Effort |
| --- | --- | --- | --- |
| **CompanyCam** | `PhotoSource` impl | Photos are the #1 supplement evidence; highest amplification | M |
| **EagleView / Hover** | `MeasurementSource` impl | Measurement is the #2 evidence + powers Estimate agent | M |
| **Xactimate / Symbility live** | `ScopeReader` live impl (replaces upload) | Removes the only manual step in Slice 1 | L (Verisk API access is the gating unknown — see `ARCHITECTURE_QUESTIONS.md`) |
| **AccuLynx / JobNimbus / Roofr** | `EstimateLookup` + project ports | Roofing-CRM is where the claim record already lives | L |
| **ServiceTitan / Jobber / Housecall Pro** | `EstimateLookup` impl | Broadens beyond roofing into restoration/HVAC storm work | L |

Each is a new adapter behind an existing port — no scattered direct calls
(`~/memory/feedback_no_silent_vendor_lock.md`). None of them gate Slices 1–4: the wedge
ships on the upload seam first, integrations make it frictionless second.

---

## What we explicitly do NOT build

- **No outbound dialer / auto-text / voice-AI** — forbidden surface
  (`~/memory/project_no_outbound_architecture.md`); also the lost battle per `WEDGE.md`.
- **No COI / ACORD-25 carrier-liaison product yet** — different ICP, parked per `WEDGE.md`
  and `~/memory/feedback_no_new_verticals_finish_locked.md`.
- **No replacement of Xactimate/Symbility** — we read their output, we don't re-build
  estimating.

---

## Sequencing summary

1. **Slice 1 (Supplement on upload seam)** — flips the highest-ROI agent to `live` with
   zero integration dependency. Ship first.
2. **Slice 2 (Evidence binder, Drive-folder source)** — makes Slice 1's supplements win.
3. **Slice 4 (Supplement cadence)** — cheapest, reuses existing machinery, drives
   retention.
4. **Slice 3 (Compliance docs)** — moat layer; drafting ships, firing waits on counsel.
5. **Slice 5 (Live integrations)** — CompanyCam → EagleView → Xactimate → CRMs → FSM.

The first three slices are the minimum viable wedge and depend on **zero new
integrations** — only the file-upload seam plus connectors already shipped.
