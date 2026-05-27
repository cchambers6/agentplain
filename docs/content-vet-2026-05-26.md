# Full content vet — autonomous-operation readiness (2026-05-26)

**Question:** If Conner went fully hands-off tomorrow and the agent fleet ran agentplain end-to-end for real Atlanta businesses — reaching out, responding, intake, pricing, customizing, delivering, supporting, with no human in the loop — does every piece of content hold up?

**Verdict (one line):** **NO — not hands-off ready.** Live customer surfaces leak internal memory filenames verbatim on at least 11 marketing routes; the homepage and /pricing assert "counsel-reviewed" compliance corpora that are 0/45 counsel-reviewed; the approvals queue copy contradicts the no-outbound architecture; there is no `/terms`, `/privacy`, `/security`, `/dpa`, or `/trust` page; advice-adjacent claims across regulated verticals (SEC Marketing Rule, MRPC 7.1, TRID, RESPA, Circular 230, TCPA, fair-housing) carry no customer-facing disclaimer; and `/how-it-works` (linked in some copy paths and a plausible direct visit) returns HTTP 404.

**Scope of this vet:**
- **Live-walked (WebFetched 2026-05-26):** `/`, `/pricing`, `/custom`, `/about`, `/verticals`, `/inquiry-received`, `/general`, all 10 vertical pages (`/real-estate`, `/mortgage`, `/insurance`, `/property-management`, `/title-escrow`, `/recruiting`, `/home-services`, `/cpa`, `/law`, `/ria`), and `/how-it-works`.
- **Code-mapped:** product app surface (`app/(product)/app/*`), operator surface (`app/(operator)/operator/*`), `lib/pricing/tiers.ts`, `lib/billing/*`, `lib/auth/resend-provider.ts`, `lib/inngest/functions/trial-expiration-warnings.ts`, `lib/custom-inquiry/*`, `lib/support/*`, `lib/agents/sentinel/corpus/*`, `lib/integrations/config-status.ts`, `components/CustomInquiryForm.tsx`, `components/Footer.tsx`.
- **Not assessable in this pass:** authenticated journeys (no real account on prod); Stripe live-mode price IDs (no Stripe console access from here); whether `hello@agentplain.com` is actively monitored (operational, not content).

This is an **assessment**, not a build, and not a license for outreach. No outreach was sent. No code was changed. The only write is this doc.

---

## Summary table — every surface, every piece, graded

Grades: **SHIP** = ready for a real customer hands-off · **FIX** = specific change needed · **MISSING** = required content doesn't exist · **RISKY** = misleads/embarrasses/creates legal-or-trust exposure.

