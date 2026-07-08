---
name: truth-wave-check
description: Verify every capability, number, and state claim traces to a real artifact before it ships — and never cite a source that doesn't exist. Use when writing marketing copy, capability claims, pricing, SLAs, counts, internal plans, or skills like this one. Cut, rewrite to what's true today, or mark todo-real-signal; flag ghost sources instead of citing them.
---

# Truth Wave — no fabrication, no ghost citations

Every claim traces to a shipped code path, a real metric, or a signed policy — or it doesn't ship. The rule cuts both directions: don't *make* unbacked claims, and don't *cite* unbacked sources.

## Procedure

1. For **every** capability/number/state claim, find the backing artifact. Exists → cite it (PR#/path). Doesn't → cut, rewrite to today's truth, or mark `todo-real-signal`.
2. **No aspirational present tense.** "Connects to X" only if the connector dispatches — "available ⇒ a working route." The live-claimable integration story is a whitelist (email + calendar + QuickBooks + DocuSign + Drive); CRM/PMS names are *targeting signals*, never claims.
3. **State claims true now:** "read-access only by design" — not implied write. Degraded mode (paused prod key) is a live experience; claims must hold under it.
4. **Capability claims must be funded.** "Respond within 24 hours" presupposes an on-call rotation that KILL #7 explicitly doesn't fund — soften to defensible ("as quickly as possible after confirmed detection") or fund it ([[kill-list-discipline]]).
5. **Ghost-source check, before citing:** does the file/memory/audit you're about to cite exist? The kaizen sweep found 7 of 10 retros briefed on memories that didn't exist (engineering: 6 of 7), and a brief asserting a "50+ detector insight library" that was 7 families and no library. The correct move, demonstrated by those retros: work from artifacts that exist and file a "does not exist" caveat in the header.

## Rules

- **No guesses, no estimates — cite or tag.** "About 5 connectors" is fabrication; "5 connectors with dispatch routes: [list]" is fact. Unanchored numbers get `[ESTIMATE]`+anchor or `[UNKNOWN]`+what-would-verify.
- **Subagent reports are claims-to-verify** before they become facts downstream ([[report-back]], [[push-verification]]).
- **Wired, not just built:** code that exists but has no caller doesn't back a claim ([[wired-not-just-built]] — never publish a saved-time number while the writers are unwired; "a wrong number on the proof shelf is worse than an empty shelf").
- **Applies to skills and plans too** — every skill in this catalog carries an Origin citation; a skill with no traceable origin is a fabricated skill.

## Example invocation

> **Input:** "Vet the /security page before it ships."
>
> **Output shape:** claim table — architecture-grounded claims kept with code refs (AES-256-GCM, RLS, OAuth scope minimization) · "within 24 hours" → softened (unfunded) · personal name → "founding team" · counts checked against shipped routes — plus the scrub diff and the gate runs ([[voice-gate-check]], [[model-vendor-invisible]]).

## Compose with

[[wired-not-just-built]] · [[kill-list-discipline]] · [[voice-gate-check]] · [[model-vendor-invisible]] · [[report-back]]

## Origin

Truth Wave PR #290 (~120 claims fixed) · trial-policy PR #262 · "available ⇒ route" `project_connector_dispatch_routes_2026_06_15` · claims whitelist: `docs/sales/deep-dive-2026-07-02/01-named-icp-per-vertical.md` · SLA softening: `docs/copy-rulings/2026-07-03/security-page.md` · ghost sources: `docs/kaizen/2026-07-02/MASTER-IMPROVEMENT-PLAN.md` F6 · `feedback_no_guesses_no_estimates`.
