# TODOs for Conner — Strategic Build 2026-06-17

Account-gated and credential-gated follow-ups parked here by the build waves.
Code is shipped and ready; each item below is the human/account step that
activates it. Other waves append their own sections to this file.

---

## Vertical-MCP adapter scaffolds (7 connectors)

PR: `feat(integrations): adapter scaffolds for 7 new vertical-specific MCPs`.

Each connector ships its typed client, auth shape, zod tool registry, and
workspace-scoped MCP dispatch route. All are registered `coming-soon` in the
marketplace (they will NOT trip the #277 coverage gate until activated). Read
tools return `CREDENTIAL_NOT_FOUND` until a credential lands; every mutating
tool (create / send / charge / update) is approval-gated and returns
`APPROVAL_REQUIRED` — nothing fires from an autonomous run.

To activate a connector: obtain the credential below, add the
`IntegrationProvider` row, flip the marketplace entry to `available` + set its
`providerKey`, and (for OAuth) wire the connect/callback routes + token-refresh
adapter. TaxDome and Karbon already shipped in a prior wave and are NOT in this PR.

- [ ] **TaxDome** (CPA): sign up for partner account, get API key.
- [ ] **Karbon** (CPA): register OAuth app at developer.karbonhq.com, get client ID + secret.
- [ ] **Clio** (Law): register OAuth app at app.clio.com/api/v4/documentation, get credentials. Then set `CLIO_OAUTH_CLIENT_ID`/`CLIO_OAUTH_CLIENT_SECRET`, add a Clio token-exchange adapter (mirror `lib/integrations/hubspot/oauth.ts`) + the connect/callback routes.
- [ ] **MyCase** (Law): contact MyCase support for API access (some plans require enterprise tier). Token-auth — paste the token at connect time.
- [ ] **kvCORE** (RE): API key from kvCORE account settings (Inside Real Estate parent).
- [ ] **BoldTrail** (RE): API key from BoldTrail account or OAuth registration (Real Geeks parent). Verify the base URL + auth scheme at enrollment (`lib/integrations/boldtrail-mcp/client.ts` carries a placeholder base).
- [ ] **AppFolio** (PM): submit partner program application — ~2 month approval process. **Highest priority for the PM vertical.** Basic-auth (client-id + client-secret) + per-tenant subdomain on `providerMetadata.subdomain`.

---

## Item A — API costs at scale (per-workspace budgets + routing + caching)

- [ ] **Sign off on per-tier token budgets.** Recommended starting caps
  (`docs/scaling/api-cost-projection-2026-06-17.md` §6), targeting COGS ≤ 30%
  of revenue:
  - Regular ($199/seat): **monthly $60 / daily $6**
  - Partner ($299/seat): **monthly $90 / daily $9**
  - Max ($499/seat): **monthly $150 / daily $15** (or per-engagement)

  These are stored per-workspace in `Workspace.settings`
  (`tokenBudgetUsdMonthly` / `tokenBudgetUsdDaily`) and can be raised on any
  single account without a deploy. **They are not applied automatically** — no
  workspace has a cap until you (or an operator) set one. Say the word and the
  fleet will write these defaults per tier.

- [ ] **Confirm: auto-pause vs hard-fail at the budget cap.** Current behavior
  at 100% of cap is **graceful auto-pause** — the budget gate
  (`BudgetEnforcingLlmProvider`) returns `OVER_BUDGET` *before* the model call
  (no tokens spent), the workspace sees a calm "Plaino paused new work — you've
  reached your budget" banner, queued work resumes on period reset or a raised
  cap, and the owner got 50/75/90% email warnings on the way up. The
  alternative (hard-fail with a visible error) is worse UX and we did **not**
  build it. **Confirm auto-pause is the behavior you want**, or tell us if a
  heavy workspace should instead keep running and just alert you to reprice.

  **Strategic flag:** the modeled *heavy* Regular workspace (~$106/mo COGS)
  exceeds a $60 monthly cap. Options (§6): (1) throttle — caps pause heavy
  users near month-end; (2) reprice — usage add-on or nudge to Partner;
  (3) route harder — a little more Sonnet on lower-stakes surfaces. Your call.

### Context links
- Cost math + scaling table: `docs/scaling/api-cost-projection-2026-06-17.md`
- Budget seam (daily + monthly): `lib/billing/budget.ts`
- Alerts (pure logic): `lib/billing/budget-alerts.ts` +
  sweep `lib/inngest/functions/budget-alert-sweep.ts`
- Per-skill model tiers: `lib/skills/model-assignment.ts`
- Customer usage dashboard: `/app/workspace/[id]/usage`

### Follow-ups the fleet can do without a decision (noted, not blocking)
- Verify every Inngest sync sweep no-ops before any LLM call when there's no
  new work (delta-check before dispatch) — the cheap polling-cost win.
- Wire the already-defined `*_TRIGGER_EVENT` webhooks (HubSpot / Salesforce /
  FUB) so hourly polling drops to a daily reconciliation backstop.
- Calibrate the §2 workload model against real `LlmUsageRecord` aggregates once
  the prod key is unpaused (~2 weeks of data).
## Item E — IP protection + customer data rights

PR: `feat(ip): ToS + AUP + abuse detection + customer-data-rights surface`

These are **policy documents and abuse-handling logic** — they need counsel and
a few product decisions before public exposure or enforcement.

- [ ] **Counsel review of ToS + AUP + Privacy Policy before public exposure —
      load-bearing.** All three pages (`/terms`, `/aup`, `/privacy`) carry new
      IP-protection and data-ownership language. None of it is counsel-reviewed.
      Markdown source of record: `docs/legal/tos-2026-06-17.md` (sections flagged
      `[COUNSEL]`).
- [ ] **Sign off on the no-training commitment.** We state plainly, in code and
      on `/privacy` + `/terms`, that we never train on customer data and that
      Anthropic's commercial API doesn't either by default. Verify this against
      Anthropic's *current* product terms (paid API does not train by default —
      confirm no org-level setting or DPA clause changes that) before relying on
      it publicly.
