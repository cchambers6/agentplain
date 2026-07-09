---
name: capability-builder
description: Turn a recurring pattern from real work into a reusable, installable skill. Use when you catch yourself or the fleet doing the same non-obvious thing more than twice - "we keep doing X the same way," "make this a skill," "extract this pattern." Scores the candidate against a rubric, walks extraction to a self-contained SKILL.md with an example invocation, and names what NOT to skill-ify.
---

# Capability-builder (the meta-skill)

This skill builds other skills. The gate on everything below: **no fabricated skills** — every skill traces to a real, executed pattern with a citable PR#/file/memory. If you can't cite where it actually ran, you have a candidate, not a skill; write it down as a candidate.

## 1. The rubric — is this pattern worth skill-ifying?

Score each dimension 0–2; **build at ≥6/10 with no zero on Recurrence or Provenance.**

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| **Recurrence** | happened once | 2× or clearly about to recur | ≥3 recorded instances |
| **Formalization delta** | obvious; anyone would do it | saves real re-derivation | its absence caused a recorded, costly failure |
| **Separability** | inseparable from one deliverable | mostly separable | a clean verb-phrase primitive, domain-free |
| **Composability** | standalone | pairs with 1–2 skills | a hub other skills must link to |
| **Stability / provenance** | unstable API or unverifiable | stable but thinly cited | stable mechanics + hard citations |

Calibration from this catalog: *fleet-token-push* scores 10 (every fleet PR; silent-403 incident; clean primitive; hub; verified scripts). *"How we happened to phrase the July 3 sales plan"* scores ~3 — deliverable, not primitive. Borderline calls go in the catalog README as **candidates**, not skills.

## 2. Extraction

Name it as a **verb-phrase capability** ("push from a headless session," "gate on the outcome, not the PR"). Then write down: trigger phrases · inputs · procedure · guardrails **each naming the failure it prevents** · origin citations. Strip the domain: if the text only makes sense for this week's task, you extracted the output — go back.

## 3. The exact SKILL.md format

Directory: `docs/skills-v2/cowork/<domain>/<skill-name>/SKILL.md`, where `<domain>` ∈ `fleet-ops` (build/push/schedule/dispatch mechanics) · `orchestration` (dispatching + coordinating passes) · `governance` (truth/positioning/secrets gates) · `code-hygiene` (PR discipline, migrations, wiring). New domain → propose it in the same PR with a reason.

```md
---
name: <kebab-case, MUST equal the directory name — the resolver matches on it>
description: <one sentence of what it does + the trigger phrases that should invoke it.
  This is the matching surface: vague description = skill never fires. No colons
  in ways that break YAML; quote or rephrase if needed.>
---

# <Human title>

<1–2 sentences: the failure this prevents or the move it makes repeatable.>

## Procedure
<concrete, copy-runnable steps>

## Rules
<each guardrail names the recorded failure it prevents>

## Example invocation
> **Input:** <what a user/orchestrator actually says>
> **Output shape:** <what applying the skill produces — artifacts, checks, report lines>

## Compose with
<[[skill-name]] links — the dependency edges that make skills chain>

## Origin
<the real PR#/file/memory citations — the no-fabrication receipt>
```

Self-containment test: a future session with **no repo and no conversation history** can apply it from this file alone. Embed the procedure; never "see the runbook" without the essential commands inline.

## 4. Catalog + ship

Add a row to `docs/skills-v2/00-README.md` under the domain (name · purpose · seeded-by). Cross-link both directions — a new skill that nothing links to is probably mis-scoped. Gates: voice-gate if customer-facing wording; [[docs-only-pr]]; report back per [[report-back]].

## 5. Anti-patterns — what NOT to skill-ify

