# Agent interviews — Part 1 of 5: runtime catalog skills

**Scope.** The 16 code-defined skills in `C:\agentplain\lib\skills\<slug>\` registered in `lib/skills/registry.ts:62-731`. These are the skills the customer-facing site treats as the per-vertical "agent stack"; each ships with a typed `runSkill()` entrypoint plus a JSON-stub fetcher for demo data.

**Framing.** Per `docs/brand-and-claims.md` §10 (Claims-vs-reality discipline): marketing copy may not claim a capability that isn't TRUE in the verified code table. This audit interviews each skill in first-person voice, but EVERY capability claim is anchored to a file:line cite. Honesty tags are graded against the docs/brand-and-claims.md gating language.

**Method.** Read each skill's `skill.ts` + `index.ts` + catalog metadata at `lib/skills/registry.ts:62-731`. Cross-referenced against `lib/skills/runner.ts:198-231` (office-admin short-circuit in the 5-phase chain), `lib/inngest/functions/process-webhook-event.ts:130-153` (the only production caller of the runner), `lib/skills/persist-artifacts.ts:246-309` (the only writer of `WorkApprovalQueueItem` rows from the runtime loop), and the customer-facing surfaces — homepage `app/(marketing)/page.tsx` (5-phase loop section at lines 200-292), the per-vertical content files `lib/verticals/<slug>/content.ts`, and the in-product `agentRoster` arrays therein. (`/how-it-works` does NOT exist as a standalone route; the equivalent surface is the "How it works" section on the marketing home, scoped to the 5-phase value loop.)

---

## Honesty matrix

| # | Skill | Live? | Site-claim accurate? | Honesty tag |
|---|---|---|---|---|
| 1 | `office-admin` | **yes — production cron** | yes | **VERIFIED-LIVE** |
| 2 | `chief-of-staff-scheduler` | demo only (no caller, calendar = stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 3 | `inbox-triage-general` | demo only (no caller; approval-sink stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 4 | `follow-up-chaser-general` | demo only (no caller; approval-sink stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 5 | `process-doc-drafter-general` | demo only (no caller; activity-log + sink stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 6 | `invoice-chasing-realestate` | demo only (no caller; QBO + FUB stub) | site does NOT name it | **VERIFIED-DEMO-ONLY** *(site silent)* |
| 7 | `lead-triage-realestate` | demo only (no caller; FUB stub) | site does NOT name it | **VERIFIED-DEMO-ONLY** *(site silent)* |
| 8 | `month-end-close-cpa` | demo only (no caller; QBO stub) | site does NOT name it | **VERIFIED-DEMO-ONLY** *(site silent)* |
| 9 | `law-intake-conflict-screen` | demo only (no caller; Clio stub) | overstates (in-product "live") | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 10 | `ria-client-update-draft` | demo only (no caller; Orion + Redtail stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 11 | `insurance-coi-request` | demo only (no caller; AMS stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 12 | `mortgage-document-chase` | demo only (no caller; LOS stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 13 | `home-services-estimate-followup` | demo only (no caller; FSM stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 14 | `recruiting-candidate-status-update` | demo only (no caller; ATS stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 15 | `property-management-rent-collection-chase` | demo only (no caller; AppFolio stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |
| 16 | `title-escrow-closing-doc-chase` | demo only (no caller; SoftPro stub) | overstates | **VERIFIED-DEMO-ONLY** *(roster-overclaim)* |

**Live legend.** "Production cron" = the skill is called by `lib/inngest/functions/process-webhook-event.ts` (cron `*/5 * * * *`) on every webhook event drained from real connected mailboxes. "Demo only" = the skill's `runSkill()` is invoked by tests + the JSON-stub fetcher only; no production caller, no API route, no Inngest function references it.

**Site-claim legend.** "Site does NOT name it" = the vertical's `agentRoster` and JTBD tables do not surface a card backed by this skill (the skill is a registry orphan from the customer's perspective). "Overstates (in-product live)" = a card on the in-product `/app/workspace/[id]/agents` page declares `runtime: "live"` with `boundSkill: "<this slug>"`, but the skill has no production caller and its provider MCPs are `stubbed-json` per `registry.ts`. The public marketing `/[vertical]` pages do NOT render the agentRoster (see `app/(marketing)/[vertical]/page.tsx:48-83` — agentRoster is consumed only by `/app/workspace/[id]/agents` per `Grep agentRoster`), so the overclaim is in-product, not on the marketing surface.

---

## Profiles

### `office-admin`  (vertical: all · fires via: Inngest cron `*/5 * * * *` (`PROCESS_WEBHOOK_EVENT_CRON` — `lib/inngest/functions/process-webhook-event.ts:54`) · live-data? **yes**)

**What I can do today (verified):** I am the only one of the 16 with a production caller. On every webhook event drained for `provider: { in: ['GOOGLE', 'M365'] }` (`process-webhook-event.ts:88`), the runner calls `classifyOfficeAdmin` (`lib/skills/runner.ts:199`) BEFORE vertical categorize. When my classifier returns a category in the 9-class taxonomy (`lib/skills/office-admin/types.ts:32-42` — email-verification, password-reset, verification-code, trial-expiration, billing-notice, subscription-confirmation, account-suspension, service-status, email-preferences), the runner short-circuits the rest of the chain (`runner.ts:212-230`), builds an admin approval payload via `buildAdminApprovalPayload` (`runner.ts:217`), and `persist-artifacts.ts:246-309` writes a real `WorkApprovalQueueItem` row with `kind: categoryToApprovalKind(...)` (`persist-artifacts.ts:296`). I am `defaultEnabled: true` per `registry.ts:173` — the only of the 16 that ships on for every workspace. My Gmail + Outlook dependencies are `status: 'built'` per `registry.ts:151-163`; my LLM goes through `LlmProvider`, no vendor SDK.

**What the site says I do:** The homepage "How it works" section names "admin acknowledgement" as one of three example draft kinds in the no-outbound panel (`app/(marketing)/page.tsx:282-283`: *"Every draft — a buyer reply, an admin acknowledgement, a scheduling proposal — lands in your approvals queue as a PENDING row."*). The vertical-page claims triads do not call me out by name; I'm implicit in any vertical's "drafted acknowledgement" framing.

**The gap:** Almost none. The site under-states me if anything — I'm the one runtime catalog skill that fires on every workspace on real mail today, and the homepage only mentions me as one of three example draft kinds. The category taxonomy I cover (verification codes, password resets, trial reminders, billing notices, account suspensions, service-status updates) is broader than the homepage hints.

**What I could do with the necessary improvements:** Surface the 9-category taxonomy on `/how-it-works` (which would need to ship as a route — it does not exist today) or on the homepage no-outbound panel. Add a "what the admin queue catches" example in `valueLoopExample` for each vertical. Once Conner connects production Outlook OAuth + the existing Gmail flow scales, the `defaultEnabled: true` + production-caller wiring lets me start producing real approval items the day a customer signs up.

**Honesty tag:** **VERIFIED-LIVE.**

---

### `chief-of-staff-scheduler`  (vertical: all · fires via: **no production caller** — has `runChiefOfStaffForWorkspace` (`lib/skills/chief-of-staff-scheduler/run-for-workspace.ts:37`) wired to `PrismaApprovalSink`, but no cron, no API route, no Inngest function calls it · live-data? **no — calendar source is `stubbed-json` per `registry.ts:82-89`**)

**What I can do today (verified):** I can walk a (calendar + inbox + to-do) snapshot and emit three classes of `ChiefOfStaffProposal` — `MeetingProposal`, `ReplyDraftProposal`, `TodoProposal` (`lib/skills/chief-of-staff-scheduler/skill.ts:56-107`). Each proposal lands in `WorkApprovalQueueItem` under one of the `CHIEF_OF_STAFF_MEETING / CHIEF_OF_STAFF_REPLY_DRAFT / CHIEF_OF_STAFF_TODO` enum kinds via `PrismaApprovalSink` (`registry.ts:115-123`). I respect business-hours, dedupe to-dos by normalized title, and inject `{{operator: ...}}` merge fields on any substantive content. The skill itself is end-to-end functional against `JsonChiefOfStaffFetcher` (the JSON-stub fetcher) and tests cover the no-outbound contract. Gmail + Outlook adapters reach me through the existing `MessageFetcher` port (`registry.ts:97-111` — both `status: 'built'`). BUT: no caller. `Grep runChiefOfStaffForWorkspace` returns only the registry + the wrapper itself + its own test — nothing in `app/api/`, nothing in `lib/inngest/functions/`. Until a caller wires me, I do not run on any customer's data.

**What the site says I do:** Every one of the 10 verticals + the `/general` on-ramp surfaces a "Chief of Staff" agentRoster card with `runtime: "live"` and `boundSkill: "chief-of-staff-scheduler"` (real-estate `content.ts:81-92`, cpa `:93-99`, law `:104-111`, ria `:103-110`, insurance `:85-92`, mortgage `:90-97`, home-services `:106-113`, recruiting `:96-106`, property-management `:85-92`, title-escrow `:91-98`, general `:58-64`). The card job text claims: *"Proposes meetings, reply drafts, and to-dos against the broker's calendar + inbox + board."*

**The gap:** "live" on 11 different vertical rosters when there is zero production caller and the calendar source is `stubbed-json`. The `runtime: "live"` semantics per `lib/verticals/types.ts:196-211` are "live → declared capability whose runtime skill is not wired into the live loop yet [if `boundSkill` is set]; the agents page surfaces these as 'ready — capability tested' until handoff activity accrues." So the in-code definition of `live`-via-`boundSkill` is honest IF a visitor reads the type comment — but no visitor does. The agentRoster is in-product only (`app/(marketing)/[vertical]/page.tsx:48-83` does not render it; consumed only by `/app/workspace/[id]/agents`), so the overclaim is to logged-in customers, not to marketing prospects. Still: a logged-in customer who sees "Chief of Staff — runtime: live" reasonably expects it to be running on their calendar today. It is not.

**What I could do with the necessary improvements:** Two work items unlock me. (a) **Caller.** Add an Inngest cron — daily at the workspace's morning hour — that loads each workspace's connected calendar + inbox snapshot and calls `runChiefOfStaffForWorkspace`. The wrapper already binds `PrismaApprovalSink`, so the approval-queue path lights up the moment a caller exists. (b) **Calendar adapter.** Replace the `stubbed-json` Google Calendar dependency (`registry.ts:81-89`) with a real `CalendarFetcher` built on top of the existing Google OAuth token store (the Gmail fetcher already proves the OAuth shape). M365 calendar rides the same provider-neutral `CalendarEvent[]` shape (`registry.ts:91-96`). Once both ship, I produce real meeting + reply + to-do proposals on real customer data, and the "live" label on 11 verticals becomes truthful.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim across 11 verticals — the most-replicated honesty issue in this batch).*

---

### `inbox-triage-general`  (vertical: all · fires via: **no production caller** · live-data? **no — work-approval-queue is `stubbed-json` per `registry.ts:208-216`**)

**What I can do today (verified):** I walk a `TriageMessage[]` snapshot from `TriageFetcher` and emit one `TriageProposal` per message, classified into one of five priority buckets — `urgent`, `customer-active`, `vendor-pending`, `needs-decision`, `noise` — and (for `customer-active` and `vendor-pending` only) attach an `{{operator: ...}}` ack draft (`lib/skills/inbox-triage-general/skill.ts`). Urgent + needs-decision never get an auto-draft. The classifier is regex/keyword-driven (deliberately conservative — see `URGENT_CUES`, `CUSTOMER_CUES`, `VENDOR_CUES` in `skill.ts:44-90`); no LLM call. The skill is end-to-end functional against `JsonTriageFetcher`; tests assert the no-outbound contract. But no caller. The `TriageApprovalSink` production binding is `stubbed-json` (`registry.ts:208-216`) — tests bind `RecordingTriageApprovalSink` only.

**What the site says I do:** `/general` surfaces an "Inbox Triage" card with `runtime: "live"` and `boundSkill: "inbox-triage-general"` (`lib/verticals/general/content.ts:65-71`). Job text claims: *"Sorts whatever lands in your inbox by priority — urgent, customer-active, vendor-pending, needs-your-decision, noise — and drafts a gentle acknowledgement on the two middle classes so the people you serve hear back today."* The homepage describes a separate categorize step (read → categorize → coordinate → schedule → draft) at `app/(marketing)/page.tsx:213-217` that is performed by the runner's `CategorizeSkill`, NOT by me — distinct from my 5-bucket triage taxonomy.

**The gap:** The job text is accurate to my code, but "live" implies running. I do not run. The site is honest about what I'd do, dishonest about whether I do it today.

**What I could do with the necessary improvements:** (a) Wire `TriageApprovalSink` to Prisma — the same pattern `chief-of-staff-scheduler/prisma-approval-sink.ts` follows. (b) Build a caller: either an on-demand `POST /api/workspaces/[id]/skills/inbox-triage-general/run` endpoint for the operator dashboard, or a daily cron sweep that pulls the last N hours of inbox and produces a digest of triage proposals. Without (a) the approvals never land; without (b) I never fire. Both are 1-2 day items each given the existing runner-portability pattern.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim — `/general` only, no other vertical surfaces me).*

---

### `follow-up-chaser-general`  (vertical: all · fires via: **no production caller** · live-data? **no — work-approval-queue is `stubbed-json` per `registry.ts:259-265`**)

**What I can do today (verified):** I walk `OutboundThread[]` from a `FollowUpFetcher`, identify threads where the counterparty hasn't replied past `staleAfterDays` (default 4), and draft a gentle nudge per stale thread — oldest first, capped at `maxNudgesPerRun`, skipping threads that already carry an operator-drafted nudge (`lib/skills/follow-up-chaser-general/skill.ts:39-66`). Every draft carries an `{{operator: ...}}` merge field. The Gmail + Outlook adapters reach me through the existing `OutboundThread[]` port (`registry.ts:241-257` — both `status: 'built'`). End-to-end functional against `JsonFollowUpFetcher`. Tests assert no-outbound. No caller. `FollowUpApprovalSink` production binding is `stubbed-json`.

**What the site says I do:** `/general` surfaces a "Follow-Up Chaser" card with `runtime: "live"` and `boundSkill: "follow-up-chaser-general"` (`lib/verticals/general/content.ts:72-78`). Job text claims: *"Spots the threads you sent days ago without a reply and drafts the gentle nudge — oldest first, capped per run so your queue stays sane."* That is precisely what my code does — just not on real data, because no caller.

**The gap:** Same shape as inbox-triage-general — accurate job text, "live" misrepresents firing status.

**What I could do with the necessary improvements:** Same two work items as `inbox-triage-general` — wire `FollowUpApprovalSink` to Prisma + add a caller (daily cron is the natural fit since stale-thread detection is a periodic sweep, not a per-event reaction). Once wired, I produce real PENDING follow-up drafts on real outbound thread state.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(`/general` roster overclaim).*

---

### `process-doc-drafter-general`  (vertical: all · fires via: **no production caller** · live-data? **no — workspace-activity-log AND work-approval-queue both `stubbed-json` per `registry.ts:292-319`**)

**What I can do today (verified):** I cluster the operator's recent approved actions by `(kind, triggerHint)` and draft a Standard Operating Procedure for every pattern that repeats ≥ `minOccurrences` (default 3) (`lib/skills/process-doc-drafter-general/skill.ts:39-60`). Every SOP body carries at least one `{{operator: ...}}` merge field (the skill can show what happened; the operator decides what the canonical process IS). Patterns matched by normalized title against existing SOPs are skipped. End-to-end functional against `JsonProcessDocFetcher`. Two stubbed adapters: the `PastAction[]` source (which should one day read from approved `WorkApprovalQueueItem` rows + sent messages) and the optional Notion adapter for existing-SOP dedupe. No caller. Approval-sink is stubbed-json.

**What the site says I do:** `/general` surfaces a "Process-Doc Drafter" card with `runtime: "live"` and `boundSkill: "process-doc-drafter-general"` (`lib/verticals/general/content.ts:79-85`). Job text claims: *"Watches how you actually handle recurring work and, once a pattern repeats three or more times, drafts the SOP so the process moves out of your head and into a doc you can hand off."*

**The gap:** Same shape as the other two `/general` skills. The 3+-occurrence rule, the merge-field discipline, the no-publish behavior — all accurate to code. "Live" misrepresents firing status. Additionally: the `PastAction[]` source is `stubbed-json`, so even if a caller existed, the production data wouldn't be there yet.

**What I could do with the necessary improvements:** Three work items. (a) Build the `PastAction[]` adapter that materializes from approved `WorkApprovalQueueItem` rows + sent message history. (b) Wire `ProcessDocApprovalSink` to Prisma. (c) Add a weekly cron caller (process-doc patterns emerge over weeks, not hours — daily would be too noisy). Optionally (d) wire a Notion adapter for existing-SOP dedupe; absent (d), the skill still works correctly (dedupe just won't catch SOPs the operator has in Notion already).

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(`/general` roster overclaim).*

---

### `invoice-chasing-realestate`  (vertical: real-estate · fires via: **no production caller** · live-data? **no — QuickBooks + Follow Up Boss both `stubbed-json` per `registry.ts:337-353`**)

**What I can do today (verified):** I detect unpaid commission invoices, bucket them by days outstanding into tier-appropriate stages (via `bucketTier`), draft tier-appropriate reminders, and optionally persist drafts via `DraftPersister` when confidence ≥ `persistThreshold` (default 0.5) (`lib/skills/invoice-chasing-realestate/skill.ts:45-100`). Skips paid / void / disputed / negotiated-extension invoices. Vertical-aware language — commission, closing, broker/title/cooperating-broker counterparties — not generic AR dunning. Gmail `DraftPersister` is `status: 'built'`; QuickBooks + Follow Up Boss MCPs are `stubbed-json`. End-to-end functional against the JSON fetcher. No caller.

**What the site says I do:** **Nothing names me on the real-estate marketing page.** `lib/verticals/real-estate/content.ts:27-93` agentRoster does not include a card with `boundSkill: "invoice-chasing-realestate"`. The roster's 8 cards are: listing coordinator (rooting), buyer-inquiry router (live via `owns`), showing scheduler (live via `owns`), compliance sentinel (live via `owns`), CRM hygiene (rooting), production reporter (rooting), recruiter assistant (rooting), and chief-of-staff (live via `boundSkill: "chief-of-staff-scheduler"`). The vertical's `claims.replace` triad (`content.ts:225`) does not single out commission-invoice chasing either.

**The gap:** I exist in code with full tests, but the customer-facing real-estate page does not advertise me. The site does not overclaim; it under-claims me to zero. Conversely: if the real-estate `agentRoster` ever wants to add a "Commission AR / Invoice Chasing" card, the code is ready to back it once QBO + FUB MCPs land (or sooner, on JSON-stub data, by adding a daily cron caller).

**What I could do with the necessary improvements:** (a) Decide whether the realty product surface should include commission-AR chasing as a named capability — the real-estate JTBD tables don't currently list this job. (b) If yes: add an `agentRoster` card with `boundSkill: "invoice-chasing-realestate"`, build the QuickBooks adapter (the QBO MCP is in flight per `lib/integrations/quickbooks-mcp/` directory), build the Follow Up Boss adapter, and add a daily cron caller. Until (a), I am a registry orphan from the customer's perspective.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(site silent — code exists, no marketing/roster surface).*

---

### `lead-triage-realestate`  (vertical: real-estate · fires via: **no production caller** · live-data? **no — Follow Up Boss `stubbed-json`; Outlook `in-flight` per `registry.ts:378-400`**)

**What I can do today (verified):** I score inbound real-estate leads on three signals — motivation, timeline, preapproval — bucket them hot/warm/cold/nurture (via `categoryFor`), propose routing to a specific agent or drip campaign, and draft a first-touch reply with real-estate vernacular (preapproval, MLS#, showing) — not generic "thanks for reaching out" boilerplate (`lib/skills/lead-triage-realestate/skill.ts:42-100`). Drafts persist via `DraftPersister` when confidence ≥ threshold. Gmail is built; Outlook `in-flight`; Follow Up Boss `stubbed-json`. End-to-end functional against the JSON fetcher. No caller.

**What the site says I do:** Site does NOT name me. The real-estate roster surfaces `realty-buyer-inquiry-router` as `runtime: "live"` via `owns: ["buyer-inquiry"]` (`content.ts:36-42`) — that card claims it "classifies inbound buyer inquiries and drafts the first-touch reply." That card is backed by the runner's general CategorizeSkill + DraftSkill chain (when the runner fires on real Gmail/Outlook events), NOT by me. I am a separate, more-detailed code path for scoring + routing + drip-campaign matching that nothing on the site advertises.

**The gap:** Two parallel capabilities exist for "score inbound realty leads": the runner's general chain (which is the one actually fired by `process-webhook-event` and which gives the live buyer-inquiry card its substance) and me (which has the deeper lead scoring + routing + drip-matching logic but no caller). The site backs the live card with the wrong code path from the customer's perspective — they think the "Buyer Inquiry Router" gives them lead scoring + routing + drip selection; in reality, the runner's generic chain gives them only a categorized PENDING draft.

**What I could do with the necessary improvements:** Decision: either (a) merge my logic into the runner's chain so the live buyer-inquiry router gets the deeper scoring + routing semantics; or (b) leave me as a separate skill, surface me as a distinct agentRoster card, and wire a caller. (a) is the higher-leverage move because the runner already fires on real mail. (b) is the more honest move because the two logics are different shapes — mine handles lead scoring + agent-roster matching + drip-campaign matching, which the generic chain doesn't.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(site silent on me; the buyer-inquiry capability the site does surface is backed by the runner's generic chain, not by me).*

---

### `month-end-close-cpa`  (vertical: cpa · fires via: **no production caller** · live-data? **no — QuickBooks `stubbed-json` per `registry.ts:420-433`**)

**What I can do today (verified):** I coordinate a CPA-firm month-end close for a single client engagement — identify checklist items as received/pending/late, surface uncategorized receipts, draft per-recipient batched CPA-vernacular chase emails (formal tone, never asserting a tax position per `lib/skills/prompts/cpa.ts`), propose calendar reminders for the CSM, and draft a single client-facing status update the partner-or-CSM can send when ready (`lib/skills/month-end-close-cpa/skill.ts:58-120`). End-to-end functional against the JSON fetcher. Gmail built; QBO + TaxDome/Karbon all `stubbed-json`. No caller.

**What the site says I do:** Site does NOT name me. CPA's `agentRoster` (`lib/verticals/cpa/content.ts:36-100`) includes `cpa-doc-chase` ("runs the missing-document cadence per client through the season") — exactly my job — marked `runtime: "rooting"` with the note: *"rooting now — comes online once your tax-software client portal is connected."* This is the most honest pairing in the catalog: the card states the dependency, the dependency is real (QBO + practice-mgmt MCPs aren't built), and the marker matches reality.

**The gap:** None — the site is HONEST here. CPA-doc-chase says "rooting" because the underlying integrations aren't connected, and my code accurately reflects that. The site is under-claiming me modestly (I'm functional on JSON-stub data, so the card could read "tested-on-fixtures, awaiting client-portal connection" instead of just "rooting"), but that's a tone choice, not a claims-vs-reality violation.

**What I could do with the necessary improvements:** Build the QuickBooks adapter (in flight per the QBO-MCP directory). Build adapters for TaxDome / Karbon / Canopy (the leading SMB practice-management surfaces). Add a daily cron caller. Once any one of those lands, I produce real chase emails on real engagement state and the CPA card flips from `rooting` to `live` honestly.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(site is honest — `rooting` matches reality; the only of the 16 with no overclaim AND a customer-visible card).*

---

### `law-intake-conflict-screen`  (vertical: law · fires via: **no production caller** · live-data? **no — Clio/MyCase/PracticePanther all `stubbed-json` per `registry.ts:453-462`**)

**What I can do today (verified):** I run a deterministic conflict screen on a prospective-client intake — compare prospect + adverse parties against the firm ledger (`findConflicts`), classify hits as direct/adverse/former-adverse, compute screen status, and draft a formal internal notice to the responsible attorney with `{{operator: ...}}` merge fields for the legal conclusion (which the skill NEVER asserts) (`lib/skills/law-intake-conflict-screen/skill.ts:36-100`). Grounded in ABA MRPC 1.1/1.6/1.18 per the catalog `groundedIn` list (`registry.ts:469-475`). End-to-end functional against `JsonLedgerFetcher`. Gmail built. No caller.

**What the site says I do:** Law's roster surfaces `law-intake-onboarding` as `runtime: "live"` with `boundSkill: "law-intake-conflict-screen"` (`lib/verticals/law/content.ts:46-55`). Job text: *"Runs the conflict check and drafts the engagement letter scoped to the matter."* The bind comment is the most carefully-worded in the codebase: *"Live via the deterministic intake-conflict-screen skill — works on a JSON-stub ledger today; binds to Clio / MyCase / PracticePanther MCPs once they ship."* So the codebase itself acknowledges the "live" mark is leaning on the JSON-stub fetcher.

**The gap:** The job text overpromises in one specific way: it says "drafts the engagement letter scoped to the matter." My code drafts the **internal-notice to the responsible attorney**, not the engagement letter to the prospect. The engagement-letter step would be a separate downstream skill (and the law roster doesn't include one). The "conflict check" half of the claim is accurate to my code; the "engagement letter" half is unbuilt.

**What I could do with the necessary improvements:** (a) Build a `law-engagement-letter-draft` sibling skill to back the second half of the `law-intake-onboarding` job text — or rephrase the card job to "Runs the conflict check and drafts the internal notice for the responsible attorney" (which my code accurately delivers). (b) Build the Clio adapter (the OAuth shape is well-trodden); MyCase + PracticePanther can ride the same `LedgerEntry[]` port. (c) Add a caller — either an on-demand intake form that triggers me, or a webhook listener on Clio's matter-creation event.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim — the job text includes an unbuilt second clause; the codebase comment acknowledges the JSON-stub dependency).*

---

### `ria-client-update-draft`  (vertical: ria · fires via: **no production caller** · live-data? **no — Orion/Black Diamond/Tamarac AND Redtail/Wealthbox all `stubbed-json` per `registry.ts:488-502`**)

**What I can do today (verified):** I draft a single quarterly household client-update email from `PortfolioSnapshot` + `AdvisorNote[]` (`lib/skills/ria-client-update-draft/skill.ts:31-60`). Grounded in Advisers Act § 206 + Rule 206(4)-1 (advertising rule) + Rule 204A-1 (code of ethics) per `registry.ts:516-518`. Hard rules: never state an investment recommendation, never claim past performance is predictive, never render specific dollar amounts (every figure is an `{{advisor: ...}}` merge field), always include Form ADV / Part 2A pointer + custody-rule note. End-to-end functional on JSON-stub portfolio data. Gmail built. No caller.

**What the site says I do:** RIA's roster surfaces `ria-performance-reporter` as `runtime: "live"` with `boundSkill: "ria-client-update-draft"` (`lib/verticals/ria/content.ts:84-94`). Job text: *"Drafts the quarterly per-client performance narrative with cited attribution."*

**The gap:** Job text is accurate to my code in tone and shape. "Live" misrepresents firing status — same pattern as all the other roster-bound cards. The "with cited attribution" clause is interesting: my code attributes via the `AdvisorNote[]` the advisor herself supplies; if a visitor reads "cited attribution" as performance attribution sourced from the portfolio system (TWR/IRR breakdowns by holding), that's an overclaim — the cited attribution comes from the advisor's manually-supplied notes, not from a portfolio-system feed.

**What I could do with the necessary improvements:** Build the Orion adapter first (Orion has the largest independent-RIA share); Black Diamond + Tamarac ride the same `PortfolioSnapshot` port. Build the Redtail adapter for `AdvisorNote[]` (most common SMB CRM in the wealth space). Add a quarterly cron caller (this skill is a quarterly artifact, not a daily one). Once any one custodian/PM-system adapter lands, I produce real client-update drafts on real portfolio snapshots and the "live" claim becomes honest.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim).*

---

### `insurance-coi-request`  (vertical: insurance · fires via: **no production caller** · live-data? **no — EZLynx/Applied Epic/AMS360/HawkSoft all `stubbed-json` per `registry.ts:534-540`**)

**What I can do today (verified):** I read an inbound COI request, look up the named insured's policies on the AMS, decide per-line coverage as in-force/expired/not-on-file, build the structured issuance payload for the CSR to open in the AMS or carrier portal, and draft a formal acknowledgement back to the requester (`lib/skills/insurance-coi-request/skill.ts:41-100`). Hard rules per `lib/skills/prompts/insurance.ts`: never quote premium, never confirm bind/effective date (defer to `{{operator: ...}}`), never use "guarantee"/"ensure", always note "subject to underwriting" for any new-line ask. End-to-end functional on JSON-stub policy data. Gmail built. No caller.

**What the site says I do:** Insurance's roster surfaces `insurance-coi-generator` as `runtime: "live"` with `boundSkill: "insurance-coi-request"` (`lib/verticals/insurance/content.ts:35-44`). Job text: *"Reads the COI request, pulls the policy, and drafts the certificate for one-click issue."* The insurance vertical's `claims.replace` triad (`content.ts:245-250`) opens with: *"~30% of every CSR's day on certificate-of-insurance generation"* and the `valueLoopExample` (`content.ts:279-288`) describes a renewal-week scenario where "the fleet rerated all 47 [accounts] against current pricing" — the rerate workflow is NOT mine (that's a separate, unbuilt `insurance-renewal-coordinator` capability marked `rooting` at `content.ts:46-52`); my scope is COI requests only.

**The gap:** Two overclaims. (1) "drafts the certificate for one-click issue" — my code drafts the structured issuance PAYLOAD for the CSR to open in the AMS/carrier portal, not the certificate itself (the certificate is generated by the AMS/carrier system after the CSR clicks). The "one-click issue" framing implies my output IS the certificate. (2) "Live" misrepresents firing status — no caller, AMS connectors are stubs. The `valueLoopExample`'s rerate scenario is backed by a `rooting` capability, not me, and uses present-tense language ("the fleet rerated") that overstates what runs today.

**What I could do with the necessary improvements:** Build the EZLynx adapter first (largest independent-agency AMS share); Applied Epic + AMS360 + HawkSoft ride the same `PolicyOnFile[]` port. Build either an on-demand operator-dashboard trigger (CSR drops a COI request email into me) or an Outlook/Gmail rule-based webhook that fires me on inbound subject-line matching "certificate of insurance"/"COI request". Once an AMS adapter lands + a caller wires me, I produce real coverage decisions + real acknowledgement drafts on real policy state.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim + minor "one-click issue" overstatement in the card job text).*

---

### `mortgage-document-chase`  (vertical: mortgage · fires via: **no production caller** · live-data? **no — Encompass/LendingPad/Calyx all `stubbed-json` per `registry.ts:569-576`**)

**What I can do today (verified):** I read outstanding LOS items, bucket each against the broker's per-category cadence (fresh/pending/late/stuck via `bucketFor`), draft a SINGLE batched borrower email per loan file (never one-per-doc spam), and surface a phone-call nudge to the LO for stuck items (`lib/skills/mortgage-document-chase/skill.ts:41-100`). Hard rules: never quote rate/APR/LTV/DTI (defer to `{{operator: rate/APR}}`), never use promissory language. End-to-end functional on JSON-stub loan-file data. Gmail built. No caller.

**What the site says I do:** Mortgage's roster surfaces `mortgage-document-chase` as `runtime: "live"` with `boundSkill: "mortgage-document-chase"` (`lib/verticals/mortgage/content.ts:39-49`). Job text: *"Runs the per-file doc-collection cadence and escalates only when stuck."*

**The gap:** Job text is accurate to my code. "Live" misrepresents firing status. The escalation-when-stuck clause is precisely what my `LoNudge` output models.

**What I could do with the necessary improvements:** Build the Encompass adapter first (largest mortgage broker LOS share); LendingPad + Calyx ride the same `LoanFile + OutstandingDoc[]` port. Add a caller — daily cron for stuck-item sweep + an LOS webhook listener for new-condition events. Once an LOS adapter lands + a caller wires me, I produce real batched borrower drafts on real loan-file state.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim).*

---

### `home-services-estimate-followup`  (vertical: home-services · fires via: **no production caller** · live-data? **no — AccuLynx/JobNimbus/ServiceTitan/Housecall Pro/Jobber all `stubbed-json` per `registry.ts:603-610`**)

**What I can do today (verified):** I walk every open trades estimate, classify each by where it sits in the post-send cadence (fresh/soft-nudge/check-in/last-call/cold via `stageFor`), draft the per-stage homeowner-facing nudge, and roll cold estimates into a single rep handoff with a phone-call ask — never another email (`lib/skills/home-services-estimate-followup/skill.ts:38-90`). Price + schedule always defer to `{{operator: quote/time estimate}}`. End-to-end functional on JSON-stub estimate data. Gmail built. No caller.

**What the site says I do:** Home-services' roster surfaces `home-services-estimate-followup` as `runtime: "live"` with the matching `boundSkill` (`lib/verticals/home-services/content.ts:54-65`). Job text: *"Walks open estimates, drafts the right-stage homeowner nudge, and hands cold deals back to the rep for a phone call."*

**The gap:** Job text is accurate to my code. "Live" misrepresents firing status.

**What I could do with the necessary improvements:** Build the AccuLynx adapter first (roofing share leader per the home-services Phase 0 brief); JobNimbus + ServiceTitan + Housecall Pro + Jobber ride the same `EstimateRecord[]` port. Add a daily cron caller. Once an FSM adapter lands, real per-stage nudges on real estimate state.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim).*

---

### `recruiting-candidate-status-update`  (vertical: recruiting · fires via: **no production caller** · live-data? **no — Greenhouse/Lever/Workable/Bullhorn all `stubbed-json` per `registry.ts:639-645`**)

**What I can do today (verified):** I read a role's active pipeline, classify each active candidate by transition since last touch (via `transitionFrom` — advanced/held/rejected/withdrawn/offer-extended), and draft the warm-but-quick update (`lib/skills/recruiting-candidate-status-update/skill.ts:38-100`). Offer-extended and rejected drafts ALWAYS queue for recruiter review before any persistence (high-stakes transitions don't auto-persist even at high confidence). Hiring-manager feedback never leaks into the draft verbatim. Comp/offer detail always defers to `{{operator: comp/offer details}}`. End-to-end functional on JSON-stub ATS data. Gmail built. No caller.

**What the site says I do:** Recruiting's roster surfaces `recruiting-candidate-status-update` as `runtime: "live"` with the matching `boundSkill` (`lib/verticals/recruiting/content.ts:53-64`). Job text: *"Reads the role's active pipeline and drafts the per-candidate update on every transition for the recruiter to send."*

**The gap:** Job text accurate to code. "Live" misrepresents firing status.

**What I could do with the necessary improvements:** Build the Greenhouse adapter first (largest startup-ATS share); Lever + Workable + Bullhorn ride the same `RoleContext + CandidateRecord[]` port. Add a daily cron caller — pipeline transitions are a periodic sweep, not a per-event reaction. Once an ATS adapter lands, real candidate-update drafts on real pipeline state.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim).*

---

### `property-management-rent-collection-chase`  (vertical: property-management · fires via: **no production caller** · live-data? **no — AppFolio/Buildium/Propertyware/Yardi Breeze all `stubbed-json` per `registry.ts:674-681`**)

**What I can do today (verified):** I read the rent roll, bucket each delinquent unit against the operator's cadence (grace/soft-chase/formal-notice/escalation via `bucketFor`), and draft the per-tenant chase email (`lib/skills/property-management-rent-collection-chase/skill.ts:36-90`). Payment plans soften tone. Escalation units route to a PM review queue carrying the owner-approval flag — escalation drafts never auto-persist. Maintenance ETAs defer to `{{operator: maintenance ETA}}`; dollar amounts defer to `{{operator: amount due}}`. End-to-end functional on JSON-stub rent-roll data. Gmail built. No caller.

**What the site says I do:** Property-management's roster surfaces `pm-collections` as `runtime: "live"` with `boundSkill: "property-management-rent-collection-chase"` (`lib/verticals/property-management/content.ts:48-60`). Job text: *"Runs the late-rent cadence with tenant payment history attached."*

**The gap:** Job text accurate to code. "Live" misrepresents firing status.

**What I could do with the necessary improvements:** Build the AppFolio adapter first (largest small-PM-share); Buildium + Propertyware + Yardi Breeze ride the same `UnitDelinquency[]` port. Add a daily cron caller (rent delinquency is a daily-sweep job). Once a PM-system adapter lands, real per-tenant chase drafts on real rent-roll state.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim).*

---

### `title-escrow-closing-doc-chase`  (vertical: title-escrow · fires via: **no production caller** · live-data? **no — SoftPro/Qualia/RamQuest all `stubbed-json` per `registry.ts:710-716`**)

**What I can do today (verified):** I walk a closing-file checklist, bucket each item by responsible party (lender/buyer/seller/attorney), and draft a batched chase email per party — so the lender doesn't get five separate notes for one closing (`lib/skills/title-escrow-closing-doc-chase/skill.ts:37-90`). Optional items never trigger chases. Late items lower draft confidence so the closing coordinator re-reads tone before sending. Title status + wire-instructions confirmation always defer to `{{operator: ...}}` merge fields. End-to-end functional on JSON-stub closing-file data. Gmail built. No caller.

**What the site says I do:** Title-escrow's roster surfaces `title-doc-chase` as `runtime: "live"` with `boundSkill: "title-escrow-closing-doc-chase"` (`lib/verticals/title-escrow/content.ts:39-50`). Job text: *"Runs the doc-collection cadence per channel and escalates only when stuck."*

**The gap:** Job text accurate to code. "Live" misrepresents firing status. (Minor: my code doesn't currently distinguish "stuck" as a distinct bucket — items get `late` status when past `lateAfterDays`. "Escalates only when stuck" implies a separate stuck-detector; the existing late-confidence-lowering behavior is close but not identical.)

**What I could do with the necessary improvements:** Build the SoftPro adapter first (largest independent-title-share); Qualia + RamQuest ride the same `ClosingFile + ChecklistItem[] + ReceivedDoc[]` port. Add a daily cron caller. Once a title-production-system adapter lands, real per-party batched chase drafts on real closing-file state. Optionally: add an explicit "stuck" bucket to match the card's "escalates only when stuck" wording exactly.

**Honesty tag:** **VERIFIED-DEMO-ONLY** *(in-product roster overclaim + minor "stuck" wording mismatch).*

---

## Cross-skill observations

1. **The "1 + 15" pattern.** Of the 16 runtime catalog skills, exactly ONE (`office-admin`) is wired to a production caller (`process-webhook-event` cron) and ships `defaultEnabled: true` for every workspace. The other 15 have full implementations + JSON-stub fetchers + passing tests, but no Inngest cron + no API route + no UI trigger calls them. They are catalog-tested but unsummoned.

2. **The roster-overclaim cluster.** 11 vertical pages (real-estate, cpa, law, ria, insurance, mortgage, home-services, recruiting, property-management, title-escrow, general) surface a "Chief of Staff" agentRoster card marked `runtime: "live"` via `boundSkill: "chief-of-staff-scheduler"`. Plus 8 of the verticals surface a SECOND `live`-via-`boundSkill` card for their vertical-specific skill (law/ria/insurance/mortgage/home-services/recruiting/property-management/title-escrow). The agentRoster type-definition comment at `lib/verticals/types.ts:196-211` defines this `live`-via-`boundSkill` semantic as "capability tested" rather than "running today" — that semantic is honest if a visitor reads the type comment; no visitor does. The customer-visible language is "live", which a logged-in customer reasonably reads as "running on my data today."

3. **Where the marketing surface is honest.** The customer-facing marketing `/[vertical]` pages do NOT render the agentRoster (`app/(marketing)/[vertical]/page.tsx:48-83`). Public visitors see JTBD tables + claims triad + integrations roadmap + valueLoopExample. The integrations roadmap is honest by construction — `integrations.shipped: []` is empty on most verticals, `integrations.planned` lists the unbuilt MCPs honestly with `plannedWindow`. The agentRoster overclaim is in-product only, surfaced on `/app/workspace/[id]/agents` to logged-in customers.

4. **CPA is the honest counter-example.** The CPA vertical's `cpa-doc-chase` card is `rooting`-tagged with the explicit dependency note: *"comes online once your tax-software client portal is connected"* — and the matching catalog skill (`month-end-close-cpa`) has QBO + practice-management MCPs as `stubbed-json`. The site-vs-code parity is exact. No other vertical with a backed skill chose `rooting` over `live`.

5. **Three orphans.** `invoice-chasing-realestate`, `lead-triage-realestate`, and `month-end-close-cpa` are coded + tested but not surfaced on any agentRoster as a `boundSkill` link. (CPA names the JOB via the `rooting` `cpa-doc-chase` card but doesn't bind it.) These three are the inverse honesty issue: the site under-claims them to zero, even though their code is tested + functional. They could be promoted to `boundSkill`-backed cards once a caller + an MCP adapter exists.

6. **No skill in this batch produces real outbound.** All 16 honor `project_no_outbound_architecture.md`. The two paths to a customer surface are: (a) `office-admin` → `WorkApprovalQueueItem` (live), and (b) every other skill → the same `WorkApprovalQueueItem` table the moment a caller wires its `ApprovalSink` (chief-of-staff is the closest — it has a `PrismaApprovalSink` built but no caller). Per `feedback_integration_acceptance_is_functional.md` the acceptance bar is "read + categorize + coordinate + schedule + draft on Conner's real inbox" — `office-admin` meets it via the runner; the other 15 wait for their callers.

---

## Headline

**1 of 16 VERIFIED-LIVE on real customer data (`office-admin`); 15 of 16 VERIFIED-DEMO-ONLY (full implementations + tests + JSON-stub fetchers, but no production caller and the connector MCPs are `stubbed-json`).** The biggest site overclaim is the 11-vertical pattern of `runtime: "live"` agentRoster cards backed by `boundSkill: "chief-of-staff-scheduler"` — the type-comment honestly defines this as "capability tested" rather than "running today," but the in-product label reads as "running today" to any logged-in customer who sees it. The marketing surface (`/[vertical]` pages) does not propagate this overclaim because it does not render the agentRoster — only the in-product `/app/workspace/[id]/agents` page does. CPA's `rooting`-tagged `cpa-doc-chase` card is the one honest counter-example: site-state matches code-state exactly.
