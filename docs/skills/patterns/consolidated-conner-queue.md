# Pattern: consolidated Conner queue

**Group:** orchestration · **Seeded by:** `docs/chief-of-staff/2026-07-02/03-conner-queue-priority.md`, `docs/ceo/2026-07-02/04-open-questions-for-conner.md`, the CoS Pass 1 (PR #352); memory: project_cos_pass1_2026_07_02 ("conner-queue split-brain").

## When to use — trigger phrases
- "what does Conner need to decide" / "build his queue"
- after any lens or head pass that surfaced forced decisions
- "the queue is out of sync" (repo vs memory)

## Inputs
- Every forced decision surfaced by CEO open-questions, CoS priority, and each department head's "one decision."

## Procedure
1. Collect all forced decisions into **one** queue — do not maintain parallel lists.
2. For each item: `{decision, default-if-silent, what-it-blocks, time-to-decide}`.
3. Rank by what-it-blocks (a decision gating the critical path outranks a cosmetic one).
4. Store in the single source of truth (the repo YAML **or** fleet memory — pick one and reconcile the other to it).

## Output
One ranked queue of decisions only Conner can make, each with a safe default and the work it unblocks.

## Guardrails
- **Avoid the split-brain.** The canonical failure (memory: PR #352) was the repo `conner-queue` YAML showing 0 rows while fleet memory held 5 — two truths, no truth. Reconcile to one store, every time.
- **Every item has a default-if-silent** — silence must be safe, or the item is a hard blocker (e.g. `NO_CAP` un-pause was flagged *silence-unsafe*, making it a true blocker, not a default).
- **Separate Conner's queue from the fleet's.** The fleet's backlog is not Conner's queue; his queue is only the decisions the fleet genuinely cannot make.
- Keep it short — a 30-item "queue" is a backlog; a 3–5 item queue is a decision list.

## Worked example
CoS Pass 1 (PR #352) made the five-fix list canonical and named the queue split-brain as the thing to fix; the top item was "revoke the exposed PAT." The coordination pass (PR #368) later reduced two weeks of plans to one queue whose #1 was un-pause ratification — the pattern working end to end.
