# agentplain — Investor Deck

> Pre-launch draft, 2026-06-14. 10 slides. Each slide: title · body (1–3 sentences) · speaker notes.
> Source discipline: every product/traction claim is grounded in code or memory at the ref cited inline.
> Competitive figures are from live research (2026-06-14) and are **directional for a deck** — re-confirm against primary filings before any number enters a financing document.

---

## Slide 1 — Title

**agentplain**
*Intelligence rooted in reality.*

The done-for-you AI service that runs the back office for local businesses — so owners get their time back.

**Speaker notes.**
One line to set the frame: we are not another AI tool a small-business owner has to learn and operate. We are the **service** that does the work for them, on top of the best models in the world. Mission (locked, ratified 2026-05-11): *"We lift up local businesses by doing the work that takes their time and money away from the people they serve."* Keep the open calm and concrete — this is a services-margin software business, not a science project. Do not say "platform," "SaaS tool," or "copilot" — those put the work back on the owner. The whole pitch is that we remove the work.

---

## Slide 2 — Problem

**The local-business owner is the bottleneck — and the back office is eating them alive.**

A solo realtor, a 6-person CPA shop, a 4-truck plumbing company: the owner is also the receptionist, the bookkeeper, the marketer, and the compliance officer. The administrative work that pays nothing crowds out the client work that pays everything — and they can't afford a back-office hire at $45–70K/yr.

**Speaker notes.**
Make the pain visceral and specific to one persona, then generalize. The structural facts behind this: (1) labor — local businesses can't compete for admin talent and turnover is brutal; (2) software sprawl — they already pay for a CRM, an accounting tool, a scheduler, none of which talk to each other; (3) the new option (general AI) demands they become prompt engineers, which they will not do. The result: the owner does $15/hr admin work instead of the $200/hr work only they can do. This is the wedge. Resist listing 10 problems — anchor on the **owner-as-bottleneck** and the **can't-afford-a-hire** economics.

---

## Slide 3 — Solution

**A service-partnership AI fleet that does the work — not one more dashboard that tracks it.**

agentplain configures Anthropic's Claude into a pre-built fleet of vertical agents — Plaino — that read the owner's real inboxes and tools, then draft the replies, chase the invoices, screen the intakes, and prep the close. Every action is drafted-and-approved; nothing sends without the owner's tap.

**Speaker notes.**
Three differentiators, said plainly: (1) **It does work, it doesn't just surface it.** The output is a drafted reply ready to send, a categorized invoice list with chase drafts, a screened client intake — not a chart. (2) **It's configured for you.** Pre-built skills + per-vertical compliance corpora + persistent memory mean the owner connects their tools and the fleet runs — no prompt engineering. (3) **It's safe by construction.** Architecturally there is no outbound send from our side (`project_no_outbound_architecture`); the customer's own system executes, on approval. That is the trust unlock for licensed verticals. Plaino is the single named service partner across every workspace (`project_plaino_named_agent`). This is the "service partnership," not "software subscription," framing — it is load-bearing for the next slide and the margin story.

---

## Slide 4 — Why now

**Three curves crossed in 2026: model capability, the SMB labor crisis, and a matured integration substrate.**

Claude is now good enough to draft client-grade work; local businesses have given up trying to hire back-office help; and the connector layer (QuickBooks, Microsoft 365, Google, FUB, DocuSign) is finally consistent enough to plug into without a custom build. None of these were true 18 months ago.

**Speaker notes.**
"Why now" is the slide that kills "why didn't this exist already." (1) **Capability** — frontier models crossed the line from "summarize this" to "draft the thing I'd actually send a client," which is the only line that matters for a services product. (2) **Labor** — the SMB admin-hire market is structurally broken; owners are primed to buy an outcome, not a tool. (3) **Substrate** — Anthropic itself shipped *Claude for Small Business* on 2026-05-13 (15 horizontal connectors + workflows) and a *Claude Partner Network* with a $100M services fund on 2026-03-12. Read that correctly: the substrate provider is **validating the category and recruiting service partners** rather than serving SMBs directly. The road we're on is the road they're paving. Use that — it de-risks "the platform will eat you."

---

## Slide 5 — Market size

**Bottom-up, not top-down: ~1.6M serviceable US firms across our five launch verticals; a conservative early SAM in the low hundreds of millions of ARR.**

We don't claim a $X-trillion "AI market." We count firms in the verticals we actually serve, multiply by a realistic per-firm subscription, and discount hard for what we can win early.

