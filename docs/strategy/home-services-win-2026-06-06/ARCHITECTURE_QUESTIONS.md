# Architecture questions — the calls only Conner makes

**Date:** 2026-06-06
**Rule under examination:** `~/memory/project_no_outbound_architecture.md` (no-outbound,
ratified 2026-05-06). It is LOAD-BEARING. This document does **not** propose changing it.
It surfaces, crisply, the places where the supplement wedge presses on the rule's edges so
Conner can rule — not me.

The brief is explicit: "If the home-services wedge requires sharpening or extending the
architecture … surface the question crisply. Conner makes the call, not you. Don't
silently expand the rule." So each item below ends with a **proposed answer that keeps the
rule intact**, plus the alternative, and a clear "your call" marker.

---

## Q1 — Is a supplement sent to an insurance carrier "outbound communication"?

**The tension.** The no-outbound rule forbids agentplain from reaching out — "email, SMS,
voice, calendar invite … any reaching out would be on their system." The rule's examples
are all *customer/consumer* outreach (TCPA, CAN-SPAM). A supplement goes to an **insurance
adjuster** — a B2B counterparty in an active claim, not a marketing/sales contact.

**Why it matters.** If "send the supplement to the carrier" counts as forbidden outbound,
the wedge's last mile (submission + the cadence in `PRODUCT_SPEC.md` Slice 4) must stay
fully in the contractor's email — which is fine, but we should say so deliberately rather
than discover it later.

**Proposed answer (keeps the rule intact):** Treat carrier submission exactly like every
other outbound — **agentplain drafts; the contractor's own email/portal sends.** A
supplement is a document the *owner signs and routes*, which is the rule's native shape.
We do NOT build a "submit to State Farm" button inside agentplain. The compliance logic
(`project_no_outbound_architecture.md`: "what agentplain does at draft time" vs. "what the
customer's system must do before sending" as distinct columns) maps cleanly: agentplain
produces the supplement + evidence binder; the customer's system transmits it.

**Alternative (would require sharpening the rule):** Define a narrow carve-out —
"transactional B2B claim correspondence within an active claim the customer initiated is
not consumer outreach and may be transmitted by agentplain." This is *defensible*
(it's not TCPA/CAN-SPAM territory) but it cracks the door on "agentplain transmits," which
is the thing the rule was built to prevent. **Recommendation: do not take the carve-out.**
The draft-and-route path delivers the full wedge value without it.

> **Your call, Conner:** confirm carrier submission stays draft-and-route (recommended),
> or open a transactional-B2B carve-out.

---

## Q2 — Carrier-portal *writes* vs. carrier-portal *reads*

**The tension.** Some carriers/estimating platforms accept supplements via a portal or
API, not email. Reading claim/scope status from such a portal is a READ (allowed —
"webhooks back into customer CRM = allowed," reads are core). *Writing* the supplement
into the portal is the same act as Q1 in a different channel.

**Proposed answer (keeps the rule intact):** **Reads yes, writes no.** agentplain may pull
the adjuster scope and claim status from a carrier/Xactimate surface (READ). The write —
submitting the supplement into the portal — executes from the customer's authenticated
session with the customer's credentials, not agentplain's. If a portal has no
customer-side automation, the contractor submits manually from our draft. This is the
exact same line as Q1, applied to API/portal channels.

> **Your call, Conner:** confirm "carrier-portal reads allowed, writes are
> customer-executed" (recommended), consistent with Q1.

---

## Q3 — Whose credentials/keys touch Xactimate (Verisk)?

**The tension.** This is not a no-outbound question; it's a portability + lock-in
question, but the wedge can't be scoped without an answer. Xactimate/Symbility (Verisk)
API access is **gated and not currently held** — there is no `available` Verisk connector
in `lib/integrations/marketplace.ts`, and `PRODUCT_SPEC.md` flags Verisk API access as the
L-effort unknown. The interim seam is **file upload (PDF/ESX export)**, which needs no
Verisk relationship at all.

**Why it matters.** If we wait on a Verisk partnership, the wedge stalls. If we ship on the
upload seam, the wedge ships now and the live integration becomes an upgrade.

**Proposed answer:** Ship Slice 1 on the **upload seam** (no Verisk dependency), behind a
`ScopeReader` port with PDF + ESX implementations. Pursue Verisk API access in parallel as
a *later* `ScopeReader` implementation, not a prerequisite. This honors the adapter rule
(`~/memory/feedback_runner_portability.md`) — the live API is just a third implementation
of a port we already shipped against files.

> **Your call, Conner:** confirm upload-seam-first (recommended), and whether to open a
> Verisk partnership conversation now or after roofing proves out.

---

## Q4 — Is "advising on the homeowner's claim" unauthorized practice / public adjusting?

**The tension.** This is a **compliance question, not an architecture one**, but it gates
how we word the wedge and must reach counsel before GTM. In many states, negotiating an
insurance claim *on the homeowner's behalf for a fee* is regulated **public adjusting** and
requires a license. A contractor writing a supplement for *their own scope of work* is
generally not public adjusting — but the line varies by state, and our copy must not imply
we (or the contractor) are adjusting the homeowner's claim.

**Proposed answer:** Scope every supplement draft as **the contractor's own scope of
work**, never "we negotiate your insurance claim for you." Route the public-adjusting
boundary to counsel as a new Sentinel corpus question for home-services (the corpus already
flags adjacent issues — `outputs/counsel-handoff-packets/home-services.md`). Sentinel stays
dark on this vertical until `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` flips
(`~/memory/project_compliance_corpus_lives_in_sentinel.md`).

> **Your call, Conner:** confirm we route the public-adjusting / unauthorized-practice
> boundary to counsel before any supplement GTM copy ships, and keep all copy framed to
> the contractor's own scope (recommended).

---

## What is NOT in question

- The no-outbound rule itself. Nothing in the wedge requires repealing or broadening it.
  The recommended answers to Q1–Q2 keep agentplain firmly on the draft-and-advise side.
- The adapter/portability rules. Q3's upload-seam approach is the *most* portable path.
- Brand/positioning locks. The wedge sharpens the existing home-services positioning; it
  does not rename or reposition (`~/memory/project_brand_locked.md`).

**Net:** the wedge is buildable today without changing a single locked rule. Q1–Q4 are
confirmations, not amendments. The one genuinely external dependency is Verisk API access
(Q3), and the upload seam routes around it.
