# Top 5 P0 fixes — code paths, owners, exit criteria

Selected from the master-synthesis top-20 under the ratified kill list. Selection logic: (a) the one fix that leaks real money today, (b) the two legal/PII exposures that survive the kill rulings, (c) the two truth/activation fixes that sit on the RE sales path. flatsbo rows 2–8 are out of scope for engineering this quarter except row 1 — Conner's stay-live override makes the API lock non-optional. Rows 9–10's full portal trust chain is cut by kill #4; only the safety net ships.

---

## 1. Guarantee counts the money right (top-20 row 11) — the only recurring cash leak

**Defect:** `recordSavedTime` has exactly one caller — `persistSkillRunArtifacts` (`lib/skills/persist-artifacts.ts:195`), reached only from the webhook inbox path — and its attribution map (`guaranteeActionForOutcome`, `lib/guarantee/saved-time.ts:188`) covers 3 of 7 calibrated actions. `invoice-sent`, `document-chased`, `tenant-notice-posted`, and `lead-enrichment` have **no writer anywhere**, so the vertical sweeps (including invoice-chase, the flagship workflow) bank zero minutes. The Day-7 evaluation then compares an undercounted ledger against the 5-hour bar and offers walk-away refunds — plus a false "we failed you" email — to workspaces the fleet served.

**Fix spec:**
1. *Hour one (separate one-line PR):* set the Day-7 walk-away cron to human-review mode — refund offer becomes a Conner-queue item, not an outbound email — until step 2 is verified on main. There is no third option in which the cron keeps auto-firing against a ledger known to undercount.
2. Extend `guaranteeActionForOutcome` in `lib/guarantee/saved-time.ts` to map all 7 calibrated actions, and add `recordSavedTime` calls at each sweep's persist path (the sweeps under `lib/skills/*/` have durable source rows — use them as dedupe keys, same idempotency pattern as the existing caller).
3. Bound Day-7 candidates to `ageDays ∈ [7,14]` (row-11 sub-item; audit 09 P1-1).
4. Extend `lib/guarantee/saved-time.test.ts` with one test per newly wired action asserting minutes land; add an invariant test that every calibrated action has a mapped writer (so the 8th action can't ship writerless).

**Owner:** one Opus code-task session (Fable review of the attribution mapping before Jul 7). **Effort:** S–M. **Exit:** all 7 actions write minutes under test; cron stays human-review until a full week's ledger is spot-checked against activity.

## 2. Portal flag-off + data-safety net (rows 9–10, scoped by kill #4)

**Defect:** the portal is 0%-activatable yet its 9 portal tables + 3 support tables sit outside RLS and account-teardown — all liability, no adoption. Its unit suite fails on main with no CI coverage. Kill #4 rules: gate it off, make the DPA signable, spend nothing else.

**Fix spec:**
1. `PORTAL_ENABLED` env flag, default **off**: guard `app/portal/[customerSlug]/*` (layout-level redirect to a plain "not enabled" page) and 404 the four API routes `app/api/portal/{invite,setup}/route.ts`, `app/api/portal/[customerSlug]/{enter,upload}/route.ts`.
2. RLS policies + account-teardown coverage for the 12 tables (follow the existing pattern from the PR #298 substrate; verify with `tests/rls-context.test.ts` / `tests/rls-memory-scale-isolation.test.ts` extended to the portal tables).
3. Fix the failing `tests/portal-units.test.ts` on main.
4. Wire the portal + RLS/data-category invariant suites into `pr-checks.yml` (see `02-CI-floor-and-gates.md`) so this class cannot ship silently again.

**Owner:** one Opus code-task session. **Effort:** M (mostly the RLS migrations — remember the drift-baseline entry for raw-SQL policies). **Exit:** portal unreachable in prod; account close deletes end-client rows; both suites green in CI. **Revisit trigger:** first signed design partner who needs client document exchange.

## 3. flatsbo unauthenticated-API lock (row 1) — mandatory once stay-live was ratified

**Defect (repo `C:\flatsbo`):** `GET /api/listings/[id]` and `GET /api/listings/[id]/offers` dump seller+buyer name/email/phone and offer terms unauthenticated; `/offers/[id]` is world-readable; photo POST/DELETE is unauthenticated; offer POST upserts any email (overwriting that user's name/phone); `/api/stripe/checkout` mints sessions against any listing. Waitlist-dark was the cheap mitigation; Conner overrode it, so the lock ships.

**Fix spec:** session + ownership checks on the two read endpoints and the offers page; auth on photo mutation routes; derive the buyer from the session on offer POST (kill the email upsert); ownership guard on checkout. One day, one PR, no feature change.

**Owner:** `flatsbo-eng-backend` (one session — the only flatsbo engineering spend this quarter). **Effort:** S. **Exit:** anonymous `curl` against each endpoint returns 401/403; a regression test per endpoint. **Note:** flatsbo main has been frozen since #40 — this lands via the stranded-branch merge check first (row 4) to avoid re-fixing what PR #45 already fixed.

## 4. Marketed-but-inert controls (row 12) — truth on the surfaces prospects will see this week

**Defect:** BYO storage is marketed present-tense with no credential write path (partners would mail S3 creds into a void); discipline-heads routing routes nothing; "threshold you set" points at nothing; Test-connection is decorative; billing-page card/trial copy contradicts `lib/billing/facts.ts`. With 5 RE prospects hitting the site Monday, every one of these is a trust grenade.

**Fix spec:** flag-gate BYO storage UI until the credential path exists; wire-or-soften discipline-heads copy (soften — wiring is killed surface area); make Test-connection perform the real dispatch-route probe or relabel it; source billing copy from `facts.ts` (single-source, same pattern as trial-copy).

**Owner:** one Sonnet code-task session (mechanical; specs are in audits 10/05/04). **Effort:** S. **Exit:** voice-gate + brand-gate pass; every rendered control does what it says or no longer says it.

## 5. Connector disclosure routing + Reconnect dead-end (row 13 remainder)

**Defect:** #355 fixed api-key connect and set TaxDome/Karbon to coming-soon, but the marketplace tile Connect and onboarding Connect still bypass the #306 storage-disclosure step (audit 05 P0-2), and the api-key Reconnect path dead-ends. The disclosure is ratified load-bearing positioning (two-bucket data architecture) — a bypass on the primary CTA is a positioning breach on every grant, including the RE connectors on this week's sales path.

**Fix spec:** route tile + onboarding Connect through the same disclosure component the #306 flow uses (one entry-point function, no per-tile copies); fix Reconnect to re-enter the api-key form with existing config; add a test asserting every `connectMode` entry point renders the disclosure before grant.

**Owner:** one Sonnet code-task session. **Effort:** S–M. **Exit:** no path from tile to granted connector skips the disclosure; Reconnect round-trips. TaxDome/Karbon **stay** coming-soon — CPA activation is killed until 2 RE pilots (kill #2); do not rebuild them.

---

**Explicitly deferred from the top-20:** row 14 front-door sweep is mostly closed by #355 (`/how-it-works` unshadowed, `/contact` live) — the remainder (root `not-found.tsx`, `/guarantee` linking, `/security` name) rides in the hardening pass. Row 15 (session revocation + rate limiting) is the first candidate for week 3 — it is real but exploits require traffic we don't have yet; it must land before any paid traffic per the paid-media gate.
