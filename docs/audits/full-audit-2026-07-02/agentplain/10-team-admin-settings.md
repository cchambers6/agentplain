# Audit 10/10 — Team + Admin + Settings + Data-Rights

- **Date:** 2026-07-02
- **Pin:** `origin/main` @ `f928400` (worktree `C:\agentplain-wt-audit-10`, isolated, read-only)
- **Scope:** workspace team layer, workspace settings tree, data-rights + data-storage surfaces, internal operator dashboard. Per PRs #301 (team), #296 (IP/data-rights), #298 (memory RLS + tiering + BYO), #306 (data minimization), #313 (billing facts SSOT).
- **Method:** six parallel deep-read auditors (team/roles, data-rights/delete/export, memory-scale/BYO, operator gating, settings/billing SSOT, gates+brand); every P0 and headline P1 independently re-verified against the code by the coordinating session before inclusion.
- **Note on scope naming:** the mission named `app/admin/*` — that directory does not exist. The internal dashboard is `app/(operator)/operator/*` (17 pages) and was audited as such.

## Verdict

**3 × P0, 14 × P1, ~15 × P2.** The authorization architecture is genuinely strong — every server action across team, settings, data-rights, and operator re-derives the caller's role from the DB; no authz bypass was found anywhere in scope. The gates (voice, brand, Heritage Plains, vendor invisibility) are clean on every customer surface. The failures are concentrated in one theme: **surfaces narrating guarantees the runtime does not deliver** — the deletion story, the export story, the BYO-storage story, and the discipline-heads routing story all promise more than the code does. The epicenter is the client-portal table family, which shipped one day after #298 outside every safety net that PR built.

### Verify-item scorecard