| # | Surface | Grade | Evidence (file:line or live URL) | One-line why |
|---|---|---|---|---|
| 1 | Acquisition / first-contact assets (cold outreach, value pitch, objection handling) | **MISSING** | none in repo (`Grep` for sequence/outreach assets returns nothing user-facing) | The fleet has no canned first-touch to send; the no-outbound architecture says the customer system sends, but the *content* to populate that send doesn't exist. |
| 2 | Marketing — homepage `/` headline + tagline + mission line | SHIP | `app/(marketing)/page.tsx:69-90` | Locked brand text, correctly used. |
| 3 | Marketing — homepage 10-vertical chip row + /general on-ramp | SHIP | `app/(marketing)/page.tsx:105-132` | Ten ratified verticals + honest on-ramp; matches `lib/verticals/index.ts`. |
| 4 | Marketing — homepage "knowledge substrate" stat block ("Counsel-reviewed fair-housing, ECOA, broker-of-record…") | **RISKY** | `app/(marketing)/page.tsx:436-440` ("27 Compliance rules — Counsel-reviewed…") | Live page renders the claim verbatim. Per `lib/agents/sentinel/corpus/*` every rule across all 10 verticals is `status: DRAFT, counselReviewer: null` (0/45 counsel-reviewed). The page tells a real Atlanta business they're buying counsel-reviewed compliance that doesn't exist. |
| 5 | Marketing — homepage internal-file leak ("Source: project_stripe_both_surfaces.md HISTORICAL" and 5 other `.md`) | **RISKY** | live `https://agentplain.com/` rendered references include `project_agentplain_built_by_agents.md`, `project_counsel_engaged.md`, `project_pricing_value_anchor.md`, `project_no_outbound_architecture.md`, `project_stripe_both_surfaces.md`, `lib/knowledge/seed-data.ts` | Customer sees internal filenames. "HISTORICAL" / "STUB" / `.md` paths break the spell and read as an unfinished site. |
| 6 | Marketing — `/pricing` three-tier grid (Regular / Partner / Max) | FIX | `app/(marketing)/pricing/page.tsx:129-161` | Tier *structure* is internally consistent with `lib/pricing/tiers.ts` and the homepage; the **footnote leak** on line 148 (`"Schema-backed Partner tier per project_stripe_both_surfaces.md HISTORICAL."`) renders to the customer. Fix is delete the citation row and the "HISTORICAL" qualifier from customer copy. |
| 7 | Marketing — `/pricing` ROI calculator framing ("Conservative inputs are 8–15 hr/wk at $75–$150/hr") | FIX | `app/(marketing)/pricing/page.tsx:176` | Calculator estimate appears next to hard tier prices with no "illustrative" qualifier on the prose. Add a one-line "illustrative; your numbers will vary" near the calculator. |
| 8 | Marketing — `/custom` form + "Free scoping call" copy | SHIP | `app/(marketing)/custom/page.tsx:106-131,392-435` | Story arc is clean, inquiry form fields are sufficient for triage, "Custom vs Max" distinction is explained. |
| 9 | Marketing — `/custom` "Counsel-reviewed compliance" proof card | **RISKY** | `app/(marketing)/custom/page.tsx:149-153` ("The compliance corpus that ships with every vertical is reviewed by outside counsel… When counsel returns we name them publicly.") | Same defect as homepage: 0/45 corpora are counsel-reviewed today; "When counsel returns" implies it has been engaged. `project_counsel_engaged.md` is the cited memory but I cannot find counsel-review-completed records in `lib/agents/sentinel/corpus/*`. |
| 10 | Marketing — `/custom` internal-file leak ("Source: project_stripe_both_surfaces.md (Custom engagement pricing framework; locked 2026-05-12)") | **RISKY** | `app/(marketing)/custom/page.tsx:340-344, 363-365` | Every proof card has a `Source: <memory.md>` row that renders to the customer. Customer copy should never reference internal memory paths. |
| 11 | Marketing — `/about` | SHIP | live `/about` | Honest about scope: "Not a brokerage, lender, carrier, or licensed party. Liability for licensed activities stays with you and your firm." No team/scale claims that would mislead. |
| 12 | Marketing — `/verticals` index | SHIP | live `/verticals`; `app/(marketing)/verticals/page.tsx` | Ten cards, /general on-ramp, three tiers correctly described. |
| 13 | Marketing — `/general` on-ramp | SHIP | live `/general` | Honest about being lighter-scaffolded, sets 15× as floor, points to /custom for deeper. |
| 14 | Marketing — `/how-it-works` route | **RISKY** | `WebFetch https://agentplain.com/how-it-works` → **HTTP 404**; no `app/(marketing)/how-it-works` directory exists | Homepage uses `#how` anchor and footer uses `/#how`, but any organic landing on `/how-it-works` (typed URL, stale link, SEO crawler) breaks. With agents authoring outbound on customer behalf in the future, link discipline matters now. |
| 15 | Marketing — vertical `/real-estate` (ROI 26×, Compliance Sentinel claim) | FIX | live `/real-estate`; `lib/verticals/real-estate/content.ts:51-56,246-258` | 10 planned integrations rendered as "Integrations planned · Q3 2026, none cleared bar today" — that part is honest. Compliance Sentinel IS the one rule that has a verified literal-match HUD corpus (`lib/agents/sentinel/corpus/real-estate/fair-housing-hud-literal.ts`), but `status: DRAFT, counselReviewer: null`. ROI 26× is uncaveated. Internal `.md` leaks ride along (`project_*`, `feedback_*`). |
| 16 | Marketing — vertical `/mortgage` (ROI 9×, TRID claim) | **RISKY** | live `/mortgage`; `lib/agents/sentinel/corpus/mortgage/*` (5 rules DRAFT, 3 UNVERIFIED) | TRID/RESPA-adjacent claims with zero customer-facing disclaimer; ROI 9× uncaveated; internal `.md` leaks. |
| 17 | Marketing — vertical `/insurance` (ROI 11×, E&O posture, anti-rebating) | **RISKY** | live `/insurance`; `lib/agents/sentinel/corpus/insurance/*` (4 rules DRAFT, all 4 UNVERIFIED including GA O.C.G.A. § 33-6-4 subsection numbering open question) | E&O/fiduciary-adjacent claims without disclaimer; corpus is unverified; internal `.md` leaks. |
| 18 | Marketing — vertical `/property-management` (ROI 15×, fair-housing claim) | **RISKY** | live `/property-management`; `lib/agents/sentinel/corpus/property-management/*` (4 rules DRAFT, 3 UNVERIFIED) | Fair-housing for PM has no verified literal corpus today; the rule that fires for real-estate (HUD § 100.75) is NOT auto-applied to PM workflows. Page implies coverage. |
| 19 | Marketing — vertical `/title-escrow` (ROI 10×, wire-fraud guard, RESPA) | **RISKY** | live `/title-escrow`; `lib/agents/sentinel/corpus/title-escrow/*` (4 rules DRAFT, 2 UNVERIFIED + 1 crossref) | "Wire-fraud guard" is a high-trust claim with no disclaimer; RESPA-adjacent with no fiduciary qualifier; corpus is DRAFT; internal `.md` leaks. |
| 20 | Marketing — vertical `/recruiting` (ROI 23×, TCPA posture) | **RISKY** | live `/recruiting`; `lib/agents/sentinel/corpus/recruiting/*` (6 rules DRAFT, 1 UNVERIFIED) | TCPA / EEOC-adjacent claims without disclaimer; ROI 23× uncaveated (caveat is internal: "operator-modeled, not customer-attested" but does not render here). |
| 21 | Marketing — vertical `/home-services` (ROI 14×, contractor licensing) | FIX | live `/home-services`; `lib/agents/sentinel/corpus/home-services/*` (4 rules DRAFT, 3 UNVERIFIED, 1 verified GA contractor licensing) | Lower regulatory exposure than insurance/RIA/CPA/law but still ships ROI 14× with no disclaimer and `.md` leaks. |
| 22 | Marketing — vertical `/cpa` (ROI 12×, Circular 230) | **RISKY** | live `/cpa`; `lib/agents/sentinel/corpus/cpa/*` (6 rules DRAFT, all 6 UNVERIFIED) | "Compliance agent has already run federal + state checklist" + Circular 230 framing without "this is not tax advice" disclaimer; corpus is unverified; internal `.md` leaks. CPA practitioners are licensed parties — the gap between page promises and corpus state is largest here alongside RIA/law. |
| 23 | Marketing — vertical `/law` (ROI 15×+, ABA Model Rule 1.6 / MRPC 7.1) | **RISKY** | live `/law`; `lib/agents/sentinel/corpus/law/*` (7 rules DRAFT, 2 UNVERIFIED + 1 routing entry); `lib/skills/law-intake-conflict-screen/` | "Privilege-aware compliance pass" rendered as live capability; the underlying `law-compliance-sentinel` is `runtime: rooting` (not live); MRPC 7.1 corpus is "candidate phrases UNVERIFIED, does NOT fire until counsel red-lines." No UPL ("not legal advice") disclaimer anywhere. |
| 24 | Marketing — vertical `/ria` (ROI 15×+, SEC Marketing Rule, fiduciary-aware) | **RISKY** | live `/ria`; `lib/agents/sentinel/corpus/ria/*` (6 rules DRAFT, 5 UNVERIFIED); `project_no_outbound_architecture.md` cited next to "SEC archiveable" claim | "fiduciary-aware compliance pass" and "SEC Marketing Rule" rendered as live capability against an UNVERIFIED corpus. No fiduciary disclaimer. Highest-exposure vertical from SEC enforcement standpoint. |
| 25 | Intake — `/custom` form fields (type, name, business, vertical, seats, needs, email, service-intensity-notes) | SHIP | `components/CustomInquiryForm.tsx:104-146,160-336` | Sufficient for operator triage; type toggle pre-routes Custom vs Max; honest about no auto-reply. |
| 26 | Intake — `/inquiry-received` confirmation copy + 2-business-day SLA | SHIP | live `/inquiry-received`; `app/(marketing)/inquiry-received/page.tsx` | "Expect a reply within two business days from a real human, not a drip sequence." Honest. SLA is an operational promise that requires Conner (or a future named operator) to actually be staffed — flag for operations, not content. |
| 27 | Intake — there is NO customer auto-reply email (only operator gets notified) | FIX | `lib/custom-inquiry/index.ts:151-214` (operator email only); `components/CustomInquiryForm.tsx:333-335` ("We email one human; no drip sequence, no auto-reply.") | Honest, but for a hands-off fleet the customer should get a *transactional* "got it, here's your ticket id, here's the SLA" confirmation email — not a drip, just a receipt. The on-page state alone fails if the tab closes or the email bounces operator-side. |
| 28 | Product app — sign-up, sign-in, verify, passkey flows | SHIP | `app/(product)/app/sign-up/page.tsx:43-62`, `app/(product)/app/sign-in/*`, `app/(product)/app/verify/route.ts` | Copy is clean, error states are specific, Plaino character is consistent. |
| 29 | Product app — workspace overview (`/app/workspace/[id]`) | SHIP | `app/(product)/app/workspace/[id]/page.tsx:105-601` | Honest empty states ("Nothing has come in yet. Plaino is watching your inbox."), illustrative loop preview is correctly marked "An illustration, not your data." |
| 30 | Product app — onboarding wizard | SHIP | `app/(product)/app/workspace/[id]/onboarding/page.tsx:351-354,424-427,506-509` | Read-only / no-outbound discipline correctly stated: "We never send outbound on your behalf; your existing inbox handles every send." Step 2 honest about not-configured providers. |
| 31 | Product app — approvals queue intro copy | **RISKY** | `app/(product)/app/workspace/[id]/approvals/page.tsx:41-43` ("Routine items send through automatically. Anything above your threshold lands here for explicit ratification — we draft, you decide, your existing system sends.") | "send through automatically" contradicts `project_no_outbound_architecture.md` head-on. The very next clause says "your existing system sends" — the two halves contradict. A customer reading this can fairly conclude that some items skip review. Wording must flip to "Routine items roll through quietly to your existing system; anything above your threshold lands here for explicit ratification — we draft, you decide, you send." or similar. |
| 32 | Product app — approvals queue per-row copy (PERSISTED vs not, admin cards, verification-code handling) | SHIP | `app/(product)/app/workspace/[id]/approvals/ApprovalsList.tsx:171-179, 235-323` | Per-row copy correctly distinguishes "held for review — confidence below the persist threshold, did not write to your Gmail Drafts" vs "Saved to your Gmail Drafts. Approve here to confirm it ships on your side." Honest and architecturally correct. |
| 33 | Product app — integrations page count line ("X connected · X available · X coming soon") | FIX | `app/(product)/app/workspace/[id]/integrations/page.tsx:83-85,106-112,152-159` | `tileStatusFor` returns `"available"` whenever a tile is neither connected nor coming-soon — **regardless of whether the OAuth env vars are set** (`lib/integrations/config-status.ts:33-48`). A self-serve customer sees "8 available" but tapping reveals "{name} isn't open for self-connect yet" for tiles whose `GOOGLE_OAUTH_CLIENT_ID` / `M365_*` / `DOCUSIGN_*` env vars are missing. Bucket "available" must exclude unconfigured tiles, or rename to "in marketplace." |
| 34 | Product app — billing / Stripe checkout / trial banners | SHIP | `app/(product)/app/workspace/[id]/settings/billing/page.tsx:109-651` | Trial, past-due, cancellation-scheduled, and missing-subscription states all have honest copy. "First month free" framing is consistent. |
| 35 | Product app — agents page + per-agent detail | SHIP | `app/(product)/app/workspace/[id]/agents/page.tsx`, `[slug]/page.tsx` | Status line distinguishes "ready" / "rooting" / "{N} handoffs logged" honestly per `runtime: live` / `runtime: rooting` in `lib/verticals/*/content.ts`. |
| 36 | Product app — briefings, activity feed, compliance flags, settings, help form | SHIP | `app/(product)/app/workspace/[id]/{briefings,activity,compliance,settings,help}/page.tsx` | Empty states honest, no fake imminence, Plaino character consistent, settings "coming-soon" badges scoped correctly. Compliance flag page correctly notes "Compliance Sentinel raises flags on customer-facing drafts before they leave your brokerage… your broker-of-record review still gates every send." |
| 37 | Product app — Plaino service partner character | SHIP | `lib/onboarding/service-partner.ts:16-20`; consumed across all `/app/workspace` surfaces | One named character, voice + avatar consistent, no name-pool drift. |
| 38 | Pricing — single source of truth `lib/pricing/tiers.ts` vs surfaces | FIX | `lib/pricing/tiers.ts:98-123`; `app/(marketing)/pricing/page.tsx:27-41`; `components/CustomInquiryForm.tsx` (no price echo); `app/(product)/app/sign-up/SignUpForm.tsx:37-43` | Code-side pricing is internally consistent (Regular $199→$99, Partner $299→$199, Max quote-based). The conflict is **memory vs surface**: `project_stripe_both_surfaces.md` is recorded in memory as "simplified Regular + Custom only, ARCHIVED 2026-05-12" — surfaces ratified 3 days later (2026-05-15) re-introduced three tiers. The memory mirror has not been re-mirrored. Effect: code/site are consistent with each other; the **memory file Conner will read** says something else, which is a process gap, not a customer-facing defect. The customer-facing defect is the "HISTORICAL" word rendering in the citation footnote (row 6 above). |
| 39 | Transactional email — sign-in magic-link | SHIP | `lib/auth/resend-provider.ts:11-43` | Clean, expires in 15m, "If you didn't request this…" reassurance, signed "Plaino, your service partner at agentplain." |
| 40 | Transactional email — sign-up workspace creation | SHIP | `lib/auth/resend-provider.ts` | As above. |
| 41 | Transactional email — workspace invitation | SHIP | `lib/auth/resend-provider.ts` | As above. |
| 42 | Transactional email — trial-end warning (7/3/1 day) | SHIP | `lib/inngest/functions/trial-expiration-warnings.ts:230-262` | Honest: "If you haven't added a card yet, your fleet pauses when the trial ends." Specific dollar amount + per-seat math rendered. |
| 43 | Transactional email — support-request notification (operator-bound) | SHIP | `lib/support/index.ts:124-158` | Goes to `hello@agentplain.com`; triages to `/operator/support`. |
| 44 | Transactional email — custom-inquiry notification (operator-bound) | SHIP | `lib/custom-inquiry/index.ts:151-214` | Goes to `hello@agentplain.com`; triages to `/operator/inquiries`. |
| 45 | Transactional email — customer-facing inquiry confirmation | **MISSING** | nothing in `lib/custom-inquiry/*` sends to the *customer* | See row 27. The form's `SentState` is on-page only. |
| 46 | Transactional email — invoice / receipt / failed-payment | SHIP (delegated) | `lib/billing/webhook-dispatch.ts:44-82` | Stripe owns invoice PDFs and receipts; agentplain mirrors metadata. Fine for hands-off as long as Stripe's default-receipt setting is on; not assessable from here. |
| 47 | Support — in-app help form `/app/workspace/[id]/help` | SHIP | (per code-map) | Subject + body, server-side validation, honest success state ("Your message is on its way to your service partner. We'll follow up by email."). |
| 48 | Support — public-facing KB / FAQ | **MISSING** | no `/support`, `/help`, `/docs`, `/faq` routes; homepage `/#faq` anchor is the only FAQ surface | A hands-off customer who hits an issue before signing in has no self-serve KB. The on-site FAQ (homepage `#faq`) is marketing-shaped, not troubleshooting-shaped. |
| 49 | Support — public escalation path / "talk to a human" | FIX | Footer (`components/Footer.tsx:118-127`) has only `mailto:hello@agentplain.com` | Acceptable for now, but a hands-off ops fleet should not have email-only escalation as the *only* path. No phone, no SLA on response. |
| 50 | Legal — `/terms` (Terms of Service) | **MISSING** | no route, no file | Hard blocker for hands-off SaaS on real customers; trial sign-up + Stripe charge with no executed terms is a real exposure. |
| 51 | Legal — `/privacy` (Privacy Policy) | **MISSING** | no route, no file | Required for any state with consumer-privacy law (CA/CO/CT/UT/VA already; GA pending). |
| 52 | Legal — `/security` or `/trust` | **MISSING** | no route, no file | Customers in regulated verticals (RIA, law, CPA, insurance) will ask before signing. |
| 53 | Legal — `/dpa` (Data Processing Agreement) | **MISSING** | no route, no file | If the fleet reads CRM/email/calendar, customer counsel will require one before connecting OAuth. |
| 54 | Legal — cookie banner / GDPR/CCPA notice | **MISSING** | grep for cookie-banner / consent-banner returns nothing | Lower priority since site appears US-only, but CCPA threshold applies once revenue/users cross. |
| 55 | Legal — vertical disclaimers (UPL, "not tax advice", "not investment advice", "not legal advice") | **MISSING** | grep for `"not legal advice"`, `"not tax advice"`, `"consult"`, `"informational purposes"` across customer surfaces returns zero | Every regulated-vertical page (law, RIA, CPA, mortgage, insurance, title-escrow) makes advice-adjacent claims with no boilerplate. |
| 56 | Legal — Compliance Sentinel scope disclaimer ("realty/HUD only today; other verticals are DRAFT corpus") | **MISSING** | sentinel UI in `/app/workspace/[id]/compliance/page.tsx` says "Compliance Sentinel raises flags on customer-facing drafts" with no qualifier on corpus maturity | Customer on `/cpa` or `/ria` reading the marketing page and the in-app compliance page will fairly believe the sentinel is enforcing their vertical's rules today. It isn't (rules are loaded as DRAFT/UNVERIFIED and do not fire). |
| 57 | Delivery — value-loop output framing (what the customer actually receives — drafts in Gmail Drafts, approvals in queue) | SHIP | per-row copy in `ApprovalsList.tsx:171-179`; onboarding step 2 (`onboarding/page.tsx:351-354`) | Architecturally honest and well-framed. The "approve here, your existing system sends" loop is one of the strongest parts of the product surface. |
| 58 | Operator surface — `/operator/*` (workspaces, inquiries, integrations, support, fleet) | OUT-OF-SCOPE-FOR-VET | `app/(operator)/operator/*` | Internal, gated. Copy quality is operational not customer-facing. Flagged only because: the inquiry triage flow assumes a human triages within the SLA promised on `/inquiry-received` — that's an operational dependency hidden behind a content promise. |
| 59 | Footer (`components/Footer.tsx`) | FIX | `components/Footer.tsx:110-127` | Company column has only About + email. Once `/terms` / `/privacy` / `/security` ship, they belong here. Current state contributes to the "unfinished site" impression. |