**Speaker notes.**
Walk the math transparently and own the assumptions (all firm counts are directional from public sources — Census/BLS/IRS/NAR ranges — and flagged for primary-source confirmation before any financing doc):

| Vertical | US firms (small/local, est.) | Realistic ARPA/yr | Vertical TAM (est.) |
|---|---|---|---|
| Real estate brokerages | ~100K firms (~1.5M agents) | ~$3,600 (multi-seat) | ~$360M |
| CPA / accounting firms | ~45K small firms | ~$3,600 | ~$160M |
| Law firms (solo–small) | ~400K firms | ~$3,600 | ~$1.4B |
| Home services contractors | ~700K establishments | ~$2,400 | ~$1.7B |
| RIA / wealth + property mgmt | ~30K RIAs + ~300K PM firms | ~$3,600 | ~$1.2B |

**Bottom-up TAM ≈ $4–5B/yr** across the five verticals at our actual price points — built from firm counts × our live $99–199/seat ladder, *not* from a market-research headline. Early **SAM** (US, small/local, our supported verticals): we'd model 1–3% reachable in 3 years → **low hundreds of millions of ARR** as the honest near-term ceiling. The point for investors: the number is large enough without inflation, and it compounds as each new vertical's corpus unlocks (verticals are code, not headcount — see traction). Be the person in the room who *deflates* their own TAM; it builds credibility for every other number.

---

## Slide 6 — Product demo flow

**Three screens: Connect → Plaino drafts → Owner approves.**

(1) Owner picks their vertical and connects their inbox + tools in minutes. (2) Plaino reads real data and produces a queue of ready-to-send drafts — invoice chases, lead replies, intake screens — each with its reasoning shown. (3) Owner reviews the approval queue and taps approve; their own system sends.

