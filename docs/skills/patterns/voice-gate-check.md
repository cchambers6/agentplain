# Pattern: voice-gate compliance check

**Group:** code/process (governance-adjacent) · **Seeded by:** `npm run voice-gate` (the voice gate the loop RUNBOOK and every copy PR run), `docs/brand/voice-guidelines-2026-06-19.md`, `docs/brand/voice-audit-2026-06-19.md`; memory: project_voice_guidelines_de_ai_2026_06_19 ("voice-gate.mjs owns LLM-ese A–D").

## When to use — trigger phrases
- "I changed customer-facing copy" / marketing pages, emails, UI strings
- "run the voice gate before landing"
- any loop pass (step 5 of the track skeleton runs it)

## Inputs
- The changed customer-facing text (marketing surfaces, `docs/marketing/*.md`, UI copy).

## Procedure
1. Run the gate:
   ```bash
   npm run voice-gate
   ```
2. It flags **LLM-ese categories A–D** (the de-AI'd voice rules): hollow intensifiers, "it's not just X, it's Y" constructions, robotic hedging, and the banned-phrase list.
3. Fix flagged lines to match the voice guidelines; re-run until clean.
4. Landing gate: a copy/marketing PR does not merge until voice-gate is green.

## Output
A green voice-gate run; copy that reads human, not model-generated.

## Guardrails
- **Voice-gate is the owner of LLM-ese A–D** — don't hand-wave "it reads fine." Run it.
- **Scope:** it scans marketing surfaces and `docs/marketing/*.md`. It does **not** scan `docs/outreach/*` (memory: project_outreach_kit — "voice-gate does NOT scan docs/outreach"), so outreach copy needs a manual voice read.
- Banned phrases live in the gate config, not in your head — if you think a phrase is fine but the gate flags it, the gate wins.
- Compose with `../governance/model-vendor-invisible` for customer surfaces and `../patterns/truth-wave-no-fabrication` for claims.

## Worked example
The send-path wave (PR #355) and the marketing waves run voice-gate as the landing gate; the loop track skeleton (`docs/loop/prompts/TRACKS.md`) makes `npm run voice-gate` step 5 of every pass before the commit to main.
