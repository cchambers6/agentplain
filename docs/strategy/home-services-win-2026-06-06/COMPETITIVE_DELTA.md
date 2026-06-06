# Competitive delta — agentplain vs. Hatch, ServiceTitan AI, Rilla on the supplement wedge

**Date:** 2026-06-06
**Depends on:** `WEDGE.md`. The point of this doc: show that on the wedge we chose
(supplement & claims-documentation depth), the named competitors are not actually
competing — they are playing different squares. The "delta" is mostly empty field.

**Sourcing note** (`~/memory/feedback_no_guesses_no_estimates.md`): the competitor
*category* assignments below come from the internal watchlist
(`docs/agent-interviews/02-vertical-agents.md:179`) and the brief's competitive read.
Where a specific product capability is asserted I mark it `[watchlist]` (from our internal
roster doc) or `[brief]` (from the competitive audit read in the task). Live vendor
feature claims should be re-verified against each vendor's current site before this goes
into customer-facing collateral — this is an internal strategy doc, not published copy.

---

## The squares each player occupies

| Player | Square they own | Where they sit in the job | Source |
| --- | --- | --- | --- |
| **Hatch** | Speed-to-lead: automated first-touch text/call, lead follow-up | Top of funnel, pre-sale | [brief] |
| **ServiceTitan AI** | Booking, dispatch, CRM, call summary inside the FSM | Operations, mid-job | [watchlist] |
| **Rilla** | Virtual ride-along / rep call-coaching (speech analytics) | Sales conversation coaching | [brief] |
| **Avoca AI / ServiceAgent** | AI inbound call answering / CSR | Front desk, pre-sale | [watchlist] |
| **agentplain (this wedge)** | Supplement drafting + evidence + compliance + cadence | **Post-adjuster, claim-to-cash** | this strategy |

The four competitors cluster at **pre-sale and operations**. agentplain's wedge is at
**claims-to-cash**, after the adjuster's scope lands. There is almost no overlap — which is
the whole thesis ("lower competitive density,"
`docs/agent-interviews/02-vertical-agents.md:183`).

---

## Head-to-head on the wedge capabilities

Rows = the jobs the supplement wedge does (`PRODUCT_SPEC.md`). ✅ = does it; ⚠️ = adjacent
/ partial; ❌ = doesn't touch it.

| Capability | agentplain | Hatch | ServiceTitan AI | Rilla |
| --- | --- | --- | --- | --- |
| Read an Xactimate/Symbility adjuster scope line by line | ✅ (Slice 1) | ❌ | ❌ | ❌ |
| Draft a line-item supplement against the carrier price list | ✅ | ❌ | ❌ | ❌ |
| Bind photo + measurement + code cite as evidence per line | ✅ (Slice 2) | ❌ | ⚠️ stores photos, doesn't assemble supplement evidence | ❌ |
| Track supplement status + draft re-submissions | ✅ (Slice 4) | ❌ | ⚠️ generic CRM tasks | ❌ |
| Draft state-specific lien waivers / certs / EPA RRP / warranty language | ✅ (Slice 3) | ❌ | ❌ | ❌ |
| Speed-to-lead <60s auto-text/auto-call | ❌ (by design — no-outbound) | ✅ | ✅ | ❌ |
| Inbound call answering / CSR | ❌ | ⚠️ | ⚠️ | ❌ |
| Rep call-coaching / ride-along | ❌ | ❌ | ❌ | ✅ |
| Lead routing + estimate follow-up (drafts, from own inbox) | ✅ (shipped) | ✅ (sends) | ✅ (sends) | ❌ |

**Read of the table:** the entire top block (the wedge) is an agentplain column of ✅ next
to three columns of ❌. The entire middle block (speed-to-lead) is the inverse — and we
concede it on purpose. We are not a worse Hatch; we are a different product that happens to
share the word "home-services."

---

## Why each competitor can't easily follow us into the wedge

- **Hatch** is a top-of-funnel outreach company. Following us means building Xactimate
  scope parsing, carrier price-list logic, and an evidence pipeline — a different product,
  a different buyer (back-office vs. sales), and a different data model. Low strategic
  incentive; their growth story is lead conversion.

- **ServiceTitan AI** is built for the **service/maintenance** trade shape (recurring
  HVAC/plumbing calls), not **storm restoration**. Their AI roadmap is booking/dispatch/
  call-handling inside their FSM. Supplement drafting is out of their product scope and
  serves a sub-segment (storm roofing) that isn't their core ICP. They *could* build it,
  but it's a side quest for them and the core wedge for us. (And we integrate with
  ServiceTitan as a `EstimateLookup` source rather than fight it —
  `PRODUCT_SPEC.md` Slice 5.)

- **Rilla** is speech-analytics call-coaching. Supplement drafting shares zero technology
  and zero data with ride-along coaching. Fully orthogonal — more a potential
  complement than a competitor.

- **Avoca AI / ServiceAgent** are front-desk call-answering. Same gap as Hatch — pre-sale,
  not back-office; never reach the claim.

---

## The real long-term threat (not on the original list)

**Verisk / Xactimate itself.** The genuine risk is not Hatch or Rilla — it's the
estimating platform shipping its own AI supplement-writer inside Xactimate, or a
**dedicated supplementing competitor** (third-party supplementing services already exist
and take a percentage cut of recovered dollars; an AI-native one is the obvious entrant).

Our defenses:

1. **Platform-neutral.** We read both Xactimate **and** Symbility behind a `ScopeReader`
   port (`PRODUCT_SPEC.md` Slice 1 / `ARCHITECTURE_QUESTIONS.md` Q3). Verisk has no
   incentive to serve the contractor's side against the carrier; we do.
2. **We own the contractor's evidence + price-list + cadence layer**, not just the scope
   read. That's the sticky moat (`WEDGE.md` "high switching cost"). A scope-reader alone
   is a feature; the claims-to-cash workspace is a system of record.
3. **We undercut the percentage-cut supplementing services.** They take a slice of every
   recovered dollar; we charge a flat per-seat subscription
   (`lib/verticals/home-services/content.ts:270`, Partner $299→$199). For a shop recovering
   $50K+/yr, a flat seat beats a percentage cut decisively — that's a direct,
   quantifiable displacement pitch.
4. **No-outbound keeps our compliance posture clean** while a percentage-cut public-adjusting
   adjacent service carries licensing exposure we route around (`ARCHITECTURE_QUESTIONS.md`
   Q4 — we draft the contractor's own scope, never adjust the homeowner's claim).

---

## One-line competitive summary for the deck

> Hatch, ServiceTitan, and Rilla fight over who answers the lead fastest. agentplain
> writes the supplement that gets the storm job *paid* — the highest-value, lowest-
> competition job in the trade, and the one our draft-and-advise architecture was built
> for.
