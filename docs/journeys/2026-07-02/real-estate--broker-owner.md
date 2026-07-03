# Journey map — real-estate / broker-owner

**Run date:** 2026-07-02 · **Produced by:** claude-fable-5 (pass-1 seed) · **Schema:** v1

## Persona

Broker-owner of a small Georgia brokerage; spends 8–12 hours/week on
coordination work (broker-of-record review, listing follow-up, showing
scheduling, recruiting outreach) they'd rather delegate. Sourced from the
ratified Phase 0 JTBD table (`lib/verticals/real-estate/content.ts:114-209`,
jobs BO-1..BO-8) — analyst-derived from public role research, not observed
customers. `persona_source: lib/verticals/real-estate/content.ts` with a
standing caveat: zero paying customers and zero design-partner conversations
have validated it (kaizen `docs/kaizen/2026-07-02/05-sales.md`: 0 outreach
sends), so persona validation is itself want `real-estate.awareness.persona-research`.

## Stage-by-stage map

### awareness

**re.aw.1 — first contact with the marketing site**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Understand what the service does before committing time | audit: docs/audits/full-audit-2026-07-02/agentplain/01-marketing-home.md P0-1 | partial | `/how-it-works` (PR #283) exists but a stale 308 redirect in `next.config.mjs:22-25` shadows it — the explainer is unreachable |
| Believe the ROI numbers | audit: 01-marketing-home.md P1-2 | no | gap: proof card range $2,900–$10,600/mo has no substantiating source in code; Truth-Wave violation risk |
| See proof from brokers like me | kaizen: 05-sales.md | no | gap: zero social proof, no founder bio, no case studies (and none may be invented) |
| Be marketed to as a person we actually studied | todo-real-signal | no | gap: personas are JTBD-derived; no observed-customer research exists |

### consideration

**re.co.1 — evaluating price, terms, trust**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Clear tier pricing with volume discounts | code: lib/pricing/tiers.ts:87-123 | yes | three-tier ladder Regular $199 → $99 at volume, self-serve for Regular/Partner |
| Know exactly what trial I get | audit: 10-team-admin-settings.md P1-11; code: lib/pricing/tiers.ts:131 | no | gap: `TRIAL_PERIOD_DAYS=30` in code vs ratified 7d policy (PR #262) vs billing copy — three surfaces disagree |
| Understand the guarantee before trusting a new vendor | audit: 09-guarantee.md P1-4, P1-5 | partial | `/guarantee` page exists but is orphaned (no inbound links, no sitemap); 14-day money-back and Day-7 walk-away never reconciled |
| Compare against my status quo | doc: /compare (PR #285) | yes | comparison page shipped in marketing surface launch |
| Trust the security story | audit: 01-marketing-home.md P1-1 | partial | `/security` live but names a single named individual as sole prod-access holder and carries unverified absolutes |
| Talk to a human before buying | kaizen: 05-sales.md | no | gap: no scheduling link (`{{CALENDLY_LINK}}` unresolved), no demo asset, founder-led motion unfired |

### signup

**re.si.1 — creating the account**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Sign up without a broken first step | audit: 02-auth.md P1-5 | partial | magic link consumed via GET — corporate mail scanners can burn the token before the human clicks |
| Set up a passkey that works on my phone | code: PR #268/#270/#171 fixes | yes | WebAuthn hints + rpId + 30-day stay-signed-in all landed |
| Know whether a card is required | audit: 10-team-admin-settings.md P1-10 | no | gap: billing page hardcodes "no card required" while `lib/billing/facts.ts` has `CARD_REQUIRED_AT_SIGNUP=true` |
| Have what I agreed to on record | kaizen: 08-legal-compliance.md | no | gap: no clickwrap — no versioned ToS acceptance recorded at signup; published legal docs lack counsel sign-off |

### activation

**re.ac.1 — connecting my systems (the first-5-minutes promise)**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Connect Follow Up Boss and see triage in 5 minutes | audit: 05-connectors.md P1-5 | no | gap: FUB/Sierra are api-key connectors whose Connect CTA dead-ends in a false "OAuth start not implemented" error — the advertised killer-workflow entry is unreachable from the UI |
| Know what data you touch before I connect | audit: 05-connectors.md P0-2 | no | gap: tile Connect bypasses the #306 disclosure page entirely |
| Connect email/calendar | code: lib/integrations/marketplace.ts (GOOGLE, M365 available) | yes | Gmail/Outlook OAuth live; Gmail truthful read-only state (PR #282) |
| See a first drafted reply in Approvals | code: killer-workflow runtime (PR #303), deterministic ~0-LLM | partial | fires on synthetic/seeded data; blocked for real accounts by the FUB connect dead-end above |
| Invite my agents without locking myself out | audit: 10-team-admin-settings.md P1-13 | partial | invite works; last-owner guard counts INVITED owners that can never activate |
| Not stare at a blank tab while things load | audit: 03-workspace-shell.md F1/F2 | partial | Connections and Reports tabs have no loading.tsx |

### daily-use

**re.du.1 — the morning check-in (BO-1)**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Morning briefing on what the fleet did | code: briefing-generator cron; JTBD BO-1 | yes | briefing cron live in Inngest registry |
| Be told when something needs my approval | audit: 04-approvals-plaino-chat.md F-1 | partial | push fires on ~1 of 8 approval-creation paths; ~15 sweeps create approvals silently |
| Approve from my phone comfortably | audit: 03-workspace-shell.md F4 | partial | shell touch targets ~15–20px vs 44px minimum |
| Reject with a reason so it learns | audit: 04-approvals-plaino-chat.md F-3 | no | gap: web reject has no reason field (mobile has it); feedback loop starves |
| Never lose queued approvals | audit: 04-approvals-plaino-chat.md F-2 | no | gap: queue truncates at 50 with no signal; oldest vanish |
| Compliance flags on in-flight listings (BO-2) | code: lib/agents/sentinel/corpus/real-estate (fair-housing verified) | yes | realty compliance sentinel is the one live sentinel; fires on `compliance-check` work |
| Ask the fleet anything (Plaino chat) | code: PR #154 two-surface chat | yes | live |
| Honest experience when AI is paused | code: PR #276 degraded banner; policy: prod key paused | yes | universal banner + deterministic killer workflow still functions |
| Know where my data lives, in my vocabulary | audit: 04 F-5, 05 P0-3/P1-4 | no | gap: two-bucket data story absent from product surfaces; unmerged positioning branch; "Claude (reasoning)" leaks vendor on a customer surface |

### expansion

**re.ex.1 — turning on the rest of the roster**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| CRM hygiene, production reports, recruiting help | code: content.ts roster — 5 of 8 agents `rooting` | no | gap: awaits CRM/MLS connections (kvCORE/BoldTrail coming-soon; FMLS/GAMLS unplumbed) |
| A portal my clients can use | audit: 06-customer-portal.md PORTAL-1..14 | no | gap: portal is 0%-activatable with 5 P0s (owner edits discarded, caseId injection, blind approvals, bytes dropped) |
| Grow seats without price surprise | code: lib/pricing/tiers.ts volume ladder | yes | seat-banded pricing is explicit |

### renewal

**re.re.1 — the "is this worth $199/mo" moment**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| See the time actually saved | audit: 09-guarantee.md P0-1, P1-2 | no | gap: only 3/7 calibrated actions write saved-time; sweeps write zero; counter claimed live but renders once |
| A guarantee that pays out fairly — for both of us | audit: 09-guarantee.md P0-1, P1-1 | no | gap: undercounting triggers wrongful walk-away refunds; Day-7 sweep has no age bound |
| Cancel and truly be deleted | audit: 02-auth.md P1-7, 10 P0-1/P0-2 | no | gap: "delete everything we hold" overclaims; portal tables + support tickets survive close |

### advocacy

**re.ad.1 — telling other brokers**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| A referral motion worth my reputation | kaizen: 05-sales.md | no | gap: no referral mechanism, no proof ladder, nothing to hand a peer |
| not-in-scope: agentplain sending outreach on my behalf | memory: project_no_outbound_architecture | not-in-scope | agents draft; customer's own system sends — by ratified architecture |

## Machine block

```yaml
vertical: real-estate
persona: broker-owner
persona_source: lib/verticals/real-estate/content.ts:114-209 (ratified JTBD; not observed-customer)
run_date: 2026-07-02
produced_by: claude-fable-5
stages:
  - stage: awareness
    micro_moments:
      - id: real-estate.awareness.first-contact
        moment: broker lands on marketing site from search or referral
        wants:
          - {id: real-estate.awareness.first-contact.1, want: understand the service before committing time, signal: [{kind: audit, ref: docs/audits/full-audit-2026-07-02/agentplain/01-marketing-home.md P0-1}], delivering: partial, evidence: "/how-it-works shipped but shadowed by stale 308 in next.config.mjs:22-25", universal: true, cluster: know-what-i-am-buying}
          - {id: real-estate.awareness.first-contact.2, want: believe the ROI numbers, signal: [{kind: audit, ref: 01-marketing-home.md P1-2}], delivering: no, evidence: "gap: $2,900-10,600/mo range unsubstantiated in code", universal: true, cluster: provable-claims}
          - {id: real-estate.awareness.first-contact.3, want: see proof from brokers like me, signal: [{kind: kaizen, ref: docs/kaizen/2026-07-02/05-sales.md}], delivering: no, evidence: "gap: zero social proof; none may be invented", universal: true, cluster: provable-claims}
          - {id: real-estate.awareness.persona-research, want: be marketed to as a person we actually studied, signal: [{kind: todo-real-signal, ref: no observed-customer research exists}], delivering: no, evidence: "gap: JTBD analyst-derived only", universal: true, cluster: real-signal}
  - stage: consideration
    micro_moments:
      - id: real-estate.consideration.evaluate
        moment: broker weighs price, trial, guarantee, security
        wants:
          - {id: real-estate.consideration.evaluate.1, want: clear tier pricing with volume discounts, signal: [{kind: code, ref: lib/pricing/tiers.ts:87-123}], delivering: yes, evidence: lib/pricing/tiers.ts ladder + self-serve checkout, universal: true, cluster: know-what-i-am-buying}
          - {id: real-estate.consideration.evaluate.2, want: know exactly what trial I get, signal: [{kind: audit, ref: 10-team-admin-settings.md P1-11}, {kind: code, ref: lib/pricing/tiers.ts:131}], delivering: no, evidence: "gap: 30d in code vs 7d ratified policy vs billing copy", universal: true, cluster: know-what-i-am-buying}
          - {id: real-estate.consideration.evaluate.3, want: understand the guarantee, signal: [{kind: audit, ref: 09-guarantee.md P1-4 P1-5}], delivering: partial, evidence: "/guarantee orphaned; two guarantees unreconciled", universal: true, cluster: guarantee-integrity}
          - {id: real-estate.consideration.evaluate.4, want: compare against status quo, signal: [{kind: doc, ref: /compare PR285}], delivering: yes, evidence: app/(marketing) compare page, universal: false}
          - {id: real-estate.consideration.evaluate.5, want: trust the security story, signal: [{kind: audit, ref: 01-marketing-home.md P1-1}], delivering: partial, evidence: "single named prod-access holder; unverified absolutes", universal: true, cluster: provable-claims}
          - {id: real-estate.consideration.evaluate.6, want: talk to a human before buying, signal: [{kind: kaizen, ref: 05-sales.md}], delivering: no, evidence: "gap: no scheduling link, demo, or fired outreach", universal: true, cluster: founder-motion}
  - stage: signup
    micro_moments:
      - id: real-estate.signup.create-account
        moment: broker creates workspace and authenticates
        wants:
          - {id: real-estate.signup.create-account.1, want: sign up without a broken first step, signal: [{kind: audit, ref: 02-auth.md P1-5}], delivering: partial, evidence: magic link consumed on GET (scanner prefetch), universal: true, cluster: auth-reliability}
          - {id: real-estate.signup.create-account.2, want: passkey that works on my phone, signal: [{kind: code, ref: PR268 PR270 PR171}], delivering: yes, evidence: WebAuthn hints + rpId + 30d session fixes, universal: true, cluster: auth-reliability}
          - {id: real-estate.signup.create-account.3, want: know whether a card is required, signal: [{kind: audit, ref: 10-team-admin-settings.md P1-10}], delivering: no, evidence: "gap: billing copy contradicts facts.ts CARD_REQUIRED_AT_SIGNUP", universal: true, cluster: know-what-i-am-buying}
          - {id: real-estate.signup.create-account.4, want: have what I agreed to on record, signal: [{kind: kaizen, ref: 08-legal-compliance.md}], delivering: no, evidence: "gap: no clickwrap acceptance record; no counsel sign-off", universal: true, cluster: legal-floor}
  - stage: activation
    micro_moments:
      - id: real-estate.activation.connect
        moment: broker connects FUB/email in the first sitting
        wants:
          - {id: real-estate.activation.connect.1, want: connect Follow Up Boss and see triage in 5 minutes, signal: [{kind: audit, ref: 05-connectors.md P1-5}], delivering: no, evidence: "gap: api-key Connect CTA dead-ends in false OAuth error", universal: false, cluster: activation-blockers}
          - {id: real-estate.activation.connect.2, want: know what data you touch before I connect, signal: [{kind: audit, ref: 05-connectors.md P0-2}], delivering: no, evidence: "gap: tile Connect bypasses #306 disclosure", universal: true, cluster: data-story}
          - {id: real-estate.activation.connect.3, want: connect email and calendar, signal: [{kind: code, ref: lib/integrations/marketplace.ts GOOGLE M365}], delivering: yes, evidence: OAuth live; truthful Gmail state PR282, universal: true}
          - {id: real-estate.activation.connect.4, want: see a first drafted reply in Approvals, signal: [{kind: code, ref: PR303 killer workflow}], delivering: partial, evidence: deterministic runtime fires on synthetic; blocked live by connect.1, universal: false, cluster: activation-blockers}
          - {id: real-estate.activation.connect.5, want: invite my agents without lockout risk, signal: [{kind: audit, ref: 10-team-admin-settings.md P1-13}], delivering: partial, evidence: invited-owner counted by last-owner guard, universal: true}
          - {id: real-estate.activation.connect.6, want: no blank tabs while loading, signal: [{kind: audit, ref: 03-workspace-shell.md F1 F2}], delivering: partial, evidence: Connections/Reports missing loading.tsx, universal: true, cluster: shell-polish}
  - stage: daily-use
    micro_moments:
      - id: real-estate.daily-use.morning
        moment: the morning check-in and approval pass (BO-1)
        wants:
          - {id: real-estate.daily-use.morning.1, want: morning briefing on fleet activity, signal: [{kind: code, ref: briefing-generator cron}, {kind: doc, ref: JTBD BO-1}], delivering: yes, evidence: Inngest briefing cron live, universal: true}
          - {id: real-estate.daily-use.morning.2, want: be told when something needs approval, signal: [{kind: audit, ref: 04-approvals-plaino-chat.md F-1}], delivering: partial, evidence: push on ~1/8 creation paths, universal: true, cluster: approval-loop}
          - {id: real-estate.daily-use.morning.3, want: approve comfortably on phone, signal: [{kind: audit, ref: 03-workspace-shell.md F4}], delivering: partial, evidence: sub-44px touch targets, universal: true, cluster: shell-polish}
          - {id: real-estate.daily-use.morning.4, want: reject with a reason so it learns, signal: [{kind: audit, ref: 04-approvals-plaino-chat.md F-3}], delivering: no, evidence: "gap: web reject has no reason field", universal: true, cluster: approval-loop}
          - {id: real-estate.daily-use.morning.5, want: never lose queued approvals, signal: [{kind: audit, ref: 04-approvals-plaino-chat.md F-2}], delivering: no, evidence: "gap: silent 50-cap truncation", universal: true, cluster: approval-loop}
          - {id: real-estate.daily-use.morning.6, want: compliance flags on in-flight listings, signal: [{kind: code, ref: lib/agents/sentinel/corpus/real-estate}, {kind: doc, ref: JTBD BO-2}], delivering: yes, evidence: live realty sentinel with verified fair-housing rule, universal: false}
          - {id: real-estate.daily-use.morning.7, want: ask the fleet anything, signal: [{kind: code, ref: PR154 chat}], delivering: yes, evidence: Plaino chat live, universal: true}
          - {id: real-estate.daily-use.morning.8, want: honest experience when AI is paused, signal: [{kind: code, ref: PR276 degraded banner}, {kind: memory, ref: prod key paused policy}], delivering: yes, evidence: universal banner + 0-LLM killer workflow, universal: true}
          - {id: real-estate.daily-use.morning.9, want: know where my data lives in my vocabulary, signal: [{kind: audit, ref: 04 F-5 and 05 P0-3 P1-4}], delivering: no, evidence: "gap: two-bucket story unmerged; vendor named on customer surface", universal: true, cluster: data-story}
  - stage: expansion
    micro_moments:
      - id: real-estate.expansion.roster
        moment: broker wants the rest of the roster working
        wants:
          - {id: real-estate.expansion.roster.1, want: CRM hygiene / production reports / recruiting help, signal: [{kind: code, ref: content.ts roster 5-of-8 rooting}], delivering: no, evidence: "gap: awaits CRM/MLS connectors (kvCORE, BoldTrail, FMLS/GAMLS)", universal: false, cluster: rooting-roster}
          - {id: real-estate.expansion.roster.2, want: a portal my clients can use, signal: [{kind: audit, ref: 06-customer-portal.md PORTAL-1..14}], delivering: no, evidence: "gap: 5 P0s; 0%-activatable", universal: true, cluster: portal}
          - {id: real-estate.expansion.roster.3, want: grow seats without price surprise, signal: [{kind: code, ref: lib/pricing/tiers.ts}], delivering: yes, evidence: explicit seat bands, universal: true}
  - stage: renewal
    micro_moments:
      - id: real-estate.renewal.worth-it
        moment: the "is this worth $199/mo" evaluation
        wants:
          - {id: real-estate.renewal.worth-it.1, want: see the time actually saved, signal: [{kind: audit, ref: 09-guarantee.md P0-1 P1-2}], delivering: no, evidence: "gap: 3/7 actions write saved-time; sweeps zero; counter not live", universal: true, cluster: guarantee-integrity}
          - {id: real-estate.renewal.worth-it.2, want: a guarantee that pays out fairly both ways, signal: [{kind: audit, ref: 09-guarantee.md P0-1 P1-1}], delivering: no, evidence: "gap: undercount triggers wrongful refunds; unbounded sweep age", universal: true, cluster: guarantee-integrity}
          - {id: real-estate.renewal.worth-it.3, want: cancel and truly be deleted, signal: [{kind: audit, ref: 02-auth.md P1-7 and 10 P0-1 P0-2}], delivering: no, evidence: "gap: portal tables + tickets survive close; claim overreaches", universal: true, cluster: data-story}
  - stage: advocacy
    micro_moments:
      - id: real-estate.advocacy.refer
        moment: broker considers telling peers
        wants:
          - {id: real-estate.advocacy.refer.1, want: a referral motion worth my reputation, signal: [{kind: kaizen, ref: 05-sales.md}], delivering: no, evidence: "gap: no referral mechanism or proof ladder", universal: true, cluster: founder-motion}
          - {id: real-estate.advocacy.refer.2, want: agentplain sends outreach for me, signal: [{kind: memory, ref: project_no_outbound_architecture}], delivering: not-in-scope, evidence: ratified no-outbound architecture, universal: true}
```

## Cross-vertical clusters observed

know-what-i-am-buying · provable-claims · guarantee-integrity ·
activation-blockers · approval-loop · data-story · auth-reliability ·
shell-polish · portal · founder-motion · legal-floor · real-signal ·
rooting-roster — sibling maps this run: real-estate--individual-agent,
cpa--partner-owner, cpa--staff-accountant.