**Speaker notes.**
Tell it as a 60-second story, ideally live or as a 3-frame mock. Screen 1 (**Connect**): the honest signup gate only takes money for verticals we actually serve (`lib/verticals/readiness.ts` — a real local-business owner can never pay for a vertical we can't run). Screen 2 (**Work**): the approval queue is the product — show a *real* drafted artifact, not a chat bubble. Each card carries an AI-disclosure and the action's rationale. Screen 3 (**Approve**): one tap; the customer's connected system executes the send. Emphasize the queue is the retention surface — Plaino's replies carry a "what next" card that pulls the owner back in. **Honesty note for the room:** the production Anthropic key is paused today, so a live demo runs in degraded/mocked mode — use recorded drafts or the seeded test workspace, and say so plainly rather than risk a dead demo. That candor reads as operational maturity, not weakness.

---

## Slide 7 — Business model & pricing

**Productized subscription where the margin scales — human service is gated to the top tier on purpose.**

Solo and Partner tiers are **fleet-only** (configured-for-you, but no standing human time) so they scale at software margins; **Max + Custom** is the only tier that consumes human/founder time, priced to cover it.

**Speaker notes.**
This is the margin slide — make the structural choice explicit. Three productized tiers plus engagements (live in code, `app/(marketing)/pricing`, ratified 2026-05-15):

- **Solo (Regular)** — self-serve fleet, monthly review. **$199/seat → $99 at 50+ seats.** First month free.
- **Partner** — named partner, weekly review, deeper customization. **$299 → $199 at scale.**
- **Max + Custom** — non-standard scope / bespoke builds. **Quoted / sales-led**, engagements **$5K–$15K + $200–$500/mo.**

The **Conner-time constraint** is the whole margin thesis: standing human/founder service time is reserved for **Max and Custom only**. Solo and Partner are productized fleet output — they scale without scaling headcount. That is how a "service" business keeps software gross margins: the human is a premium SKU, not the cost of every account. Trial mechanics (set, defensible): card-on-file at signup, **7-day default trial**, **14-day for CPA + Law** (longer sales cycles), **14-day money-back**. Banned framing: never say "pilot fees/pricing" — it's "first month free." Don't surface the Plus/Max *enum* names from the schema; the customer tiers are Solo/Partner/Max.

---

## Slide 8 — Traction

**Five verticals code-complete, four firing live on real data, a self-healing fleet, and 330+ test files — built almost entirely by the fleet itself.**

The product is built by agents under a disciplined PR cadence; the same fleet that serves customers ships the codebase. Today four killer workflows fire on live workspace data, with the rest gated honestly behind a readiness check rather than faked.

**Speaker notes.**
Lead with the honest version — it's stronger than a puffed one. Verified at this branch:
- **334 test files** across the codebase (`find ... *.test.ts*` count) — this is a tested system, not a prototype.
- **26 cataloged skills, 17 marked `runtime: 'live'`** (`lib/skills/registry.ts`).
- **Four verticals have a live production caller firing the killer workflow on real data**: real-estate (lead triage), general (invoice chase), CPA (month-end close), law (intake conflict screen) — per the `SKILLS_WITH_PRODUCTION_CALLER` manifest in `lib/verticals/readiness.ts`. Several more are module-complete with tests but intentionally gated until their caller and counsel sign-off land — and the signup gate refuses to charge for them. **That honesty is a feature**: it's the same fail-closed discipline (`isVerticalSupportedSafe`) that protects customers and de-risks the compliance story.
- **The fleet self-heals and self-builds**: agents ship the product through PR-A→PR-B→PR-C cadence with CI gates, compliance gates, and memory as the steering layer (`feedback_agentplain_built_by_agents`).
- **Design partners**: Conner's own pilot workspace + the seeded test workspaces. *(Fill in named design partners before this goes to a real investor — leave honest if none are signed.)*

Do not claim verticals fire that don't. The board will check, and the readiness resolver is the proof you can show them.

---

## Slide 9 — Team & advisors

**Founder-led by an operator who builds durable, high-margin software — backed by a fleet that ships and a compliance posture built for counsel from day one.**

Conner Chambers — senior AI/product & strategy leader (Coca-Cola) — building agentplain as a durable, high-autonomy software business. The "team" is a disciplined agent fleet plus a counsel-in-the-loop compliance system designed to bring real lawyers into the workflow, not route around them.

**Speaker notes.**
Be honest about shape: this is a founder + an agent fleet, not a 30-person org chart — and that *is* the story (capital efficiency, software margins, vertical expansion without linear hiring). Position Conner's edge: operator-strategist who ties product to business economics, not a first-time technical founder guessing at GTM. On advisors/counsel: the compliance architecture (`lib/agents/sentinel`) is explicitly built to hand work to outside counsel — a durable per-vertical sign-off gate (`counsel-signoff.ts`) means lawyers ratify the legal corpus before it goes live; that's a defensible, auditable posture investors in regulated-SMB verticals will want to see. **Action before a real pitch:** name the actual advisors/counsel engaged (broker + GA corpus counsel per the brief), or state the engagement honestly as in-progress. Do not invent advisor names.

---

## Slide 10 — The ask

**Raising to convert a working, honest product into a multi-vertical revenue engine — fund the GTM motion and the counsel sign-offs that unlock the next five verticals.**

The code is built and the fleet ships; what capital buys is (1) design-partner→paid conversion in the four live verticals, (2) counsel sign-off + production callers to light up the remaining verticals, and (3) the GTM engine to acquire local businesses at SMB CAC.

**Speaker notes.**
Make the use-of-funds map to de-risking, not to "hire 20 engineers." Three buckets: (1) **Demand** — prove repeatable acquisition of local businesses (the hard part is distribution, not product) and design-partner→paid conversion. (2) **Vertical unlock** — each new vertical is mostly a corpus + a counsel sign-off + a production caller, so capital converts to TAM unusually efficiently; show the unit cost of lighting up a vertical. (3) **Trust & compliance hardening** — the audit-log immutability, key-rotation drills, and per-vertical counsel sign-offs that turn "code-complete" into "GA-safe." Close on the thesis: the substrate provider (Anthropic) is recruiting service partners and explicitly *not* building the vertical/compliance/human-service layer — agentplain is built to be the durable, high-margin occupant of that whitespace. State the round size, instrument, and the 2–3 milestones it funds; if those aren't set yet, say the round is being shaped and walk the milestone logic instead of inventing a number.

---

### Strongest / weakest slide (builder's honest read)

- **Strongest: Slide 7 (Business model).** The Conner-time-gated-to-top-tier design is a genuine, defensible margin thesis most "AI services" pitches can't make — it's the difference between a software multiple and an agency multiple, and it's backed by the real pricing in code.
- **Weakest: Slide 8 (Traction) — and Slide 5 depends on it.** "Built by agents, 4 verticals live" is real but thin on the metric an investor actually underwrites: **paying customers and retention.** Until there are named design partners and revenue, traction leans on test counts and architecture, which proves *capability* not *demand*. Fix before a real raise: get 3–5 named paying/design-partner logos and one retention cohort. Don't paper over it with vanity metrics — the readiness resolver makes overclaiming checkable.
