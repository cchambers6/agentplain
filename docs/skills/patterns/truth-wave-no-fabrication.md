# Pattern: Truth Wave — no-fabrication check

**Group:** code/process (governance) · **Seeded by:** the Truth Wave (PR #290, ~120 claims fixed) and the trial-policy truth pass (PR #262); memory: project_truth_wave_2026_06_16, feedback_no_guesses_no_estimates.

## When to use — trigger phrases
- "does the site claim something we can't back up"
- writing marketing copy, capability claims, pricing, guarantees, counts
- any doc that asserts a number, a feature, or a state

## Inputs
- The claim-bearing surface or doc.

## Procedure
1. For **every** capability/number/state claim, find the backing artifact: a shipped code path, a real metric, a signed policy. 
2. If the artifact exists → cite it (PR # / file path). If it doesn't → the claim is either cut or rewritten to what's true today, or marked `todo-real-signal`.
3. No aspirational present tense ("Plaino connects to X") unless the connector actually dispatches (memory: project_connector_dispatch_routes — "available ⇒ must have route").

## Output
Copy and docs where every claim traces to a real artifact; no fabricated capabilities, counts, or states.

## Guardrails
- **No guesses, no estimates — cite the artifact** (memory: feedback_no_guesses_no_estimates). "About 5 connectors" is a fabrication; "5 connectors with dispatch routes: [list]" is a fact.
- **"Available" implies a working route.** A connector tile that renders but can't dispatch is a truth violation (memory: audit5 connectors, project_connector_dispatch_routes).
- **State claims must be true now.** Gmail is "read-access only by design" — say that, don't imply write access (memory: project_gmail_connected_truthful_state).
- This constraint applies to **these skill docs too**: every skill here cites the real PR#/path that seeded it. A skill with no traceable origin is a fabricated skill — don't write it.

## Worked example
The Truth Wave (PR #290) audited ~120 site claims and fixed each to match shipped reality; the trial-policy pass (PR #262) set the real policy (7-day trial, 14-day for CPA/law, CC-at-signup, 14-day money-back) instead of a vague "free trial" claim. Every pattern in this catalog carries a **Seeded by** line for the same reason.
