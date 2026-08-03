# Pre-merge independent architectural review

**Status: enforced in CI.** Informally: the Fable review gate (Fable is the
reviewing model tier). This is an engineering norm, not a suggestion.

## The incident that created this norm

A sibling project shipped a change that passed 706 of 706 unit tests and its
acceptance test. Its own validation report contained a load-bearing false claim:
that existing crons "cover the new models for free". They did not — the new
models were unreachable by the deletion machinery. Every test passed anyway,
because no test encoded the claim. An independent architectural review caught
it; nothing else did, and nothing else would have.

Agentplain has never had this step. Code passes tests, merges, and ratified
invariants rot quietly.

## The principle

Tests verify what they encode. Independent architectural review verifies what
tests structurally cannot see:

1. **Claim–code divergence** — the PR description or validation report says X;
   the code does Y. No test compares prose to code.
2. **Coverage illusions** — "already handled by Y", "the cron picks it up",
   "covered for free". Tests confirm Y works on what it is handed; nothing
   confirms the new thing is in what Y is handed.
3. **Invariant erosion** — no-outbound, LLM compose order, tenancy scoping,
   cold-start safety, pricing tiers, brand lock. Each is ratified, most are
   unasserted, and a green suite says nothing about any of them.

"Independent" is the load-bearing word. A reviewer who shares the builder's
context inherits the builder's blind spots and re-derives the builder's
conclusions. The reviewing session must be separate, and must work from the diff
and the code rather than from the builder's account of them.

## Which PRs trigger the gate

**`tools/review/fable-review-gate.mjs` CONFIG is the source of truth.** The list
below mirrors it and can drift; the script cannot.

A PR is gated when it touches any of these paths:

| Surface | Paths | Why |
| --- | --- | --- |
| Schema / migrations | `prisma/schema.prisma`, `prisma/migrations/**` | the data model everything rests on; migrations are irreversible in production |
| Deletion / retention | `lib/storage/**`, `lib/memory/**`, `lib/plaino/chat-retention.ts`, `lib/plaino/conversation-cleanup.ts`, `lib/customer-data/**` | the exact machinery the incident broke |
| Agent output to customers | `lib/agents/**`, `lib/skills/**`, `lib/email/**`, `lib/voice/**`, `lib/plaino/**`, `lib/portal/**` | reaches customers directly |
| Security / tenancy | `lib/auth/**`, `lib/security/**`, `lib/abuse/**`, `lib/db/**`, `middleware.ts` | where isolation is enforced or lost |
| LLM seam | `lib/llm/**` | ratified compose order `Logging(Budget(Sentinel(Caching(Anthropic))))` |
| Money | `lib/billing/**`, `lib/pricing/**` | charges, trials, guarantees, ratified tiers |
| The gates themselves | `.github/workflows/**`, `tools/review/**`, `tools/brand/**` | weakening a gate is invisible to every test |

…or when it **adds** a line containing any of: `workspaceId` (tenancy scoping is
load-bearing wherever it appears), `deleteMany(`, `DROP TABLE`, `DROP COLUMN`
(the SQL patterns match case-insensitively). Content rules look at added lines
only, and ignore lines added under `docs/reviews/**` so that a review doc
quoting these terms cannot trigger the gate on itself.

Everything else passes with an explicit "no review required" line in the CI log.
The workflow has no `paths:` filter on purpose: a filtered job that never runs
shows the same green check as a job that ran and passed, and the difference
matters here.

## Workflow for a build agent

1. **Build the change.** Run the tests. They are necessary and insufficient.
2. **Request an independent review session** — a fresh Fable session that did
   not build the change and does not receive your plan, your reasoning, or your
   conclusions. Give it the branch and the diff. Do not give it your summary of
   what the diff does; that is the thing under review.
3. **The reviewer** copies `docs/reviews/TEMPLATE.md` to
   `docs/reviews/<yyyy-mm-dd>-<branch-slug>.md`, fills every section, sets
   `reviewed-commit` to the commit it actually read, names itself in `reviewer`
   (never `self`), and records a verdict.
4. **The reviewer commits the doc to the branch.** Reviews are artifacts, not
   chat messages. The record has to survive the session.
5. **CI verifies** the doc on the next push: frontmatter present and coherent,
   `reviewed-commit` resolvable and inside this PR's range, verdict `pass` or
   `pass-with-notes`, every rubric heading present, and no gated commit landed
   after the reviewed commit.

A `fail` verdict blocks. So does a missing verdict, an unnamed reviewer, a
missing section, or a `reviewed-commit` that belongs to the base branch (a
review of base-branch code reviewed nothing in the PR).

## The staleness rule

A review covers one commit, not a branch in motion. After the reviewed commit,
the gate walks every commit up to HEAD and re-classifies it. If any of them
touched gated paths or added gated content, the gate fails with "gated changes
landed after the review — re-review required".

Changes under `docs/reviews/**` after the reviewed commit are always allowed —
the review doc lands after the commit it reviews, by construction. Ungated
changes (copy edits, unrelated docs, non-gated app code) are allowed too; only
gated drift invalidates a review.

The fix for staleness is always a re-review, never an edit to the SHA. A fresh
independent session re-reads the change, updates `reviewed-commit` to the
current HEAD, and commits.

## Override

Applying the PR label **`review-gate:override`** makes the gate pass with a loud,
permanent warning in the CI log naming the drift classes that went unchecked.

**Only Conner applies this label.** It is a human decision to merge without an
independent review, and it leaves a record that says exactly that. An agent that
believes it needs the override needs a review instead — the correct escalation is
to ask for a reviewing session, not for the label.

Bootstrap note: the PR that introduced this gate is itself gated (it touches
`tools/review/**` and `.github/workflows/**`). It gets a real independent review
or Conner's override — the gate does not exempt itself.

## Evolving the gated-path config

Edit the CONFIG block at the top of `tools/review/fable-review-gate.mjs`. Every
entry carries a one-line "why"; a new entry without one is not finished. Keep
the table above in sync, and remember that `tools/review/**` is itself a gated
path — a PR that widens or narrows the gate is reviewed by the gate.

Run it locally with `npm run review-gate` (dependency-free; it needs only git
and a full checkout). Unit tests for the pure logic:
`node --test tools/review/fable-review-gate.test.mjs`.
