# Integration roadmap V2 — 2026-05-19

**Author:** agentplain build pod
**Branch:** `docs/integration-roadmap-v2-2026-05-19` (off `origin/main` @ `436d5bf`)
**Scope:** Expanded per Conner's 2026-05-19 ask — Microsoft full suite (Teams, OneDrive, Excel, OneNote, etc.) + payments + paperwork tools, mapped to the ten locked verticals + `/general`.
**Voice anchor:** rooted, not pitchy. Per `feedback_everything_tells_a_story.md` — every integration earns its place.
**Estimate convention:** S / M / L / XL based on adapter complexity, anchored to **Gmail MCP as the reference "M"** (`lib/integrations/gmail-mcp/` — 5 files: `auth.ts`, `index.ts`, `json-rpc.ts`, `server.ts`, `test-server.ts`, plus `types.ts` and `lib/integrations/google/oauth.ts` + `lib/integrations/google/webhook-handler.ts`). Per `feedback_no_guesses_no_estimates.md` no day counts appear in this doc — sizes describe *adapter complexity*, not calendar time.

---

## 1. Where we are today (2026-05-19 baseline)

Every status cell cites a file path, a git ref, or a prod HTTP response. No "should be working."

| Surface | Status | Evidence |
|---|---|---|
| **Gmail MCP** | Shipped; OAuth env vars NOT YET configured in prod | `lib/integrations/gmail-mcp/{auth,index,json-rpc,server,test-server,types}.ts` on `origin/main`. Operator setup steps documented in `docs/operator-integrations-setup.md` Steps 1–8. Per `docs/pre-pilot-ship-readiness-2026-05-18.md` §2 row 5: "**No `IntegrationCredential` row observed in production for any real Gmail account.**" |
| **Outlook MCP** | Shipped (Phase B merged); OAuth env vars NOT YET configured in prod | Phase B landed via PR #46 (commit `8aa8ed5`, merged at `9c32b4d` 2026-05-18). Files: `lib/integrations/outlook-mcp/{auth,index,json-rpc,server,test-server,types}.ts` + `lib/integrations/microsoft/{oauth,subscriptions,webhook-handler}.ts`. Operator setup steps documented in `docs/operator-integrations-setup.md` (Microsoft section, Steps 1–7). |
| **Stripe (billing only)** | Shipped, live mode unverified | `lib/billing/stripe-provider.ts:62-75` — `apiVersion: "2026-04-22.dahlia"` pinned per commit `9ab106a`. Webhook receiver at `app/api/stripe/webhook/route.ts:23-64`. **No live $-test charge has been completed** per pre-pilot audit §3 S2. Stripe-as-billing is distinct from Stripe-as-customer-payment-acceptance (Tier 3a item below). |
| **Marketplace UI v1** | Shipped | `lib/integrations/marketplace.ts:56-161` — 9 entries total: 2 `available` (Gmail, Outlook), 7 `coming-soon` (QuickBooks, HubSpot, DocuSign, Slack, PayPal, Canva). Tile catalog feeds `/app/workspace/[id]/integrations`. Coming-soon tiles funnel through `/custom?type=integration-waitlist` per `marketplace.ts:212-214`. |
| **Knowledge substrate MCP** | Shipped | `app/api/knowledge/mcp/route.ts`. Reseeded 2026-05-18 via PR #44 (commit `6bc95e5`). |
| **5-skill value loop on real inbox** | Not yet observed end-to-end | Per pre-pilot audit §3 S1: "Every layer is built; we have unit-test confidence in the parts but zero end-to-end confidence that a Gmail Pub/Sub push at agentplain.com results in a draft landing in the customer's Gmail Drafts folder." This is the load-bearing gate before any V2 integration ships behind it. |

**What "shipped" means here:** MCP server lives in `lib/integrations/<slug>-mcp/`, OAuth start + callback routes are mounted, webhook receiver (where applicable) parses + writes `WebhookEvent` rows, marketplace catalog entry has `status: 'available'`. It does NOT mean the value loop has been observed firing on a live customer inbox — that bar is `feedback_integration_acceptance_is_functional.md`, and it has been crossed by zero integrations.

**Implication for the V2 schedule:** Week 1 below is not a new build — it is closing the verification gap on what already shipped. Nothing else lands until that gate is open.