| Mission verify item | Result |
|---|---|
| Member roles enforced (staff can't see owner-only data) | **PASS** — server-side re-derivation everywhere; escalation blocked at correct tier; activity feed policy-filtered server-side |
| Data-rights shows two-bucket model correctly | **PASS on copy** (no banned phrases, buckets stated exactly per ratified positioning) — but backing claims fail, see P0-1/P0-2/P1-1 |
| Export delivers structured zip | **PARTIAL** — real streamed JSON attachment, owner-gated, leak-defended; but omits the entire Plaino-memory bucket (P1-1) |
| Delete is GDPR-clean (all Plaino memory hard-deleted) | **FAIL** — teardown misses ~14 workspace-scoped tables incl. all 9 Portal models and 3 Support models (P0-1, P0-2, P1-3/4/5) |
| BYO-storage toggle works | **FAIL** — no toggle exists; marketed as available (P0-3) |
| Admin dashboard gated to Conner only | **PASS** — allowlist → sealed session → middleware + layout + per-page + per-action + RLS; one page-level gap (P1-14) |
| Billing surface uses `lib/billing/facts.ts` SSOT | **PARTIAL** — prices/taglines read from SSOT; two copy drifts contradict facts.ts (P1-10, P1-11) |
| Voice-gate on all copy | **PASS** — 0 in-scope violations, ratchet green; caveat: gates don't scan `app/(operator)` |
| Model-vendor invisible | **PASS on customer surfaces** — zero hits in team/settings/data-rights copy; vendor names rendered on internal operator pages only (P2) |
| Heritage Plains applied | **PASS** — all four surfaces fully tokenized; zero raw hex, zero default-gray classes in scope |

---

## P0 findings

### P0-1 — Client-portal tables (9 models of end-client PII) are outside every safety net
`prisma/schema.prisma:2969-3160` (PortalConfig, PortalClient, PortalCase, PortalCaseEvent, PortalInvite, PortalSession, PortalThread, PortalMessage, PortalDocument) — created in migration `20260618000003_client_portal`, one day after #298 closed the RLS gap. Three independent failures on the same tables:

1. **Not deleted on account close.** `tearDownWorkspaceData` (`lib/customer-files/deletion.ts:302-435`) deletes 26 table groups but zero Portal models. The cascades hang off Workspace, but teardown deliberately preserves the Workspace row (`deletion.ts:341`), so they never fire — the file's own comments at `:231-232` name this exact "orphaned PII" failure mode for other tables. Meanwhile the closed-state copy claims "Nothing tenant-specific remains" (`data-rights/page.tsx:176`) and "no tenant data is left" (`settings/data/page.tsx:205`). End-clients' emails, encrypted message bodies, and uploaded documents (Vercel Blob) persist indefinitely after close.
2. **Zero RLS.** No `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` anywhere for the 9 tables. PortalConfig carries a direct `workspaceId`; the other 8 scope via `portalConfigId` — the exact table-owner-role read-everything exposure the #298 migration comment (`20260617000000/migration.sql:27-29`) describes.
3. **The invariant tests that would catch this are not in CI.** `tests/rls-memory-scale-isolation.test.ts:68-92` and `lib/storage/__tests__/data-categories.test.ts:47-60` would both fail today — but no workflow runs them (`.github/workflows/` has only auth-tests [`tests/auth-*.test.ts` only], e2e-nightly, schema-drift, connector-dispatch-coverage, audit-queue-seeder).

**Failure scenario:** a law-vertical owner closes their account trusting "nothing tenant-specific remains"; their clients' case threads and documents survive — an active GDPR Art. 17 breach the moment the portal has one real end-client.

### P0-2 — Support tickets survive account close despite an explicit on-surface promise
`lib/storage/data-categories.ts:174` promises support threads are "removed on account close." `tearDownWorkspaceData` never touches `SupportRequest` / `SupportTicket` / `SupportTicketMessage` (verified: zero references in `deletion.ts`); only the on-demand resolved-only purge exists (`lib/storage/category-purge.ts:138-159`). Support message bodies are personal data. False claim on a live surface + non-deleted personal data.

### P0-3 — BYO customer-hosted storage is marketed as available but is completely inert
`app/(product)/app/workspace/[id]/data/page.tsx:221-239` tells Partner/Max customers, present tense: "you can keep your cold-tier memory and archives in an S3-compatible bucket you own… We run a connectivity + round-trip probe, then migrate your existing cold data." None of that exists:
- **No write path for `WorkspaceStorageConfig` anywhere in the repo** (verified: zero `create`/`upsert`/`update` call sites in `lib/`, `app/`, `scripts/`). The page's own comment (`:17-20`) admits "a credential form that doesn't exist yet."
- Nothing ever sets `verifiedAt` — the "connectivity probe" is not code.
- Neither `@vercel/blob` nor `@aws-sdk/client-s3` is in `package.json`, so both managed and customer object stores return `NOT_CONFIGURED` (`lib/storage/object-store.ts:21-28`, documented as a pending Conner decision).
- The migrate script's precondition (`scripts/migrate-to-customer-hosted.ts:10-13`) is unsatisfiable.

**Failure scenario:** a Partner customer follows the page's 3-step instructions and sends bucket credentials to their service partner; there is no tool to store, probe, or use them. This is the "cosmetic-but-marketed" class. Cheapest correct fix: gate the customer-hosted card behind a flag until the credential path + SDK decision land.

---

## P1 findings

### Data lifecycle (deletion / export / audit-trail)

**P1-1 — Export omits the entire Plaino-memory bucket.** Surfaces repeatedly promise Plaino's memory is "exportable any time" (`settings/data/storage/page.tsx:67-69`, `data-categories.ts:63-67,91`), but `buildWorkspaceExport` (`lib/customer-data/export.ts:85-99`) contains no ChatThread/ChatMessage/WorkspaceMemoryEntry/SkillRun/WorkspaceBriefing/support tables. "Download a copy of everything" is untrue for exactly the data positioned as the product's memory. GDPR-portability relevant. Secondary: `PER_TABLE_ROW_CAP=5000` silently truncates, disclosed only in metadata.

**P1-2 — Both invariant gates are broken against the current schema and toothless in CI.** Four workspaceId-bearing models are neither disclosed nor excluded in `data-categories.ts` (TimeSavingsEntry, WorkspaceStorageConfig, MemoryAuditLog, PortalConfig) — the invariant test would fail if run; it never runs (see P0-1 item 3). The gate built to prevent P0-1/P0-2 is not holding. Fix = one CI workflow line + reconcile the four models + extend RLS invariant to indirect tenancy (`portalConfigId`-scoped tables).

**P1-3 — `WorkspaceStorageConfig` (encrypted customer S3 credentials) is not deleted on close and not disclosed.** `schema.prisma:2401`; absent from `tearDownWorkspaceData`. Retaining a departed customer's cloud credentials, even encrypted, is a real liability.

**P1-4 — Cold-tier memory objects survive deletion.** `WorkspaceMemoryEntry.archivedRef` points COLD ciphertext at the object store, but teardown (`deletion.ts:366-368`) and category purge (`category-purge.ts:99-119`) delete DB rows only — orphaned ciphertext persists in managed/BYO buckets after "hard delete." (Blast radius ~zero today because tiering is dormant, P1-6 — but fixing P1-6 silently promotes this.)

**P1-5 — Disclosed-as-deleted tables missing from teardown.** RetryableAction (JSON payloads can embed customer data; disclosed at `data-categories.ts:106`), MemoryAuditLog, OnboardingState, Team/TeamMembership, DisciplineHead, IntegrationHealthCheck (last four disclosed as removed on close at `data-categories.ts:153`) — none in `tearDownWorkspaceData`.

### Memory-scale runtime (#298 downstream)

**P1-6 — Memory tiering is dormant.** `runTieringSweep` (`lib/memory/tiering.ts:281`) has zero production callers — no Inngest function, no cron, no route. Every entry stays HOT forever while `data/page.tsx:173-177` narrates cold-archival as current behavior. The table-bloat problem #298 was meant to solve is unsolved.

**P1-7 — Cold-read path unwired; one COLD entry would 500 the memory surface.** `hydrateBody` (`tiering.ts:252`) is called only by its own test; `prisma-memory-store.ts:232` decrypts `row.body` with no tombstone handling — `decrypt('§cold-archived§')` throws inside `listForWorkspace`, poisoning the whole list. The tiering comment (`:249-251`) calls this "the one-line follow-up tracked in the PR"; it never landed. **Ship-order hazard: P1-6 must not be fixed before this.**

**P1-8 — MemoryAuditLog is never written on normal reads/writes; the "every read and write" claim is false.** `recordMemoryAccess` callers: only dormant tiering + the migrate script. `PrismaMemoryStore.upsert/edit/delete/listForWorkspace/markRead` never audit. `data/page.tsx:104-111,248` promises "a log of every read and write"; production renders "No memory access recorded yet" forever. Also absent from the export despite `page.tsx:273-275` claiming "the full trail is in your data export."

### Settings (cosmetic controls + billing SSOT drift + vocab)

**P1-9 — Discipline heads is a cosmetic control.** `settings/discipline-heads/page.tsx:61-80` promises "every new approval-queue item in that discipline routes to them — no one else can act on it until they do." Neither half is true: `resolveRequiredApprover`/`resolveWorkRouting` have zero call sites outside their own modules (verified repo-wide) — no sink stamps `requiredApproverUserId`; and `decideApproval` (`lib/approvals/decisions.ts:73-102`) checks only PENDING+RLS — any owner can approve any item. A customer's stated compliance control silently does nothing. Adjunct: targeted push-notify (`lib/push/notify.ts:30`) narrows on the never-set field, so that branch is dead. Fix direction is a Conner call: wire wave-6b as promised, or soften the copy until it ships.

**P1-10 — Billing page hardcodes "no card required to start," contradicting facts.ts.** `settings/billing/page.tsx:136-140` renders unconditionally; `facts.ts:54` says `CARD_REQUIRED_AT_SIGNUP = true` (ratified 2026-06-14) and `env.stripeCheckoutEnabled()` defaults true. The helper built to prevent exactly this (`trialCardPolicy` in `lib/billing/trial-copy.ts`, used by sign-up) is bypassed. Money-honesty violation of the Truth-Wave class, on the customer's own billing page.

**P1-11 — Billing page shows the 7-day default trial to 14-day verticals.** `page.tsx:118,137,719` uses `env.stripeTrialPeriodDays()` for all workspaces; `facts.ts trialPeriodDaysForVertical` gives CPA/Law 14 days. The page has `workspace.verticalTier` in hand and never consults it — and the trial banner on the same page computes correctly from `subscription.trialEndsAt`, so the page disagrees with itself.

**P1-12 — Banned engineer vocab rendered on customer surfaces.** "LLM" ×4: `settings/pause/page.tsx:60,67` and `settings/schedule/page.tsx:76,83`. A literal code path rendered to customers: `settings/discipline-heads/page.tsx:79` "(See \`lib/auth/route-approval.ts\`.)" — doubly bad given P1-9. Also "schema-only"/"Live" taxonomy on `settings/page.tsx:88` and `settings/skills/page.tsx:59,82-86`.

### Team + operator

**P1-13 — Last-owner guard counts INVITED owners that can never activate → owner lockout.** `team/actions.ts:185-195,247-258` counts `status IN (ACTIVE, INVITED)`, but no acceptance flow exists anywhere (invite email/token parked per `actions.ts:15-19`; verified no INVITED→ACTIVE transition in the codebase). A sole owner invites a second "Owner," demotes/removes themselves, and the workspace permanently loses all OWNER-tier capability (billing.write, workspace.delete, roster.write.owner). Fix: count ACTIVE only until acceptance ships.

**P1-14 — Operator tickets pages rely solely on the layout for auth.** `operator/tickets/page.tsx:27-37` and `tickets/[ticketId]/page.tsx:38-40` are the only 2 of 17 operator pages with no in-page `isOperator` assertion; they read all workspaces' support threads. Layouts and pages render in parallel in App Router — protection rests on the layout redirect alone, contrary to the repo's own defense-in-depth convention (every sibling page re-asserts). Amplifier: Next.js is pinned at 14.2.18 (`package.json:42`), vulnerable to CVE-2025-29927 (middleware bypass via `x-middleware-subrequest`; patched in 14.2.25). Mutations are safe (`tickets/actions.ts` self-gates). Two-line fix per page + version bump.

---

## P2 (condensed)

- `TeamMembership` has no RLS policy (migration `20260531300000` comment claims "RLS-isolated" but contains none; unqueried today) — same class as P0-1's portal gap, zero current exposure.
- TOCTOU race on the last-owner guard (two concurrent demotes both pass the count) — fix with `SELECT … FOR UPDATE` alongside P1-13.
- `setMemberRole` accepts DEACTIVATED targets; self-targeting only UI-blocked (server allows privilege-reducing self-demotion — fine, but should be deliberate).
- Invite silently creates a permanent User row and the UI promises "they'll join once they accept" — no email is ever sent, acceptance doesn't exist. Trust bug on a customer-facing promise.
- Operator grant/revoke lag: allowlist consulted only at user-creation; revocation doesn't invalidate sealed 30-day sessions (acceptable single-founder; revisit before a second operator).
- Operator actions fail closed but silently (return void on non-operator) — masks broken sessions.
- `dataRegion` is a stored column + rendered label ("US East (us-east-1)") with zero enforcement; nothing sets or routes by it.
- Vendor names rendered on internal operator pages (`operator/fleet/creative/page.tsx:138,232`, `fleet/media/page.tsx:122,215` "Anthropic tokens"/`~/.claude/` paths; `operator/leads/page.tsx:147,177` "Asked about Claude" cohort — likely deliberate). Neither gate scans `app/(operator)` — monitoring gap if operator screens are ever customer-visible.
- `settings/billing/UsagePanel.tsx:56-60` — model-id string in rate math + vendor comment (never rendered).
- Comment drift: `trial-copy.ts:6` claims default "14, not 30" (actual 7); `skills/page.tsx:10-15` header describes a dead state; `billing/page.tsx:632-635` retired "reserved hours" framing.
- `TIER_BULLETS` (`billing/page.tsx:501-526`) hand-duplicates Partner support description instead of reading `PARTNER_SUPPORT.description` — consistent today, drift-prone.
- `autonomy/page.tsx:23-34` KIND_LABELS fallback renders raw enum tokens if the allowlist grows; `:135` "goes live" borderline vocab.
- Stale voice-gate baseline entry (`VE|app/(marketing)/page.tsx:287` no longer exists); `settings/data` + `data-rights` prose carries one em-dash per sentence (gate-legal; the known cadence tell).
- "This page … lets you clear anything" (`settings/data/page.tsx:122`) and "every document the fleet has read" (`data-rights/page.tsx:125`) overstate; `recordEphemeralFetch` wired to only one fetch path so the pass-through-reads counter undercounts (honest direction).

---

## What held up (SOLID highlights)

- **Authz, everywhere.** All 4 team actions, all 10 settings action files, export route, closure actions, storage actions: `requireWorkspaceMember` with DB-derived role + ACTIVE status; owner-tier required for billing/delete/roster-owner ops. Discipline-heads assignment even validates the *target* is an ACTIVE member of the same workspace. No client-trusted workspaceId anywhere.
- **Role escalation blocked correctly:** ADMIN can't touch ADMIN/OWNER seats; both current and requested role checked; zod-constrained enums; a member cannot invite an owner; invited seats are inert (no token surface exists at all).
- **Activity feed** filtered server-side per policy (`lib/team/activity.ts:51-63`), unit-tested, double-covered by RLS.
- **#298's isolation claims are real:** all 6 tables have ENABLE+FORCE+FOR ALL policies with WITH CHECK; no 63-char truncation drift; 46 of 47 workspaceId-bearing models RLS-covered (PortalConfig the sole direct gap); transaction-scoped GUCs.
- **Settings controls that are real, not cosmetic:** pause + schedule (read fresh by `gateSkillFire` on every fire), autonomy (page reads through the same resolvers the executor uses), work-thresholds (safe-default PENDING), skill config (all displayed keys have runtime readers).
- **Export leak defense:** RLS-context mismatch rejected, operator-context rejected, OAuth tokens redacted, attachment + no-store headers.
- **Delete machinery quality:** typed confirmation, 7-day grace, hourly sweep re-checking CLOSING state, AuditLog included per Conner's 2026-06-18 ruling — the machinery is right; the table list is incomplete.
- **Operator surface:** email allowlist → sealed httpOnly session → middleware + layout + 15/17 per-page + 8/8 per-action + route-handler self-gate + read-only-by-construction impersonation, no secrets in HTML, real fleet-health data.
- **Brand:** voice-gate and brand-gate both green (0 in-scope, 0 new); all four surfaces fully Heritage-tokenized (zero raw hex, zero default grays); zero vendor names in customer-visible copy; passkeys rpId derived, not hardcoded.

## Open questions for Conner

1. **Is the client portal live for any customer?** Decides whether P0-1 is latent or an active GDPR exposure. Either way the fix (RLS migration + teardown additions + CI wire-up) is one PR.
2. **Was BYO storage ever promised to a live Partner/Max customer?** If not, gate the card behind a flag; the SDK decision (`@vercel/blob` vs `@aws-sdk/client-s3`) blocks all of P0-3/P1-6/P1-7 by design.
3. **Discipline-heads: wire wave-6b or soften the promise?** The current copy makes a hard-gate compliance claim the runtime can't honor.
4. **Account-level (vs workspace-level) deletion:** User/WebAuthnCredential/PushDevice rows survive workspace close by design — is a separate GDPR Art. 17 account path intended?
5. **CI for invariant tests:** recommend a `unit-invariants` workflow running the RLS + data-categories tests on every PR — it would have caught P0-1 the day it shipped.

## Spend

Six subagents: ~746k tokens (115k + 104k + 93k + 145k + 124k + 164k) + coordinating session (setup, P0/P1 re-verification, synthesis, PR) ≈ **~850k tokens total**, single session, no ceiling hit.
