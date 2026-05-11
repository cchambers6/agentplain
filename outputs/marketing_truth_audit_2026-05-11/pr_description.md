# PR description — `feat/marketing-truth-pass`

**Compare URL (opens GitHub's new-PR form):**
https://github.com/cchambers6/agentplain/compare/main...feat/marketing-truth-pass

**Suggested PR title:**
`feat(marketing): truth-pass — strip vaporware, replace killed pilot pricing`

---

## Summary

Marketing site audit against the locked memory rules. 47 customer-facing claims reviewed, 13 removed, 22 revised, 5 deferred under a "Coming Q3 2026" budget (CRM + inbox + MLS integrations and agent runtime — none shipped today, all on the integration roadmap), 7 kept.

The full audit table with per-claim disposition + memory citation lives at `outputs/marketing_truth_audit_2026-05-11/audit.md`.

## The five worst-offending claims (before → after)

### 1. Pilot pricing $1,500 / $2,750 / $4,500
- **Before:** `Starter — $1,500 — 30-day pilot` (home + entire `/pilot` page)
- **After:** Three per-seat tiers — `Regular $199 → $99`, `Plus $299 → $199`, `Max $499 → $299`, per-seat ladder sliding by seat count, **first month free**, month-to-month.
- **Memory:** `project_stripe_both_surfaces.md` line 62-65 — pilot SKUs (`flatsbo-pilot-tier-1`, `-2`, `-3`) explicitly marked DEPRECATED.

### 2. "A pre-trained AI agent fleet for SMB brokerages"
- **Before:** Root metadata + home + footer copy locked the audience to brokerages only.
- **After:** "professional-services firms — realty first" with the ten verticals (mortgage, insurance, property mgmt, title & escrow, recruiting, home services, CPA/tax, law, RIA) named in the fleet footnote.
- **Memory:** `project_vertical_tier_mapping.md` — 10 verticals across Regular/Plus/Max; medical parked.

### 3. Buyer Inquiry Router: "Reads inbound inquiries from email, web forms, and CRM webhooks"
- **Before:** Implied live inbox + web-form + CRM-webhook integrations.
- **After:** "Classifies inbound buyer inquiries by intent and attaches context for the right human in your office. Routes by your rules, not by a free-text prompt. **Inbox + CRM connectors — coming Q3 2026.**"
- **Memory:** `feedback_integration_acceptance_is_functional.md` — integration claim requires the value-loop demo. Repo has no `lib/crm/` or `lib/email/`.

### 4. Showing Scheduler: "Confirms, reschedules, and logs activity back to the CRM"
- **Before:** Implied agentplain executes outbound coordination and writes to CRM.
- **After:** "Drafts showing-coordination messages... your existing scheduling tool sends and confirms."
- **Memory:** `project_no_outbound_architecture.md` — agentplain advises/drafts; customer system executes. No Twilio/SendGrid/dialers in our surface.

### 5. "Read-only access to your CRM, your shared inbox, and an export of recent listings" (FAQ Q4)
- **Before:** Claimed live read-only OAuth integrations across CRM + inbox.
- **After:** "Today, an export of your recent listings, contacts, and inbox folders — uploaded by your team. Coming Q3 2026: OAuth into your CRM and Gmail / Outlook for read-only access."
- **Memory:** `feedback_integration_acceptance_is_functional.md` + `project_integration_roadmap.md` — Gmail/Outlook/CRM OAuth are P1 priority but plumbing is still in flight (PR-A foundation in `feat/p0-10-p0-12-integration-foundation`).

## Totals

- **Removed:** 13 claims — including the entire `/pilot` page (308 redirects to `/#pricing` in `next.config.mjs`), 3 pilot pricing tier cards, header/footer/CTA references to `/pilot`, and FAQ Q4 vapor.
- **Revised:** 22 claims — REPLACE/INTEGRATE/AUGMENT honest framing applied; brokerage-only audience widened to professional-services firms; agent descriptions reworded so none imply outbound execution or live integrations that don't exist in `lib/`.
- **Deferred (Coming Q3 2026):** 5 claims — Pillar 02 (CRM + inbox integrations), Listing Coordinator runtime, Buyer Inquiry Router connectors, CRM Hygiene integration, Production Reporter direct data pull. **Budget at 5/5 used.**
- **Kept:** 7 claims — locked tagline, "not a brokerage / CRM / chatbot / 50-feature platform" framing, broker-of-record liability framing, the Recruiter Assistant description (already aligned with the no-outbound architecture rule).

## Footer attribution (per `feedback_persistence_discipline.md`)

Added a `site reflects current product capabilities; updated 2026-05-11` line to the footer so future audits can date the truth baseline.

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓ (no warnings or errors)
- `npm run build` ✓ (9 static + dynamic routes; `/pilot` is gone, redirect lives in `next.config.mjs`)
- `npm test` ✓ (42 tests pass)

Vercel preview URL will appear on this PR once it's opened.

## Coordination concern surfaced to orchestrator

Sibling branch `feat/agentplain-marketing-redo-positioning` (3 commits ahead of main, not merged) is doing a wider marketing rewrite (ROI calculator, seat-tier table, stack comparison, several new pages: `/pricing`, `/capabilities`, `/verticals`, `/platform`, `/brokerages`, `/for-agents`, `/trust`). It overlaps directly with this audit's scope but goes further.

**Recommended merge order:** this truth-pass first → redo branch rebases on top and inherits the honest baseline. Otherwise the redo branch risks reintroducing claims this PR just removed.

## Open questions for Conner (not blockers)

1. **Pricing page UI** — this PR ships the three Regular/Plus/Max per-seat tier cards on the home page. A standalone `/pricing` route with ROI calculator + tier matrix (per `project_pricing_value_anchor.md`) is its own PR — the redo branch appears to be building exactly that.
2. **"Coming Q3 2026" specificity** — `project_integration_roadmap.md` Phase 1 (next 60 days) covers Gmail + Outlook + Follow Up Boss + Zillow + RESO. Q3 leaves slack for slippage; tightening to a specific month is your call once PR-C lands.
3. **`/pilot` redirect target** — currently sends to `/#pricing`. Easy to change to `/` or `mailto:hello@agentplain.com` if you'd rather not anchor on the home-page pricing block.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
