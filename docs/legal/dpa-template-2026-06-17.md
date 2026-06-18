# Data Processing Agreement (DPA) — TEMPLATE

> **STATUS: DRAFT — NOT COUNSEL-REVIEWED. DO NOT SEND TO A CUSTOMER FOR SIGNATURE
> UNTIL OUTSIDE COUNSEL HAS REVIEWED AND APPROVED.** This template restates, in
> contract form, the data-minimization commitments already published on
> `/data`, `/privacy`, `/security`, and `/terms`. It is grounded in the
> architecture actually in production (AES-256-GCM at rest, per-workspace RLS,
> read/draft OAuth scopes, no-training tier, export + closure-cascade deletion).
> Every bracketed `[…]` is a fill-in or a counsel decision.

---

## Parties

This Data Processing Agreement ("DPA") supplements the agentplain Terms of
Service between **agentplain** ("Processor") and **[Customer legal name]**
("Controller") (together, the "Parties"), effective **[date]**.

Where this DPA conflicts with the Terms of Service on the subject of personal
data processing, this DPA controls.

## 1. Roles and instructions

1.1 The Controller determines the purposes and means of processing the personal
data it connects to or uploads into its workspace. The Processor acts solely as
a data processor on the Controller's documented instructions, which are: to
deliver the agentplain service (read connected systems, categorize, coordinate,
schedule, and draft customer-facing outputs for the Controller's review).

1.2 The Processor will not process the personal data for any other purpose. In
particular, the Processor will not use the personal data to train any machine-
learning model, will not pool it across customers, and will not sell or share it
except with the subprocessors listed in Annex B as needed to operate the
service.

## 2. Data minimization

2.1 The Processor retains only the data necessary to deliver the service:
(a) drafts queued for the Controller's review; (b) an append-only audit
(handoff) log of actions taken; (c) documents the Controller chooses to connect
as a knowledge source; (d) an encrypted copy of OAuth/connection tokens;
(e) the Controller's account and configuration; and (f) an append-only log of
the Controller's edits to drafts.

2.2 The Processor does **not** retain a standing copy or mirror of the
Controller's connected systems (mailbox, CRM, accounting ledger, message
history). The service reads what a task requires on demand and writes results
back to the Controller's own systems.

## 3. Security measures

The Processor maintains the technical and organizational measures described on
its public security page, including at minimum: encryption at rest (AES-256-GCM)
and in transit (TLS 1.2+); per-workspace row-level security isolation in the
primary database; OAuth scope minimization (no send-on-behalf scopes on email);
append-only audit logging; and access controls gated behind multi-factor
authentication. (See Annex A.)

## 4. Subprocessors

4.1 The Controller authorizes the Processor to engage the subprocessors listed
in Annex B, each bound by data-protection terms no less protective than this
DPA.

4.2 The Processor will give the Controller notice of any intended addition or
replacement of a subprocessor at least **[30]** days in advance, during which
the Controller may object on reasonable data-protection grounds.

## 5. Breach notification

The Processor will notify the Controller without undue delay, and in any event
within **[72]** hours of confirming the scope of a personal-data breach
affecting the Controller's data, with the information then available and updates
as the investigation proceeds. (Aligned with the public security page's
incident-response windows.)

## 6. Data subject requests

The Processor will provide reasonable assistance — through the in-product export
and deletion controls and otherwise — to enable the Controller to respond to
data-subject requests (access, correction, deletion, portability).

## 7. Return and deletion

7.1 The Controller may export a complete copy of its workspace data at any time
from the product.

7.2 On workspace closure or written request, the Processor will hard-delete the
Controller's customer-data rows after the soft-delete grace window stated in the
Terms, retaining only invoice records and a minimal closure-audit entry as
required for tax and compliance. Encrypted backups roll off within **[30]** days.

## 8. Audit

The Processor will make available information reasonably necessary to
demonstrate compliance with this DPA and will allow for and contribute to audits
**[scope/frequency — counsel to set]**.

## 9. International transfers

**[Counsel to complete — SCCs / UK Addendum / DPF as applicable. agentplain
hosts in [region]; the model-inference subprocessor processes in [region].]**

## 10. Liability; term; governing law

This DPA is subject to the liability cap, term, and governing-law provisions of
the Terms of Service (State of Georgia), except where applicable data-protection
law requires otherwise.

---

## Annex A — Technical and organizational measures
Encryption at rest (AES-256-GCM, per-environment key in the hosting secrets
store); encryption in transit (TLS 1.2+); per-workspace RLS isolation; OAuth
scope minimization; append-only audit logging; MFA-gated production access;
daily encrypted backups with point-in-time recovery, rolled off after 30 days.

## Annex B — Subprocessors
The current list published in the agentplain privacy policy (model inference on
a no-training tier; database hosting; application hosting; payment processing;
transactional email; error monitoring with PII scrubbing; event/cron
orchestration). **[Keep in sync with `/privacy`.]**

## Annex C — Details of processing
- **Subject matter:** delivery of the agentplain managed AI service.
- **Duration:** the term of the subscription plus the deletion windows in §7.
- **Nature/purpose:** read, categorize, coordinate, schedule, draft.
- **Data subjects:** the Controller's clients, contacts, employees, and counterparties.
- **Categories of data:** contact details, communications content, transaction/document
  metadata, and any personal data within connected documents — as determined by
  the Controller's connections and uploads.

---

### Open counsel decisions (carried to TODOS-FOR-CONNER)
1. Which tiers receive a DPA at no charge vs. Partner+/Custom only.
2. International-transfer mechanism (§9) — SCCs / DPF.
3. Audit scope and frequency (§8).
4. Final breach-notification window (§5) — align to security page.
