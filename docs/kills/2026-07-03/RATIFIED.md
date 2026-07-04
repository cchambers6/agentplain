# Kill List — Ratified 2026-07-03

**Source:** CEO Pass 1 (`docs/ceo/2026-07-02/03-what-CEO-would-cut.md`)  
**Ratified by:** Fleet, delegated by Conner Chambers 2026-07-03  
**Override on record:** KILL #3 (flatsbo waitlist-dark) — OVERRIDDEN by Conner; flatsbo stays live.

---

## KILL #1 — No new audit / retro / deep-dive / planning loops

**Status: RATIFIED**

**What's dead:** No new audit loops, kaizen retros, deep-dive synthesis runs, or planning-cycle documents until the top-20 fix table (from `docs/kaizen/2026-07-02/MASTER-SYNTHESIS.md`) is burned down. The 10-part kaizen series (#334–#343), the product audit series (#323–#330), the CEO/CoS analysis waves (#344–#348), and any lookalike "what would X think" loops are all halted.

**Exception:** Decision-focused CEO/CoS passes that answer a specific Conner-delegated question stay allowed. These must be bounded (single pass, single deliverable) — not recurring loops.

**Restart trigger:** Top-20 fix table from the master synthesis is burned down. Burn-down means: each item shipped and merged, not planned or in-flight. The fleet holds a reference in `docs/kaizen/2026-07-02/MASTER-SYNTHESIS.md`.

