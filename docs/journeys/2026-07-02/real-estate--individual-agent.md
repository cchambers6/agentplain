# Journey map — real-estate / individual-agent

**Run date:** 2026-07-02 · **Produced by:** claude-fable-5 (pass-1 seed) · **Schema:** v1

## Persona

Producing agent inside a workspace a broker-owner bought — an invited seat, not
the buyer. Mobile-first; today re-types reply drafts out of Outlook, runs
manual MLS queries, and discovers compliance flags after submission. Sourced
from the ratified Phase 0 JTBD table
(`lib/verticals/real-estate/content.ts:114-209`, jobs IA-1..IA-6); same caveat
as the broker-owner map — analyst-derived, zero observed customers
(`persona_source` carries the standing `real-estate.awareness.persona-research`
gap from the sibling map).

## Stage-by-stage map

The buying stages (awareness, consideration) are thin for this persona — the
broker buys; the agent's journey effectively starts at the invite. Awareness
is kept as one moment because agent buy-in decides whether the seat gets used.

### awareness

**re-ia.aw.1 — "my broker just added me to something"**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| A one-screen explanation of what this does for *me* (not the broker) | todo-real-signal | no | gap: no invited-seat onboarding surface distinct from the buyer flow |
| Reassurance it isn't surveillance of my production | doc: JTBD IA-6 (production vs median is a listed job) | partial | production comparison is a designed feature; no framing exists telling the agent how it will and won't be used |

### signup

**re-ia.si.1 — accepting the invite**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Invite email that survives my corporate inbox | audit: 02-auth.md P1-5 | partial | magic-link-on-GET pattern; scanners can consume it |
| Sign in fast on my phone every day after | code: PR #270 stay-signed-in, PR #268 passkeys | yes | 30-day session + passkey hints shipped |
| My access to end when I leave the brokerage — everywhere | audit: 02-auth.md P1-1/P1-2/P1-3 | no | gap: no server-side revocation; sealed cookie valid 30 days after removal; no per-device sign-out |

### activation

