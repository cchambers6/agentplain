# Stop list — work to cancel or freeze because it is off the path to profitable

Ordered by how much capacity each frees. "Stop" means cancel or freeze-dormant; none of these
are "never" — each names its restart condition.

## 1. STOP (freeze dormant): the 9-track non-stop loop expansion — `local_fdd1beb2`

**What it is:** expansion of the journey loop (PR #347) to nine continuous tracks running until
`profitable_milestone_reached: true`.

**Why it's off the path:** the milestone is undefined anywhere on disk; the existing 1-track
loop has run one seed pass, its governor has never ticked (`state.yaml` `last_tick_at: null` —
the `agentplain-loop-governor` scheduled task was never created), and zero backlog cards have
converted to merged fixes. Nine tracks of gap *discovery* multiplied against zero gap *closure*
produces documentation, not profit — and after Jul 7 it does so at usage-credit prices. This is
the purest expression of the introspection-over-execution error (03, error 2).

**Restart condition:** (a) `profitable_milestone_reached` defined in `memory/data/loop/
schema.yaml` with a named data source, AND (b) one existing backlog card shipped as a merged
fix. Land the expansion's prompts/schema as dormant capacity in the meantime — the build work
isn't wasted, the *scheduling* is what stops.

## 2. STOP: any new audit / retro / synthesis / deep-dive layer

**What it is:** the pattern of PRs #323–#346 continuing — e.g., a "Pass 2" of the CEO or
Chief-of-Staff docs, a re-audit, another cross-cutting synthesis.

**Why:** the master synthesis (PR #344) already ratified "fixes-only next, no new audit
loops," and three more analysis layers fired anyway. Marginal insight per layer is ~zero
(03, error 1). Land the two in-flight passes (local_745086aa CEO, local_b37ce9e4 CoS) since
they're paid for — then the analysis tap closes.

**Restart condition:** the kaizen first-5 fixes merged, or a planning-cadence trigger fires
(06).

## 3. STOP (re-order): the flatsbo fleet-week from the master synthesis (rows 1–8)

**Why:** contradicts the ratified "agentplain is THE priority" rule; flatsbo is parked behind
entity/license/counsel and recommended waitlist-dark. **Carve-out:** the unauthenticated-PII
endpoints are a live safety exposure — spend one day to gate those endpoints or take the
surface dark. Not a week, and not before the agentplain activation wave.

**Restart condition:** agentplain activation wave merged AND Conner resolves the flatsbo
waitlist-dark decision.

## 4. STOP: journey-loop depth passes on CPA (queued passes 3–4 in `memory/data/loop/state.yaml`)

**Why:** the sales plan closes CPA outreach until 2 RE pilots are live. Deepening CPA journey
maps to depth 2 (including three new personas) builds inventory for a lane that is closed by
policy, while RE — the beachhead — has the shallowest individual-agent map. Coverage passes for
law/PM (pass 2) are cheap and fine; depth belongs on RE only.

**Fix:** re-order the queue — pass 3 keeps the RE depth half, drops the general+CPA depth
halves until the beachhead saturates or CPA reopens.

## 5. STOP: new marketing asset production (ads, creative variants, additional narratives)

**Why:** 51 outbound creative files, 31 claims-grounded outreach files, and 25 ad concepts
already exist against zero sends and a paid-spend gate that is 0/4 conditions met. Asset
production is not marketing's bottleneck — distribution, proof, and measurement are (marketing
deep-dive's own diagnosis). Every additional asset depreciates unused.

**Restart condition:** the paid gate's four conditions met, or a design partner supplies real
proof material to produce against.

## 6. STOP: mobile app track (V2 TestFlight, EAS)

**Why:** blocked on infra, zero customers, no design partner has asked for it, and it serves
no link in the revenue chain. It's been correctly idle — this makes it explicit so no session
picks it back up as "unfinished work."

**Restart condition:** a paying customer or active pilot requests mobile access.

---

## Explicitly NOT on the stop list

- **The 1-track journey loop through Jul 7** — keep it, with the re-ordered queue (item 4).
  Its remaining passes cost ~$0 and law/PM coverage feeds real fix cards. Create the governor
  task or accept it stays manual; either is fine for four days.
- **Librarian roll-ups** — 84 consecutive quiet no-ops looks wasteful, but it is the recovery
  substrate and it's cheap. (A cadence back-off is already a queued Conner contradiction; let
  that process decide.)
- **The Truth Wave discipline** — every stopped item above restarts eventually; the claims
  discipline never pauses.