**Workstreams affected:**
- Kaizen weekly retro loop (PR #273, `lib/inngest/functions/`) — retro fire is suspended; the wiring stays so it can resume
- CEO pass architecture (`docs/ceo/`) — only one-shot bounded passes allowed
- CoS pass architecture (`docs/cos/`) — same gate

---

## KILL #2 — GTM fronts except Georgia RE closed

**Status: RATIFIED**

**What's dead:** All go-to-market motion for every vertical except Georgia real estate (RE) is closed until 2 RE design partners are live (not in trial — live, weekly-running). This covers: outreach, marketing activation, connector unlocks, and partner onboarding for CPA, law, home services, insurance, mortgage, title, RIA, PM.

**CPA exception (S-effort, one-time, no restart gate):** The TaxDome/Karbon connector tiles remain in scope for a single truth fix — changing the tiles from present-tense connected-and-working claims to honest "coming soon" / "your service partner configures this" copy. This is a compliance obligation, not GTM motion. It does not open CPA outreach.

**Restart trigger:** 2 Georgia RE design partners live and running the realty killer workflow weekly. "Live" = onboarded, workflow firing, at least one real saved-time figure in their workspace. Trial enrollments do not count.

**Workstreams affected:**
- Design-partner outreach packets (PR #293, `wt-dp-outreach/`) — restricted to RE-only sends
- FAQ + marketing copy for non-RE verticals — no new vertical-specific expansion
- Connector unlock roadmap (`docs/integration-roadmap-v2-2026-05-19.md`) — RE connector depth only
- CPA exception scope: `app/(marketing)/` connector tile copy for TaxDome/Karbon (Audit 5, PR #326 findings)

---

## KILL #3 — flatsbo waitlist-dark

**Status: OVERRIDDEN by Conner — flatsbo stays live**

Conner explicitly rejected the waitlist-dark recommendation. flatsbo remains publicly accessible and transactionally armed.

**Exposure tracked (not resolved):**
- "© Flatsbo, Inc." claim is live — no LLC entity formed (`docs/plans/next-5-phases-2026-06-28.md` §flatsbo snapshot)
- "Georgia broker partnership is in place" claim is live — no broker signed
- AI valuation / counter-offer coaching / contract-reading features are publicly accessible — these cross `O.C.G.A. § 43-40` without a licensed broker in the loop
- Buyer loop is dead (passwordless buyers cannot complete a transaction) — revenue hole is passive for now
- Zero ToS / Privacy Policy on site

This exposure is tracked here for accountability. It is not resolved by this decision. Conner owns the go/no-go on legal remediation.

---

## KILL #4 — Client portal as a funded workstream

**Status: RATIFIED**

**What's dead:** The per-customer client portal (`app/(product)/app/workspace/[id]/` portal surfaces, PR #299) is flagged off as a funded workstream. No new portal feature development, no portal bug fixes, no portal promotion in marketing. The code stays in place but is treated as dormant.

**Restart trigger:** First signed design partner explicitly asks for portal access as a condition of their engagement. "Asks for it" means a direct stated request, not an inferred preference. The triggering partner's name and date must be logged before development resumes.

**Workstreams affected:**
- PR #299 (`app/(product)/app/workspace/[id]/` portal views) — dormant, no new work
- Audit 6 findings (PR #327) — the 5 P0/9 P1 portal bugs are parked until restart trigger fires
- Portal test coverage (`tests/customer-workspace-home.test.tsx`) — do not expand; existing tests stay

---

## KILL #5 — No LLM-dependent feature shipping against paused key

**Status: RATIFIED**

**What's dead:** No new customer-facing feature that requires a live `ANTHROPIC_API_KEY` to deliver its first-run value. This covers: new Plaino chat capabilities, draft quality upgrades using Opus, LLM-driven skill classification, new LLM-backed connector routes. The paused key is a given — the build must route around it.

**What's allowed:** Deterministic wiring, activation paths, measurement instrumentation, truth fixes, YAML data layer hydration, ValueSummaryCard, first-fire UX state rewrite (customer-vocab states) — all LLM-free. The 5 firing killer workflows are deterministic and stay in scope.

**Restart trigger:** Conner explicitly restores the production `ANTHROPIC_API_KEY` and authorizes LLM-dependent shipping. The key decision is Conner's alone — the fleet does not propose it.

**Workstreams affected:**
- `lib/plaino/degraded-mode.ts` — degraded mode stays the operating posture
- `lib/llm/anthropic-provider.ts` — do not expand call sites or add new LLM-dependent skill paths
- Conversational Plaino depth features — parked
- Any skill that routes to `provider: 'anthropic-llm'` in `lib/skills/registry.ts` (lines 390, 435, 521, 568) — existing skills stay; new LLM-gated skills are blocked

---

## KILL #6 — Paid media + photography commissions

**Status: HOLD**

**What's dead:** No paid media spend (Google, Meta, LinkedIn, any channel), no photography or video production commissions. The creative assets from PR #263 (`wt-outreach-creative/`) exist and are ready; they are not to be deployed to paid channels until the hold lifts.

**Restart trigger:** First design partner signed (trial→paid conversion, not free trial enrollment). The first paying customer is the minimum signal that the motion is repeatable enough to amplify.

**Workstreams affected:**
- PR #263 outbound creative pack — assets frozen at their current state, not distributed
- Media discipline (`project_media_discipline`) — arm stays dormant
- Paid spend on any channel — $0 until trigger

---

## KILL #7 — No new surface area

**Status: RATIFIED**

**What's dead:** No new verticals, no new connectors beyond the RE activation set and the CPA truth fix (see KILL #2 exception), no voice/Twilio feature expansion, no BYO-storage feature expansion, no seasonal-pause billing module, no new marketing pages for unbuilt features.

**What counts as "new surface area":** Any net-new customer-facing route, connector tile, or skill that isn't already in the locked vertical set (RE, CPA, law, home services, general). Adding depth to existing surfaces (e.g., hardening the realty killer workflow, fixing connector truth copy) is not new surface area.

**Restart trigger:** Profitable milestone ratified (cash breakeven: 3–9 signed paying customers per `project_ceo_pass1_2026_07_02`) **AND** at least one card from the top-20 fix table (KILL #1) shipped. Both conditions must be true simultaneously.

**Workstreams affected:**
- Voice/Twilio layer (PR #304, `lib/voice/`) — stays env-gated at `TWILIO_ENABLED=false`; no new routes
- BYO-storage surface (PR #306, `app/(product)/app/workspace/[id]/settings/data/`) — dormant; no new config paths
- Connector marketplace — no new tiles beyond RE + CPA truth
- New vertical onboarding pages — blocked
- Seasonal-pause billing module — parked

---

## Summary table

| Kill | Status | Restart trigger |
|------|--------|-----------------|
| #1 No new audit/retro loops | RATIFIED | Top-20 fix table burned down |
| #2 GTM except GA RE closed | RATIFIED | 2 RE design partners live |
| #3 flatsbo waitlist-dark | **OVERRIDDEN** — flatsbo stays live | N/A |
| #4 Client portal as funded workstream | RATIFIED | First signed design partner asks for it |
| #5 No LLM-dependent features | RATIFIED | Conner restores production key |
| #6 Paid media + photography | HOLD | First design partner signed (trial→paid) |
| #7 No new surface area | RATIFIED | Profitable milestone + 1 top-20 card shipped |
