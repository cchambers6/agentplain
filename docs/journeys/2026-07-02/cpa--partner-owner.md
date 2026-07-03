# Journey map — cpa / partner-owner

**Run date:** 2026-07-02 · **Produced by:** claude-fable-5 (pass-1 seed) · **Schema:** v1

## Persona

Partner/owner-CPA at a small firm (1–10 staff). Buys for the firm; personally
cares about pipeline visibility during season, pre-file compliance review, and
AR escalation. During the 8 tax-season weeks the firm loses ~25% of each
80-hour staff week to document chasing — the basis of the ratified 12x ROI
anchor. Sourced from the ratified JTBD table
(`lib/verticals/cpa/content.ts:122-257`, partner role) — analyst-derived from
AICPA/PCPS/Karbon/TaxDome public role docs; zero observed customers. The firm
is sold the **Partner tier ($299/mo solo)** whose stated rationale includes
4 hrs/month of named-service-partner reserved time.

## Stage-by-stage map

### awareness

**cpa.aw.1 — partner researches "AI for my firm" between deadlines**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| See it speaks my systems (TaxDome/Karbon/QBO), not generic AI | code: lib/integrations/marketplace.ts (TaxDome, Karbon `available`) | partial | marketplace advertises the right names; the claim is ahead of the product (see activation) |
| Evidence it understands CPA obligations (Circular 230, confidentiality) | code: lib/agents/sentinel/corpus/cpa (7 rules loaded, 0 verified) | partial | rules exist in corpus but every one is `[UNVERIFIED — needs counsel]` and none fire |
| Proof from firms like mine | kaizen: 05-sales.md | no | gap: zero proof, zero fired outreach; none may be invented |

### consideration

**cpa.co.1 — justifying Partner tier to myself**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Know why Partner costs $100 more than Regular | code: lib/verticals/cpa/content.ts:15-23 | partial | rationale exists (season cadence + 4 hrs/mo partner time); nothing in-product ever shows or schedules that time |
| The 4 hrs/mo of named-partner time to actually happen | todo-real-signal | no | gap: no booking surface, no fulfillment mechanism, no record — a paid tier promise with no delivery path |
| Know my trial terms (CPA gets 14 days, per policy) | audit: 10-team-admin-settings.md P1-11; code: lib/pricing/tiers.ts:131 | no | gap: billing page shows 7-day copy to 14-day verticals; code says 30; policy says 14 |
| Confidence about client-data handling before signing | audit: 05-connectors.md P0-3; memory: project_two_bucket_data_positioning | no | gap: two-bucket positioning single-sources sit on an unmerged branch; nothing customer-facing explains pass-through vs memory |
| An engagement-letter-grade legal posture from my vendor | kaizen: 08-legal-compliance.md | no | gap: no legal entity named in ToS, no counsel sign-off, no DPA path — disqualifying for a professional-services buyer |

### signup

**cpa.si.1 — creating the firm workspace**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Clean signup with card expectations stated | audit: 10-team-admin-settings.md P1-10 | no | gap: "no card required" copy vs `CARD_REQUIRED_AT_SIGNUP=true` |
| Passkey + reliable sign-in | code: PR #268/#270 | yes | shipped |
| A signed record of terms (professional buyer habit) | kaizen: 08-legal-compliance.md | no | gap: no clickwrap acceptance record |

### activation

**cpa.ac.1 — connecting the practice-management system (the whole pitch)**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Connect TaxDome or Karbon and see the month-end/doc-chase loop | audit: 05-connectors.md P0-1; doc: docs/agent-interviews/01-runtime-skills.md | no | gap: both advertised `available` but unconnectable — no `connectMode` UI path, MCP endpoints stubbed-JSON, no live adapter. Every one of the 6 rooting CPA agents depends on this credential |
| Connect QuickBooks Online | code: marketplace.ts (QBO available) | yes | QBO connector live |
| See the data disclosure before connecting client files | audit: 05-connectors.md P0-2 | no | gap: tile Connect bypasses #306 disclosure — worse for CPAs, whose data is client PII under confidentiality rules |
| A first visible win in week one | code: cpa-client-inbound live (content.ts:36-104) | partial | inbound question triage fires on email; the headline doc-chase win is blocked behind the connector gap |