**Counts:** SHIP = 23 · FIX = 9 · MISSING = 8 · RISKY = 11 · OUT-OF-SCOPE = 1. **Of the 11 RISKY items, 10 are on live customer-facing pages today.**

---

## Detailed findings by surface

### 1. ACQUISITION / FIRST CONTACT

**Status: MISSING (entire surface).**

The repo has no outreach sequences, no canned first-touch templates, no objection-handling docs, no cold-email collateral. This is **consistent with the no-outbound architecture** (the customer system, not agentplain, sends) and **consistent with the "no outreach until product/site ready" rule** — but for a hands-off fleet that one day *will* draft outreach into the customer's Gmail, the **content** that fills the drafts has to live somewhere. Today it does not.

Per the brief I am not authoring this content. Flagged as the largest single MISSING gap.

### 2. MARKETING SITE

**The biggest cross-cutting defect is internal-memory-filename leakage onto live pages.** Confirmed verbatim by WebFetch on 2026-05-26:

- `/` renders: `lib/knowledge/seed-data.ts`, `project_agentplain_built_by_agents.md`, `project_counsel_engaged.md`, `project_pricing_value_anchor.md`, `project_no_outbound_architecture.md`, `project_stripe_both_surfaces.md`
- `/pricing` renders: `project_stripe_both_surfaces.md`, including the word **"HISTORICAL"** (file:line `app/(marketing)/pricing/page.tsx:148`)
- `/custom` renders: `feedback_agentplain_built_by_agents.md`, `project_counsel_engaged.md`, `project_no_outbound_architecture.md`, `project_pricing_value_anchor.md`, `project_stripe_both_surfaces.md`
- `/real-estate` renders: `project_stripe_both_surfaces.md`, `project_pricing_value_anchor.md`, `realty_vertical_spec_v1_2026-05-03.md`, `agentplain_positioning.md`, `project_integration_roadmap.md`, `feedback_integration_acceptance_is_functional.md`
- `/cpa`, `/mortgage`, `/insurance`, `/property-management`, `/title-escrow`, `/recruiting`, `/home-services`, `/law`, `/ria` — same pattern. Every vertical page carries a "Source: <memory.md>" row that renders.
- `/about` and `/general` and `/verticals` and `/inquiry-received` are clean (no leaks observed in WebFetch).

