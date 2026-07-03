# L1 — weekly Fable journey-mapper prompt

Model: **claude-fable-5** (Opus acceptable fallback). Cadence: Sundays, once per
vertical × persona. Parameterized by `{VERTICAL}` and `{PERSONA_SLUG}` (take
persona list from last week's maps; on first run for a vertical, derive personas
from real signal only and mark unproven ones `TODO: real signal needed`).
Internal doc — model names allowed; output must never be pasted to customer
surfaces without a voice-gate pass.

---

You are mapping the full customer journey for agentplain's `{VERTICAL}`
vertical, persona `{PERSONA_SLUG}`. agentplain is a service layer on top of
Claude for Small Business — a service partnership, never a competitor. Plaino
is the named service partner the customer experiences. Your output is the
ground truth a nightly heartbeat and human sessions will build against for a
week, so a wrong "delivering: yes" is worse than a missed want.

## Method

1. **Read before writing.** Last week's map for this vertical×persona (if any)
   — keep micro-moment and want ids stable; ids are how downstream layers track
   progress week over week. Then the real-signal sources:
   - `docs/reviews/` and `docs/retros/` (audits, kaizens) — the gap inventory
   - the vertical registry and skills under `lib/verticals/{VERTICAL}/` and
     `lib/agents/` — what actually exists
   - connector/marketplace registry + dispatch routes — what "connect X" really does
   - `lib/billing/facts.ts`, trial policy, guarantee docs — what we promised
   - `docs/customer-success/`, support handler surfaces — what customers hit post-sale
   - memory pointers passed in by the runner
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
   run. `not-in-scope` is for wants that violate ratified architecture (e.g.
   outbound sending from our runtime) — say which rule. When the LLM key being
   paused would change the experience, verdict against the degraded experience
   too: degraded mode is a live experience, not an edge case.
6. **Cluster.** Tag wants you have seen (this run or in sibling maps) in other
   verticals with a `cluster:` slug and set `universal: true` at ≥3 verticals.

## Output

Exactly one file per persona:
`docs/journeys/{RUN_DATE}/{VERTICAL}--{PERSONA_SLUG}.md`, following
`docs/loop/templates/journey.md`, with the machine yaml block conforming to
`journey` in `memory/data/loop/schema.yaml` (schema_version 1). The yaml block
is the contract; make the prose agree with it.

Do not propose fixes, costs, or priorities — that is L2's job. Do not soften
verdicts to be polite. Expected volume: 25–60 wants per persona; if you are
under 20, you are skipping micro-moments; if over 80, your moments are too
granular to action.
