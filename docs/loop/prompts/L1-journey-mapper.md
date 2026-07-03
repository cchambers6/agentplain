# L1 — Fable journey-mapper prompt (continuous loop)

Model: **claude-fable-5** while the plan-included window lasts (until
2026-07-07; then on-demand or Opus 4.8 per RUNBOOK § After Jul 7). Cadence:
**continuous** — the L3 governor fires a pass as soon as the previous one
completes; each pass runs L1 then L2 back-to-back for the scope named in its
queue entry. Internal doc — model names allowed; output must never be pasted
to customer surfaces without a voice-gate pass.

## Pass preamble (do this before any mapping)

1. Read `memory/data/loop/state.yaml` (schema v2). Confirm your scope matches
   the queue entry the governor fired you with; you are pass
   `pass_number + 1`.
2. **Address every pending `corrective_nudges` entry** targeting L1 or both —
   these are quality-gate corrections from the previous pass. Apply each one
   throughout your work and set its `status: consumed`.
3. Check your mode:
   - **coverage** — you are mapping new vertical × persona cells. Derive
     personas ONLY from real signal (the vertical's ratified JTBD table in
     `lib/verticals/{VERTICAL}/content.ts`); mark unproven ones
     `TODO: real signal needed`.
   - **depth** — you are deepening existing maps: edit the newest journey
     file in place — add micro-moments, surface new wants, tighten verdicts
     with fresh evidence, re-verdict anything the fleet shipped since the map
     was written. Keep existing ids stable; increment the map's `depth` and
     set `last_deepened_pass`.

---

You are mapping the full customer journey for agentplain's `{VERTICAL}`
vertical, persona `{PERSONA_SLUG}`. agentplain is a service layer on top of
Claude for Small Business — a service partnership, never a competitor. Plaino
is the named service partner the customer experiences. Your output is the
ground truth the loop and human sessions build against until the next pass
deepens it, so a wrong "delivering: yes" is worse than a missed want.

## Method

1. **Read before writing.** The existing map for this vertical×persona (if
   any) — keep micro-moment and want ids stable; ids are how downstream layers
   track progress pass over pass. Then the real-signal sources:
   - `docs/audits/` and `docs/kaizen/` (audits, kaizens) — the gap inventory
   - the vertical registry and skills under `lib/verticals/{VERTICAL}/` and
     `lib/agents/` — what actually exists
   - connector/marketplace registry + dispatch routes — what "connect X" really does
   - `lib/billing/facts.ts`, trial policy, guarantee docs — what we promised
   - `docs/customer-success/`, support handler surfaces — what customers hit post-sale
   - memory pointers passed in by the governor
2. **Walk the stages** in order: awareness → consideration → signup →
   activation → daily-use → expansion → renewal → advocacy. Break each into
   micro-moments (id: `{VERTICAL}.<stage>.<slug>`). A micro-moment is one
   sitting, one screen, or one decision — "gets the Monday summary email", not
   "uses the product".
3. **List every want** at each micro-moment as "As a {PERSONA} at {moment}, I
   want …", in customer vocabulary (Setting up / Working / Watching — never
   engineer labels like cron, webhook, RLS).
4. **Attach signal.** Every want cites ≥1 defensible source: audit finding,
   kaizen, code path, shipped doc, memory slug, or support artifact. If a want
   is obviously real but you cannot cite it, keep it with signal
   `todo-real-signal` — never invent a citation, a customer count, or a quote.
5. **Verdict each want**: `yes` / `partial` / `no` / `not-in-scope`, with
   evidence. `yes` requires a code path or shipped doc you actually opened this
   pass. `not-in-scope` is for wants that violate ratified architecture (e.g.
   outbound sending from our runtime) — say which rule. When the LLM key being
   paused would change the experience, verdict against the degraded experience
   too: degraded mode is a live experience, not an edge case.
6. **Cluster.** Tag wants seen in other verticals' maps with a `cluster:` slug
   and set `universal: true` at ≥3 verticals.

## Output

Coverage mode: one file per persona,
`docs/journeys/{RUN_DATE}/{VERTICAL}--{PERSONA_SLUG}.md`, following
`docs/loop/templates/journey.md`, machine yaml conforming to `journey` in
`memory/data/loop/schema.yaml` (schema_version 2). Depth mode: edit the
newest existing file in place. The yaml block is the contract; make the prose
agree with it.

Do not propose fixes, costs, or priorities — that is L2's job (run it next,
same session, per `docs/loop/prompts/L2-profitability-lens.md`). Do not soften
verdicts to be polite. Expected volume: 25–60 wants per buyer persona (20+
for invited-seat personas whose buying stages belong to someone else); a
depth pass should net ≥5 new or re-verdicted wants or say why saturation was
reached.

## State handoff

L2 (which runs next in this same pass) closes out state.yaml — see its
prompt. Your only state duty is accuracy of the maps it will read; do not
write `pass_records` (the governor gates the pass on its next tick).
