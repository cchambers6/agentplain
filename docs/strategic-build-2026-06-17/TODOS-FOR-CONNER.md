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

- [x] **Chat retention default: account lifetime (ratified 2026-06-18).** Plaino
  never forgets the business — conversation history is kept for the life of the
  account and hard-deleted on cancel. No tier defaults to a finite window. Opt-in
  auto-purge is available per-workspace (`WorkspacePreference.chatRetentionDays`)
  or per-thread (`ChatThread.retentionDays`) for customers who explicitly request
  it; a one-line change in `lib/plaino/chat-retention.ts` if you ever want a
  vertical (e.g. law) to *default* finite. *(An early draft of PR #306 set default
  = 2 days for all tiers; reversed per Conner before merge.)*

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

---

## Voice integration layer (Twilio) — `feat(voice): Twilio integration layer + per-vertical voice playbooks`

The entire voice layer is built and ships behind env-gated readiness checks: every
surface degrades gracefully (the settings panel shows "your phone line isn't live
yet"; the numbers route returns a clean 503) until the accounts below exist. The
moment the env vars are set, it's plug-and-play.

**Accounts & credentials**
- [ ] **Twilio account** — add `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` to Vercel env (Production). The auth token also signs/validates inbound webhooks.
- [ ] **Buy a phone number** — first toll-free or local number (~$2/mo). Map it to a workspace via `VOICE_NUMBER_MAP` env (`{"+18005550100":{"workspaceId":"<ws-uuid>","verticalSlug":"cpa"}}`) until the `VoiceNumber` table lands.
- [ ] **A2P 10DLC registration** — required for the SMS path (~10-day carrier approval). Not needed for voice-only, but register early.
- [ ] **STIR/SHAKEN Voice Integrity** — register for attested caller-ID so outbound caller-ID isn't flagged as spam.
- [ ] **Voice synthesis** — add `ELEVENLABS_API_KEY` (preferred) or `CARTESIA_API_KEY` to Vercel env.
- [ ] **ConversationRelay host** — stand up the always-on WebSocket server (`lib/voice/conversation-relay/server.ts`) on Render/Fly/a small VM (Vercel can't hold a long-lived socket); set `VOICE_RELAY_WSS_URL` to its `wss://` URL and `VOICE_PUBLIC_BASE_URL` to the app's https origin.
- [ ] **Transcript webhook secret** — set `VOICE_TRANSCRIPT_WEBHOOK_SECRET` (a long random string) and attach it as the bearer token when creating the Conversation Intelligence webhook action.

**Compliance & policy**
- [ ] **Call-retention policy + per-state consent language** — confirm the two-party-consent state list in `lib/voice/recording.ts` with counsel, and approve the spoken recording-disclosure copy. Recording stays OFF for every workspace until the owner approves the `VOICE_RECORDING_CONSENT` card on /approvals.

**Deploy note**
- [ ] The production deploy (`npm run build` → `prisma migrate deploy`) applies migration `20260618000000_voice_recording_and_action_item_kinds` (two additive `WorkApprovalKind` enum values: `VOICE_CALL_ACTION_ITEM`, `VOICE_RECORDING_CONSENT`). Purely additive — no existing data changes.

**Once live, install the SDK on the relay host:** `npm install twilio ws` (both are lazy-imported via non-literal specifiers, so the app builds and the unit tests pass without them today).

---

## Integrations: customer-brought vs we-bring split

_From `feat(integrations): customer-brought vs we-bring split with cost attribution`._
_Context: `docs/connections/byo-vs-we-bring.md`._

- [ ] **Twilio billing model.** Pass-through is wired with a **flat 0% markup
      (at cost)** as the default. Decide: pass-through **with a markup %** (and
      what %), or a **flat-rate-per-channel** model instead. Code:
      `DEFAULT_PASS_THROUGH_MARKUP` in `lib/integrations/wb/passthrough.ts` —
      one constant + the `markupFraction` arg already plumb it through.
- [ ] **Embedding cost model.** Currently **fully absorbed** with a high soft
      fair-use cap (50M tokens/period). Decide: keep absorbed, or **meter it at
      Max tier**? Code: `openai-embeddings` entry in
      `lib/integrations/wb/registry.ts` (flip `costModel` / `fairUseCap`).
- [ ] **BYO LLM option.** Should we offer "**bring your own Anthropic/OpenAI
      key**" (hosted-by-them reasoning)? Decide: offer in **Max tier**, **Custom
      only**, or not yet. Today it's documented as a power-user path but not
      built. Same question applies to **BYO S3** for memory storage.
- [ ] **Sign off on the categorization.** Review the full list in
      `docs/connections/byo-vs-we-bring.md` (or run
      `npx tsx scripts/classify-connections.ts`). Move anything you disagree
      with: a connection's bucket is one field — `sourcing` on a marketplace
      entry, or `costModel` on a we-bring registry entry.

---

## Item 6 — Knowledge corpus (pgvector RAG + GA free-source ingestion)

PR: `feat(knowledge): pgvector RAG + ingestion of GA free-source corpora (RE/CPA/Law/PM)`

The pgvector substrate, embedding pipeline, retrieval, and citation
rendering **already existed on `main`** (`lib/knowledge/`, `prisma`
`KnowledgeDocument`/`Embedding`, the chat grounding path). This item added
what was missing: jurisdiction-awareness, the ingestion framework
(`scripts/corpus-ingest/`), real GA free-source content (60 cited chunks),
the weekly refresh cron, and a dedicated `Citation` component. The
following need your call / your account:

- [ ] **Decide: free-only corpus (zero ongoing cost) vs. paid sources later.**
  V1 ships free public sources only (O.C.G.A., GREC, IRS publications, GA
  DOR, GA Bar Rules). Paid options if we want deeper/benchmark data:
  ALM legal (~$15–30K/yr), Tax Notes (~$5–10K/yr), RealPage benchmarks
  (~$10–30K/yr), Stessa landlord data (variable). The framework already
  supports adding a paid source as a new `CorpusSource` with a real
  `fetch()` — no architecture change needed.

- [ ] **Verify Twilio Enterprise Knowledge as an alternative** to rolling our
  own pgvector. A `twilio-enterprise-knowledge` MCP exists and may be
  simpler to operate. (We did NOT rebuild pgvector — it was already on
  `main` — so this is a "should we migrate the substrate later" question,
  not a "which to build" one.)

- [ ] **Sign off on use of public state-law content.** No licensing issue with
  public statute/regulation/agency text, but counsel should bless surfacing
  it as grounding for customer answers. Note: the corpus is stored as
  `COMPLIANCE`-kind knowledge; the existing `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`
  sentinel gate governs agentplain's own marketing *claims*, NOT this
  reference corpus — they're independent. Plaino is instructed to attribute
  facts to the cited public source and never assert an ungrounded rule.

- [ ] **OpenAI account for embeddings** (cheap: ~$0.02 per 1M tokens for
  `text-embedding-3-small`). Initial ingestion of all GA sources costs
  ~$0.0004–10 total (60 chunks ≈ 21k tokens). Add `OPENAI_API_KEY` to
  Vercel. Until then: the corpus framework runs locally against the
  deterministic test embedder, and the **weekly refresh cron is safe to
  enable now** — it refuses to write hash vectors into prod pgvector when
  the key is absent (falls back to a report-only dry run) and a no-change
  week costs $0 regardless. Once the key lands, run
  `npx tsx scripts/corpus-ingest/run.ts` once to embed the initial corpus.

### Follow-ups (engineering, not account-gated)
- Add a `Workspace.state` column so retrieval reads the workspace's real
  jurisdiction instead of defaulting to `["GA","US"]`
  (`app/api/chat/route.ts#WORKSPACE_JURISDICTIONS`, TODO marked inline).
- Persist corpus `citation` + `jurisdiction` into the in-app dispatcher's
  `PersistedChatMessage.metadata.citations` so the richer `Citation` modal
  (source link + jurisdiction + excerpt) lights up on the `/talk` surface
  as well as the support chat. The component + `extractCitations` already
  read those fields when present.
- Implement live `fetch()` scrapers per `CorpusSource` (pull + parse the
  GREC/Justia/IRS HTML) to replace the curated arrays. The seam exists;
  V1 is curated + citation-verified.

---

## Item 5 — Client portal (`feat(portal): per-customer client portal`)

Account-needed / decision-gated items parked by the strategic build. Each is a
deliberate boundary the code already respects (truthful degraded state, no
fabrication) — flipping it on is a credential or a decision, not more code.

The portal ships fully working on its safe defaults: slug-based routing, the
`ref` storage adapter (records uploads, keeps them quarantined), and the
fail-closed `noop` scanner (uploads stay PENDING until a real scanner clears
them). Everything below turns capabilities from "wired and safe" to "live."

- [ ] **Custom-subdomain strategy.** Decide `portal.{customer-domain}` (requires
      per-customer DNS work) vs. the shipped `agentplain.com/portal/{slug}`
      (zero setup). Recommendation: stay on slug-based routing for V1 — it's
      live now, needs no DNS, and the `PortalConfig.slug` is already independent
      of the workspace slug so a vanity address is a later, additive change.

- [ ] **ClamAV REST: self-hosted vs. VirusTotal.** The virus-scan port
      (`lib/portal/virus-scan.ts`) ships fail-closed: with no scanner, every
      upload stays PENDING (quarantined, never downloadable). To enable
      scanning, decide:
        - **Self-hosted (free OSS, recommended):** stand up a ClamAV REST worker
          (e.g. `clamav-rest` on Fly.io / Render / a small Vercel-adjacent
          worker), then set `PORTAL_CLAMAV_URL=<worker-url>` and
          `PORTAL_VIRUS_SCAN=clamav`.
        - **VirusTotal API ($$$):** higher accuracy, per-scan cost; would need a
          small adapter alongside `ClamAvRestScanner`.
      Until one is wired, document uploads are accepted but never released.

- [ ] **Vercel Blob for real uploads.** Storage ships behind a port with a
      no-account `ref` default. To persist real bytes: `npm i @vercel/blob`, set
      `BLOB_READ_WRITE_TOKEN` (from the Vercel dashboard), and set
      `PORTAL_STORAGE=blob`. The `@vercel/blob` package is intentionally NOT a
      dependency yet (kept optional via a guarded dynamic import) so the build
      stays green without it.

- [ ] **Email-from-customer-domain policy.** Invite emails currently send from
      agentplain's Resend sender, branded with the owner's name in the copy
      (with the owner's `replyTo` when provided). Sending *from* each owner's
      own domain requires per-customer Resend custom-domain config (DNS:
      SPF/DKIM). Decide the policy: agentplain-sender-with-owner-replyTo (today)
      vs. per-customer verified domains (more setup, better deliverability +
      trust). We have Resend; this is per-customer onboarding, not new code.

- [ ] **(Optional) Owner setup UI.** The portal is provisioned via
      `POST /api/portal/setup` and clients invited via `POST /api/portal/invite`
      (both owner-gated). A workspace-settings screen to drive these from the
      product UI is a natural follow-up — the API contract is stable.

---

## Item 8 of 9 — Trial guarantee (time-savings tracking + Day-7 walk-away)

PR: `feat(guarantee): time-savings tracking + Day 7 walk-away offer + auto-refund`

- [ ] **Sign off on the bar.** Default is **5 hours saved by day 7**
  (`GUARANTEE_BAR_HOURS`, env-tunable, no deploy needed). Higher bar =
  stronger marketing claim but harder to clear; lower = easier to clear but
  weaker promise. Confirm 5, or set per-vertical (a CPA month-end close
  saves more hours than a one-person home-services shop — the calibration
  already differs per vertical, the bar could too).
- [ ] **Sign off on the time-saving calibrations.** These numbers are
  **customer-visible** — they render on the workspace counter and decide the
  Day-7 evaluation. They live in one file:
  `lib/guarantee/savings-calibration.ts`. Current base estimates (minutes):
  drafted email 10, lead enrichment 5, document chased 3, meeting scheduled
  8, invoice prepared 6, tenant notice 12, admin task 4. They are
  deliberately conservative (the "by hand" floor). Do **not** inflate — the
  number has to survive a customer doing the math, or you lose them on day 7.
- [ ] **Decide the refund window.** Currently: the walk-away offer surfaces
  from day 7 through day 14 (a one-week action window) and a tap triggers an
  instant full refund. Confirm instant Day-7 walk-away, or extend to a
  longer money-back window (e.g. 14-day or 30-day money-back). The window is
  a code constant today (`evaluationDays + 7` in the workspace loader) —
  promote to env if you want it tunable.
- [ ] **Decide the data-deletion policy.** Walk-away currently does a
  **hard delete** (GDPR-clean): it runs the existing audited workspace
  teardown — knowledge docs + embeddings, approvals, chat, memory,
  integration tokens, the time-savings ledger — and marks the workspace
  CLOSED. Billing history (Subscription/BillingEvent/AuditLog) and the empty
  Workspace/Membership rows are preserved for refund reconciliation + audit.
  Confirm hard-delete, or switch to anonymized-retain if you want the
  aggregate analytics.
- [ ] **Flip the refund kill-switch when ready.** Money movement on a
  walk-away is gated by `GUARANTEE_WALKAWAY_REFUND` (default **on**) **and**
  `STRIPE_BILLING_ENABLED`. While billing is disabled (today), a walk-away
  still deletes data + closes the workspace and **pages a human** to issue
  the refund manually — never silent. Once Stripe billing is live and the
  bar is ratified, the auto-refund path runs end-to-end with a per-workspace
  cap (`GUARANTEE_REFUND_CAP_USD`, default $500; above cap → refund to cap +
  page a human for the remainder).
- [ ] **Marketing copy is intentionally qualitative.** The public
  `/guarantee` page does **not** publish the exact hours-saved number — it
  says "clearly saved you time," not "5 hours" — to avoid pinning us to a
  figure before sign-off and to avoid gaming. If you want the precise bar
  public, that's a copy change once the number is ratified.

---

## Item 9 — Multi-employee team support

Shipped in `feat(team): multi-employee roles, context-aware routing, playbook generator`.

- [ ] **Pricing for team seats.** `lib/billing/tiers.ts` does not separate
      per-seat pricing today — a workspace is billed at one plan price
      regardless of headcount. Multi-employee support makes seats a real
      cost axis. **Decide:** per-seat add-on, seats bundled into the plan,
      or unlimited seats on Partner+ (and a seat cap on Regular)? The team
      surfaces are built and live; nothing in this PR changed `tiers.ts`
      (load-bearing rule). Wire the chosen model in a follow-up.

- [ ] **Invite-acceptance UX.** Invites currently create a Membership in
      `INVITED` status (inert until the user signs in) — but the actual
      acceptance path is parked. **Decide:** email magic-link only (reuses
      the existing `MagicLinkToken` flow), or add SSO as an option once a
      team is large enough to warrant it? Today an invited seat shows on
      the roster as "invited" and grants nothing until acceptance lands.

- [ ] **Visibility defaults.** **Recommendation (implemented):** full
      visibility for owner + manager (OWNER/ADMIN); staff (MEMBER) and
      viewers see only their own activity + work assigned to them. Confirm
      this is the right default, or flip to a configurable per-workspace
      toggle if a customer asks for tighter or looser sharing. The rule
      lives in `lib/team/activity.ts#visibleActivityFor` and is unit-tested
      (staff never receives a teammate's PII-bearing row).

### Follow-ups (codeable, not Conner-gated — noted so they aren't lost)
- Wire `lib/team/routing.ts#resolveWorkRouting` into the per-skill approval
  sinks so tag/urgency context actually stamps `requiredApproverUserId` at
  insert time. Today the richer routing is a usable library + the wave-6
  discipline-head routing (`lib/auth/route-approval.ts`) remains the live
  path. Equivalent for the discipline-only case; the superset adds
  URGENT→owner, tag→lead, and intake-assigned-staff.
- Optional LLM polish pass on the playbook (behind the existing degraded-
  mode seam) once the ANTHROPIC_API_KEY is restored — the generator is
  deterministic/heuristic today by design (no key needed).

---

## 🚨 Vercel deploys red — Neon database outage (diagnosed 2026-06-19)

**Symptom:** "Vercel: failure" red on `main` and all open PRs for ~5h; blocking
deployment of merged work.

**Root cause (two layers):**

1. **Neon is unreachable from Vercel (DB-side — needs you).** Every build hit
   `Error: P1001: Can't reach database server at
   ep-aged-snow-aq0e4b6k.c-8.us-east-1.aws.neon.tech:5432` and died in ~14s.
   The host is unchanged from the last green build (so `DATABASE_URL` is **not**
   stale) and it's `P1001` (unreachable), not `P1000` (auth) — credentials are
   fine. The failure is instant (~80ms), not a slow timeout, which points to the
   **compute endpoint being suspended/disabled or the Neon project itself
   suspended** (quota/billing) rather than a cold-start hiccup. **I cannot fix
   this from code or CLI** (and per policy I won't touch Vercel/Neon env or
   secrets).
   - **ACTION:** Open the Neon console for project `neondb` /
     endpoint `ep-aged-snow-aq0e4b6k` (us-east-1). Check: is the compute
     **suspended/disabled**? Is the **project suspended** for plan limits or
     billing? Any Neon status-page incident? Resume/re-enable the compute. Once
     `psql "$DATABASE_URL_DIRECT" -c 'select 1'` succeeds, production deploys
     will recover.

2. **The build command made one DB blip redden *everything* (fixed in PR #307).**
   The build ran `prisma generate && prisma migrate deploy && next build` on
   **every** build, so `migrate deploy`'s direct Neon connection gated even
   docs-only preview builds — and preview builds were silently applying
   migrations to the **production** DB (shared `DATABASE_URL`). PR #307 gates
   `migrate deploy` to `VERCEL_ENV === "production"` only; previews are now
   DB-free and went **green** (verified) even with Neon still down.

**A second, previously-hidden break (also fixed in PR #307):** because every
build died at `migrate deploy` before `next build` ran, nobody saw that #298
added `lib/memory/byo-storage.test.ts` with `eslint-disable
@typescript-eslint/no-explicit-any` comments — but that plugin isn't installed,
so `next build`'s lint stage errored ("Definition for rule … was not found").
PR #307 excludes colocated `*.test.ts(x)` from build lint + typecheck.

**What's still on you after merging PR #307:**

- **Production (`main`) stays red until Neon is reachable.** This is by design —
  production builds still run `migrate deploy`, and we should NOT ship a
  schema-dependent app against an un-migrated/unreachable DB. Resolve item (1).
- **One pending migration must apply on the next healthy production deploy:**
  `20260617000000_memory_scale_rls_tiering_byo` (from #298). It has never been
  applied (all builds since it merged failed). Once Neon is back, the first
  production deploy's `migrate deploy` will apply it; verify with
  `npm run migrate:status`.
- **To clear the other open PRs:** merge PR #307, then rebase the remaining open
  PRs onto the new `main` so they pick up the DB-free preview build (their own
  previews currently still run the old build command and will keep redding on a
  Neon blip until rebased).
- **Optional hardening (future):** move production `migrate deploy` out of the
  Vercel build entirely into a dedicated GitHub Action on `push: main` (the repo
  already runs Actions). That decouples schema migration from the build lifecycle
  per Prisma's serverless guidance. Not done here because it requires adding a
  `DATABASE_URL_DIRECT` repo secret (your call).

---

## Item 10 — Brand voice de-AI-fication (guidelines + gate)

Shipped in `feat(brand): voice guidelines + anti-pattern gate (de-AI-fication)`.
New source of truth: `docs/brand/voice-guidelines-2026-06-19.md`. Enforced by
`tools/brand/voice-gate.mjs` (ratchet, baseline = 31 existing violations frozen;
only NEW tics fail the build). Audit: `docs/brand/voice-audit-2026-06-19.md`.

- [ ] **Approve the anti-pattern catalog (§3).** The four banned families —
      VA (LLM-ese vocab: delve, tapestry, realm, "navigate the landscape"…),
      VB (the "not just X, it's Y" antithesis reflex), VC (sycophantic/chatbot
      openers: "Great question!", "dive in", "rest assured"), VD (essay
      scaffolding + launch-ese) — are now build-enforced on new copy. Confirm the
      list, or strike/add words. Family E (hype) is left to the existing
      `brand-gate.mjs` R4 to avoid double-counting — confirm that split is right.

- [ ] **Sign off the per-persona voice attributes (§6) and the Plaino register.**
      Founder voice = direct, plain, CAPS-for-emphasis (extracted verbatim from
      your 2026-05-11 notes — see §7 attributions). Plaino = calm, grounded,
      honest about limits, never gushes, never claims to be human. Product copy =
      plain/concrete, punchy in titles, warm in flows. Confirm these are right, or
      adjust the founder/Plaino characterization before it becomes canon.

- [ ] **Confirm the em-dash spam threshold.** The gate flags 3+ em-dashes in one
      line (one or two are fine — em-dashes are not banned, *spam* is). The audit
      found this is the dominant residual AI tell (30 of 31 violations). If you
      want it stricter (flag 2+) or looser (4+), say so and I'll re-baseline. The
      worst offender today is `components/faq-items.ts` (6 lines, one with five
      em-dashes) — a one-file rewrite clears most of the rendered-surface debt.

### Follow-ups (codeable, not Conner-gated)
- The 31 baseline violations are the de-AI-fication work-list (audit doc §P1/§P2).
  Sibling/marketing sessions own the copy edits; re-baseline as waves land so the
  count ratchets toward zero (same path `brand-gate.mjs` took to zero, #227–#234).
- Once the catalog is approved, consider folding the §3 word-families that overlap
  nobody else's gate into the same pre-commit pass brand-gate uses, for parity.
## De-AI-fication content sweep (2026-06-19) — item 3 of 4

Surgical voice sweep across marketing + product + email + voice. Full report:
`docs/brand/content-sweep-violations-2026-06-19.md`. PR rewrites 11 files; the
copy was already strong, so this was targeted cleanup, not a rewrite.

- [ ] **Sign off on the highest-impact rewrites.** The PR surfaces ~12 before→after
      pairs. The ones most likely to draw an opinion: the four "Not magic / pixie
      dust" tricolons replaced with "working software, the people who run it, and a
      brokerage we run it on" (homepage, about, custom ×2), and the five vertical
      day-in-the-life scenarios that now name a person (Dana/insurance,
      Priya/recruiting, James/ria, Maria/property-management, Rosa/title-escrow).
      The named people are illustrative composites mapped only to facts already in
      each scenario — no new claims. If you'd rather keep the verticals faceless,
      say so and I'll revert the names.
- [ ] **Decide per-vertical tone calibration.** Defaults lean: CPA = tax-season
      grind, Law = billable-hour pressure, PM = 10pm maintenance call, RE = the
      9:14pm deal, General = tired-owner-no-specifics. Tell me if any vertical should
      read warmer/harder/more technical and I'll retune.
- [ ] **Truthfulness fix to confirm (not just a style edit):** "first month free"
      → "7-day free trial" on `/how-it-works` and `/waitlist`. Those two surfaces
      were missed by the #262/#290 trial-policy correction and contradicted the rest
      of the site. Confirm 7-day is current policy (it is everywhere else) — if the
      policy actually changed, tell me and I'll align all surfaces instead.
## De-AI-fication wave 2 — distinctive visual system (2026-06-19)

Source: `docs/brand/design-mirror-2026-06-19.md` (seven-brand mirror) + the
additive token/component work shipped in the same PR. All changes are additive —
no existing surface was restyled; the new primitives are demonstrated on the new
internal `/style` guide. Three decisions are yours:

- [ ] **Sign off on the analysis + which brands' patterns to lean into.** The
      mirror studied Linear, MUJI, Patagonia, early Stripe, pre-Intuit Mailchimp,
      heritage Americana (Filson/Pendleton/Yeti/REI/Coors), and the robot-dog
      precedents (Boston Dynamics/Aibo). **Recommendation:** lean hardest into
      **Patagonia + heritage Americana** (nearest to our plains/service-partner
      positioning) for tone and photography, **MUJI** for tonal layering, and
      **Aibo/Boston Dynamics** for the Plaino "posture not a face" discipline.
      Confirm, or re-weight.

- [ ] **Approve the new color tokens.** Five support tokens were added through the
      canonical channel (`lib/brand/tokens.ts` → `globals.css` → `tailwind.config.ts`
      → `brand-gate.mjs`), so the brand gate stays green: `forest` #1F3D2E (deep
      field band), `wheat` #C8A24A (the **rare second accent** — the one to scrutinize;
      ≤1 use per long page, clay stays primary), `paper-bright` #FCFAF4 (no-shadow
      surface lift), `clay-wash` #F3E7E0 (pull-quote/highlight band), `mid-rule`
      #D9D5C7 (figure-frame hairline, already gate-known). See them all live on
      `/style`. **Decide:** approve all five, or drop `wheat` if a second accent
      feels like drift from the single-charge rule.

- [ ] **Decide whether to invest in custom illustration** (vs. continuing the
      current Plaino-PNG + line-motif style). The mirror's strongest "human" signal
      across Mailchimp + heritage brands is hand-made illustration with visible
      imperfection. We have the Plaino pose system already; the open question is
      whether to commission **real photography of local-business work** (graded
      with the new `.img-heritage` treatment, which currently has no production
      photo to attach to) and/or bespoke hand-drawn vertical motifs. This is a
      spend decision — route through `CreatorBrief` (`lib/creative-handoff`) if yes.
## De-AI-fication item 4 — distinctive per-vertical visual assets (2026-06-19)

Replaced the generic / ultra-minimal placeholder imagery with a distinctive,
on-brand, vertical-grounded visual system: rich hero scenes (Plaino *in
context* — closing table, CPA desk, law lectern, PM truck, kitchen-table
office), "how it works" illustrations, social share cards, and a per-vertical
OG endpoint. All generated deterministically from
`tools/brand/gen-vertical-scenes.mjs` (brand tokens only; regenerable).

- [ ] **Sign off on the visual style direction.** The PR ships sample renders
      (hero scenes + social cards + step illustrations) for the 5 priority
      verticals (real-estate, cpa, law, property-management, general). Confirm
      the heritage-illustration direction, then we extend the same generator to
      the remaining 5 verticals.
- [ ] **Sign up for Adobe Express / Canva** if we want templated photographic
      variants. This wave used the project's own brand-token SVG generator (no
      external account needed); Adobe/Canva (via the small-business plugin)
      require an authenticated account to drive `adobe-design-from-template` /
      `canva-creator`. TODO only if we want that route.
- [ ] **Decide whether to commission professional photography** for the
      Plaino-vertical-context moments. They are currently brand-illustrated
      (vector Plaino in the heritage idiom), which is why the scene slots stay
      flagged `isMotifScene` in `PlainoScene.tsx` — a real raster/photographed
      scene can drop into the same `/scenes/` path later with one line changed.