Source of the pattern: every `Section` and proof card uses a `Source: <code>{citePath}</code>` footnote where the path is the orchestrator-memory filename. For internal traceability this is gold. For a customer surface it is a category error — it tells the buyer they are reading a working document, not a product page.

**Other marketing-site defects:**

- **"Counsel-reviewed" claim on homepage** (`app/(marketing)/page.tsx:436-440`) and **on `/custom`** (lines 149-153). Per `lib/agents/sentinel/corpus/*/index.ts` every rule across all 10 verticals carries `status: 'DRAFT', counselReviewer: null`. The homepage stat block says "27 Compliance rules" labeled "Counsel-reviewed fair-housing, ECOA, broker-of-record, and per-vertical regulatory rules. Unverified placeholders are intentionally excluded — flagged for counsel, never seeded." This claim is **incorrect today** in two ways: (a) corpus is DRAFT, not reviewed; (b) the "unverified placeholders are excluded" assertion is false — `lib/agents/sentinel/corpus/insurance/*`, `/cpa/*`, `/ria/*`, `/law/*` etc. ship corpora explicitly marked UNVERIFIED ("does NOT fire until counsel red-lines"). They are seeded, just not active.
- **`/how-it-works` returns HTTP 404.** Confirmed by WebFetch. The homepage uses `#how` anchor (`app/(marketing)/page.tsx:139,198`) and the footer uses `/#how` (`components/Footer.tsx:72`). The 404 is not directly linked from current copy, but it's the obvious URL guess and it embarrasses any prospect who types it.
- **Homepage three-tier framing** (`app/(marketing)/page.tsx:486-518`) re-introduces Regular / Partner / Max as a 3-column grid. Memory `project_stripe_both_surfaces.md` is recorded as "simplified Regular + Custom only, ARCHIVED 2026-05-12." The 2026-05-15 re-introduction of three tiers in code/site is not reflected in the memory mirror. The customer doesn't see this — the code/site are internally consistent — but a future re-orchestration that reads memory will recreate the contradiction. Out of scope to fix in this vet; flagged.

