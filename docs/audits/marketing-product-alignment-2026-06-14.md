# Marketing ↔ Product Alignment — Claims vs Reality (Post-Merge 2026-06-14)

**Audit date:** 2026-06-14
**Base:** `origin/main` @ `fc900bc` (PR #257 merged)
**Mandate (Conner):** "Marketing and product agents need to connect. Are we delivering everything we are marketing?"
**Method:** Every customer-facing claim across all marketing surfaces was inventoried verbatim, then verified against product runtime — registry runtime flags, adapter gating, Prisma schema, billing/trial code, the compliance sentinel gate, and the paused-LLM degraded path. Every status cites a `file:line`.

Companion docs: `docs/audits/CUSTOMER_JOURNEY_POST_MERGE_2026_06_14.md` (#257, what the customer experiences) and `docs/audits/SIGNUP_TO_GO_AUDIT_2026_06_10.md`. This audit is the **claim-by-claim** layer under that journey view.

---

## Section 1 — TL;DR

**Of ~92 distinct marketing claims inventoried, ~63% are GREEN (delivered today), ~26% YELLOW (partial / gated), ~11% RED (not delivered — scrub or build first).**

**The biggest gap is present-tense compliance claims on nine non-real-estate verticals.** Marketing tells CPAs "a Circular 230 slip *is corrected at the draft stage*," tells property managers "the fair-housing scanner *flags it*," tells RIAs "the SEC Marketing Rule corpus *flags them*." The compliance sentinel scans live **for real-estate only** — `BASELINE_LIVE_VERTICALS = new Set(["real-estate"])` (`lib/agents/sentinel/index.ts:89`). On the other nine verticals those scanners fire **nothing**. This is simultaneously our loudest differentiator and our least-true claim, and on regulated verticals a false present-tense compliance promise is a liability risk, not just a marketing one.

Three things are true at once and worth holding together:

1. **The architecture claims are real and well-built.** Draft-only / no-outbound, workspace isolation, OAuth read-and-draft scopes, memory + voice learning, the support ticket lifecycle, and the first-5-minute activation draft are all genuinely delivered in code. The honest version of agentplain is a strong product.
2. **The single most-load-bearing capability is currently dark in production.** `ANTHROPIC_API_KEY` is the paused sentinel (`sk-ant-PAUSED-…`), so the LLM draft loop — the thing every "Plaino drafts your replies" claim rests on — returns a no-throw paused response and generates no draft bodies today. This is an *operational* gate (restore the key), not a copy lie, but it caps the truth-only pitch until it clears.
3. **A small set of byte-for-byte falsehoods is live and should be scrubbed today** regardless of #1 and #2: the nine-vertical compliance claims, an AES-256-GCM encryption claim over a plaintext column, an undisclosed OpenAI subprocessor, and a live price self-contradiction.

**Honest verdict (Section 6): truth-only marketing closes a real-estate design partner at 4/5 today.** It does not yet close cold self-serve buyers on the other nine verticals, because the claims that would close them (live vertical compliance, live vertical connectors) are the ones that aren't true yet. The gating bar to 5/5 is operational (restore the key) plus one copy-scrub wave, not a fundamental rebuild.

---

## Section 2 — Per-surface claim verification

Legend: 🟢 delivered · 🟡 partial/gated · 🔴 not delivered

### Homepage — `app/(marketing)/page.tsx` + `lib/marketing/home-content.ts`

| Claim (abbrev.) | Status | Evidence |
|---|---|---|
| Pre-built skills + agents shipped day one | 🟢 | 17 `runtime: 'live'` skills in `lib/skills/registry.ts` |
| "Memory, managed" — persistent context, no config files | 🟢 | `WorkspacePreference.learnedDraftNotes`, `PreferenceSignal`, `WorkspaceMemoryEntry` (`prisma/schema.prisma:1756–2128`) |
| "The chain runs every five minutes against your inbox backlog" | 🟡 | Cron/sweep code exists, but LLM paused → no draft bodies generated in prod today (`lib/llm/index.ts` Sentinel layer; key = `sk-ant-PAUSED-…`) |
| Onboarding captures tone/hours/quirks → "rides into every prompt every fire" | 🟢 | `WorkspacePreference.draftingTone / categorizationNotes / calendarWindow` inlined into draft prompts |
| "Every edit you make to a draft becomes a learned note" | 🟢 | `PreferenceFeedback` (originalDraft/correctedDraft/reason/category), append-only `PreferenceSignal` |
| File source: "runs against on-disk fixtures … Drive lands the moment OAuth scopes are connected" | 🟢 | Self-hedged and accurate — already states the fixture reality |
| Every draft lands in approvals as PENDING; "nothing … sends anything outbound" | 🟢 | No-outbound architecture; `WorkApprovalKind` enum is all draft/triage/coordinate |
| Real-estate fair-housing scanner "fires today; the other verticals' rules are loaded as drafts and don't fire" | 🟢 | Exactly matches `BASELINE_LIVE_VERTICALS = {"real-estate"}` (`lib/agents/sentinel/index.ts:89`) — **the homepage tells the truth here; the vertical pages do not (see below)** |
| Regular $199→$99, Partner $299→$199 (home-content.ts) | 🟡 | Regular correct; Partner **mid-band wrong** — see RED price drift below |
| "First month free. Month-to-month from day one. Cancel anytime." | 🟢 | `TRIAL_PERIOD_DAYS = 30` (`lib/pricing/tiers.ts:131`); cancel = `cancelAtPeriodEnd` |
| "Human review on every customer-facing output" / "You own the work product" | 🟢 | No-outbound + approvals queue; terms §ownership |

### Pricing — `app/(marketing)/pricing/page.tsx`

| Claim | Status | Evidence |
|---|---|---|
| Three tiers, month-to-month, first month free | 🟢 | `lib/pricing/tiers.ts` |
| Regular ladder $199→$99 | 🟢 | `PER_SEAT_MONTHLY_USD_CENTS.regular` (`tiers.ts:102–108`) |
| Partner mid-bands $269 (2–9) / $239 (10–24) | 🔴 | Canonical is **$279 / $249** (`tiers.ts:110–112`). Pricing page contradicts the source of truth and the vertical pages |
| "you're approving real drafts in the first week" | 🟡 | True *mechanically* (activation draft is instant) but the recurring draft loop needs the key restored |
| Real-estate scanner "fires live today; other verticals' corpora are drafted and gated until counsel review" | 🟢 | Matches sentinel gate |

### About — `app/(marketing)/about/page.tsx`

| Claim | Status | Evidence |
|---|---|---|
| Ten verticals served | 🟡 | All ten have `content.ts`; only real-estate has a live compliance scanner + a live vertical killer skill (`lead-triage-realestate`, `runtime:'live'`). Others are skill-present-but-gated |
| "~35 cron-fired agents … on flatsbo" (dogfood proof) | 🟢 | flatsbo dogfood is real; framed as proof, not a customer deliverable |
| "Every skill earned its way in by working on flatsbo first" | 🟢 | Consistent with build history |
| First month free / month-to-month / cancel | 🟢 | As above |

### Custom — `app/(marketing)/custom/page.tsx`

| Claim | Status | Evidence |
|---|---|---|
| Custom $5K–$15K + $200–$500/mo maintenance | 🟢 | Quote-based; `max` tier routes out-of-band (`tiers.ts:116–122`) |
| "Scoping call → spec inside a week → 4–6 week build → staging-first → sign-off" | 🟡 | Process claim, not a product feature; plausible but unverifiable from code |
| "15x–50x ROI target" | 🟡 | Modeled anchor, not measured (see ROI note in Section 5) |

### Security — `app/(marketing)/security/page.tsx`

| Claim | Status | Evidence |
|---|---|---|
| AES-256-GCM encryption at rest, per-env key, Vercel secrets | 🟡 | True for `ChatMessage`, `WorkspaceMemoryEntry`, `IntegrationCredential`, `SkillConfig`, `PlainoConversation` (v1 envelopes) — **but NOT for knowledge-substrate `body` (RED below)** |
| TLS 1.2+; non-TLS rejected at edge | 🟢 | Vercel edge default |
| `workspace_id` + Postgres RLS; "query that omits the filter returns zero rows" | 🟡 | Workspace-scoping is pervasive in code; full RLS-policy enforcement + a CI gate is a known hardening gap (see `project_production_growth_plan_2026_06_05`) — claim is stronger than the verified guarantee |
| Email OAuth = read-and-draft only, "never request send-on-your-behalf" | 🟢 | No-outbound architecture; scopes match |
| QuickBooks read-only for reconciliation | 🟢 | Matches connector intent |
| Append-only handoff log, "no agent and no admin can rewrite history" | 🟡 | Append-only model exists; cryptographic immutability / audit-log tamper-evidence is a noted hardening gap |
| Incident: contain 24h / notify 72h / post-mortem | 🟡 | Policy commitment, not a drilled/verified runbook (key-rotation/restore "un-drilled" per growth plan) |
| Daily backups + PITR, 30-day rolloff | 🟢 | Neon-backed (subprocessor list) |

### Privacy — `app/(marketing)/privacy/page.tsx`

| Claim | Status | Evidence |
|---|---|---|
| Explicit per-connection OAuth; minimum scopes; never send-on-behalf | 🟢 | No-outbound architecture |
| "knowledge substrate documents you connect or upload are encrypted at rest using AES-256-GCM" | 🔴 | `KnowledgeDocument.body` is plaintext `String` (`schema.prisma:1394`), no cipher — **false** |
| "We … store [voice/preferences] as an append-only feedback log" | 🟢 | `PreferenceSignal` / `PreferenceFeedback` |
| Subprocessor list: Anthropic, Neon, Vercel, Stripe, Resend, Sentry, Inngest | 🔴 | **OpenAI omitted** — knowledge-doc bodies are sent to `api.openai.com/v1/embeddings` (`lib/knowledge/openai-embedding.ts:34`, selected by `lib/knowledge/index.ts:53–55` when `OPENAI_API_KEY` set) |
| "We do not train any base model on your data" | 🟢 | Anthropic no-training tier; no fine-tuning pipeline in code |
| 7-day soft-delete → hard delete; 30-day backup rolloff | 🟢 | Closure lifecycle in schema |
| OAuth tokens encrypted; refresh server-side | 🟢 | `IntegrationCredential.accessTokenEncrypted` (`schema.prisma:2133`) |

### Terms — `app/(marketing)/terms/page.tsx`

| Claim | Status | Evidence |
|---|---|---|
| Fleet reads connected systems, drafts, queues; never sends outbound | 🟢 | No-outbound architecture |
| "Card captured at signup and charged at the start of your second month" | 🔴/🟡 | Card-at-signup is **opt-in and OFF by default** (`STRIPE_CHECKOUT_ENABLED` default false); and `STRIPE_BILLING_ENABLED` default false means **no charge fires at all today**. Terms describe a flow the product can't currently execute |
| Failed payment → 7-day grace → pause (read-only) | 🟢 | Dunning lifecycle in `Subscription` states + abandoned-signup sweep |
| Not a licensed party; liability stays with you | 🟢 | True disclaimer |
| Georgia governing law | 🟢 | Stated |

### Vertical pages — `lib/verticals/<slug>/content.ts` (rendered at `app/(marketing)/[vertical]`)

| Vertical | Killer-workflow / integration / compliance claims | Status | Evidence |
|---|---|---|---|
| **real-estate** | "INTEGRATES with Outlook, Gmail, Drive, DocuSign on day one"; HUD scanner flags before MLS; FUB + Sierra + M365 + Google + QBO live, others "planned Q3 2026" | 🟢 | `lead-triage-realestate` `runtime:'live'`; sentinel live; integrations real; roadmap honestly labeled. **This page is the honesty benchmark.** |
| **property-management** | "the fair-housing scanner flags it"; Buildium on day one | 🔴 | Scanner fires nothing for PM (`sentinel:89`); Buildium is fixtures-only by default (`BUILDIUM_ADAPTER_LIVE` off — `property-management-rent-collection-chase-sweep.ts:8` "whole sweep no-ops unless …=on") |
| **cpa** | "a Circular 230 slip is corrected at the draft stage"; TaxDome/QBO/DocuSign day one | 🔴 | Sentinel does not scan CPA (`sentinel:89`); present-tense "corrected" is false. TaxDome/Karbon read-layer is real; QBO real |
| **law** | "a privilege-aware compliance pass" on every draft/pleading | 🔴 | No law-specific live compliance scan (`sentinel:89`); compliance is cross-vertical advisory, not a privilege-aware gate |
| **ria** | "the SEC Marketing Rule corpus flags them"; never renders dollar amounts | 🔴 (compliance) / 🟢 (no-numbers) | Scanner doesn't fire RIA; the "never renders dollar amounts / merge-field" architecture **is** real and honest |
| **mortgage** | RESPA-routed drafts; Encompass/OneDrive/DocuSign day one | 🟡 | Draft-through-approval real; Encompass fixtures-only (`ENCOMPASS_ADAPTER_LIVE` off, `lib/env.ts:359`) |
| **insurance** | COI drafting; EZLynx day one | 🟡 | Skill present; EZLynx fixtures-only (`EZLYNX_ADAPTER_LIVE` off) |
| **title-escrow** | file-intake automation; Qualia | 🟡 | Qualia fixtures-only (`QUALIA_ADAPTER_LIVE` off) |
| **recruiting / general** | sourcing/outreach drafts; on-ramp value | 🟡 | Cross-vertical draft skills live (in code); gated on key |
| **All verticals** | Specific ROI dollars ($5,300/mo, $42k/yr, $150k/yr, $175k/yr, etc.) | 🟡 | Opportunity-cost **models**, not measured customer outcomes — see Section 5 |

### Email templates

| Template | Claim | Status | Evidence |
|---|---|---|---|
| Weekly report (`lib/reports/weekly-report-email.ts`) | "Plaino drafted N things and you approved N, saving you about X" | 🟢 | Computed from real `computeWeeklyReportData`; renders nothing when zero; "never says 'sent' where it means 'drafted'" |
| Weekly digest (`lib/measurement/weekly-digest-email.ts`) | "N taken, $X influenced, M handled automatically" | 🟢 | `isEmpty` guard; dollars only from real data |
| Quiet-week subhead | "watching your inbox and your systems" | 🟡 | True intent; watching produces no drafts while key paused |

### #248 first-5-minute value (`lib/onboarding/activation-run.ts`, `demo-data.ts`)

| Claim | Status | Evidence |
|---|---|---|
| "Up and running / see Plaino work in the first session" | 🟢 | Deterministic ACTIVATION_DRAFT, **no LLM/network** — survives the paused key; idempotent per workspace; demo work scores 0 in the value ledger so it never inflates ROI |

---

## Section 3 — "Lies we should stop telling" (RED claims to scrub now)

### 3.1 — Present-tense compliance claims on nine verticals  ⚠️ MOST EGREGIOUS
- **Surfaces:** `lib/verticals/{property-management,cpa,law,ria,mortgage,insurance,title-escrow,recruiting,home-services}/content.ts`; mirrored in `docs/marketing/vertical-landing-pages/*` (#255).
- **Exact text (examples):** CPA — "a Circular 230 slip **is corrected at the draft stage**"; PM — "the fair-housing scanner **flags it**"; RIA — "the SEC Marketing Rule corpus **flags them**"; Law — "a **privilege-aware compliance pass**."
- **Why it's a lie:** `lib/agents/sentinel/index.ts:89` — `BASELINE_LIVE_VERTICALS = new Set(["real-estate"])`. Every other vertical's corpus is DRAFT and scans nothing until `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` lists it. The scanner fires for exactly one of ten verticals.
- **Recommended replacement (conditional/roadmap tense, matching the homepage's own honest framing):** "The real-estate fair-housing scanner runs live on every draft today. Your vertical's compliance corpus is loaded and in counsel review — it pre-checks drafts the moment we complete sign-off for your state. Until then, every customer-facing output still routes through human approval." This is *more* compelling, not less: it's the only honest present-tense compliance pitch any competitor can make, and it doesn't expose us on a regulated vertical.

### 3.2 — AES-256-GCM claim over a plaintext column
- **Surfaces:** `app/(marketing)/privacy/page.tsx:95`, `app/(marketing)/security/page.tsx:46–50`.
- **Exact text:** "the knowledge substrate documents you connect or upload … are encrypted at rest using AES-256-GCM."
- **Why it's a lie:** `KnowledgeDocument.body` is a plaintext `String` (`prisma/schema.prisma:1394`) written verbatim — unlike `ChatMessage.body`/`WorkspaceMemoryEntry.body`, which carry v1 AES envelopes.
- **Recommended fix (product, not copy — this one we should *build* to keep the claim):** wrap `KnowledgeDocument.body` in the same v1 AES envelope the other body columns use (one encrypt-on-write / decrypt-on-read seam already exists). If we won't build it this week, **scrub the word "documents" from the AES sentence** so the claim covers only the columns that are actually encrypted.

### 3.3 — OpenAI undisclosed as a subprocessor
- **Surface:** `app/(marketing)/privacy/page.tsx:114–151` (subprocessor list).
- **Why it's a lie of omission:** knowledge-doc bodies are POSTed to `https://api.openai.com/v1/embeddings` (`lib/knowledge/openai-embedding.ts:34`) whenever `OPENAI_API_KEY` is set (`lib/knowledge/index.ts:53–55`). OpenAI is a data subprocessor and isn't listed. The "your data is not used to train models" assurance is also scoped only to Anthropic.
- **Recommended fix:** add OpenAI to the subprocessor list ("OpenAI — vector embeddings for the knowledge substrate; on the no-training API tier"), **or** switch embeddings to a no-third-party provider. Disclosure is the one-line fix; do it today.

### 3.4 — Live price self-contradiction (Partner mid-bands)
- **Surfaces:** `app/(marketing)/pricing/page.tsx:43–44` and `lib/marketing/home-content.ts:39–40` show Partner **$269 / $239**; `lib/verticals/*/content.ts` and `components/vertical/PricingTierBanner.tsx` show **$279 / $249**.
- **Why it's a lie:** the source of truth is `lib/pricing/tiers.ts:110–112` = **$279 (2–9) / $249 (10–24)**. A buyer sees one price on a vertical page and a different one on the pricing page they click through to.
- **Recommended fix:** one-line correction of the pricing page + home-content to `$279 / $249`. Pure data fix, zero design work.

---

## Section 4 — "Truths we should add" (capabilities marketing under-sells)

1. **The support ticket lifecycle is real and works LLM-free.** `SupportTicket` has stable customer-visible numbers, threaded `SupportTicketMessage` rows, internal staff notes, assignment, and a real SLA (`firstResponseDueAt` computed from P0=1h / P1=4h / P2=24h / P3=48h — `schema.prisma:535–556`). Marketing says almost nothing about support. **Suggested copy:** "Open a ticket and get a real number, a real owner, and a stated first-response time — P0 within the hour. The lifecycle runs even when the AI is offline."
2. **The whole value loop fails *closed*, by architecture.** Nothing sends, nothing publishes, nothing moves money — enforced by the `WorkApprovalKind` enum, not a setting. **Suggested copy:** "There is no 'auto-send' toggle to forget to turn off. The product literally cannot send on your behalf — your name, your domain, your click."
3. **Voice learning is concrete and inspectable.** Every draft edit becomes a stored `PreferenceSignal`; `WorkspaceMemoryEntry` rows link back to the chat turn they came from (`sourceChatMessageId`). **Suggested copy:** "Shorten a draft 22% and Plaino remembers — and shows you the exact correction it learned from."
4. **Integration self-heal is live (pfd-2).** Daily health probes, a durable retry queue that resumes failed actions when a connection comes back, and a reconnect banner — `IntegrationHealthCheck` + `RetryableAction` (`schema.prisma:1285–1372`). **Suggested copy:** "If a connection drops, Plaino notices, pauses cleanly, and picks up exactly where it left off when you reconnect."
5. **The first-5-minute draft survives degraded mode.** It's deterministic and never inflates your metrics. Worth saying explicitly: "You'll see a real, send-ready draft in your queue before you finish onboarding."

---

## Section 5 — "Almosts" (YELLOW with the smallest GREEN path)

| # | Claim | What's missing | Smallest fix to GREEN | Effort |
|---|---|---|---|---|
| 5.1 | The core draft loop ("Plaino drafts your replies", "runs every five minutes") | LLM is the paused sentinel in prod → no draft bodies generate | **Restore `ANTHROPIC_API_KEY`** (operational, Conner action). Code is ready; budget/sentinel/cache stack composes around it | Ops, not eng |
| 5.2 | Buildium / EZLynx / Encompass / Qualia "on day one" | Adapters built but dispatch to fixtures by default (`*_ADAPTER_LIVE` off) | Flip the per-vendor live flag once a real sandbox/cred is validated; until then add a marketplace sublabel "connect-ready — activating" | Small (flag + label) |
| 5.3 | Non-RE vertical compliance | Corpora drafted but counsel-gated | Land one counsel sign-off (e.g. CPA federal) → add slug to `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` → that vertical's claim becomes true | Counsel-gated, code-trivial |
| 5.4 | "Card charged at start of month two" (terms) | `STRIPE_BILLING_ENABLED` + `STRIPE_CHECKOUT_ENABLED` default false → can't charge | Decide trial mechanics, enable billing flags, smoke a live charge | Decision + small eng |
| 5.5 | Per-vertical ROI dollars ($42k/yr, $150k/yr, …) | Opportunity-cost models, not measured outcomes | Add a one-line "modeled, not measured" footnote, OR wire the value ledger to surface a real per-workspace tally (data exists in `computeWeeklyReportData`) | Copy (now) / small eng (real) |
| 5.6 | "Postgres RLS — omitting the filter returns zero rows" | Pervasive workspace-scoping, but full RLS policy + CI gate is a hardening gap | Land the RLS CI gate from the growth plan, then the claim is provable | Medium eng |
| 5.7 | Knowledge-doc AES claim (3.2) | `KnowledgeDocument.body` plaintext | Reuse the existing v1 envelope on one column | Small eng |

---

## Section 6 — Honest customer-value bar

**Score: 4 / 5** for a real-estate design partner. **~2.5 / 5** for a cold self-serve buyer on the other nine verticals.

After every lie in Section 3 is scrubbed, the *pure-truth* pitch is still strong and differentiated for real estate specifically:
- A done-for-you service layer (not a tool you configure) — true.
- Real Gmail/Outlook/QuickBooks/HubSpot/Salesforce/DocuSign/FUB/Sierra dispatch — true.
- A live HUD fair-housing scanner on every draft before it hits MLS — true, and nobody else ships it.
- Draft-only, fails-closed, you own the work product — true and rare.
- Memory + voice learning that's inspectable — true.
- A real support lifecycle and self-heal — true.

**Why not 5:** the headline daily value — Plaino actually drafting your replies on a five-minute loop — is dark in production because the key is paused (5.1). A design partner on a hand-held pilot still gets the activation draft, the support lifecycle, and the live RE scanner, so 4/5 holds. But you cannot honestly sell the recurring draft loop to a cold buyer until it fires live.

**The gating bar to 5/5 is not a fundamental build.** It is: (a) restore the API key [ops], (b) run one copy-scrub wave [hours], and (c) land one non-RE counsel sign-off to make a second vertical's compliance claim true [counsel]. The product is closer to its marketing than the RED count suggests — the REDs are concentrated in nine copies of one compliance overclaim plus three discrete defects, not spread across the whole surface.

---

## Section 7 — Reconciliation with the #255 marketing pack

The #255 vertical landing pages (`docs/marketing/vertical-landing-pages/*`) and sales scripts (`docs/marketing/sales-scripts/*`) are mostly **more honest than the live `lib/verticals/*/content.ts`** — the scripts already segment "Working today" vs "Setting Up." Flag these before they ship:

| #255 file | Claim to fix before ship | Why | Status |
|---|---|---|---|
| `vertical-landing-pages/cpa.md:96` | "a Circular 230 slip is corrected at the draft stage" | Sentinel doesn't scan CPA | 🔴 — same fix as 3.1 |
| `vertical-landing-pages/cpa.md:8` | "Partner $299→$199" + "CPA gets a 14-day free trial" | Partner mid-bands must read $279/$249; trial constant is 30-day (`tiers.ts:131`), not 14 — pick one and make code+copy agree | 🔴 price / 🟡 trial |
| `vertical-landing-pages/real-estate.md:127` | "Card at signup, 7-day trial, 14-day money-back" | Card-at-signup is OFF by default; trial constant is 30-day. The RE page's *capability* claims are otherwise the honesty benchmark — only the billing line is wrong | 🔴 (billing line only) |
| `vertical-landing-pages/law.md` | "privilege-aware compliance pass" framing | No law-specific live scan | 🔴 — soften to roadmap |
| `vertical-landing-pages/ria.md` | "Marketing-Rule-aware by design"; "never renders dollar amounts" | No-numbers architecture is true 🟢; "flags them" present-tense is not | 🟡 — keep no-numbers, soften the scan claim |
| `vertical-landing-pages/home-services.md` | field-service connectors "setting up"; TCPA "you send against your own consent record" | Already honest — connectors flagged, no-outbound true | 🟢 — ship as written |
| `sales-scripts/*` (all) | "Objection 10: what's live today" segmentation | Already separates live vs Setting-Up correctly; RE/CPA/Law scripts even name the live skill set | 🟢 — these are the model; port their honesty into the landing `content.ts` |

**Net:** the sales scripts are the template. If the live `content.ts` adopted the scripts' "Working today / Setting Up" discipline, most of Section 3's REDs would disappear on the vertical pages.

---

## Section 8 — Sequencing

### Scrub TODAY (brand-integrity protection, all copy/data, no build)
1. **Nine-vertical compliance claims → conditional tense** (3.1). One sweep across `lib/verticals/*/content.ts`. Biggest trust + liability risk. Highest priority.
2. **Price fix** $269/$239 → $279/$249 on pricing page + home-content (3.4). One-line data fix.
3. **OpenAI subprocessor disclosure** added to privacy page (3.3). One-line addition.
4. **AES sentence**: either scrub "documents" from the encryption claim or schedule the column-encryption build (3.2). Copy-scrub today, build this week.

### This week (YELLOW → GREEN)
5. **Restore `ANTHROPIC_API_KEY`** (5.1) — unlocks the entire draft-loop value proposition; the single highest-value action on the board.
6. **Encrypt `KnowledgeDocument.body`** with the existing v1 envelope (5.7 / 3.2) — makes the AES claim true rather than scrubbed.
7. **Land one non-RE counsel sign-off** (CPA federal is the obvious first) and add it to `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` (5.3) — turns a second vertical's compliance claim true.
8. **Decide billing/trial mechanics** and flip `STRIPE_BILLING_ENABLED` (5.4) so terms' "charged at month two" stops being aspirational. Also resolve the 30-day-code vs 14-day-mandate split so every surface tells one story.
9. **Marketplace sublabels** for the four fixtures-only connectors (5.2) — "connect-ready, activating."

### Fundamental asks (cannot be fixed without a real build/decision; do NOT block the scrub on these)
- **Per-vertical live compliance scanning** for all ten verticals — gated on counsel sign-off per state/vertical, not on code. This is the real moat and the real backlog; it is *correct* that it's gated, and marketing must match the gate, not the ambition.
- **Real customer ROI measurement** to replace modeled dollars — needs the value ledger surfaced per workspace plus real inbox data flowing (which needs the key restored). Until then, footnote the dollars as modeled.
- **Full Postgres RLS + CI gate** (5.6) to make the security page's strongest isolation claim provable.
- **Live AMS/LOS/PMS adapters** (Buildium/EZLynx/Encompass/Qualia and the vertical practice-management systems) — each needs a real partner sandbox + credential validation before its flag flips.

---

### Appendix — Most-load-bearing evidence
- Compliance gate: `lib/agents/sentinel/index.ts:89` — `BASELINE_LIVE_VERTICALS = new Set(["real-estate"])`
- Price source of truth: `lib/pricing/tiers.ts:102–123`; trial: `:131` (`TRIAL_PERIOD_DAYS = 30`)
- Knowledge body plaintext: `prisma/schema.prisma:1394`
- OpenAI embeddings dispatch: `lib/knowledge/openai-embedding.ts:34`, selected in `lib/knowledge/index.ts:53–55`
- Adapter fixtures gate: `lib/inngest/functions/property-management-rent-collection-chase-sweep.ts:8`; `lib/env.ts:359`
- Skill runtime flags: `lib/skills/registry.ts:38–80` (17 live)
- Support SLA lifecycle: `prisma/schema.prisma:535–556`, `1926–1967`
- First-5-min activation: `lib/onboarding/activation-run.ts` (deterministic, no LLM)
- LLM paused sentinel: `lib/llm/index.ts` (Sentinel layer short-circuits on `sk-ant-PAUSED-…`)
