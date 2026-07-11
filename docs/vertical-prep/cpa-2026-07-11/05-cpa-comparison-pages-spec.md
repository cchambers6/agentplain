# 05 — Comparison pages spec: `/compare/taxdome` and `/compare/karbon`

**Status: SPEC ONLY — not built.** Building these is an activation-day item (doc 09), because publishing new vertical marketing surface before the trigger violates KILL #2. The spec exists so the build is a half-day PR, not a research project.

## How the build works (mechanics, so activation day is mechanical)

The vendor pages are registry entries, not bespoke pages: add two `Comparison` objects to `lib/marketing/comparisons.ts` (the FUB/Sierra/BoldTrail pattern from PR #378) and the `/compare/[alt]` route, hub card, OG image, breadcrumb + FAQPage JSON-LD all light up from the registry. Checklist for the PR:

1. Two registry entries per the content spec below, `bookingCta: true` on both.
2. A claims ledger appended to a new `docs/marketing/compare-pages-cpa/RESEARCH-NOTES.md` — **every vendor fact re-verified against the vendor's live public pages at build time**; the sketches below are directional, not verified claims. Dollar figures live in the notes file only; pages state pricing *shape*.
3. Tests: extend the compare-page coverage the same way #378 did (the money-figure allowlist pattern). New rule this vertical adds: the pages must contain **no dollar penalty figure** unless the ledger sources it — the CPA analog of the RE $26,262 line is the IRC §6694 preparer-penalty range ($1,000 / $5,000 per return), which may be used **only after doc 08 clears counsel review** for customer-facing use.
4. Voice-gate + brand-gate pass (the pages are customer-facing marketing surface).

## Load-bearing honesty rules specific to these two pages

- **We are speccing comparison pages against vendors we advertise as coming-soon integrations.** This is a stranger shape than FUB (roadmap CRM, no tile). The page must carry both truths without tension: TaxDome/Karbon are *good at what they do and we intend to connect to them*; today the tiles read coming-soon (`lib/integrations/marketplace.ts`, pinned by the wave-3 guardrail test) and the integration FAQ answers "Not directly today — the connect step opens soon." Never present-tense an integration claim.
- **Do not reuse the RE compliance sentence.** "Drafts are checked against the fair-housing corpus" is live-for-RE-only (RESEARCH-NOTES cross-page rule). The CPA compliance sentinel activates after counsel review; until then the pages claim the human gate only: *a person at your firm approves everything before it goes out.*
- **DIY-vs-run-for-you frame, never product-vs-product warfare.** Both vendors are kept, not replaced — same as "keep Follow Up Boss." Shared-pain intro is a described week, not statistics.
- Vendor invisible; no named customers; no saved-time statistics; pricing = our published seat ladder shape.

---

## `/compare/taxdome` — content spec

- **navLabel:** TaxDome · **alternative:** "TaxDome" · **heroHeadline:** "TaxDome vs run for you"
- **cardSummary sketch:** "The client-portal-and-practice-management hub vs. a service that drafts the work around it. Firms that fit us usually keep both."
- **directAnswer sketch:** TaxDome is practice management for accounting firms — client portal, organizers, e-signature, pipelines, and automated reminders in one hub. It does not write the specific message your client actually needs. agentplain is a run-for-you service: the fleet reads the inbox, the calendar, and the books, drafts the chases and replies with the real context in them, and a person at your firm approves each one. If your client files are chaos, buy the hub first. If the writing is what eats your evenings, that's the work we run.
- **sharedPain sketch:** the season week — organizers out, a third of clients stalled, the partner writing individual "still missing your K-1" emails at 9pm, status questions arriving faster than they're answered.
- **whereAlternativeWins (verify each at build time):** the client hub of record (portal, organizers, e-sign, requests in one login); automated reminder sequences at volume once configured; client-facing mobile app; all-in-one pricing for what it bundles.
- **cantDo gaps:** *Write the specific chase.* (Its reminders fire the template you pre-wrote; the fleet drafts the message citing what that client actually owes, from the actual thread.) · *Run itself.* (Pipelines, automations, and templates are built and maintained by someone at the firm.) · *Hold every send for a human.* (Automation sends what was pre-written on a schedule; our architecture is the reverse — drafts wait for approval, nothing sends itself.) · *See past its own walls.* (The books live in QuickBooks, the engagement letter in DocuSign, the thread in Outlook — the fleet reads across the desk.)
- **Integration FAQ (mandatory, exact posture):** "Does agentplain integrate with TaxDome?" → "Not directly today. The TaxDome tile in the product says coming soon, and that's the truth — the connect step hasn't opened yet. The fleet works from your email, calendar, QuickBooks Online, and document folders now, and design partners get first say on connector sequencing."
- **rows:** same five dimensions as the FUB page (setup time / ongoing labor / personalization / cost predictability / when you need help), CPA-flavored.
- **chooseAlternativeIf:** your problem is client-file organization and intake — a hub of record with organizers and e-sign, owned by someone on staff who will build the pipelines.
- **chooseAgentplainIf:** the hub is fine (or coming) and the bottleneck is the writing: the per-client chase, the status reply, the month-end follow-up.

## `/compare/karbon` — content spec

- **navLabel:** Karbon · **heroHeadline:** "Karbon vs run for you"
- **cardSummary sketch:** "The team-workflow platform for accounting firms vs. a service that drafts the client work inside those workflows."
- **directAnswer sketch:** Karbon is practice management built around team collaboration — shared inboxes, work items, checklists, and visibility across the firm. It organizes who does the work; someone still writes it. agentplain drafts the client-facing work itself — the chase, the reply, the follow-up — from the live context, and your staff approves each one before it goes anywhere.
- **whereAlternativeWins (verify at build time):** team email triage and shared visibility (their signature strength); work-item and recurring-task management across staff; firm-wide accountability reporting; template automation across engagement types.
- **cantDo gaps:** *Write the message.* (A triaged email still needs a human author; the fleet arrives with the draft.) · *Run itself.* (Work templates and automations are staff-built and staff-maintained.) · *Hold every send for a human by architecture.* · *See the books.* (The chase email's context — the unreconciled account, the unpaid invoice — lives in QuickBooks; the fleet reads it there.)
- **Integration FAQ:** same exact posture as TaxDome — "Not directly today; the tile says coming soon because it is."
- **rows / choose-if pair:** parallel structure to the TaxDome page; chooseAlternativeIf centers on multi-staff workflow visibility, chooseAgentplainIf on the drafting bottleneck.

## Shared FAQ items (both pages)

1. "Do I have to replace {vendor} to use agentplain?" → No — keep it; we work the seams it doesn't: the inbox, the books, the drafting.
2. "Does the fleet send anything on its own?" → the registry's `NO_OUTBOUND_ANSWER` constant, extended one clause for this vertical: *…and it never files anything, either.*
3. "What about client confidentiality and return information?" → the two-bucket answer + pointer to /privacy and /security. Wording passes through doc 08's counsel gate first.
