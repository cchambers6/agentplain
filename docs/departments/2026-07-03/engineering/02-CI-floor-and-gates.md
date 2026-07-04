# Server-side CI floor — `pr-checks.yml` spec

**Problem being ended:** only three workflows run on `pull_request` today, all path-filtered (`schema-drift.yml` → `prisma/**`, `auth-tests.yml` → `lib/auth/**`, `connector-dispatch-coverage.yml` → `lib/integrations/**`). A PR touching `app/`, `components/`, or most of `lib/` runs **zero** server-side checks. All other enforcement lives in `.husky/pre-push` on the author's machine, and the `HUSKY=0` bypass is documented, sanctioned, and routine. The standing proof of need: the portal test suite fails on main and nothing caught it; 41 tests fail on main right now (known, pre-diagnosed — do not re-diagnose).

**Design principle:** the server-side floor is authoritative; husky becomes fast local feedback, not the gate. `HUSKY=0` stops being dangerous the day the same checks re-run where no env var can skip them. We do not ban the bypass — we make it irrelevant.

---

## The workflow

`.github/workflows/pr-checks.yml` — triggers on every `pull_request` to main (NO path filter) and on `push` to main. Four parallel jobs, target wall-clock ≤ 6 min:

### Job 1 — `typecheck`
```
npm ci
PRISMA_GENERATE_NO_ENGINE=true npx prisma generate
npx tsc --noEmit
```
`npm run typecheck` exists in package.json and is wired into nothing — this wires it. `PRISMA_GENERATE_NO_ENGINE` per the standing recipe (no engine download in CI where we never run queries).

### Job 2 — `unit-tests` (with a known-failure baseline)
Main fails 41 pre-existing tests, so a naive `npm test` gate would block every PR on day one and get labeled around within a week. Instead:

1. Check in `tests/known-failing-baseline.txt` — the exact list of currently failing test names, generated once from main.
2. The job runs `node --import tsx --test "tests/*.test.ts" "lib/**/*.test.ts"` with a TAP reporter, diffs failures against the baseline, and fails **only on new failures or on a baseline test that starts passing without being removed from the file** (ratchet: the baseline can only shrink).
3. **Burn-down rule:** the baseline must hit zero by Jul 17. Each fix-wave PR that touches a subsystem removes that subsystem's baseline lines. A baseline entry older than 14 days is treated as a P1 defect with an owner.

This makes the suite blocking immediately without a big-bang fix, and makes the 41 failures visible debt with a ratchet instead of ambient noise.

### Job 3 — `gates` (brand / voice / vendor / claims)
```
node tools/brand/brand-gate.mjs      # R1 vendor names, R2 placeholders, R3 hex drift, R4 hype, R5 icon families
node tools/brand/voice-gate.mjs      # LLM-ese A–D on customer surfaces
```
Two additions to the gate layer itself (small PRs, same fortnight):
- **Vendor-name gate hardening:** brand-gate R1 exists but the vendor-invisible rule still lacks coverage on the surfaces the audits flagged (`app/portal`, `lib/reports`, `lib/integrations`, `app/(operator)`). Move both gates to a **shared customer-surface manifest derived from the tree** (scan everything under the customer-rendering roots, allowlist exceptions) instead of hand-kept directory lists — top-20 row 19, and the audits' "stop hand-maintaining gate scan lists" ruling. The sole sanctioned vendor-name surfaces remain `/privacy` + `/security` subprocessor list.
- **Claims gate v1 (cheap, honest scope):** a grep-class check for the banned-phrase families already ratified — "nothing stored"/"forgets" (two-bucket rule), "pilot pricing", compete/replace/instead-of/alternative-to Claude — run against the same manifest. Present-tense capability-claim verification stays a review-time rule (it needs judgment); the gate only enforces the mechanically checkable bans.

### Job 4 — `pr-shape`
- **Size budget:** fail if the PR exceeds 800 insertions or 30 files, unless labeled `size-exception` (the label requires a stated reason in the PR body). 41% of merged PRs exceed 1,000 insertions today; post-merge audits keep finding P0s in exactly those.
- **Duplicate migration timestamps:** `ls prisma/migrations | cut -c1-14 | sort | uniq -d` — fail on any output. (Also added to `schema-drift.yml` so it runs on the prisma path even if this job is ever skipped.) 8 hand-minted duplicate stamps live on main today; this is the one-line check that ends the class.

## Branch protection

Flip `main` to require `typecheck`, `unit-tests`, `gates`, and `pr-shape` plus the three existing path-filtered workflows. This is the actual end of the `HUSKY=0` pattern — a bypassed local hook now meets the same checks at the PR, where there is no env var. (Conner action: branch-protection toggle is a repo-settings click; listed in the go/no-go note.)

## What this does NOT include (deliberately)

- **No e2e in the PR path** — `e2e-nightly.yml` stays nightly; 3–5 min PR latency is the budget and Playwright would triple it.
- **No lint job initially** — typecheck catches the class of bug that costs money; lint noise on a 41-failure baseline repo invites label-around behavior. Add it after the baseline hits zero.
- **No build job** — `next build` is 4+ min alone and Vercel preview already builds every PR; a red preview is visible on the PR.

## Rollout order

1. Day 1: land `pr-checks.yml` with jobs 1, 3, 4 (all green-able immediately).
2. Day 2: generate the baseline file on main, enable job 2.
3. Day 2: flip branch protection.
4. Days 3–14: baseline burn-down rides inside each fix-wave PR (portal fix removes the portal lines, etc.).

**Measures (from the kaizen retro, now enforced):** schema-drift CI failures 14/60d → ≤2/month; PRs >1,000 insertions 41% → <15%; P0s found by post-merge audit on freshly merged PRs → 0; `HUSKY=0` occurrences in commit/PR bodies → tracked, and harmless.
