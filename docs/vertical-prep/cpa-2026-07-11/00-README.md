# CPA vertical parallel-prep — how this folder activates

**What this is:** the complete activation kit for CPA as the second GTM vertical, prepared 2026-07-11 while the lane is **closed**. It mirrors, artifact for artifact, what the Georgia-RE beachhead shipped between 07-02 and 07-08: ICP, named prospects, first-touch emails, discovery playbook, comparison-page spec, pilot week-1 runbook, case-study arc, legal notes, and a one-page activation checklist.

**What this is NOT:** a launch document. The ratified kill list (`docs/kills/2026-07-03/RATIFIED.md`, KILL #2) closes all GTM motion outside Georgia RE until 2 RE design partners are live. Nothing in this folder is sent, published, or built until that trigger fires. The one CPA exception the kill list grants — the S-effort TaxDome/Karbon connector truth fix — **has already shipped**: both tiles read `coming-soon` with honest copy in `lib/integrations/marketplace.ts`, pinned by the wave-3 guardrail test. No further exception work is pending.

## The trigger

**2 Georgia RE design partners live** — onboarded, killer workflow firing weekly, at least one real saved-time figure in each workspace. Trial enrollments do not count (kill-list definition, verbatim).

The day after RE partner #2 signs, Conner runs `09-cpa-activation-checklist.md` — one page, ~2 hours of work spread over a week — and the following Monday's send block is CPA. Target: 48 hours from trigger to send-ready, not 2 weeks.

## One timing gate the RE lane didn't have

CPA outreach is seasonal (ICP rule, `docs/sales/deep-dive-2026-07-02/01-named-icp-per-vertical.md`): **no first touches between January 15 and April 15**, and treat mid-September through October 15 as a soft hold (extension deadline crunch). If the RE trigger fires inside a hold window, the checklist runs anyway — prospect re-verification, compare pages, counsel notice — and the sends queue for the first Monday outside the window. Prep never waits; sends do.

## Contents, in run order

| File | What it is | Freshness rule |
|---|---|---|
| `01-cpa-icp-definition.md` | Who we sell to, 3 disqualifiers, would-be-a-yes | Stable |
| `02-5-named-cpa-prospects.md` | 5 named Georgia firms, public research, cited | **Re-verify every fact ≤3 days before send** |
| `03-cpa-first-touch-emails.md` | 5 send-ready drafts, Conner's voice | Re-check hooks with 02 |
| `04-cpa-discovery-playbook-adapted.md` | 20-min script, 3 CPA questions, demo pick, 5 CPA objections | Stable |
| `05-cpa-comparison-pages-spec.md` | Spec for `/compare/taxdome` + `/compare/karbon` (not built) | Vendor facts re-verified at build time |
| `06-cpa-pilot-week-1-runbook-adapted.md` | Day 0–5 for CPA partner #1 | Stable |
| `07-cpa-case-study-arc-pre-fill.md` | PLACEHOLDER expected arc + CPA outcome methodology | Never publishable as-is |
| `08-cpa-legal-compliance-notes.md` | §7216 / Circular 230 / GLBA-WISP / AICPA / Georgia | **Counsel-gated before customer-facing use** |
| `09-cpa-activation-checklist.md` | The one page Conner runs the day after the trigger | The activation artifact |

## Standing rules this folder inherits (do not re-derive)

- **Truth Wave.** No fabricated firms, counts, relationships, or certifications. Every prospect fact cites a public URL. Placeholder arcs are labeled and never quoted externally.
- **Model vendor invisible.** No AI-provider name in any outreach, page copy, or call script. The subprocessor lists on /privacy and /security are the sole disclosure.
- **No-outbound architecture.** The fleet drafts; the firm approves and sends/files from its own systems. No sentence anywhere may imply auto-send or auto-file.
- **Persona rule (CPA-specific, from the ratified ICP):** no Plaino voice in CPA outreach. Sober, plain, signed by Conner.
- **Pricing canon.** CPA is recommended at the Partner tier ($299/seat sliding to $199). The design-partner offer is three months free + weekly founder call + co-authored case study — never "pilot pricing." 14-day trial (CPA/Law extended trial, `lib/billing/facts.ts`) applies to non-design-partner signups only.
- **Data positioning.** Two buckets: raw tool data stays in the firm's tools; the service's memory of the firm persists for the life of the account and is theirs. "Nothing is stored" and "it forgets" are banned framings.