**re-ia.ac.1 — first week in the workspace**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| See my own priorities on open (IA-1) | doc: JTBD IA-1; code: Today tab (PR #288 5-tab IA) | partial | Today tab exists; per-agent scoping vs workspace-wide view unverified in any audit — needs a verdict next run |
| Grab a drafted reply from my phone in seconds (IA-2) | code: PR #303 runtime; audit: 03-workspace-shell.md F4 | partial | drafts exist in Approvals; sub-44px targets make the core mobile action clumsy |
| Trust it in front of a client | code: PR #276 degraded banner | yes | deterministic drafts + honest degraded state |

### daily-use

**re-ia.du.1 — working listings and buyers**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Compliance flags *before* MLS submission (IA-3) | code: lib/agents/sentinel/corpus/real-estate; JTBD IA-3 | partial | sentinel fires on inbox compliance-check work; pre-MLS-submission checkpoint depends on MLS/transaction connectors that are `rooting` |
| Ratify per-listing recommendations (IA-4) | doc: JTBD IA-4; code: approvals queue | partial | approvals surface exists; per-listing grouping/audit view (BO-5 sibling) not built |
| Ask the fleet from a thread (IA-5) | code: PR #154 chat | yes | Plaino chat live |
| Get notified when a draft is waiting | audit: 04-approvals-plaino-chat.md F-1 | partial | 1-of-8 creation paths push; an agent who isn't notified re-types from Outlook again — the exact behavior we sell against |
| Reject a bad draft with a reason, from web too | audit: 04-approvals-plaino-chat.md F-3 | no | gap: web reject has no reason field |
| Not lose my older queued items | audit: 04-approvals-plaino-chat.md F-2 | no | gap: 50-cap silent truncation |
| See my production vs workspace median (IA-6) | code: content.ts roster — production-reporter `rooting` | no | gap: awaits MLS feed; no interim manual-entry version |

### expansion

**re-ia.ex.1 — becoming an internal champion**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| More of my tools connected (CRM, transaction mgmt) | code: marketplace.ts (dotloop/Skyslope planned Q3) | no | gap: rooting roster; same blocker as broker map |
| Tell my broker what's working | kaizen: 09-data-analytics.md | no | gap: zero product analytics — no per-agent usage or outcome surface to point at |

### renewal

**re-ia.re.1 — the seat-retention moment (renewal is the broker's, usage is mine)**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| The tool visibly saving me hours, so I defend the seat | audit: 09-guarantee.md P0-1 | no | gap: saved-time writers cover 3/7 actions; an agent's sweep-driven work counts as zero |

### advocacy

**re-ia.ad.1 — agent-to-agent word of mouth**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Something concrete to show agents at other brokerages | kaizen: 05-sales.md | no | gap: no shareable artifact, demo, or proof; word-of-mouth motion has nothing to carry |

## Machine block

```yaml
vertical: real-estate
persona: individual-agent
persona_source: lib/verticals/real-estate/content.ts:114-209 (ratified JTBD IA-1..IA-6; not observed-customer)
run_date: 2026-07-02
produced_by: claude-fable-5
stages:
  - stage: awareness
    micro_moments:
      - id: real-estate-ia.awareness.invited
        moment: agent learns their broker added them to agentplain
        wants:
          - {id: real-estate-ia.awareness.invited.1, want: one-screen explanation of what this does for me, signal: [{kind: todo-real-signal, ref: no invited-seat onboarding exists}], delivering: no, evidence: "gap: no seat-holder onboarding distinct from buyer flow", universal: true, cluster: invited-seat-onboarding}
          - {id: real-estate-ia.awareness.invited.2, want: reassurance it is not production surveillance, signal: [{kind: doc, ref: JTBD IA-6}], delivering: partial, evidence: comparison feature designed with no usage framing, universal: true, cluster: invited-seat-onboarding}
  - stage: signup
    micro_moments:
      - id: real-estate-ia.signup.accept-invite
        moment: agent accepts the workspace invite
        wants:
          - {id: real-estate-ia.signup.accept-invite.1, want: invite email that survives my corporate inbox, signal: [{kind: audit, ref: 02-auth.md P1-5}], delivering: partial, evidence: magic-link-on-GET scanner burn, universal: true, cluster: auth-reliability}
          - {id: real-estate-ia.signup.accept-invite.2, want: fast daily sign-in on phone, signal: [{kind: code, ref: PR270 PR268}], delivering: yes, evidence: 30d session + passkeys, universal: true, cluster: auth-reliability}
          - {id: real-estate-ia.signup.accept-invite.3, want: access ends everywhere when I leave, signal: [{kind: audit, ref: 02-auth.md P1-1 P1-2 P1-3}], delivering: no, evidence: "gap: no server-side revocation; 30d cookie survives removal", universal: true, cluster: auth-reliability}
  - stage: activation
    micro_moments:
      - id: real-estate-ia.activation.first-week
        moment: first week working inside the workspace
        wants:
          - {id: real-estate-ia.activation.first-week.1, want: see my own priorities on open, signal: [{kind: doc, ref: JTBD IA-1}, {kind: code, ref: PR288 Today tab}], delivering: partial, evidence: Today tab live; per-agent scoping unverified — verdict needed next run, universal: false}
          - {id: real-estate-ia.activation.first-week.2, want: grab a drafted reply from my phone in seconds, signal: [{kind: code, ref: PR303}, {kind: audit, ref: 03-workspace-shell.md F4}], delivering: partial, evidence: drafts exist; sub-44px targets, universal: false, cluster: shell-polish}
          - {id: real-estate-ia.activation.first-week.3, want: trust it in front of a client, signal: [{kind: code, ref: PR276}], delivering: yes, evidence: deterministic drafts + honest degraded state, universal: true}
  - stage: daily-use
    micro_moments:
      - id: real-estate-ia.daily-use.working
        moment: working listings and buyer threads through the day
        wants:
          - {id: real-estate-ia.daily-use.working.1, want: compliance flags before MLS submission, signal: [{kind: doc, ref: JTBD IA-3}, {kind: code, ref: sentinel corpus real-estate}], delivering: partial, evidence: inbox-loop flags live; pre-submission checkpoint needs rooting connectors, universal: false, cluster: rooting-roster}
          - {id: real-estate-ia.daily-use.working.2, want: ratify per-listing recommendations, signal: [{kind: doc, ref: JTBD IA-4}], delivering: partial, evidence: approvals live; per-listing grouping unbuilt, universal: false, cluster: approval-loop}
          - {id: real-estate-ia.daily-use.working.3, want: ask the fleet from a thread, signal: [{kind: code, ref: PR154}], delivering: yes, evidence: Plaino chat live, universal: true}
          - {id: real-estate-ia.daily-use.working.4, want: get notified when a draft waits, signal: [{kind: audit, ref: 04-approvals-plaino-chat.md F-1}], delivering: partial, evidence: 1/8 paths push, universal: true, cluster: approval-loop}
          - {id: real-estate-ia.daily-use.working.5, want: reject with a reason from web, signal: [{kind: audit, ref: 04-approvals-plaino-chat.md F-3}], delivering: no, evidence: "gap: no web reason field", universal: true, cluster: approval-loop}
          - {id: real-estate-ia.daily-use.working.6, want: not lose older queued items, signal: [{kind: audit, ref: 04-approvals-plaino-chat.md F-2}], delivering: no, evidence: "gap: silent 50-cap", universal: true, cluster: approval-loop}
          - {id: real-estate-ia.daily-use.working.7, want: production vs workspace median, signal: [{kind: doc, ref: JTBD IA-6}, {kind: code, ref: production-reporter rooting}], delivering: no, evidence: "gap: awaits MLS feed; no interim version", universal: false, cluster: rooting-roster}
  - stage: expansion
    micro_moments:
      - id: real-estate-ia.expansion.champion
        moment: agent becomes (or fails to become) an internal champion
        wants:
          - {id: real-estate-ia.expansion.champion.1, want: more of my tools connected, signal: [{kind: code, ref: marketplace.ts dotloop skyslope planned}], delivering: no, evidence: "gap: rooting roster", universal: false, cluster: rooting-roster}
          - {id: real-estate-ia.expansion.champion.2, want: show my broker what is working, signal: [{kind: kaizen, ref: 09-data-analytics.md}], delivering: no, evidence: "gap: zero product analytics", universal: true, cluster: value-visibility}
  - stage: renewal
    micro_moments:
      - id: real-estate-ia.renewal.defend-seat
        moment: broker reviews seats; agent decides whether to defend theirs
        wants:
          - {id: real-estate-ia.renewal.defend-seat.1, want: visible hours saved so I defend the seat, signal: [{kind: audit, ref: 09-guarantee.md P0-1}], delivering: no, evidence: "gap: sweep work counts zero minutes", universal: true, cluster: guarantee-integrity}
  - stage: advocacy
    micro_moments:
      - id: real-estate-ia.advocacy.word-of-mouth
        moment: agent talks shop with agents at other brokerages
        wants:
          - {id: real-estate-ia.advocacy.word-of-mouth.1, want: something concrete to show peers, signal: [{kind: kaizen, ref: 05-sales.md}], delivering: no, evidence: "gap: no shareable artifact or demo", universal: true, cluster: founder-motion}
```

## Cross-vertical clusters observed

invited-seat-onboarding (new this map — every multi-seat vertical will have
it) · auth-reliability · approval-loop · shell-polish · rooting-roster ·
guarantee-integrity · value-visibility · founder-motion.
