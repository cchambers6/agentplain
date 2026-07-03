# flatsbo hygiene minimum — reduce exposure without going dark

Date: 2026-07-03. Context: the 07-02 audit synthesis called the live flatsbo site a
net liability (open PII surface, unauthorized broker/entity advertising, no privacy
policy, dead funnel) and recommended waitlist-dark. **Conner overrode: flatsbo stays
live.** This document is the minimum change set that respects the override while
cutting the worst exposure. It is scoped to roughly one fleet-day of work in the
flatsbo repo (`C:\flatsbo`) and zero new features.

Predicate facts (from flatsbo memory, `conner_personal_tasks`): entity, GA
salesperson license, and broker partnership are all OPEN, only-Conner items. Nothing
below may assume any of the three exists.

## The minimum (in order; all four, not a menu)

**1. Publish a privacy notice and link it from the footer.**
A live site collecting seller/buyer contact information and property details with
no privacy policy is the single cheapest fix on the list. One static page: what is
collected (contact info, listing details, offer details), why, that it is not sold,
retention until account/listing deletion or on request, a contact email for
access/deletion requests (GA has no comprehensive privacy statute, but out-of-state
visitors and basic FTC unfair/deceptive exposure make this table stakes). No
compliance badges, no "GDPR/CCPA compliant" claims — just the honest facts.

**2. Remove or disclaim every brokerage/licensure implication.**
Until the GA license and broker partnership close, the site must not state or imply
that flatsbo is a brokerage, employs agents, or represents buyers or sellers.
Sweep for: "broker," "agent," "we represent," "our agents," MLS claims, and any
copy implying licensed activity. Add one standing disclaimer near the footer and on
the sell-flow entry:
> "FlatSBO is a for-sale-by-owner listing platform. FlatSBO is not a real estate
> brokerage, does not employ or supervise real estate agents, and does not
> represent buyers or sellers in any transaction."
Unauthorized-practice and license-law exposure (GA real-estate license law) is the
sharpest edge on the audit's list; a listing *platform* posture is defensible, a
brokerage posture without a license is not.

**3. Entity-naming honesty.**
No "Inc.," "LLC," or invented company name anywhere on the site, in the ToS, or in
email footers until the entity exists. Identify the operator honestly (the site may
say "FlatSBO" as a brand/d.b.a. and provide the contact email); the moment Conner's
entity decision closes, fill the real name in the same one-PR sweep as agentplain's
(doc 03, item 1).

**4. Close the open PII surface.**
The audit flagged PII reachable without auth. Minimum: require authentication on
any endpoint returning seller/buyer contact data, and verify with one manual pass
that listing pages expose only what a public FSBO listing must (property facts;
seller contact only behind whatever gate the product intends). This is the one
engineering item in the set; the CEO memo sized the API lock at ~two days and it is
the only item here that can leak strangers' data while we deliberate.

## Also true, but explicitly out of minimum scope

- **$499-on-close fee terms:** the fee's trigger, timing, and cancellation terms
  should be stated on one page before the next real listing signs up — flagged for
  the flatsbo backlog, not blocking this hygiene pass (the funnel is currently
  dead per the audit, so exposure is prospective).
- **flatsbo ToS refresh, escrow/earnest-money language, offer-flow disclaimers:**
  real work, needs counsel, belongs to the (paused) flatsbo track per
  `project_agentplain_is_priority`.
- **Any new feature, any marketing push:** the override keeps the site live; it
  does not reopen the flatsbo roadmap.

## Verification and counsel touch

- Each of items 1–4 verified by screenshot attached to the flatsbo PR; item 4
  additionally by an unauthenticated curl against the previously-open endpoints.
- Counsel packet item 3.4 asks counsel to confirm this minimum is a sufficient
  interim posture *given the stay-live override* — that confirmation, or a
  stricter instruction, closes the loop Conner's override opened.
- Standing review: the flatsbo predicate (entity / license / broker partnership)
  gets re-checked at each counsel session via packet item 1.4 so the parked state
  stops silently aging (kaizen friction #2).
