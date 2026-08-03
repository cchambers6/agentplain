---
pr-branch: fable/prereview-gate-2026-08-01
reviewed-commit: 18f2369
reviewer: Fable review session 2026-08-02 (task designer; implementation built by a separate Opus 5 session)
date: 2026-08-02
verdict: pass-with-notes
---

# Independent architectural review — fable/prereview-gate-2026-08-01

This is the bootstrap review: the PR that introduces the review gate is itself
gated (it touches `tools/review/**` and `.github/workflows/**`), and the gate
does not exempt itself.

## Independence

- [x] The implementation (`4a4d02b`) was built by a separate Opus 5 session. This
  reviewer wrote the design spec and, after review, a ~40-line amendment
  (`18f2369`, the docs/** content exemption) — see Verdict note 1 for the
  independence boundary that creates.
- [x] Context I did NOT share with the builder: its intermediate reasoning, its
  tool transcript, its smoke-test session state. I reviewed from the committed
  diff and files, not from its report.
- [x] What I read to form this review: the full `tools/review/fable-review-gate.mjs`,
  `.github/workflows/fable-review-gate.yml`, `docs/engineering/pre-merge-review-gate.md`,
  `docs/reviews/TEMPLATE.md`, the test file structure, and `git show --stat` of
  both commits. I re-ran the test suite myself rather than accepting the
  builder's pass count.

## Claim–code trace

| Claim (quote it) | Where it appears | Evidence (file:line or test name) | Holds? |
| --- | --- | --- | --- |
| "32 tests, 32 pass" | builder report | re-ran `node --test` myself: 32/32 at `4a4d02b`, 35/35 at `18f2369` | yes |
| "pure functions exported; all git orchestration behind a main-module guard" | builder report | `fable-review-gate.mjs` — guard at the `invokedDirectly` check above `main()`; imports in the test file execute no git | yes |
| "override short-circuits everything, including git resolution" | code comment | `main()` checks `override` before any git call | yes |
| "no `paths:` filter so green always means the gate ran and decided" | workflow header | `fable-review-gate.yml` `on.pull_request` has no `paths:` key | yes |
| "every git call goes through execFileSync with an argument array and no shell" | file header | grepped: all subprocess calls are execFileSync with argument arrays; no shell-string subprocess call anywhere in the file | yes |
| "smoke-tested 5 orchestration scenarios end-to-end, then reset" | builder report | not re-run from its session; superseded by this reviewer's own end-to-end run of the gate on this branch (see Test blind spots) | partially — re-verified independently |

- [x] Every "already handled by Y" claim was verified by opening Y. (None of that
  claim class appears in this PR.)
- [x] Unverifiable builder claims are noted above and covered by an independent
  re-check.

## Tenancy & isolation

Checked, not applicable in the direct sense: this PR adds CI tooling and
documentation only — no queries, no data paths, no API routes. Indirectly it
STRENGTHENS tenancy: `workspaceId` in added code lines is now a gated content
rule, so future tenancy-touching diffs require this review.

## Deletion & retention completeness

- [x] New persisted things introduced by this PR: none. Review docs under
  `docs/reviews/` are git-tracked engineering artifacts, not customer data, and
  carry no retention obligation.

## Outbound invariant

- [x] Checked, not applicable: no send paths. The workflow runs read-only in CI
  with the default token and posts nothing.

## LLM seam invariants

- [x] Checked, not applicable: `lib/llm/**` untouched; no provider client
  constructed anywhere in this PR. The seam's compose order is now encoded in
  the rubric (TEMPLATE.md, "LLM seam invariants") so every future gated PR
  re-checks it.

## Customer-surface invariants

- [x] No customer surface is touched. Model names (Fable, Opus, Anthropic)
  appear only in internal engineering docs and CI, which is the ratified scope —
  the ban applies to customer surfaces.
- [x] Pricing, brand, and vocabulary surfaces untouched.

## Migration safety

- [x] Destructive operations in this PR: none. No schema, no migrations, no SQL.

## Cold-start safety

- [x] The gate is stateless by construction: every CI run re-derives everything
  from the checkout and git history. No cache, no cross-run state, no ordering
  dependency. Re-runs are idempotent.

## Test blind spots

- [x] What the suite structurally cannot see: the 35 unit tests cover only the
  pure logic (globbing, parsing, classification, section checks). The git
  orchestration — ancestry verification, the base-reachability check on
  `reviewed-commit`, the staleness walk, first-parent merge diffing — runs only
  under the main guard and is untested by `node --test`. GitHub-side behavior
  (the `labeled`/`unlabeled` re-trigger, the label-based override expression,
  `fetch-depth: 0` sufficiency) cannot be exercised outside a real PR.
- [x] What I checked manually instead: traced every orchestration code path in
  `validateReviewDoc()`/`main()` line by line; then ran the gate end-to-end on
  this branch (`REVIEW_GATE_BASE=origin/main npm run review-gate`) — it
  correctly classified the PR as gated (path rules: `.github/workflows/**`,
  `tools/review/**`) and, once this doc was committed, verified it and passed.
- [x] Tests that would have caught the risk if they existed: a fixture-repo
  integration test that builds a throwaway git history and asserts the
  fail/pass/staleness exit codes. Proposed as follow-up, not blocking: the
  orchestration surface is small and the first live PR (this one) exercises it.

## Verdict

**Verdict:** pass-with-notes

**Reasoning:** The implementation matches the design spec exactly, the failure
messages are actionable enough for agents to self-serve a fix, and the two
deliberate design choices I probed hardest — no `paths:` filter, and the
docs/** content exemption — are both correct and documented with their
rationale. The claims in the builder's report all traced to code.

**Notes (required for pass-with-notes):**
1. Partial independence on `18f2369`: this reviewer authored that amendment, so
   for those ~40 lines the review is self-review. Mitigation: the amendment is
   covered by 3 new unit tests and narrows (never widens) what the gate blocks.
   Acceptable for the bootstrap PR; the norm doc's stricter flow applies from
   the next gated PR on.
2. Workflow-file behavior (label expression, base-ref fetch) is verified by
   inspection only; the first live CI run on this PR is the real test. Watch it.
3. The `reviewer:` field is attestation, not authentication — independence is
   socially enforced and auditable, not cryptographically proven. This is a
   known, accepted limit recorded in the norm doc's workflow section.