### daily-use

**cpa.du.1 — season-mode mornings**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Pipeline visibility: which engagements are stuck (partner JTBD) | code: content.ts — cpa-onboarding/doc-chase `rooting` | no | gap: needs practice-mgmt read; blocked on cpa.ac.1 connector gap |
| Client questions triaged by engagement | code: cpa-client-inbound live | yes | owns buyer-inquiry work in the inbox loop |
| Pre-file compliance review flags (partner JTBD) | code: sentinel corpus cpa — 0 verified rules | no | gap: rules loaded, counsel review pending; sentinel not live for CPA |
| Approve/reject drafted client replies with full context | audit: 04-approvals-plaino-chat.md F-1/F-2/F-3 | partial | approvals live; notification, 50-cap, and no-reason-on-web gaps apply |
| AR escalation approvals (partner JTBD) | code: cpa-collections `rooting` | no | gap: needs AR feed (QBO billing / practice-mgmt) |
| Calendar/scheduling handled (chief-of-staff) | code: cpa-chief-of-staff live, requires GOOGLE/M365 | yes | live when calendar connector present |
| Honest behavior when AI is paused | code: PR #276 | yes | degraded banner + deterministic loops |

### expansion

**cpa.ex.1 — rolling out to staff and clients**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Seats for my staff at the 2–9 price break | code: lib/pricing/tiers.ts ($279 at 2–9) | yes | ladder explicit |
| A client portal for document exchange | audit: 06-customer-portal.md | no | gap: portal 0%-activatable, 5 P0s — and for CPAs the upload-bytes-discarded P0 (PORTAL-5) breaks the core document-exchange promise |
| E-sign routing for engagement letters and 8879s (admin JTBD, partner approves) | code: PR #280 DocuSign approval gate | partial | DocuSign gated send exists; engagement-letter/8879 routing flow itself is `rooting` (cpa-billing, admin role) |

### renewal

**cpa.re.1 — after first season: was the 12x real?**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| See hours reclaimed against the 12x claim | audit: 09-guarantee.md P0-1; kaizen: 09-data-analytics.md | no | gap: saved-time writers cover 3/7 actions; no per-vertical KPI surface; the ROI claim is unverifiable in-product |
| Guarantee terms I can hold you to | audit: 09-guarantee.md P1-4 | no | gap: two unreconciled guarantees |
| Off-season price empathy or pause | todo-real-signal | no | gap: no seasonal pause/downgrade concept anywhere in billing; CPAs' willingness-to-pay is seasonal — flagged for real-signal validation |

### advocacy

**cpa.ad.1 — the state-society dinner test**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Recommend it without professional embarrassment | kaizen: 08-legal-compliance.md; audit: 06-customer-portal.md | no | gap: unverified compliance rules + portal P0s make a professional referral reputationally risky today |

## Machine block