- [ ] **Decide the soft-suspend → hard-suspend escalation timeline.** The code
      (`lib/abuse/suspend.ts`) ships a 24-hour review-window default and an
      explicit `reviewWindowExpired()` gate, but does **not** auto-escalate to a
      hard suspend on timeout — that requires your sign-off on the timeline first.
      Until then, hard-suspend only happens via explicit operator confirmation /
      rejected appeal.
- [ ] **Sign off on the data-export format.** The export is structured JSON
      today (live endpoint `app/api/workspaces/[id]/export`). The build brief
      asked for a zip. Decide: keep JSON, or wrap as a zip (e.g. zip of
      per-table JSON + generated artifacts)? The `/data-rights` page currently
      labels the button "download everything (JSON)" honestly.
- [ ] **Counsel review of data-residency commitments.** `/terms` §1.2 and
      `/data-rights` state US-region managed Postgres, encrypted at rest, and
      explicitly **do not** promise EU residency or self-hosting. Confirm the
      US-region claim matches the actual Neon/Vercel production configuration
      before publishing — and keep the no-EU-residency line until infra exists.

### Integration follow-ups (not blocking the PR, but needed to make enforcement live)

- [ ] Wire `lib/abuse/scanChatMessage` into the Plaino chat route and
      `logChatAccess` into the same path (access-audit sink → `AuditLog`).
- [ ] Wire `logConnectorRead` into the connector dispatch layer.
- [ ] Back `SuspensionStore` with `Workspace.settings.abuse` (no migration) and
      enforce read-only via `lib/billing/workspace-paused-gate.ts`.
- [ ] Wire `SuspensionEffect` → Resend (owner emails) + Conner notification, and
      add the high-risk roll-up (`surfaceHighRiskPatterns`) to the operator
      dashboard.
