# 01 — Named ICP per vertical + prospect-list spec

**Scope:** the 5 live verticals (real-estate, CPA, law, property-management, general). Each gets: a one-paragraph ICP, firmographic filters, 3 disqualifiers, a specific would-be-a-yes profile, and a data-source pick for building the list.

**Sequencing (binding, from 00):** real estate is the only active lane at start. PM and general open when the RE cadence is stable (weeks 3–4). CPA and law stay closed until 2 RE pilots are live — and CPA additionally waits on the TaxDome/Karbon connect fix (audit 5, P0-1).

**Ground rules for every list:** the integration story we can honestly sell is **email (Gmail/Outlook) + calendar + QuickBooks + DocuSign + Drive** (claims spine §2/§6). CRM/PMS stack signals below are *ops-maturity indicators for targeting*, never integration promises — FUB, BoldTrail, kvCORE, Buildium, AppFolio, TaxDome, Karbon, Clio are all roadmap or unconnectable today and are never claimed in outreach.

---

## Real estate (BEACHHEAD — active now)

**ICP.** The broker-owner of an independent (non-franchise or loosely-franchised) residential brokerage of roughly 5–40 agents who still personally carries the coordination load: chasing agents for transaction docs, drafting first-touch replies to inbound leads at 9pm, invoicing commissions through QuickBooks, and writing the monthly production email nobody else will write. They are revenue-healthy but calendar-poor, they own their liability (fair-housing exposure sits with the broker of record), and they already trust email + DocuSign + QuickBooks as their operating spine — which is exactly the spine we connect to. Georgia first: that's where Conner's FlatSBO-adjacent network produces warm paths, and warm beats cold at this stage by a wide margin.

**Firmographic filters.**
- Independent residential brokerage, broker-owner active in operations (not an absentee investor)
- 5–40 agents; $75M+ annual sides volume not required — activity matters more than GCI
- Georgia (metro Atlanta first), then Southeast
- Tech signals: Google Workspace or M365; QuickBooks (Online preferred); DocuSign; a lead-gen CRM in use (FUB / BoldTrail / kvCORE — maturity signal only)
- Community signals: active in local/state Realtor association, Lab Coat Agents, FUB or BoldTrail user groups (the money-GTM named channels)

