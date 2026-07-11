# Fable Leverage Audit — Executive Inventory (2026-07-11)

**Question answered:** across agentplain, flatsbo, and Chiron, where should Fable specifically be spent next — not "what work exists," but "what work is Fable measurably better at than Sonnet 5 or a human."

**Fable's edge, as calibrated here:** 1M-context synthesis across whole codebases + memory, production prompt engineering (real cache prefixes, Zod schemas, error paths), multi-source judgment under contradiction, high-quality prose, and density per file. Anything mechanical — ports, merges, CI wiring, curl loops — is explicitly out (see `06-not-for-fable.md`).

## The top 3 Fable moves, ranked

### 1. Chiron M3 daily-loop prompt suite (fire tomorrow)

- **What:** The morning-brief, debrief-conversation, and Child.model-update-extractor prompts for `chiron/lib/agents/tutor/` — the three prompts every family runs every school day. Includes stable cache prefixes per the M2 pattern (`chiron/lib/ai/cache.ts`), Zod schemas with content-gate coverage, the Haiku-triage-gates-extraction seam (POC plan doc 03/06, PR #380), and mock outputs that pass the same schema+gate as live (the discipline PR #383 established).
- **Why Fable:** This is the "child model compounds" bet — the second-biggest bet in the POC plan, carried by M3+M4 jointly. The extractor must read a messy parent debrief transcript and emit evidence-carrying, non-fabricated `ChildModelUpdate` rows (acceptance criterion 3 is a SQL query over those rows — PR #380). Designing a prompt that reliably distinguishes "Anna invented playful details while narrating" from "parent said the day was fine" is multi-source judgment plus prompt engineering plus voice, simultaneously, with the full CM pack + catalog + M2 integrator in context. Sonnet can wire `run.ts`; it should not author these prompts.
- **Output shape:** `chiron/lib/agents/tutor/prompt.ts`, `schema.ts`, `content-gate` extension, mock fixtures, plus a smoke script mirroring `scripts/m2-smoke.ts`. One PR.
- **Cost estimate:** 1 Fable session, ~3–4 hrs, ~$25–40 inference (labeled estimate; calibration in `05-cost-envelope.md`).
- **Dependencies:** PR #383 (M2) merged, or built on its branch. CM pack (PR #385) loaded as context — do them in the same session window to share the cache.

### 2. agentplain weekly-report narrative writer + pilot-week rehearsal (fire when the first reply lands)

- **What:** Two paired deliverables sharing one context load: (a) the production prompt + golden-example set for the Friday weekly report the unified 14-day plan names as "the partner's daily rhythm and retention heartbeat" (item 2.7, `docs/departments/2026-07-03/COORDINATION/00-UNIFIED-14D-PLAN.md`); (b) a full dry-run rehearsal of partner week 1 against the seeded Peachtree Realty demo workspace (PR #377), producing the P0 list CS's runbook (PR #366) expects.
- **Why Fable:** The weekly report is prose a paying customer reads every Friday — it decides whether the design partner renews attention. It must synthesize approvals, saved-time ledger rows, and workflow fires into a narrative that sounds like a colleague, with the Truth Wave constraint (no fabricated numbers — ledger-only per PR #374). That is exactly Fable's writing + judgment zone. The rehearsal requires holding the CS runbook, the demo seed, the approval spine, and the guarantee-leak interim fixes in one context and spotting the cross-cutting breaks — 1M-context work.
- **Output shape:** report-writer prompt + 3 golden examples + schema; rehearsal transcript + ranked P0 list. One PR each or combined.
- **Cost estimate:** 1 Fable session, ~3 hrs, ~$25–35.
- **Dependencies:** Timing is Phase 2 of the unified plan (Jul 11–17, i.e., now). Gated on a discovery call actually booking; the report-writer half is unconditional and can fire regardless.

### 3. Chiron CM pack extension — Logic + Rhetoric stages

- **What:** Extend `chiron/lib/philosophies/charlotte-mason/` (PR #385) beyond the Grammar stage to Forms III–VI equivalents: lesson-length caps, narration expectations (written narration, exam-style), living-books lists, and weekly rhythms for ages ~9–17, with the same ≥40-citation floor and `pack:verify` gate.
- **Why Fable:** The CM pack proved the shape: verbatim-quote verification against 700–860KB AmblesideOnline volumes (`/cm/volN`), PNEU primary sources, and the interpretation-notes discipline separating Mason's text from modern application. That is contradiction-heavy multi-source judgment over a corpus only a 1M context holds comfortably. PR #385's memory records the load-bearing mechanics (marker regex, VE allowlist `^—$`, URL scheme) — a Fable session copies them instead of re-deriving.
- **Output shape:** new typed modules + citations + regenerated `pack.json`, `pack:verify` green. One PR.
- **Cost estimate:** 1–2 Fable sessions, ~5–7 hrs, ~$50–80 (corpus-heavy input).
- **Dependencies:** PR #385 merged. Ranked third rather than first because the POC family (Anna, 6, grammar stage) doesn't need it yet — but any second design family with an older child immediately does, and it's the highest-value pack work before authoring new philosophies.

## What deliberately did NOT make the top 3

- **flatsbo anything** — legal-predicate-blocked; see `02-flatsbo-fable-queue.md`. Recommendation: Chiron absorbs flatsbo's fleet attention entirely.
- **M2 cache optimization to >90%** — real but small ($/family impact is cents); pair it with move #1 in the same session rather than funding it separately (`03-chiron-fable-queue.md`, item C4).
- **New philosophy packs (Trivium/Memoria/Circe)** — gated on a demand signal; full-fidelity packs cost real sessions and the kill-list discipline (no building ahead of locked demand) applies by analogy.
- **Marketing-site top-to-bottom copy pass** — the design run (PR #379), Truth Wave (PR #290), and de-AI sweep already covered most of it; a full pass before first-partner feedback would optimize against no signal.

## Two-week envelope (detail in 04/05)

~9 Fable sessions, ~28 session-hours, ~$230–340 Fable inference, plus ~6 Sonnet 5 wiring/verification sessions at ~$40–70 total. Recommended mix and the comparison against all-Opus / no-Fable are in `05-cost-envelope.md`.