### 3. INTAKE / INTERVIEW

The `/custom` form is the only intake surface. It is well-shaped for an operator-triaged path:

- Inquiry-type radio (Custom skill build / Max-tier service engagement / Not sure / both) — `components/CustomInquiryForm.tsx:164-200`
- Name, business, vertical (10 + Other), seats estimate, free-form needs — sufficient signal for operator triage
- Conditional service-intensity textarea when Max or "Not sure" selected — `components/CustomInquiryForm.tsx:274-304`
- `SentState` confirmation copy varies by inquiry type — Custom = 2 business days, Max = 1 business day

**Two gaps:**
- **No customer-bound transactional email** (row 45 in summary table). For hands-off, the customer should get an email receipt independent of the page state, with the same SLA + a way to reply.
- **No interview / discovery / questionnaire** beyond the contact form. A hands-off scoping flow that wants to actually deliver in 4-6 weeks (`app/(marketing)/custom/page.tsx:121-124`) needs more structured intake than "What you need" free-form prose. This is consistent with current "human reads each one" framing, but a real hands-off fleet would need a structured discovery skill that drafts a scoping doc from the inquiry plus a couple of follow-up email rounds.

### 4. PRODUCT / APP COPY

The product app is the **strongest content surface in the audit**. The Plaino character is consistent; empty states are honest; onboarding correctly insists on read-only and no-outbound; the per-row approvals copy is architecturally precise about "saved to your Gmail Drafts" vs "held for your review."