**Disqualifiers.**
1. Franchise offices whose tech stack is mandated from above (no authority to add tools or connect email).
2. Tech-forward discount/iBuyer models building their own automation (they're a competitor for talent, not a customer).
3. Any shop that requires SOC 2 / formal security review to pilot — we can't clear that gate yet; park politely, don't pursue.

**Would-be-a-yes profile.** *"Marietta brokerage, 14 agents, broker-owner in her 50s who was a top producer and now spends Tuesday nights reconciling commission invoices in QuickBooks and forwarding transaction-doc reminders one at a time. Runs FUB for leads, DocuSign for everything, Gmail. Active in the Cobb Association of Realtors. Has one part-time admin who is drowning. Heard about us from a FlatSBO-adjacent contact, so the first email is warm."*

**List source.** **Do not start with Apollo here.** State license rolls (Georgia Real Estate Commission), GAMLS/FMLS office rosters, and local association directories give a *complete, free* census of Georgia brokerages with broker-of-record names — better coverage of this exact population than any sales database. Use Apollo only to enrich (email, LinkedIn) the 50 names the rosters produce. Warm-path map (Conner's network) is built by hand first; the warm column on the list is its most valuable field.

---

## Property management (secondary lane — opens weeks 3–4)

**ICP.** The owner or ops director of an independent residential PM company managing roughly 150–1,500 doors with 3–15 staff, where tenant email volume and rent collections consume the front office. Live workflows (Tenant Inbound, Collections, Chief of Staff — claims spine §6) fit them today *if* their books run through QuickBooks Online and their communication runs through Gmail/Outlook. The fair-housing angle carries the same $26,262 first-offense weight as RE, and the buyer holds the liability personally.

**Firmographics.** Independent (non-institutional) residential PM; 150–1,500 doors; 3–15 staff; QuickBooks Online for trust/operating books (or at minimum owner books); Gmail or M365; Southeast US to keep time zones and eventual references coherent.

**Disqualifiers.**
1. Runs entirely inside Buildium/AppFolio/Yardi with no QuickBooks and email workflows buried in the PMS — our live surface can't reach their work yet (those PMS integrations are roadmap, never claimed).
2. HOA-only management (different workflow shape than the live tenant/collections skills).
3. Owner is checked out and delegating the decision to a staffer with no budget authority.

**Would-be-a-yes.** *"Chattanooga PM shop, 420 doors, 6 staff. Owner-operator answers tenant email himself on weekends; collections follow-ups go out late and inconsistently; QuickBooks Online holds the books; the front office lives in a shared Gmail inbox. NARPM member."*

**List source.** NARPM member directory (public, vertical-exact) + state license rolls, enriched via Apollo. LinkedIn Sales Nav unnecessary here.

---

## General (SMB on-ramp — opportunistic lane, warm-path only)

**ICP.** An owner-operated local service business, 1–10 seats, on Google Workspace or M365, whose owner is the bottleneck for inbox triage, follow-ups, and process documentation — the four live general workflows. No vertical compliance corpus exists (honest trade stated in the packet), so the fit is businesses whose risk is *time*, not *regulation*. This lane exists to absorb warm referrals that don't fit a named vertical — it is not prospected cold in the first 90 days.

**Firmographics.** 1–10 seats; owner-operated; Google/M365 confirmed (hard requirement — all four live workflows need it); US; service businesses (agencies, consultancies, contractors' offices, studios) with recurring client communication.

**Disqualifiers.**
1. Regulated-industry business arriving through the general door (route to its vertical or decline — no corpus, no claim).
2. No cloud email (POP3/on-prem Exchange relics).
3. Wants outbound marketing automation ("can it send my newsletter?") — wrong product by architecture.

**Would-be-a-yes.** *"Atlanta design-build studio, 6 people. Owner spends 90 min/day triaging a shared inbox and chasing sign-offs; proposals go out via DocuSign; books in QuickBooks. Referred by a design partner or personal contact."*

**List source.** None purchased. This lane is fed by referrals and inbound (`/waitlist`, PlainoWidget leads) only.

---

## CPA (CLOSED until 2 RE pilots live + connector fix — prep only)

**ICP (for when it opens).** A 2–15 seat local CPA/tax firm whose managing partner personally chases missing client documents at month-end and quarter-close, runs QuickBooks Online for the firm's own books and many clients', and carries IRC §6694 exposure ($1,000–$5,000 per return) personally. 14-day trial applies (`trialPeriodDaysForVertical`, `lib/billing/facts.ts`). Persona rule: no Plaino voice — sober, signed by Conner.

**Firmographics.** 2–15 seats; local/regional (not top-200); QuickBooks Online-centric practice; Gmail/M365; ideally already publishing a client-facing newsletter or portal (signals comfort with client-facing tooling).

**Disqualifiers.**
1. Practice management lives in TaxDome or Karbon and they expect us to read it — unconnectable today (audit 5 P0-1); do not open CPA outreach until fixed, and even after, scope claims to what's live.
2. Firms in active tax season compression (Jan 15–Apr 15): wrong moment to introduce anything; time outreach for May–November.
3. Audit-practice-dominant firms (independence and workpaper rules make our surface area tiny).

**Would-be-a-yes.** *"Alpharetta firm, 7 seats, managing partner + 2 CPAs + staff. Month-end close involves 40 missing-doc chase emails written by the partner. QBO everywhere. Wants the drafting, needs the approval gate to satisfy her own Circular 230 posture."*

**List source.** Georgia Society of CPAs directory + state board license rolls, Apollo-enriched.

---

## Law (CLOSED until 2 RE pilots live — prep only)

**ICP (for when it opens).** A 2–10 attorney firm in practice areas with heavy routine client communication — estate planning, family, residential real-estate closings — where the managing partner drafts status updates and intake conflict checks eat unbilled hours. ABA Model Rules 1.6/7.1 exposure makes the approval gate the pitch, not a caveat. 14-day trial. No Plaino persona; precise, signed by Conner.

**Firmographics.** 2–10 attorneys; consumer-facing practice areas (estate, family, RE closings, small business); Gmail/M365 + DocuSign or equivalent; solo-plus-staff configurations welcome; Georgia first (closing-attorney state — adjacent to the RE beachhead and its referral graph).

**Disqualifiers.**
1. Litigation-heavy firms wanting document review across a DMS (iManage/NetDocuments) we don't touch — no live claim possible.
2. Firms that require outside-counsel-grade security paperwork (SOC 2, security addenda) to pilot.
3. Anyone asking the AI to render legal conclusions — the intake screen deliberately leaves the legal conclusion as a human merge field; a buyer who wants more is buying risk we won't sell.

**Would-be-a-yes.** *"Decatur estate-planning firm, 3 attorneys + 2 paralegals. Partner writes every client status email herself after hours; intake conflict checks are a paralegal spreadsheet. Gmail + Clio (Clio unclaimed — maturity signal only), DocuSign for engagement letters. Met through a closing-attorney referral from the RE lane."*

**List source.** State Bar of Georgia member directory (practice-area filterable) + LinkedIn Sales Nav (better for small-firm org shape than Apollo in legal), Apollo for email enrichment.

---

## Prospect-list spec (one sheet, all lanes)

One row per prospect in the CRM of record (document 03), minimum columns:

| Column | Note |
|---|---|
| Business / owner name / role | Broker-owner, managing partner, owner |
| Vertical + lane status | RE active; PM/general secondary; CPA/law closed |
| Size (agents/doors/seats) | From roster or site, not guessed |
| Location | GA-first flag |
| Stack signals | Email provider, QBO?, DocuSign?, CRM/PMS (signal only) |
| Source community | Association, NARPM, GSCPA, bar, referral |
| **Warm path** | Named referrer or "cold" — the highest-value column |
| Stage + next action + date | Per document 06 |

Data-source summary: **rosters + directories first (free, complete for these populations), Apollo (~$50–100/seat/mo) to enrich, LinkedIn Sales Nav only for law.** ZoomInfo is not justified at this scale (document 03). Common Room is a Month-3+ consideration if community-signal tracking earns its keep.