---

## 2. Tier table

Every entry has: **What it unlocks** (which of the 10 verticals + `/general` benefit most), **Auth model**, **Effort**, **Dependencies**, **Shares OAuth app** (the leverage point).

Per `project_no_outbound_architecture.md`: no entry below requests a send/dispatch scope. Twilio + WhatsApp Business appear as **inbound webhook receivers only** — agentplain reads inbound messages and drafts replies; the customer's system sends. Per `feedback_no_silent_vendor_lock.md`: every entry below resolves to a `lib/integrations/<slug>-mcp/` adapter behind the marketplace catalog seam — no scattered SDK calls.

---

### Tier 1 — Email + Calendar (the value loop's substrate)

These are the only integrations the 5-skill chain (`lib/skills/{read,categorize,coordinate,schedule,draft}.ts`) directly depends on. Every other tier below is *enrichment* on top of these.

| Integration | Unlocks | Auth | Effort | Deps | Shares OAuth |
|---|---|---|---|---|---|
| **Gmail** | All 10 verticals + `/general` | Google OAuth 2.0 + Pub/Sub OIDC | shipped | Google Cloud Project (`docs/operator-integrations-setup.md` Steps 1–8) | n/a (own app) |
| **Outlook (Mail)** | All 10 verticals + `/general` | Microsoft Entra ID OAuth 2.0 (delegated) + Graph webhook validation handshake | shipped | Azure AD app registration (`docs/operator-integrations-setup.md` Microsoft Steps 1–7) | **shared Outlook OAuth app** — basis for all Tier 2 Graph extensions |
| **Google Calendar** | Mortgage, recruiting, home services, law, RIA, real estate (showings); `/general` | Google OAuth 2.0 — same client as Gmail, added scope | **S** (adapter; reuses Gmail-MCP's auth surface) | Gmail shipped; add `calendar.events.readonly` + `calendar.events` scopes | **shared Gmail OAuth app** — single consent screen update |
| **Outlook Calendar** | Same as Google Calendar | Microsoft Graph delegated | **S** (adapter; reuses Outlook-MCP's auth surface) | Outlook shipped; add `Calendars.Read` + `Calendars.ReadWrite` to existing Graph app | **shared Outlook OAuth app** |

**Rationale Tier 1 is named Tier 1:** without email + calendar, the 5-skill chain has no input and no proposal target. Every later tier produces *better* drafts (reading docs, checking calendar, pulling CRM context, attaching paperwork), but Tier 1 is what makes the loop fire at all.

---

### Tier 2 — Microsoft Graph extensions (the cheapest leverage in the roadmap)

**The leverage point:** Microsoft Graph delegated permissions for Teams / OneDrive / Excel / OneNote / Word / Bookings all extend the **same Azure AD app registration** that the Outlook integration already created (`docs/operator-integrations-setup.md` Microsoft Step 1). The customer's *connect flow* is one new permission consent — the *infrastructure work* is adding scopes + an MCP server per surface. No new tenant approval round-trip, no new OAuth app, no new secret rotation cadence.

Per Graph docs (https://learn.microsoft.com/en-us/graph/permissions-reference, read 2026-05-19): every surface below uses delegated scopes against `graph.microsoft.com`, same as Outlook's `Mail.Read` + `Mail.ReadWrite` already in production.

| Integration | Unlocks | Auth | Effort | Deps | Shares OAuth |
|---|---|---|---|---|---|
| **Microsoft Teams** | All verticals (esp. property management, recruiting, law, RIA, CPA — internal coordination heavy) | Graph delegated: `ChannelMessage.Read.All`, `Chat.Read`, `Team.ReadBasic.All` | **M** (read-only; Graph change-notification webhooks for new messages) | Outlook shipped | **yes — Outlook app** |
| **OneDrive / SharePoint** | Title-escrow (closing docs), law (matters), CPA (engagement files), recruiting (resumes), real estate (transaction files) | Graph delegated: `Files.Read.All`, `Sites.Read.All` | **M** (read; large-file streaming considerations) | Outlook shipped | **yes — Outlook app** |
| **Excel (via Graph workbook API)** | CPA, RIA, mortgage, insurance (any vertical where the operator lives in spreadsheets) | Graph delegated: `Files.ReadWrite` (workbook write requires read+write on the file) | **L** (workbook API has session-scoped state, row/range addressing — larger surface than Mail) | OneDrive (workbook files live there) | **yes — Outlook app** |
| **OneNote** | Law (case notes), CPA (engagement notes), recruiting (candidate notes), RIA (advisor notes) | Graph delegated: `Notes.Read.All`, `Notes.ReadWrite` | **M** | Outlook shipped | **yes — Outlook app** |
| **Word (via Graph)** | Law (drafts), title-escrow (closing docs), CPA (engagement letters) | Graph delegated: `Files.ReadWrite` on `.docx` in OneDrive/SharePoint | **L** (document parsing + Open XML for structured edits is non-trivial vs. plain-text draft) | OneDrive | **yes — Outlook app** |
| **Microsoft Bookings** | Home services, mortgage, RIA, recruiting (any vertical with prospect-side scheduling) | Graph delegated: `Bookings.Read.All`, `BookingsAppointment.ReadWrite.All` | **M** | Outlook shipped | **yes — Outlook app** |

**Why this tier ships before payments + paperwork:** every Microsoft-shop customer in the locked ten gets ~6 integrations for the cost of ~6 MCP servers + scope additions, sharing one OAuth app. The marginal infrastructure cost of the 2nd–6th Graph surface is lower than any single non-Microsoft integration in Tier 3.

---

### Tier 3a — Payments + accounting

Each is its own OAuth app — no shared-app leverage. Sequenced by SMB breadth × per-vertical fit.

| Integration | Unlocks | Auth | Effort | Deps | Shares OAuth |
|---|---|---|---|---|---|
| **QuickBooks Online** | CPA, law, recruiting, property management, RIA, home services (every vertical with a bookkeeping surface) | Intuit OAuth 2.0; scope `com.intuit.quickbooks.accounting` (already declared in `lib/integrations/marketplace.ts:97`) | **M** (REST + webhook for entity-change notifications) | none | n/a |
| **Stripe-as-customer-integration** | Property management (rent collection), recruiting (placement fees), home services (deposits), CPA (engagement retainers), law (retainers) — distinct from agentplain's own billing | Stripe OAuth (Connect) or restricted-key API key per customer | **M** | none; reuses internal `lib/billing/stripe-provider.ts` abstractions where possible | n/a |
| **Plaid (bank connections)** | RIA (held-away balances), CPA (cash position), mortgage (income/asset verification), property management (rent ledger reconciliation) | Plaid Link client-side handshake → server `/link/token/create` + `/item/public_token/exchange` | **L** (multi-account, balance + transactions products, webhook for `TRANSACTIONS:DEFAULT_UPDATE`) | none | n/a |
| **Bill.com** | CPA, property management, law (trust accounting), RIA (vendor payments) | Bill.com REST API key per organization | **M** | none | n/a |
| **Square** | Home services (field collection), property management (rent at door) | Square OAuth 2.0; scope `MERCHANT_PROFILE_READ` + `PAYMENTS_READ` | **M** | none | n/a |
| **Xero** | CPA, law, RIA, recruiting (the QuickBooks alternative — same JTBD, different vendor) | Xero OAuth 2.0 | **M** | none | n/a |
| **Expensify** | CPA (client expense reports), recruiting (T&E reimbursement), property management (vendor expense routing) | Expensify Integration Server API (partner credentials) or OAuth | **M** | none | n/a |

**Per `project_no_outbound_architecture.md`:** none of the above issue payments, send invoices, or move money from agentplain's surface. Every payment-tier integration is **read + categorize + draft** — the draft is a Bill.com bill to approve, a QuickBooks reconciliation match to confirm, a Stripe refund to issue from the customer's dashboard. The customer's system executes; agentplain proposes.

---

### Tier 3b — Paperwork + signature

E-signature is where many vertical workflows actually close — title-escrow closings, law engagement letters, real estate disclosures, CPA engagement letters, insurance policy bind, recruiting offer letters. Critical SMB-backbone surface.

| Integration | Unlocks | Auth | Effort | Deps | Shares OAuth |
|---|---|---|---|---|---|
| **DocuSign** | Real estate, title-escrow, mortgage, law, recruiting, CPA, RIA, insurance | DocuSign OAuth 2.0 (Auth Code grant); scope `signature` + `extended` (already declared in `lib/integrations/marketplace.ts:120-121`) | **M** | none | n/a |
| **Adobe Sign (Acrobat Sign)** | Same verticals as DocuSign — the Adobe-ecosystem alternative; common in enterprise law + larger CPA firms | OAuth 2.0; scope `agreement_read` + `agreement_write` | **M** | none | n/a |
| **PandaDoc** | Recruiting (offer letters), home services (estimates), insurance (proposals), RIA (advisory agreements), law (engagement letters) | OAuth 2.0; scope `read+write` | **M** | none | n/a |
| **Dropbox Sign (formerly HelloSign)** | Mid-market verticals — same JTBDs as DocuSign, lower price point | OAuth 2.0; scope `request_signature` | **M** | none | n/a |

**Pattern across all four:** read envelopes/agreements + sent/received status + party fields, draft new envelopes from a template + supplied field values (the customer reviews and presses Send in their own DocuSign UI — agentplain does not press Send).

---

### Tier 4 — Communication

| Integration | Unlocks | Auth | Effort | Deps | Shares OAuth |
|---|---|---|---|---|---|
| **Slack** | All verticals (esp. property management, recruiting, law, RIA — internal-coordination-heavy) | Slack OAuth 2.0; scopes `channels:history`, `channels:read`, `users:read` (already declared in `lib/integrations/marketplace.ts:132`) | **M** | none | n/a |
| **Microsoft Teams** | (cross-listed from Tier 2) | Graph delegated | M | Outlook | **shared Outlook app** |
| **Zoom** | All verticals (meeting transcripts, scheduling) | Zoom OAuth 2.0; scope `meeting:read`, `recording:read`, `user:read` | **M** | none | n/a |
| **Twilio (inbound SMS only)** | Home services (job inquiries), real estate (lead texts), mortgage (borrower texts), recruiting (candidate texts) | Twilio webhook subscription via Programmable Messaging Inbound URL — no outbound API credentials stored | **M** (RECEIVER ONLY per `project_no_outbound_architecture.md` §3) | none | n/a |
| **WhatsApp Business (inbound only)** | Home services, real estate, recruiting | Meta WhatsApp Business API webhook subscription on the customer's WABA — RECEIVER ONLY | **L** (webhook signing differs from Twilio; richer media payloads) | none | n/a |

**Twilio + WhatsApp clarification per `project_no_outbound_architecture.md`:** agentplain receives inbound SMS/WhatsApp messages as webhook events, runs the 5-skill chain (categorize → coordinate → draft a reply), surfaces the draft on the approval queue. The customer's own Twilio account or WhatsApp Business Manager sends the approved reply. No `Twilio.messages.create` and no WhatsApp `sendMessage` call ever issues from `lib/integrations/`.

---

### Tier 5 — Scheduling

| Integration | Unlocks | Auth | Effort | Deps | Shares OAuth |
|---|---|---|---|---|---|
| **Calendly** | Mortgage, recruiting, RIA, home services, real estate (showings)| Calendly OAuth 2.0; scope `default` | **M** | none | n/a |
| **Acuity Scheduling** | Same verticals as Calendly — the Squarespace-ecosystem alternative | OAuth 2.0 or API key | **M** | none | n/a |
| **Microsoft Bookings** | (cross-listed from Tier 2) | Graph delegated | M | Outlook | **shared Outlook app** |

---

### Tier 6 — CRMs

CRMs are heavy adapters: read contacts/deals/activities + write notes + listen to webhook change events. Sequenced by vertical fit.

| Integration | Unlocks | Auth | Effort | Deps | Shares OAuth |
|---|---|---|---|---|---|
| **HubSpot** | All verticals — broadest SMB CRM footprint; scope already declared in `marketplace.ts:108` | OAuth 2.0; `crm.objects.contacts.read`, `crm.objects.deals.read`, `tickets` | **L** | none | n/a |
| **Salesforce** | Mortgage, insurance, RIA, recruiting (mid-market firms) | OAuth 2.0 (web server flow); scope `api refresh_token offline_access` | **XL** (org-specific object model, custom fields, Bulk API for backfill, Streaming API for change events) | none | n/a |
| **Pipedrive** | Recruiting, home services, mortgage | OAuth 2.0 | **L** | none | n/a |
| **Follow Up Boss** | Real estate (the realty-specific CRM — single highest-fit integration for the largest vertical) | OAuth 2.0 + API key per workspace | **L** | none | n/a |
| **Close** | Mortgage, insurance, recruiting (sales-team-heavy operations) | API key per organization | **M** | none | n/a |

---

### Tier 7 — Storage + docs

| Integration | Unlocks | Auth | Effort | Deps | Shares OAuth |
|---|---|---|---|---|---|
| **Google Drive** | All verticals; deepest pull for law, CPA, title-escrow, RIA (document-heavy) | Google OAuth 2.0 — same app as Gmail; add `drive.readonly` + `drive.file` scopes | **M** | Gmail shipped | **shared Gmail OAuth app** |
| **OneDrive / SharePoint** | (cross-listed from Tier 2) | Graph delegated | M | Outlook | **shared Outlook app** |
| **Box** | Law (enterprise law firms), CPA (mid-market firms), title-escrow | OAuth 2.0; scope `root_readwrite` | **M** | none | n/a |
| **Dropbox** | Home services (job photos), real estate (transaction files), CPA (engagement files) | OAuth 2.0; scope `files.metadata.read` + `files.content.read` | **M** | none | n/a |
| **Notion** | RIA, law, CPA (internal knowledge bases); `/general` (broadly used by SMBs as ops hub) | OAuth 2.0 (Notion integration); scope `read_content` | **M** | none | n/a |

---

### Tier 8 — Vertical-specific

The first vertical-specific integration per vertical unlocks the proof point for that vertical's marketing page. Integrations beyond the first per vertical follow real customer demand, not the roadmap.

| Integration | Vertical | Auth | Effort | Notes |
|---|---|---|---|---|
| **MLS (FMLS + GAMLS — Georgia)** | Real estate | Vendor-specific RETS or Web API, lock-up agreements per MLS | **XL** | Georgia-first per the flatsbo precedent (`lib/verticals/real-estate/content.ts:18`). National coverage = N MLSes × bespoke contracts. |
| **Skyslope** | Real estate | OAuth 2.0 (broker auth) | **L** | Transaction management — alternative to dotloop. |
| **dotloop** | Real estate | OAuth 2.0 | **L** | Already named in real-estate vertical content as a integration target. |
| **Title/escrow systems (Qualia, ResWare, SoftPro)** | Title-escrow | Vendor SaaS-specific APIs; varies | **XL** | Each title vendor is its own adapter. Start with Qualia (modern API, brokerage-friendly). |
| **Clio** | Law | OAuth 2.0; scope `read+write` | **L** | Practice management — biggest US SMB law footprint. |
| **MyCase** | Law | OAuth 2.0 | **L** | Smithwick alternative; tier-2 priority after Clio. |
| **UltraTax CS** | CPA | Thomson Reuters partner API; on-prem-leaning | **XL** | Many CPAs run on-prem — defer until first design partner names this as a requirement. |
| **Drake Tax** | CPA | Vendor-specific; partner API | **XL** | Same caveat as UltraTax. |
| **Insurance carrier portals (AppliedNet, EZLynx, NowCerts, HawkSoft)** | Insurance | AMS adapter pattern — varies; some are scraping-only | **XL** | If a target portal has no API, defer to `/custom` per the anti-prioritization list below. EZLynx + NowCerts have modern APIs. |
| **Orion Advisor Tech** | RIA | OAuth 2.0 + vendor partner approval | **XL** | Portfolio mgmt — first RIA design partner picks vendor. |
| **Tamarac (Envestnet)** | RIA | Vendor-specific partner API | **XL** | Tier-2 priority after Orion. |
| **ServiceTitan / Housecall Pro / Jobber** | Home services | OAuth 2.0 (varies by vendor); paid partner programs | **L–XL** | ServiceTitan is largest US footprint but partner program is paid + gated. Housecall Pro + Jobber are easier to join. |

**Sizing convention reminder:** **M ≈ Gmail MCP** (5–7 files, one OAuth flow, one webhook receiver). **L** = ~1.5× that surface (multi-resource read API, richer schema). **XL** = vendor partner program approval is itself a multi-week dependency before code can start, and the schema is meaningfully bigger than a single mailbox.

---

## 3. 90-day landing schedule

Sequence prioritizes (a) closing the verification gap on what's already shipped, (b) Tier 2 shared-OAuth-app leverage, (c) SMB-backbone integrations (DocuSign + QuickBooks) before anything fancier. Each week names one observable acceptance bar per `feedback_integration_acceptance_is_functional.md` — code lands earlier; the bar is when the loop demonstrably runs.

| Week | Focus | Acceptance bar |
|---|---|---|
| **1** | Land Gmail + Outlook OAuth env vars in prod; complete Conner's own Gmail + Outlook connect; verify the 5-skill loop fires on his real inbox. **No new integrations land this week.** | One `WebhookEvent` row goes `processed=false → processed=true` on a real Gmail inbox AND a real Outlook inbox, each producing a `HandoffLogEntry` + a draft persisted via `gmail.users.drafts.create` / `POST /me/messages` (draft). Logged in `agent-state/integrations_audit_log.md`. |
| **2** | Microsoft Graph extensions wave 1 — Teams, OneDrive/SharePoint, Excel. Three new MCP servers under `lib/integrations/{teams,onedrive,excel}-mcp/`. Single Azure AD app gains three new delegated scopes. | One operator-side connect per surface; one read query per surface returns real data (Teams channel list, OneDrive file list, Excel workbook row range). No skill-chain integration yet — that comes in Week 9–12 when at least one vertical's per-vertical agent uses the new surfaces. |
| **3–4** | DocuSign + QuickBooks Online. Two SMB-backbone MCP servers. | DocuSign: read envelope list + statuses for a real account. QuickBooks: read chart of accounts + open invoices for a real Intuit sandbox. Each surface marked `available` in `marketplace.ts`. |
| **5–6** | Slack + Zoom + Calendly. Communication + scheduling. | Slack: read a designated channel's message history for a real workspace. Zoom: read upcoming meetings + a recording transcript for a real account. Calendly: read upcoming bookings for a real account. |
| **7–8** | HubSpot + Follow Up Boss. CRM tier — HubSpot for cross-vertical, Follow Up Boss as the real-estate-specific anchor. | HubSpot: read 100 most recent contacts + open deals for a real portal. Follow Up Boss: same for a real FUB account. |
| **9–10** | Google Drive + Notion + first MLS adapter (FMLS — the realty design-partner unlock). | Drive + Notion: read for a real account. MLS: read active listings for a real broker in Georgia. |
| **11–12** | Microsoft OneNote + Word + Bookings (Graph wave 2). Plus a "value-loop integration" PR that wires one Tier 2/3 surface into the 5-skill chain for one vertical's design-partner workspace. | Onboarding step 2 for that design-partner workspace shows ≥3 integrations connected. The vertical's per-agent JTBD table reflects new surfaces in real customer drafts (i.e. a CPA draft that references a QuickBooks invoice number; a law draft that references a OneDrive matter file). |

**Sequencing rule (per `feedback_no_new_verticals_finish_locked.md` + `feedback_sequential_not_parallel_for_overlapping_prs.md`):** at most one Tier 8 (vertical-specific) integration in flight at any time. Tier 1–7 integrations are sequenced for shared-OAuth leverage but multiple can be in code-review concurrently.

**What is intentionally NOT on the schedule:** Salesforce (XL, no immediate design partner asking), Plaid (L, but financial integrations carry their own compliance review surface), Bill.com / Square / Xero / Expensify (the second-string payment surfaces — none has a design partner ask yet). These move onto the schedule when (a) a real customer names them or (b) a first-paying-customer engagement requires them. Per `feedback_no_quick_fixes.md` — building speculative integrations is the quick fix; sequencing against real customer demand is the best fix.

---

## 4. Per-vertical starter packs

For each vertical, the **3–5 integrations every customer should connect on day 1** to get full value from the 5-skill chain. Concrete and prescriptive — the operator's onboarding script tells the customer "connect these in this order."

| Vertical | Day-1 starter pack (in connect order) |
|---|---|
| **Real estate** | (1) Gmail or Outlook — the mailbox the agent uses for leads; (2) Google Calendar or Outlook Calendar — the same Google/Microsoft account; (3) Follow Up Boss — the realty CRM; (4) dotloop or Skyslope — transaction management; (5) Google Drive or OneDrive — for transaction files. |
| **Mortgage** | (1) Outlook + Outlook Calendar (Microsoft-heavy vertical) OR Gmail + Google Calendar; (2) HubSpot or Salesforce (mid-market shops); (3) DocuSign — for borrower disclosures; (4) Calendly — for borrower scheduling. |
| **Insurance** | (1) Outlook + Outlook Calendar; (2) DocuSign — policy bind + endorsements; (3) HubSpot — pipeline; (4) Tier-8 carrier portal once available (NowCerts or EZLynx) — defer if not yet shipped. |
| **Property management** | (1) Gmail or Outlook + matching Calendar; (2) Slack — tenant-issue routing; (3) Stripe — rent collection; (4) QuickBooks — owner statements; (5) DocuSign — leases. |
| **Title-escrow** | (1) Outlook + Outlook Calendar; (2) DocuSign — closing docs; (3) OneDrive / SharePoint — closing files; (4) Qualia or ResWare — once Tier-8 adapter ships. |
| **Recruiting** | (1) Gmail or Outlook + matching Calendar; (2) HubSpot or Pipedrive — candidate pipeline; (3) Calendly — interview scheduling; (4) DocuSign or PandaDoc — offer letters; (5) Zoom — interview recordings. |
| **Home services** | (1) Gmail or Outlook + matching Calendar; (2) Twilio webhook (inbound SMS) — most job leads arrive by text; (3) ServiceTitan or Housecall Pro or Jobber — once Tier-8 adapter ships; (4) Stripe or Square — deposits; (5) DocuSign — estimates. |
| **CPA** | (1) Outlook + Outlook Calendar; (2) QuickBooks Online — engagement bookkeeping; (3) DocuSign — engagement letters; (4) OneDrive or Google Drive — engagement files; (5) Excel (via Graph) — working papers. |
| **Law** | (1) Outlook + Outlook Calendar; (2) Clio — once Tier-8 adapter ships; (3) DocuSign — engagement letters; (4) OneDrive — matter files; (5) OneNote — case notes. |
| **RIA** | (1) Outlook + Outlook Calendar; (2) Salesforce — once shipped (most RIAs run on Salesforce Financial Services Cloud) OR HubSpot for smaller shops; (3) Orion or Tamarac — once Tier-8 adapter ships; (4) DocuSign — advisory agreements; (5) OneNote — advisor notes. |
| **`/general` (on-ramp)** | (1) Gmail or Outlook + matching Calendar; (2) HubSpot — broadly used; (3) DocuSign — broadly used; (4) Google Drive or OneDrive. The on-ramp page makes no vertical-specific promises; the starter pack reflects that. |

**Onboarding implication:** the customer's onboarding step 2 (`onboarding/page.tsx:380-396` per pre-pilot audit) should render the day-1 starter pack for the customer's vertical, not the full marketplace catalog. The full marketplace remains discoverable at `/app/workspace/[id]/integrations`, but the onboarding flow's recommendation is opinionated.

---

## 5. Anti-prioritization — what NOT to build in V2

Per `feedback_no_new_verticals_finish_locked.md` and `feedback_no_quick_fixes.md` — what we leave off the roadmap is as load-bearing as what we put on it.

1. **Niche tools with <1k SMB users.** Vertical-specific tools that haven't reached scale (regional MLSes outside Georgia until a design partner asks, boutique law-PM software, single-state title-escrow vendors). These are real businesses, but each absorbs an XL adapter for a single-digit customer count. Defer until a paying customer names the tool.

2. **Anything requiring per-customer custom code.** Bespoke API integrations against a single customer's homegrown system, hand-maintained adapters against an unstable internal API, single-tenant ETL pipelines. Per `marketplace.ts:212-214` these route through `/custom?type=integration-waitlist&id=…` — the `/custom` engagement model is exactly where they belong.

3. **Integrations that aren't MCP-shaped.** Screen-scraping legacy portals where the vendor exposes no API (some carrier portals, some MLSes, some older title-escrow systems). agentplain's architecture is **per-workspace MCP servers behind a marketplace seam** (`lib/integrations/marketplace.ts:1-21`); a scraping adapter cannot be made MCP-shaped without inventing a fake server surface that's actually doing browser automation. Defer to manual handoff (the operator does the lookup; agentplain's draft cites the manual lookup result) until the vendor ships an API.

4. **Outbound execution surfaces.** Per `project_no_outbound_architecture.md` — `Twilio.messages.create`, SendGrid send, autodialer APIs, Slack `chat.postMessage` against arbitrary channels. agentplain advises and drafts; the customer's system sends. The only reason a vendor's name appears under "Communication" above (Twilio, WhatsApp Business) is as a webhook RECEIVER for inbound traffic. Sending stays out.

5. **Provider-direct calls from anywhere outside `lib/integrations/<slug>-mcp/`.** Per `feedback_no_silent_vendor_lock.md` — any new SDK imported in `app/`, `scripts/`, or skill code is a code-review block. A new vendor capability = new MCP adapter behind the existing seam, never a sprinkle of SDK calls across pages.

6. **"Enterprise SSO" integrations.** Okta SCIM, Azure AD app management, Workspace ONE. These belong in the eventual `/custom?type=max` engagement path, not the productized marketplace. The Regular tier serves 1–99 seats per `project_stripe_both_surfaces.md` — at that scale, the customer's email-OAuth identity IS the SSO.

7. **Integrations that duplicate the 5-skill chain.** Generic-AI assistant integrations (a generic OpenAI assistant connector, a generic Anthropic Claude connector wired to a customer's chat surface). agentplain's value loop IS the LLM surface; the customer doesn't need a second one connected through us.

---

## 6. Discipline anchors

For the agents executing this roadmap:

- **Per `feedback_integration_acceptance_is_functional.md`:** acceptance is the 5-skill chain firing on real data, not the OAuth flow completing. Sync-diff against the vendor sandbox is a sub-test; it does not close the integration.
- **Per `feedback_no_silent_vendor_lock.md`:** every new SDK import lands in `lib/integrations/<slug>-mcp/` only. Marketplace catalog is the single seam.
- **Per `feedback_runner_portability.md`:** every new vendor capability is an adapter behind an interface, not a direct call. Two-implementation rule applies — production adapter + a test adapter at minimum, like `lib/integrations/gmail-mcp/server.ts` + `lib/integrations/gmail-mcp/test-server.ts`.
- **Per `project_no_outbound_architecture.md`:** no entry above ships with a send/dispatch scope, no exceptions.
- **Per `feedback_no_new_verticals_finish_locked.md`:** at most one Tier 8 vertical-specific integration in flight at any time; the realty pilot bar gates everything Tier 8.
- **Per `feedback_no_guesses_no_estimates.md`:** S/M/L/XL describes adapter complexity vs. Gmail MCP as the reference "M". No day counts; no calendar projections beyond the 12-week table above, which itself is a *sequence*, not a guarantee.
- **Per `feedback_everything_tells_a_story.md`:** the marketplace UI says **what the service partner does with the connection**, not feature lists. Every entry's `description` field in `marketplace.ts` already reads this way (e.g. `marketplace.ts:117-118` DocuSign: "Your service partner prepares envelopes, tracks signatures, and flags the docs that need follow-up.").

---

## 7. Open questions for Conner

These are decisions, not estimates — flagged for Conner because each shapes a subsequent week.

1. **Which vertical takes the Week 11–12 first-design-partner integration slot?** Real estate (Follow Up Boss + dotloop are ready; FMLS adapter is Tier 8 but Georgia-first matches flatsbo precedent) is the default unless a faster-moving design partner emerges in CPA or law.
2. **Which payment-acceptance surface ships first — Stripe-as-customer-integration or QuickBooks?** Both are Tier 3a. If the first paying customer is property management or recruiting, Stripe wins; if CPA or law, QuickBooks wins. Defer the call to design-partner identification.
3. **WhatsApp Business — is the receiver-only positioning publicly defensible?** Per `project_no_outbound_architecture.md` we are clear; per Meta's WABA developer docs (https://developers.facebook.com/docs/whatsapp/cloud-api, read 2026-05-19), webhook-only subscriptions are a supported posture. The question is whether the marketplace tile description communicates the receiver-only nature clearly enough that a customer doesn't expect agentplain to send WhatsApp messages on their behalf.

---

*End of doc.*