## Item B — Memory architecture for scale + customer-hosted memory

PR: `feat(memory): RLS isolation + tiering + customer-hosted storage option`

- [ ] **Cold-tier storage backend.** The object-store seam ships with three
      adapters (in-memory, Vercel Blob, S3-compatible) but neither
      `@vercel/blob` nor `@aws-sdk/client-s3` is in `package.json` yet — the
      adapters lazy-load and return `NOT_CONFIGURED` until a dep is added.
      **Decide:** Vercel Blob (already in our stack, simplest) vs. S3
      (cheaper at 10K-customer scale, more setup). Whichever you pick, add the
      dep + lock and the managed path activates with no code change.
- [ ] **BYO-storage pricing.** Customer-hosted storage is the hardest
      data-residency + control story we can offer. **Decide:** bundle it into
      Partner/Max, or sell it as a separate add-on? (The data page copy
      currently says "Partner and Max plans" — change if that's wrong.)
- [ ] **Data-residency option set.** Shipped enum: `us-east` (default),
      `us-west`, `eu-west`, `ap-southeast`. **Sign off** on the set —
      specifically whether `eu-west` is needed for EU customers now. NOTE: the
      managed (Vercel Blob) path groups objects by a region-scoped key prefix
      but does NOT yet pin physical region; hard residency is honored on the
      BYO path (customer's own regional bucket). Pinning the managed path to a
      per-region blob store is the operational follow-up if we sell a hard
      US/EU commitment on the managed tier.
- [ ] **Customer-managed encryption keys (KMS).** Shipped postures: `NONE`,
      `AWS_KMS`, `GCP_KMS`, `BYO` (raw key we envelope-encrypt with). BYO KMS
      adds operational complexity (key rotation, lost-key recovery is the
      customer's problem, support load). **Decide:** offer KMS only on Max?
- [ ] **pgvector partitioning — schedule a maintenance window.** The
      partitioning migration is written and reviewed at
      `prisma/manual/20260617_partition_embedding_by_workspace.sql` but is
      deliberately NOT auto-applied: it rewrites the `Embedding` table (HASH-16
      by workspaceId) and requires a companion one-line app change (the upsert
      natural key goes from `(sourceType, sourceId)` to
      `(sourceType, sourceId, workspaceId)` in `lib/knowledge/pgvector-store.ts`).
      **Decide:** schedule the window + ship the two together. Until then the
      existing per-workspace btree index on `Embedding` carries us.

### What landed without needing your sign-off (FYI)
- **RLS gap closed (security).** Six customer-scoped tables shipped with a
  `workspaceId` column but NO row-level security: `DisciplineHead`,
  `SkillRun`, `SkillScheduleWindow`, `Team`, `WorkspaceLifecycleEvent`,
  `WorkspacePauseConfig`. As the table-owner role (Neon's `neondb_owner`) we
  were reading every tenant's teams / skill-run history / pause config. The
  migration enables + FORCEs RLS + workspace-isolation policies on all six. A
  CI invariant now fails if any future `workspaceId` model ships without RLS.
- **Memory tiering** (hot ≤7d / warm 7–90d / cold 90d+ → object storage) and
  the **memory access audit log** are additive and on by default in the data
  model; the cold-tier sweep is opt-in (no cron wired yet — pinned entries
  never leave hot, and no COLD entries exist until you run the sweep).
---

## Data minimization (PR: `feat/data-minimization-ephemeral-pass-through-2026-06-18`)

**Positioning (as built):** *Plaino remembers HOW your business works. He
doesn't keep copies of your raw data — that lives in your tools. He keeps what
he's learned about you, so he's a real partner that gets better.* Plaino-memory
(chat, learned patterns, preferences, approved/edited drafts) is kept for the
account lifetime, exportable any time, hard-deleted on close. Connector data is
pass-through, never stored.

- [ ] **Counsel review of the data-minimization commitment + the ToS/Privacy
  language.** The commitment to land in ToS/Privacy: *"your data is yours; we
  delete it when you cancel; connector data is pass-through and never copied;
  we keep what Plaino learns so he gets better — all owned by you, exportable
  any time."* It is true as built, but counsel should bless the exact phrasing
  before it anchors a legal/marketing claim. Note: the canonical ToS/Privacy
  source lives on the IP-protection branch (PR #296) — this PR did **not** edit
  the legal pages directly; it captured the language here + in the storage
  inventory doc for counsel to fold in. Surfaces to align:
  `app/(product)/app/workspace/[id]/settings/data/storage/page.tsx`,
  `components/integrations/ConnectStorageDisclosure.tsx`,
  `docs/architecture/data-storage-inventory-2026-06-18.md`.

- [ ] **Confirm account-close hard-deletes the audit log.** Per your direction,
  `tearDownWorkspaceData` now deletes the customer's `AuditLog` on close (only
  billing rows survive, for tax). Confirm this is what you want — some privacy
  regimes (GDPR/CCPA) expect a *minimal* deletion-event record to be retained
  to prove the deletion happened. If counsel wants that, we'd keep a single
  "workspace closed + purged at <time>" stub instead of deleting the whole log.

- [ ] **Decide: connector cache → Redis or in-memory?** The ephemeral
  pass-through ships an **in-memory** short-TTL cache (`InMemoryEphemeralCache`,
  ≤30 min, lost on container restart) behind a swap seam (`IEphemeralCache`).
  Upstash Redis (~$10/mo) would let it survive restarts + be shared across
  instances, at the cost of holding connector data in a (still short-lived,
  still off-DB) external store. In-memory is the more data-minimal default.

- [ ] **(Optional) Default chat auto-purge for any tier?** Default is now
  **lifetime** for all tiers (correct — a partner shouldn't forget). The opt-in
  finite auto-purge window is available to privacy-conscious customers. If you
  ever want a tier (or vertical with strict retention rules, e.g. law) to
  *default* to a finite window, that's a one-line change in
  `lib/plaino/chat-retention.ts` — flag it and we'll wire it.

- [ ] **Lead-conversation retention (`PlainoConversation`, MARKETING mode).**
  Anonymous marketing-widget conversations have no workspace and aren't covered
  by the account-lifetime model. Decide a retention policy for pre-conversion
  lead conversations (sales/marketing may want them) — tracked as a follow-up.

---
## Write-action depth across 9 connectors (PR: feat/integrations-write-action-depth-2026-06-18)

Added 30+ approval-gated write actions across HubSpot, Salesforce, Notion, Follow Up
Boss, Sierra, Buildium, QuickBooks, Gmail, and Calendar, all flowing through one
generic approval gate (`lib/integrations/approval/`) modeled on the DocuSign gate
(PR #280). Every mutation is gated at the connector's factory seam; nothing reaches
an external API without a recorded human approval. Decisions / follow-ups below.

### 1. Verify REST endpoints against live sandboxes before enabling in prod
The prod-server methods call documented REST endpoints, but tests mock at the SDK
boundary — so the exact paths/payloads have NOT been exercised against live accounts.
Verify these against a sandbox before flipping the connector live for a paying customer:
- **HubSpot**: `POST /automation/v4/sequences/enrollments` (send_sequence_enrollment),
  `POST /marketing/v3/transactional/single-email/send` (send_email_template). Sequences +
  transactional email require specific HubSpot product tiers/scopes — confirm the
  customer's plan includes them.
- **Follow Up Boss**: `POST /v1/textMessages` (send_text_template), `POST /v1/actionPlansPeople`
  (schedule_action_plan) — confirm the account has texting + action plans enabled.
- **Sierra Interactive**: drip-enrollment endpoint (`send_drip`) — confirm API shape.
- **Buildium**: `charge_late_fee` posts a lease transaction (MOVES MONEY) and
  `send_tenant_msg` messages a resident — verify endpoints + that the customer wants
  agents touching ledgers at all.
- **QuickBooks**: `POST /v3/company/{realmId}/invoice/{id}/send` (send_invoice).
- **Salesforce**: `/actions/standard/emailSimple` (send_email_template) — org must have
  the action enabled.

### 2. Gating-policy decision: gate-all vs outbound-only
Most connectors gate **every** mutation (internal record edits AND outbound). **Gmail**
gates **outbound-only** (`compose_from_template`, `schedule_send`); its internal
mailbox ops (`draft_message`, `label_message`, `archive`) are ungated, matching the
established wave-2 marketplace model (drafts/notes/labels = internal, not outreach).
**Decision needed:** unify the policy. Recommend outbound/money-only gating everywhere
(matches `project_no_outbound_architecture.md` + the wave-2 precedent that leaves
`create_invoice` / `create_note` ungated) — the other connectors currently over-gate
internal writes, which is safe but inconsistent and adds operator-approval friction.

### 3. Approval-card rendering is generic
`CONNECTOR_WRITE_ACTION` renders one generic card (connector + action + detail fields)
in `/approvals` (`renderApprovalPayload.ts`). Good enough to ship; a per-connector
richer render (e.g. a deal card, an invoice card) is a future polish.

### 4. Migration on deploy
This PR adds the `CONNECTOR_WRITE_ACTION` value to the `WorkApprovalKind` enum
(`prisma/migrations/20260618000000_add_connector_write_action_kind/`). Deploy runs
`prisma migrate deploy` — additive enum value, safe, no backfill.

### 5. Marketplace smoke fixtures still deferred
Salesforce, Notion, Follow Up Boss, Sierra, and Buildium remain in the wave-1
marketplace-smoke `DEFERRED` set — each now has its own `write-actions.test.ts` +
dispatch test, but a full marketplace value-loop fixture (read→write→audit against a
seeded workspace) is a follow-up wave.

---
## Visible killer-workflow runtime + 5 vertical synthetic-data demos

Shipped: `feat(demo): visible killer-workflow runtime + 5 vertical synthetic-data demos`
(branch `feat/killer-workflow-runtime-2026-06-17`).

What it does: a brand-new trial workspace with nothing connected and an empty
queue now leads its **Today** view (and the standalone `/demo` page) with its
vertical's killer workflow **visibly running** on obviously-synthetic data —
step by step (catch → enrich → draft → schedule → log), with a saved-time
counter ticking ("Plaino drafted 3 first touches · saved 27 minutes today").
Deterministic and LLM-free, so it proves value even while the model key is
paused. Steps aside the moment real drafts/handoffs land.

### Decisions / actions needed

1. **Review + merge the PR.** This is the trial→paid conversion surface. No
   migration, no new dependency, no LLM call — additive and reversible.

2. **Real-data runs still need the paused `ANTHROPIC_API_KEY` restored.** The
   *demo* does NOT depend on it (it runs on synthetic data, deterministically).
   But once a customer connects a tool, the same workflow running on *their*
   work is fleet/LLM-driven — that path is dark until the key is un-paused.
   The demo's "make it real" CTA promises this; the promise is honest only
   when the key is live.

3. **Confirm the conversion bet (informational, not blocking).** Demo mode
   leads the Today view whenever a workspace has zero pending approvals and
   zero recent handoffs — i.e. brand-new or quiet workspaces. If you'd rather
   gate it to trial-only or first-session-only, that's a one-line predicate
   change in `lib/demo/demo-mode.ts`.

4. **Saved-time numbers are calibrated, not measured.** Every figure on screen
   is `sum(per-action minutes × item count)` from a defensible table in
   `lib/workflows/runtime.ts` (drafted email = 10 min, lead enrichment = 5 min,
   doc request = 3 min, …), labeled "an estimate on sample data" wherever it
   renders. If you want different anchor values, they live in one `ACTION_MINUTES`
   map.
