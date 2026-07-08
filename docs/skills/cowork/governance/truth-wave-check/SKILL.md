---
name: truth-wave-check
description: Verify every capability, number, and state claim on a surface traces to a real shipped artifact before it ships. Use when writing marketing copy, capability claims, pricing, guarantees, or counts. No guesses, no estimates, no aspirational present tense — cite the artifact or cut the claim.
---

# Truth Wave — no-fabrication check

Every claim traces to a real artifact — a shipped code path, a real metric, a signed policy — or it is cut, rewritten to what's true today, or marked `todo-real-signal`.

## Procedure

1. For **every** capability/number/state claim, find the backing artifact.
2. Artifact exists → cite it (PR # / file path). Doesn't exist → cut, rewrite to reality, or mark `todo-real-signal`.
3. No aspirational present tense: "connects to X" only if the connector actually dispatches. **"Available" implies a working route.**
4. State claims must be true *now* (e.g. "read-access only," not an implied write capability).

## Rules

- **No guesses, no estimates — cite the artifact.** "About 5 connectors" is a fabrication; "5 connectors with dispatch routes: [list]" is a fact.
- **"Available" ⇒ it works.** A tile that renders but can't dispatch is a truth violation.
- **Applies to internal docs too** — a skill, plan, or claim with no traceable origin is fabricated; don't write it.

## Worked example

A truth audit of ~120 site claims (PR #290) fixed each to match shipped reality; the trial-policy pass (PR #262) replaced a vague "free trial" with the real terms. Every skill in this catalog carries a "Seeded by / Origin" citation for the same reason.