**One RISKY defect** — `app/(product)/app/workspace/[id]/approvals/page.tsx:41`:

> "Routine items send through automatically. Anything above your threshold lands here for explicit ratification — we draft, you decide, your existing system sends."

The first sentence and last clause contradict each other within 30 words. Per `project_no_outbound_architecture.md` the architecture is: agents draft → customer reviews → customer's system sends. **Nothing** auto-sends from agentplain. A customer reading "Routine items send through automatically" can fairly believe drafts below their threshold are auto-sent. Recommended rewrite: *"Routine items roll through quietly to your existing system as drafts; anything above your threshold lands here for explicit ratification — we draft, you decide, you send."* (Or equivalent that drops "automatically.")

**One FIX defect** — `app/(product)/app/workspace/[id]/integrations/page.tsx:83-85,152-159`:

`availableCount` includes tiles whose underlying OAuth env vars are not set (`isIntegrationConfigured` returns false for them; `tileStatusFor` does not check). The header line "X available" overstates capability. Fix is either to compute `availableCount` against `isIntegrationConfigured(entry)` as well, or rename the bucket from "available" to "in marketplace" with a smaller "X live today" sub-line.

### 5. PRICING & CUSTOMIZATION

Pricing **structure** is internally consistent across `lib/pricing/tiers.ts`, `/pricing`, `/custom`, the homepage tier grid, the signup form tier-picker, and the billing settings page. Regular $199→$99, Partner $299→$199, Max quote-based. First month free everywhere. Per-seat-monthly cents match across surfaces.

Two consistency defects:

- **"HISTORICAL" rendered in citation footnote** on `/pricing` (line 148). Highest-priority customer-facing pricing-page fix.
- **Memory file vs surface divergence** (described in summary row 38). Process gap, not a customer-facing defect, but it will create downstream "what's actually true?" confusion in any future memory-driven orchestration.

