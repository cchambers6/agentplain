# Wave-10 phase-2 — vertical-specific skill runtime audit (2026-05-31)

**Purpose.** Wave 9 closed signup → first-fire under 15 min, but the
wizard's picker filter (`lib/onboarding/picked-skills.ts`) only surfaces
skills flagged `runtime: 'live'` in `lib/skills/registry.ts`. The wave-9
audit (`docs/self-serve-onboarding-audit-2026-05-31.md` §"Honesty filter
on the picked skills list") noted that every vertical-specific skill
except `lead-triage-realestate` lacks `runtime: 'live'` — so a real-
estate or CPA or law customer who finishes the wizard sees only the four
cross-vertical pulses, not the vertical-specific skill the marketing
page promised them.

**Question.** For each of the 10 vertical-specific skills, can it
produce a REAL draft / categorization / flag on first fire today, given
just a connected Gmail or Outlook MCP and no human prompt?

**Honesty bar (from `feedback_offer_tightening_2026_05_28`).** A skill
is AUTONOMOUS only when ALL of the following hold:

1. A production caller exists — an Inngest function, a vertical-router
   entry on the inbound webhook chain, or a similar trigger — that
   invokes the skill on real workspace data without operator action.
2. The skill's required MCP dependencies are `status: 'built'` in the
   registry (the data sources are connected, not stubbed).
3. The skill body handles "no data found" gracefully (writes a
   skipped-with-reason SkillRun, never a fake draft).

Anything short of that is REACTIVE (waits on a customer event),
STAGED (body exists, runner doesn't), or THEATRICAL (the registry
copy promises something the code doesn't deliver).

## Findings — per skill

| Skill | Registry line | Required MCPs | Production caller? | First-fire output today | **Grade** |
|---|---|---|---|---|---|
| `invoice-chasing-realestate` | L625 (no `runtime:`) | quickbooks (built), gmail (built), follow-up-boss (stubbed-json) | **None.** No `run-for-workspace.ts`. No Inngest fn. Not in `vertical-router.ts`. | Skill body works if invoked; QB fetcher returns NOT_CONFIGURED if QB not wired. But nothing calls it. | **STAGED** |
| `month-end-close-cpa` | L711 (no `runtime:`) | quickbooks (built), gmail (built) | **None.** No `run-for-workspace.ts`. No Inngest fn. | Same as above — body works, no runner exists. | **STAGED** |
| `law-intake-conflict-screen` | L750 (no `runtime:`) | clio (stubbed-json), gmail (built) | **None.** No `run-for-workspace.ts`. No Inngest fn. | Reactive by design — fires on a prospective-client intake event. Clio MCP not built. | **REACTIVE + STAGED** |
| `ria-client-update-draft` | L785 (no `runtime:`) | orion (stubbed-json), redtail (stubbed-json), gmail (built) | **None.** | Needs a portfolio snapshot from Orion/Black Diamond/Tamarac — no MCP built. | **STAGED** |
| `insurance-coi-request` | L828 (no `runtime:`) | ezlynx (stubbed-json), gmail (built) | **None.** | Reactive — fires on an inbound COI-request email. AMS MCP not built. | **REACTIVE + STAGED** |
| `mortgage-document-chase` | L864 (no `runtime:`) | encompass (stubbed-json), gmail (built) | **None.** | Needs LOS-of-record data. No MCP built. | **STAGED** |
| `home-services-estimate-followup` | L899 (no `runtime:`) | acculynx (stubbed-json), gmail (built) | **None.** | Needs estimate-on-file data from trades CRM. No MCP built. | **STAGED** |
| `recruiting-candidate-status-update` | L933 (no `runtime:`) | greenhouse (stubbed-json), gmail (built) | **None.** | Needs ATS pipeline data. No MCP built. | **STAGED** |
| `property-management-rent-collection-chase` | L969 (no `runtime:`) | appfolio (stubbed-json), gmail (built) | **None.** | Needs rent-roll data from PM platform. No MCP built. | **STAGED** |
| `title-escrow-closing-doc-chase` | L1005 (no `runtime:`) | softpro (stubbed-json), gmail (built) | **None.** | Needs closing-file data from title platform. No MCP built. | **STAGED** |

**File evidence the audit relied on:**
- `lib/skills/<slug>/` — every slug has `skill.ts`, `index.ts`, `types.ts`, and an MCP-shaped or json-only fetcher. NONE has `run-for-workspace.ts`.
- `lib/inngest/functions/` — every cron sweep listed (`scheduler-sweep`, `briefings-generator-sweep`, `analytics-weekly-pulse-sweep`, `content-calendar-drafter-sweep`, `compliance-watch-sweep`, `finance-pulse-sweep`, `follow-up-chaser-sweep`, `process-doc-drafter-sweep`, `follow-up-boss-sync-sweep`, `notion-ingest-sweep`, `hubspot-sync-sweep`, `salesforce-sync-sweep`). **Zero of these dispatch any of the 10 vertical-specific skills.**
- `lib/skills/vertical-router.ts` — wires `lead-triage-realestate` only (already `runtime: 'live'` per L708; excluded from the wizard picker via `NEVER_IN_PICKER` in `lib/onboarding/picked-skills.ts:60-63` because it needs an inbound CRM webhook to fire).

## Decision

**Flip ZERO vertical-specific skills to `runtime: 'live'` in this wave.**

Promoting any of them today would lie to the wizard — the customer
would tick "Plaino will chase your unpaid commission invoices" in the
picker, watch the polling panel for 5 minutes, and see nothing land.
Per `feedback_no_quick_fixes.md`: a half-built integration that returns
empty on first fire is a worse customer experience than not offering it
at all.

**The `picked-skills.ts` filter stays as-is.** It already encodes the
right behavior: only `runtime: 'live'` skills surface, minus the
NEVER_IN_PICKER set, with inbox-gated visibility.

**Wave-10 still delivers real first-session value** via:
- Phase 1 — backfill that rewinds in-flight wave-8 customers to
  `pick_skills` so they see the cross-vertical pulses they previously
  skipped (`scripts/migrations/2026-05-31_backfill_onboarding_pick_skills.ts`).
- Phase 3a — inbox seeding on MCP connect, so the cross-vertical skills
  that DO fire on inbox data (`inbox-triage-general`, `office-admin`,
  `follow-up-chaser-general`, `chief-of-staff-scheduler`,
  `process-doc-drafter-general`) have real threads to read.
- Phase 3b — inline draft display in the watch panel so the customer
  SEES the actual draft body inside the wizard, not a status pill.

## Capability-builder follow-up

For `capability-builder` to pick up next — the per-skill work needed to
flip each vertical skill to AUTONOMOUS:

**Tier 1 — MCP is built, only the runner is missing (lift: small).**
- `invoice-chasing-realestate` — write `run-for-workspace.ts` that
  pulls open invoices from QuickBooks, ranks by days-outstanding, runs
  the skill, persists drafts via the existing `DraftPersister` port.
  Wire to a new `invoice-chasing-realestate-sweep` Inngest cron (weekly
  is enough — AR aging doesn't shift daily). After the runner lands,
  flip `runtime: 'live'` and add to `picked-skills.ts:NO_INTEGRATION_REQUIRED`
  IF the workspace has the realty vertical AND QuickBooks connected.
- `month-end-close-cpa` — same pattern, monthly cadence anchored to
  the engagement's close-of-month.

**Tier 2 — MCP is stubbed-json (lift: large; needs the MCP built first).**
- `law-intake-conflict-screen` — needs Clio / MyCase / PracticePanther
  MCP. After the MCP lands, this is REACTIVE-by-design (fires on the
  intake submission, not first connect). Don't add to the wizard.
- `ria-client-update-draft` — needs Orion / Black Diamond / Tamarac
  MCP. Quarterly cadence.
- `insurance-coi-request` — needs EZLynx / HawkSoft / Applied Epic
  MCP. REACTIVE.
- `mortgage-document-chase` — needs Encompass / LendingPad / Calyx MCP.
- `home-services-estimate-followup` — needs AccuLynx / JobNimbus /
  ServiceTitan / Housecall Pro / Jobber MCP.
- `recruiting-candidate-status-update` — needs Greenhouse / Lever /
  Workable / Bullhorn MCP.
- `property-management-rent-collection-chase` — needs AppFolio /
  Buildium / Propertyware / Yardi Breeze MCP.
- `title-escrow-closing-doc-chase` — needs SoftPro / Qualia / RamQuest
  MCP.

## What this audit did NOT change

- No edits to `lib/skills/registry.ts` (no `runtime:` flags flipped).
- No edits to `lib/onboarding/picked-skills.ts` (filter unchanged).
- No new skill bodies. No new runners. No new Inngest functions.

The audit is the deliverable for this phase. Phase 3 (inbox seeding +
inline draft display) is where wave-10's customer-visible value lands.