```yaml
vertical: cpa
persona: partner-owner
persona_source: lib/verticals/cpa/content.ts:122-257 (ratified JTBD, partner role; not observed-customer)
run_date: 2026-07-02
produced_by: claude-fable-5
stages:
  - stage: awareness
    micro_moments:
      - id: cpa.awareness.research
        moment: partner researches AI help between deadlines
        wants:
          - {id: cpa.awareness.research.1, want: see it speaks my systems not generic AI, signal: [{kind: code, ref: lib/integrations/marketplace.ts TaxDome Karbon}], delivering: partial, evidence: names advertised; product behind claim, universal: false, cluster: activation-blockers}
          - {id: cpa.awareness.research.2, want: evidence it understands CPA obligations, signal: [{kind: code, ref: lib/agents/sentinel/corpus/cpa 0-verified}], delivering: partial, evidence: 7 rules loaded all unverified, universal: false, cluster: compliance-floor}
          - {id: cpa.awareness.research.3, want: proof from firms like mine, signal: [{kind: kaizen, ref: 05-sales.md}], delivering: no, evidence: "gap: zero proof, zero outreach", universal: true, cluster: provable-claims}
  - stage: consideration
    micro_moments:
      - id: cpa.consideration.partner-tier
        moment: partner justifies the Partner tier to themselves
        wants:
          - {id: cpa.consideration.partner-tier.1, want: know why Partner costs more than Regular, signal: [{kind: code, ref: lib/verticals/cpa/content.ts:15-23}], delivering: partial, evidence: rationale documented; never surfaced in product, universal: false, cluster: know-what-i-am-buying}
          - {id: cpa.consideration.partner-tier.2, want: the 4 hrs/mo named-partner time to actually happen, signal: [{kind: todo-real-signal, ref: no fulfillment mechanism found}], delivering: no, evidence: "gap: paid tier promise with no booking/fulfillment/record path", universal: false, cluster: tier-promise-integrity}
          - {id: cpa.consideration.partner-tier.3, want: know my trial terms, signal: [{kind: audit, ref: 10-team-admin-settings.md P1-11}, {kind: code, ref: lib/pricing/tiers.ts:131}], delivering: no, evidence: "gap: 7d copy vs 14d policy vs 30d code", universal: true, cluster: know-what-i-am-buying}
          - {id: cpa.consideration.partner-tier.4, want: confidence about client-data handling, signal: [{kind: audit, ref: 05-connectors.md P0-3}, {kind: memory, ref: project_two_bucket_data_positioning_2026_06_18}], delivering: no, evidence: "gap: two-bucket positioning unmerged; no customer-facing story", universal: true, cluster: data-story}
          - {id: cpa.consideration.partner-tier.5, want: engagement-letter-grade legal posture, signal: [{kind: kaizen, ref: 08-legal-compliance.md}], delivering: no, evidence: "gap: no entity, no counsel sign-off, no DPA path", universal: true, cluster: legal-floor}
  - stage: signup
    micro_moments:
      - id: cpa.signup.firm-workspace
        moment: partner creates the firm workspace
        wants:
          - {id: cpa.signup.firm-workspace.1, want: card expectations stated honestly, signal: [{kind: audit, ref: 10-team-admin-settings.md P1-10}], delivering: no, evidence: "gap: copy contradicts facts.ts", universal: true, cluster: know-what-i-am-buying}
          - {id: cpa.signup.firm-workspace.2, want: passkey and reliable sign-in, signal: [{kind: code, ref: PR268 PR270}], delivering: yes, evidence: shipped, universal: true, cluster: auth-reliability}
          - {id: cpa.signup.firm-workspace.3, want: signed record of terms, signal: [{kind: kaizen, ref: 08-legal-compliance.md}], delivering: no, evidence: "gap: no clickwrap record", universal: true, cluster: legal-floor}
  - stage: activation
    micro_moments:
      - id: cpa.activation.practice-mgmt
        moment: partner connects the practice-management system
        wants:
          - {id: cpa.activation.practice-mgmt.1, want: connect TaxDome/Karbon and see the doc-chase loop, signal: [{kind: audit, ref: 05-connectors.md P0-1}, {kind: doc, ref: docs/agent-interviews/01-runtime-skills.md}], delivering: no, evidence: "gap: advertised available, unconnectable; MCP stubs; 6 rooting agents blocked", universal: false, cluster: activation-blockers}
          - {id: cpa.activation.practice-mgmt.2, want: connect QuickBooks Online, signal: [{kind: code, ref: marketplace.ts QBO}], delivering: yes, evidence: QBO live, universal: false}
          - {id: cpa.activation.practice-mgmt.3, want: data disclosure before connecting client files, signal: [{kind: audit, ref: 05-connectors.md P0-2}], delivering: no, evidence: "gap: disclosure bypassed on primary path", universal: true, cluster: data-story}
          - {id: cpa.activation.practice-mgmt.4, want: a first visible win in week one, signal: [{kind: code, ref: cpa-client-inbound live}], delivering: partial, evidence: inbound triage live; headline win blocked by connector gap, universal: true, cluster: activation-blockers}
  - stage: daily-use
    micro_moments:
      - id: cpa.daily-use.season-morning
        moment: season-mode morning check on the firm
        wants:
          - {id: cpa.daily-use.season-morning.1, want: pipeline visibility on stuck engagements, signal: [{kind: code, ref: content.ts cpa-onboarding cpa-doc-chase rooting}], delivering: no, evidence: "gap: blocked on practice-mgmt connector", universal: false, cluster: activation-blockers}
          - {id: cpa.daily-use.season-morning.2, want: client questions triaged by engagement, signal: [{kind: code, ref: cpa-client-inbound}], delivering: yes, evidence: live in inbox loop, universal: false}
          - {id: cpa.daily-use.season-morning.3, want: pre-file compliance flags, signal: [{kind: code, ref: sentinel corpus cpa 0-verified}], delivering: no, evidence: "gap: counsel review pending; CPA sentinel not live", universal: false, cluster: compliance-floor}
          - {id: cpa.daily-use.season-morning.4, want: approve drafted replies with full context, signal: [{kind: audit, ref: 04-approvals-plaino-chat.md F-1 F-2 F-3}], delivering: partial, evidence: approvals live with notification/cap/reason gaps, universal: true, cluster: approval-loop}
          - {id: cpa.daily-use.season-morning.5, want: AR escalation approvals, signal: [{kind: code, ref: cpa-collections rooting}], delivering: no, evidence: "gap: needs AR feed", universal: false, cluster: rooting-roster}
          - {id: cpa.daily-use.season-morning.6, want: calendar and scheduling handled, signal: [{kind: code, ref: cpa-chief-of-staff live}], delivering: yes, evidence: live with GOOGLE/M365, universal: true}
          - {id: cpa.daily-use.season-morning.7, want: honest behavior when AI paused, signal: [{kind: code, ref: PR276}], delivering: yes, evidence: degraded banner + deterministic loops, universal: true}
  - stage: expansion
    micro_moments:
      - id: cpa.expansion.rollout
        moment: rolling out to staff and clients
        wants:
          - {id: cpa.expansion.rollout.1, want: staff seats at the volume break, signal: [{kind: code, ref: lib/pricing/tiers.ts}], delivering: yes, evidence: $279 at 2-9 seats, universal: true}
          - {id: cpa.expansion.rollout.2, want: a client portal for document exchange, signal: [{kind: audit, ref: 06-customer-portal.md PORTAL-5}], delivering: no, evidence: "gap: 0%-activatable; upload bytes discarded breaks the core promise", universal: true, cluster: portal}
          - {id: cpa.expansion.rollout.3, want: e-sign routing for engagement letters and 8879s, signal: [{kind: code, ref: PR280 DocuSign gate}, {kind: code, ref: cpa-billing rooting}], delivering: partial, evidence: gated send exists; routing flow rooting, universal: false, cluster: rooting-roster}
  - stage: renewal
    micro_moments:
      - id: cpa.renewal.after-season
        moment: after first season the partner asks whether 12x was real
        wants:
          - {id: cpa.renewal.after-season.1, want: see hours reclaimed vs the 12x claim, signal: [{kind: audit, ref: 09-guarantee.md P0-1}, {kind: kaizen, ref: 09-data-analytics.md}], delivering: no, evidence: "gap: 3/7 writers; no per-vertical KPI surface", universal: true, cluster: guarantee-integrity}
          - {id: cpa.renewal.after-season.2, want: guarantee terms I can hold you to, signal: [{kind: audit, ref: 09-guarantee.md P1-4}], delivering: no, evidence: "gap: two unreconciled guarantees", universal: true, cluster: guarantee-integrity}
          - {id: cpa.renewal.after-season.3, want: off-season price empathy or pause, signal: [{kind: todo-real-signal, ref: seasonal WTP unvalidated}], delivering: no, evidence: "gap: no pause/downgrade concept in billing", universal: false, cluster: real-signal}
  - stage: advocacy
    micro_moments:
      - id: cpa.advocacy.state-society
        moment: recommending at the state-society dinner
        wants:
          - {id: cpa.advocacy.state-society.1, want: recommend without professional embarrassment, signal: [{kind: kaizen, ref: 08-legal-compliance.md}, {kind: audit, ref: 06-customer-portal.md}], delivering: no, evidence: "gap: unverified rules + portal P0s = reputational risk", universal: false, cluster: compliance-floor}
```

## Cross-vertical clusters observed

activation-blockers · compliance-floor (CPA-weighted; law will share it) ·
provable-claims · know-what-i-am-buying · tier-promise-integrity (new — any
tier bundling human time) · data-story · legal-floor · auth-reliability ·
approval-loop · rooting-roster · portal · guarantee-integrity · real-signal.