`/custom` engagement pricing ("$5K–$15K + $200–$500/mo") is consistent between `/custom` body (lines 320-339) and `/custom` metadata description (line 14) and what the homepage links to. Honest about what Custom is (engagement, not tier).

### 6. SUPPORT

- **In-app help form** (`/app/workspace/[id]/help`) is SHIP-quality.
- **No public-facing KB or FAQ** beyond the homepage `#faq` anchor — gap for a hands-off model.
- **No phone, no chat, no public ticketing.** All support is `mailto:hello@agentplain.com`. Acceptable today; insufficient for a hands-off fleet serving 50–99-seat customers.

### 7. DELIVERY & TRANSACTIONAL COMMS

All 4 customer-bound transactional emails (`lib/auth/resend-provider.ts:11-43`, plus the trial-warning at `lib/inngest/functions/trial-expiration-warnings.ts:230-262`) are clean: short, honest, signed by Plaino, link to specific actions. No drip sequences (correct). Stripe-side billing receipts delegated to Stripe (correct).

The gap is the **missing customer-facing custom-inquiry confirmation email** (summary row 45). Today, hitting submit on `/custom` gives the customer an on-page state and nothing in their inbox. If they close the tab, they have no record they submitted. A one-line receipt email is table stakes for hands-off.

### 8. LEGAL / COMPLIANCE

The largest **MISSING** cluster in the audit:

- `/terms`, `/privacy`, `/security`, `/dpa`, `/trust` — **all missing routes.** No file under `app/(marketing)/*` for any of them. No links in footer or anywhere else.
- **No customer-facing vertical disclaimers** anywhere in the marketing site. Searched for `"not legal advice"`, `"not tax advice"`, `"not investment advice"`, `"consult"`, `"informational purposes"`, `"this does not constitute"` across `app/`, `components/`, `lib/` — zero matches in customer copy.
- **"Counsel-reviewed" claims** on homepage + `/custom` against a 0/45 counsel-reviewed corpus (summary rows 4, 9).
- **"Compliance Sentinel" framing** on regulated-vertical pages without disclaimer that the per-vertical corpus is DRAFT/UNVERIFIED and does not fire (summary rows 16-24, 56).

The single **verified, fires-today** compliance rule is `lib/agents/sentinel/corpus/real-estate/fair-housing-hud-literal.ts` — ~46 literal-trigger HUD phrases, GA real-estate, status DRAFT but rule logic active. Every other rule across every other vertical is either DRAFT-not-firing or UNVERIFIED-not-firing.

`/about` correctly disclaims **"Not a brokerage, lender, carrier, or licensed party. Liability for licensed activities stays with you and your firm."** — but this disclaimer lives only on `/about`. It is not echoed on the vertical pages where the risk actually lives.

---

## Prioritized remediation backlog

### P0 — block hands-off launch (live-customer-facing risk)

1. **Strip every `project_*.md` / `feedback_*.md` / `lib/knowledge/seed-data.ts` "Source: …" footnote from customer surfaces.** Affects: `app/(marketing)/page.tsx`, `app/(marketing)/pricing/page.tsx`, `app/(marketing)/custom/page.tsx`, every `lib/verticals/*/content.ts`, and the rendering components that surface those `cite:` fields (`components/marketing/HomeCards.tsx`, vertical proof cards). The internal traceability they provide should move to a hidden HTML comment, JSON-LD `dc:source`, or an internal-only `/audit` route — never visible body text. *Highest-velocity defect: kills product perception of "finished site."*
2. **Delete the word "HISTORICAL" from `/pricing`** (`app/(marketing)/pricing/page.tsx:148`) and the inline rationale around it.
3. **Fix or qualify "Counsel-reviewed compliance" on `/`, `/custom`, and any vertical page that echoes it.** Two acceptable paths: (a) flip the corpus to actually counsel-reviewed and record `counselReviewer` per rule, then keep the claim; (b) until then, downgrade the claim to "Counsel-engaged compliance corpus, gated rules until red-line" with the proof-card body matching what `lib/agents/sentinel/corpus/*/index.ts` shows today (DRAFT + many UNVERIFIED).
4. **Rewrite `/app/workspace/[id]/approvals/page.tsx:41`** so the lead sentence does not say "send through automatically." Per `project_no_outbound_architecture.md`, the architecture is hand-off-on-every-message.
5. **Add a single boilerplate disclaimer surface for the regulated verticals** (`/cpa`, `/law`, `/ria`, `/mortgage`, `/insurance`, `/title-escrow`, `/property-management`, `/recruiting`). One shared component, rendered in the footer of those pages, that says some variant of: *"agentplain is not a [law/CPA/RIA/lending/insurance/brokerage/escrow/recruiting] firm and does not provide [legal/tax/investment/lending/insurance/title/employment] advice. Every output is reviewed and sent by your licensed personnel. Liability for licensed activities stays with your firm."*
6. **Ship `/terms` and `/privacy`** as the minimum legal surface for a hands-off trial that takes a Stripe card. Customers in regulated verticals will not sign without one.
7. **Build the `/how-it-works` route** (or 301-redirect to `/#how`). A 404 on the obvious URL guess is a trust hit.

### P1 — required for hands-off readiness (next slice)

