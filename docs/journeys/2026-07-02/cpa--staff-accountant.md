# Journey map — cpa / staff-accountant

**Run date:** 2026-07-02 · **Produced by:** claude-fable-5 (pass-1 seed) · **Schema:** v1

## Persona

Staff accountant / tax preparer at a small firm — an invited seat the partner
bought. Owns engagement checklists, the 8-week document-chase cadence, and
books reconciliation; during season works 80-hour weeks of which ~25% is
chasing clients for documents. Sourced from the ratified JTBD table
(`lib/verticals/cpa/content.ts:122-257`, staff role); analyst-derived, zero
observed customers. The remaining CPA roles (audit senior, client-services
manager, admin) are not mapped this run — deferred to the first scheduled
weekly pass.

## Stage-by-stage map

Awareness/consideration are the partner's; this journey starts at the invite,
mirroring the real-estate individual-agent map (cluster:
invited-seat-onboarding).

### awareness

**cpa-sa.aw.1 — "the partner bought us an AI thing"**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Know what it takes off my plate, in prep-room vocabulary | todo-real-signal | no | gap: no invited-seat onboarding; customer-vocab rule exists (PR #249) but no staff-facing intro surface |
| Know it won't draft nonsense to my clients under my name | code: PR #280 gate pattern; code: approvals queue | partial | approval-before-send holds; nothing explains this guarantee to the staff seat |

### signup

**cpa-sa.si.1 — accepting the invite during season**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Invite that works first click | audit: 02-auth.md P1-5 | partial | magic-link-on-GET scanner burn |
| Fast repeat sign-in | code: PR #268/#270 | yes | passkeys + 30-day session |
| Access revoked everywhere when I leave the firm | audit: 02-auth.md P1-1/P1-3 | no | gap: no server-side revocation; client-data access lingering 30 days is a confidentiality problem, not just hygiene |

### activation

**cpa-sa.ac.1 — first engagement set up with the tool**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Build an engagement checklist fast (staff JTBD) | code: cpa-onboarding `rooting` | no | gap: blocked on practice-mgmt connector (05-connectors.md P0-1) |
| Start a doc-chase cadence and stop hand-sending reminders | code: cpa-doc-chase `rooting`; doc: value-loop example content.ts:310-319 | no | gap: the single biggest staff JTBD is blocked on the same connector; the "March 17" value-loop story we tell is not yet achievable live |
| See drafted chase messages before they go | code: approvals queue + no-outbound architecture | yes | drafts queue for approval; customer system sends |

### daily-use

**cpa-sa.du.1 — season grind: chase, reconcile, respond**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Doc-chase runs its 8-week cadence itself | code: cpa-doc-chase `rooting` | no | gap: connector-blocked (same as ac.1) |
| Books reconciliation prep (staff JTBD) | code: cpa-books-recon `rooting`; QBO connector live | partial | QBO connects but the recon agent isn't live — data path exists, worker doesn't |
| Client answers drafted for my review | code: cpa-client-inbound live | yes | triage + draft in inbox loop |
| Know when a draft waits for me | audit: 04-approvals-plaino-chat.md F-1 | partial | 1-of-8 paths notify |
| Reject a bad draft with a reason | audit: 04-approvals-plaino-chat.md F-3 | no | gap: no web reason field |
| Trust the compliance net before anything client-facing (Circular 230) | code: sentinel corpus cpa 0-verified | no | gap: CPA sentinel not live; staff bears the professional risk |
| Keep working honestly when AI is paused | code: PR #276 | yes | degraded banner; deterministic loops |

### expansion

**cpa-sa.ex.1 — depending on it beyond season**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Clients upload documents somewhere safe I can see | audit: 06-customer-portal.md PORTAL-5 | no | gap: portal discards uploaded bytes; 0%-activatable |
| Off-season work (books, collections) covered too | code: cpa-books-recon, cpa-collections `rooting` | no | gap: rooting roster |

### renewal

**cpa-sa.re.1 — defending the seat at review time**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Hours-saved evidence tied to my work | audit: 09-guarantee.md P0-1 | no | gap: sweep-driven work writes zero minutes; staff seat looks idle in the ledger |

### advocacy

**cpa-sa.ad.1 — telling classmates at other firms**

| Want | Signal | Delivering? | Evidence |
|---|---|---|---|
| Something I can show without caveats | kaizen: 05-sales.md; audit: 05-connectors.md P0-1 | no | gap: the demo-able story (doc-chase) is exactly the blocked one |

## Machine block

```yaml
vertical: cpa
persona: staff-accountant
persona_source: lib/verticals/cpa/content.ts:122-257 (ratified JTBD, staff role; not observed-customer)
run_date: 2026-07-02
produced_by: claude-fable-5
stages:
  - stage: awareness
    micro_moments:
      - id: cpa-sa.awareness.invited
        moment: staff learns the partner bought agentplain
        wants:
          - {id: cpa-sa.awareness.invited.1, want: know what it takes off my plate in my vocabulary, signal: [{kind: todo-real-signal, ref: no invited-seat onboarding}], delivering: no, evidence: "gap: no staff-facing intro surface", universal: true, cluster: invited-seat-onboarding}
          - {id: cpa-sa.awareness.invited.2, want: know it will not draft nonsense under my name, signal: [{kind: code, ref: PR280 gate + approvals}], delivering: partial, evidence: approval-before-send holds; unexplained to staff, universal: true, cluster: invited-seat-onboarding}
  - stage: signup
    micro_moments:
      - id: cpa-sa.signup.accept
        moment: accepting the invite mid-season
        wants:
          - {id: cpa-sa.signup.accept.1, want: invite that works first click, signal: [{kind: audit, ref: 02-auth.md P1-5}], delivering: partial, evidence: magic-link GET burn, universal: true, cluster: auth-reliability}
          - {id: cpa-sa.signup.accept.2, want: fast repeat sign-in, signal: [{kind: code, ref: PR268 PR270}], delivering: yes, evidence: shipped, universal: true, cluster: auth-reliability}
          - {id: cpa-sa.signup.accept.3, want: access revoked everywhere on departure, signal: [{kind: audit, ref: 02-auth.md P1-1 P1-3}], delivering: no, evidence: "gap: 30d lingering access to client data", universal: true, cluster: auth-reliability}
  - stage: activation
    micro_moments:
      - id: cpa-sa.activation.first-engagement
        moment: setting up the first engagement with the tool
        wants:
          - {id: cpa-sa.activation.first-engagement.1, want: build an engagement checklist fast, signal: [{kind: code, ref: cpa-onboarding rooting}], delivering: no, evidence: "gap: practice-mgmt connector blocked (05 P0-1)", universal: false, cluster: activation-blockers}
          - {id: cpa-sa.activation.first-engagement.2, want: doc-chase cadence replaces hand reminders, signal: [{kind: code, ref: cpa-doc-chase rooting}, {kind: doc, ref: content.ts:310-319 value-loop}], delivering: no, evidence: "gap: biggest staff JTBD blocked on connector; told-story not achievable live", universal: false, cluster: activation-blockers}
          - {id: cpa-sa.activation.first-engagement.3, want: see drafted chase messages before send, signal: [{kind: code, ref: approvals + no-outbound}], delivering: yes, evidence: draft-approve loop, universal: true}
  - stage: daily-use
    micro_moments:
      - id: cpa-sa.daily-use.grind
        moment: season grind of chasing, reconciling, responding
        wants:
          - {id: cpa-sa.daily-use.grind.1, want: doc-chase runs its 8-week cadence itself, signal: [{kind: code, ref: cpa-doc-chase rooting}], delivering: no, evidence: "gap: connector-blocked", universal: false, cluster: activation-blockers}
          - {id: cpa-sa.daily-use.grind.2, want: books reconciliation prep, signal: [{kind: code, ref: cpa-books-recon rooting + QBO live}], delivering: partial, evidence: data path live, worker not, universal: false, cluster: rooting-roster}
          - {id: cpa-sa.daily-use.grind.3, want: client answers drafted for review, signal: [{kind: code, ref: cpa-client-inbound}], delivering: yes, evidence: live, universal: false}
          - {id: cpa-sa.daily-use.grind.4, want: know when a draft waits, signal: [{kind: audit, ref: 04 F-1}], delivering: partial, evidence: 1/8 paths notify, universal: true, cluster: approval-loop}
          - {id: cpa-sa.daily-use.grind.5, want: reject with a reason, signal: [{kind: audit, ref: 04 F-3}], delivering: no, evidence: "gap: no web reason field", universal: true, cluster: approval-loop}
          - {id: cpa-sa.daily-use.grind.6, want: trust the compliance net before client-facing work, signal: [{kind: code, ref: sentinel cpa 0-verified}], delivering: no, evidence: "gap: CPA sentinel not live", universal: false, cluster: compliance-floor}
          - {id: cpa-sa.daily-use.grind.7, want: keep working honestly when AI paused, signal: [{kind: code, ref: PR276}], delivering: yes, evidence: degraded banner, universal: true}
  - stage: expansion
    micro_moments:
      - id: cpa-sa.expansion.depend
        moment: depending on it beyond season
        wants:
          - {id: cpa-sa.expansion.depend.1, want: clients upload documents somewhere safe I can see, signal: [{kind: audit, ref: 06-customer-portal.md PORTAL-5}], delivering: no, evidence: "gap: upload bytes discarded; portal unactivatable", universal: true, cluster: portal}
          - {id: cpa-sa.expansion.depend.2, want: off-season work covered too, signal: [{kind: code, ref: books-recon collections rooting}], delivering: no, evidence: "gap: rooting roster", universal: false, cluster: rooting-roster}
  - stage: renewal
    micro_moments:
      - id: cpa-sa.renewal.defend-seat
        moment: defending the seat at review time
        wants:
          - {id: cpa-sa.renewal.defend-seat.1, want: hours-saved evidence tied to my work, signal: [{kind: audit, ref: 09-guarantee.md P0-1}], delivering: no, evidence: "gap: sweeps write zero minutes", universal: true, cluster: guarantee-integrity}
  - stage: advocacy
    micro_moments:
      - id: cpa-sa.advocacy.classmates
        moment: telling classmates at other firms
        wants:
          - {id: cpa-sa.advocacy.classmates.1, want: something I can show without caveats, signal: [{kind: kaizen, ref: 05-sales.md}, {kind: audit, ref: 05-connectors.md P0-1}], delivering: no, evidence: "gap: demo-able story is the blocked one", universal: true, cluster: founder-motion}
```

## Cross-vertical clusters observed

invited-seat-onboarding (confirmed cross-vertical with
real-estate--individual-agent → 2 verticals, `universal` flips true at 3) ·
auth-reliability · activation-blockers · approval-loop · compliance-floor ·
rooting-roster · portal · guarantee-integrity · founder-motion.
