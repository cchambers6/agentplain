# 03 — Outbound tool stack (Month 1 lean → Month 3 scaled)

**Architecture constraint, stated once:** the agentplain *product* never performs outbound (no Twilio/SendGrid senders in our runtime — no-outbound architecture). The stack below is **the founder's own GTM toolchain**, outside the product: the fleet researches and drafts into an approval queue; **a human sends every message from a system the human owns.** That's the same pattern we sell, applied to ourselves.

**Selection principles:** BYO/no-lock-in bias (clean data export, no proprietary sequence engine we can't leave), lowest tool count that makes the T+3/7/14/21 cadence executable and auditable, and nothing that tempts volume ahead of quality — the 90-day plan is 5 sends/week, founder-sent.

---

## 1. Enrichment: Apollo vs ZoomInfo vs Clay

| | Apollo | ZoomInfo | Clay |
|---|---|---|---|
| Cost | ~$0–49 free tier; ~$50–100/seat/mo paid | ~$15k+/yr, annual contract | ~$140–350/mo + credit costs |
| Local-business coverage | Decent for owner-operated; weaker than rosters for RE/law | Strongest DB, enterprise-tuned; overkill | Not a database — an orchestration layer over other sources |
| Fit for us | Enrich roster-sourced names (email, LinkedIn, size) | Wrong scale, wrong contract shape | Powerful, but its job (list ops at volume) doesn't exist yet |

**Recommendation:** **Apollo, entry paid tier, Month 1.** The decisive fact from document 01: for our populations, *public rosters and directories* (GAMLS/FMLS, associations, NARPM, GSCPA, state bar) are more complete than any database — the paid tool's job is enrichment, not discovery. Revisit **Clay at Month 3** only if list operations (multi-source waterfalls, custom signals) become a real bottleneck. ZoomInfo: not at this stage, at any point in this plan.

## 2. Send: Outreach vs Instantly vs manual Gmail

| | Outreach.io | Instantly | Manual Gmail (founder's own inbox) |
|---|---|---|---|
| Cost | ~$100+/seat/mo, annual | ~$37–97/mo | $0 |
| Shape | Enterprise sequencer | Cold-email volume tool (mailbox rotation, warm-up) | 1:1 human sends |
| Fit | Wrong stage | **Wrong identity** — volume-rotation tooling contradicts a founder-signed, 5-sends/week, trust-constrained motion | Exactly the motion |

**Recommendation:** **manual Gmail from Conner's real mailbox, Month 1 and likely Month 3.** At 5–20 sends/week from an actual human writing to named people, sequencers add deliverability risk and subtract authenticity. The *cadence* problem sequencers solve (T+3/7/14/21 follow-ups) is solved by CRM next-action dates + the fleet drafting due follow-ups into the Monday queue. **Deliverability hygiene still applies:** verify SPF/DKIM/DMARC on agentplain.com now (one-time check); keep volume under ~20/day; no link trackers or open pixels (they add spam signals and we don't need vanity opens — replies are the metric). A separate sending subdomain becomes worthwhile **only** if a sequencing tool ever enters; at founder volume it's unnecessary indirection.

**Month-3 trigger to revisit:** an SDR joins *and* weekly send volume must exceed ~50. Then: Instantly or plain Gmail + a shared-inbox discipline, on a `get.agentplain.com` subdomain with proper auth + gradual warm-up — decided then, not pre-bought now.

## 3. Booking: Calendly vs Cal.com

Every packet's booking asset dead-ends at `{{CALENDLY_LINK}}` today (kaizen friction #3) — this is the single cheapest conversion-path fix in the plan.

**Recommendation:** **Calendly Standard (~$10–12/mo), Month 1, this week.** The packet copy (invite description, confirmation, reminder) was written for it; it is boring and reliable. Cal.com is a fine open-source alternative if Conner prefers it — the only requirement is that one 30-minute "discovery call" event type exists, syncs to Conner's real calendar with sane buffers, and the link replaces the placeholder in every asset. Do not leave this decision pending past the first send.

## 4. CRM: HubSpot Free vs Attio vs Airtable

| | HubSpot Free | Attio | Airtable |
|---|---|---|---|
| Cost | $0 | ~$29–34/seat/mo | ~$0–20/seat/mo |
| Email logging | BCC/forwarding logging built in | Gmail sync, elegant | None native — manual paste |
| Pipeline mechanics | Stages, tasks, next-action dates out of the box | Excellent, flexible | Build-it-yourself |
| Exit cost | Full export, standard | Full export | Trivial |
| Risk | Upsell nags; fine to ignore | Paid from day 1 | Becomes a spreadsheet nobody updates |

**Recommendation:** **HubSpot Free, Month 1.** It is $0, it logs founder emails via BCC so the touch history exists without discipline, it holds the document-06 stages and next-action dates, and an SDR hired later already knows it. The pipeline-state discipline matters more than the tool: **one row per prospect, stage, next-action date, touch history — updated at the Friday review, no exceptions.** Attio is the taste upgrade if HubSpot's nagging grates; Airtable is acceptable only if Conner already lives in it. Migrate-later cost between any of these at <200 rows: an afternoon.

## 5. The demo environment (not a purchase — a designation)

The discovery agenda says "show the draft sitting in the queue" but names no demo (kaizen friction #5). **Designate the synthetic-data killer-workflow runtime (PR #303) as THE sales demo** — LLM-free, deterministic, immune to the prod-key pause, honest ("this is a demonstration workspace on synthetic data" said out loud). One recorded walkthrough of it (per 02 §3) doubles as the async proof asset. Zero dollars; one afternoon of founder recording time.

## 6. Recommended stack + costs

**Month 1 (lean — start this week):**

| Tool | Job | Cost |
|---|---|---|
| Rosters/directories (GAMLS, associations, NARPM, GSCPA, bar) | Discovery | $0 |
| Apollo entry paid tier | Enrichment | ~$50–100/mo |
| Conner's Gmail + SPF/DKIM/DMARC check | Send | $0 |
| Calendly Standard | Booking | ~$12/mo |
| HubSpot Free | CRM of record | $0 |
| PR #303 synthetic demo + one recorded walkthrough | Demo/proof | $0 |
| **Total** | | **~$60–115/mo** |

**Month 3 (scaled — only what the motion has earned):**

| Addition | Trigger | Cost |
|---|---|---|
| Clay | List ops become the bottleneck (multi-source waterfalls) | ~$140–350/mo |
| Instantly + sending subdomain + warm-up | SDR hired AND >50 sends/wk | ~$40–100/mo |
| Attio (replacing HubSpot Free) | Taste/workflow, optional | ~$30–70/mo |
| LinkedIn Sales Nav (1 seat) | Law lane opens | ~$99/mo |
| Common Room | Community-signal tracking proves worth measuring | quote |
| **Total** | | **~$300–600/mo, conditional** |

**Accounts/decisions Conner must personally make (blocking, from 00 §5):** Apollo account + card, Calendly account tied to his real calendar, HubSpot account, and the one-time DNS/auth check on agentplain.com. Everything else in this document an SDR or the fleet can operate.