8. **Send a customer-bound `/custom` inquiry confirmation email** with the same 2-business-day SLA copy, a ticket ID, and reply-to support.
9. **Ship a self-serve KB / public FAQ** (or a `/help` route with categorized articles). Today only the homepage `#faq` anchor exists and is marketing-shaped.
10. **Fix integrations-page "X available" count** to exclude unconfigured tiles, or rename the bucket. Today the count overstates capability.
11. **Ship `/security` (or `/trust`) and `/dpa`.** Required to get a 25–99-seat regulated-vertical customer through procurement without a manual back-and-forth.
12. **In-app "compliance corpus maturity" disclaimer.** `/app/workspace/[id]/compliance/page.tsx` should distinguish "Sentinel is firing X rules for your vertical today" from "Y rules are loaded as DRAFT and do not fire."
13. **Re-mirror `project_stripe_both_surfaces.md`** to the canonical three-tier 2026-05-15 ratification so memory and surface agree (process, not content).

### P2 — polish / scale enablement

14. Vertical pages: add "illustrative; your numbers will vary" near every ROI number (9× through 26× across verticals).
15. Footer: once P0-6 and P1-11 land, surface `/terms`, `/privacy`, `/security`, `/dpa` in the Company column.
16. Cookie banner / CCPA notice — defer until first CA customer or revenue threshold.
17. ROI-calculator on `/pricing`: echo the `[estimate]` qualifier from `components/RoiCalculator.tsx` into the surrounding prose, not just the calculator.
18. The "first-touch / outreach" content library (MISSING — summary row 1) belongs in a dedicated `lib/outreach/` content surface, scoped per vertical, that the customer's system would draft *into* their Gmail. Out of scope for content vet; flagged as architectural follow-up.

---

## Autonomous-readiness verdict (blunt)

**No.** The fleet cannot run agentplain end-to-end for a real Atlanta business hands-off today. The specific blockers:

1. **Trust break:** Internal memory filenames (`project_*.md`, `feedback_*.md`, the word "HISTORICAL") render on at least 11 live marketing routes. A buyer who sees this knows they're reading an unfinished surface.
2. **False compliance claim:** Homepage and `/custom` assert "counsel-reviewed" compliance across the corpus; the corpus is 0/45 counsel-reviewed. That is a legally material misrepresentation for the regulated verticals (RIA, law, CPA, mortgage, insurance, title-escrow) that drive the highest-value seats.
3. **Self-contradicting safety copy:** The approvals queue page leads with "Routine items send through automatically" while the architecture is explicitly no-outbound. A customer reading this can fairly believe agentplain auto-sends below-threshold drafts.
4. **No legal foundation:** No `/terms`, `/privacy`, `/security`, `/dpa`. Charging a Stripe card without executed terms is exposure. Regulated-vertical procurement won't clear without these.
5. **No vertical disclaimers:** Every regulated-vertical page makes advice-adjacent claims (TRID, RESPA, Circular 230, SEC Marketing Rule, ABA Model Rule 1.6, fair-housing, TCPA, E&O) with zero customer-facing boilerplate.
6. **Broken obvious URL:** `/how-it-works` 404s.
7. **Missing customer transactional email:** `/custom` submit sends operator-bound mail only; the customer gets an on-page state and no receipt.

What **is** ready:
- Brand, mission, tagline, ten-vertical chip row, /general on-ramp.
- The entire product-app interior (workspace, onboarding, agents, briefings, activity, compliance, settings, billing, help, sign-up/in/verify).
- Plaino character continuity.
- Per-row approvals copy (PERSISTED vs not, admin cards, verification handling) — architecturally precise.
- All 4 customer-bound transactional emails.
- `/inquiry-received`, `/about`, `/verticals`, `/general`, `/custom` form structure.

The product surface inside the workspace is the strongest part of agentplain's content. The marketing surface and the legal scaffolding are the gap.

**Recommended next move:** land P0-1 (strip internal filenames) and P0-3 (fix the counsel-reviewed claim) before any further pilot conversations. They are the two changes that make the rest of the site read as a product, not a draft.

---

## Scoping caveats — what was not assessed

- **Authenticated journeys on production.** I have no real account on `agentplain.com`. All product-app findings (rows 28-37, 47, 57) come from reading `app/(product)/app/**` source and the QA-shape strings that render. I did not verify how the strings look in a real workspace, nor whether the data-shaped surfaces (briefings, activity feed, approvals queue) have honest empty states under a brand-new account vs. a populated one. The code reads correct.
- **Stripe live mode.** I cannot verify whether the live Stripe Products/Prices match `lib/pricing/tiers.ts` (`scripts/stripe/setup-products.ts` is the runbook; it has not been re-run for this audit). I verified only that the in-repo pricing is internally consistent across surfaces.
- **`hello@agentplain.com` monitoring.** `/inquiry-received` promises a 2-business-day reply. Whether anyone reads that inbox today is operational, not content.
- **Real customer reaction.** This vet grades against an internal lens (no-hallucination, claims-vs-reality, customer-trust). It does not measure conversion, ICP fit, or competitive positioning — that is the journey-map audit's lane.
- **Image and OG asset content.** `app/(marketing)/[vertical]/opengraph-image.tsx` and the wordmark/brand assets were not opened in this pass.
- **Dark patterns / accessibility.** Out of scope. A separate accessibility pass is appropriate before any launch.