- **One-off patches.** A fix that ran once and shouldn't recur (the ApprovalCard dedupe) is a memory entry, not a skill — the *class* ("full build after union rebase") is the skill.
- **Unstable APIs.** Mechanics riding a surface that changes under you (a beta tool's flag names) — write a dated memory; skill-ify when it stabilizes.
- **Deliverables wearing a trench coat.** "Write the 2026-07-03 sales plan" is output; "dispatch a head-of-department pass" is the primitive.
- **Aspirational patterns.** A design that was *planned* but never executed (the once-cited `scripts/mint-fleet-token.mjs` that never existed here) — citing a ghost violates [[truth-wave-check]]. v1 of this catalog caught exactly this and said so; keep saying so.
- **Secrets-bearing runbooks.** A procedure that only works with a credential pasted into it fails [[no-secrets-in-chat]] — parameterize the auth path (mint-on-demand), or don't ship it.
- **Twins.** Check the catalog first; sharpen the existing skill instead of adding a near-duplicate ([[librarian-inbox-rollup]] dedup discipline).

## Worked example 1 — fleet-token-push (the clean case)

**Observed:** every fleet PR June–July 2026 pushed the same non-obvious way — no `gh` auth, so: mint a short-lived App token via the committed credential helper, write it to a `0600` file (never stdout), push `x-access-token` URL with `--force-with-lease`, shred the file. Seen on #295–#306, #344–#369.
**Rubric:** recurrence 2 · delta 2 (the silent-403 false-"pushed" incident) · separability 2 · composability 2 (push-verification, curl-per-pr-merge, isolated-worktree all link it) · stability 2 (scripts verified on disk). **10 → build.**
**Extracted primitive:** "push a branch from a headless/bot session." Guardrails each cite a failure: lease-not-force (concurrent-push clobber), token-never-stdout (transcript burn), junction-first (deleted shared modules).
**Shipped:** `cowork/fleet-ops/fleet-token-push/SKILL.md` + README row + `[[...]]` edges — and a Truth-Wave note that the once-referenced minter script never existed here, so nobody cites the ghost.

## Worked example 2 — no-slash-prefix (the failure-shaped case)

**Observed:** 2026-06-07 — an overnight orchestrator prompt opened with `/goal OVERNIGHT MANDATE…`; the receiving session parsed `/goal` as a slash command, swallowed the body, ran **0 turns** (`local_ba36a9f6`). The same shape bricked sprint resume messages. Conner: "a lot of this didn't fire."
**Rubric:** recurrence 1 (two instances, one mechanism — and every future dispatch is exposed) · delta 2 (whole overnight chain lost) · separability 2 · composability 1 · stability 2 (documented interception behavior + an after-the-fact detection signature). **8 → build.**
**Judgment call the rubric forces:** this is one *rule*, not one *skill* — too small alone, so it ships as the lead rule of [[orchestrator-prompt-hygiene]] alongside its siblings (no-AskUserQuestion, SendUserMessage-first, turn budgets), which share the failure mode "dispatched session produces nothing while looking fine." Bundling by failure mode beats one-rule-one-skill.
**Shipped:** the hygiene skill with the WRONG/RIGHT prompt pair, the 0-turns detection signature, and the resume-message corollary in [[dispatch-amend-in-flight]].

## Example invocation

> **Input:** "Third time this month we've had to explain that a 404 on the private repo means auth, not absence. Make it a skill."
>
> **Output shape:** rubric score (recurrence 2, delta 1, separability 1, composability 2, stability 2 = 8, but separability says it's a *rule* not a skill) → lands as the "404 = auth failure mode" rule inside [[fleet-token-push]] + a README candidates note → report-back cites `feedback_flatsbo_private_use_fleet_token` as origin.

## Compose with

[[truth-wave-check]] (no ghost origins) · [[docs-only-pr]] (the shipping vehicle) · [[librarian-inbox-rollup]] (candidates come from INBOX observations) · [[report-back]]

## Origin

How this catalog was built — v1 (PR #370, 2026-07-08) extracted every skill from cited June–July work; this v2 hardened the rubric and anti-patterns against the same corpus. Mirrors the per-product `*-capability-builder` agents (scout and level up other agents; never do the specialist work themselves).
