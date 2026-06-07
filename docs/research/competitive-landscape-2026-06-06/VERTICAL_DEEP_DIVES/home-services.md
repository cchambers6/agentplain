# Competitive Deep Dive — Home Services (agentplain)
_Research date 2026-06-06. Live web research; sources cited inline._

## The vertical's AI landscape (note the AI-voice/booking dominance)

Home services (HVAC, plumbing, electrical, roofing, GC) is the single most adversarial vertical for agentplain's no-outbound, draft-and-advise architecture. The entire AI category in the trades has organized itself around the **exact capability agentplain refuses to do**: answering the inbound phone and autonomously booking the job.

The buyer's #1 pain is the missed call. A trades operator loses revenue every time a homeowner's call rings out to voicemail after hours or during a job. So the winning product is an **AI voice CSR that picks up 24/7 and books straight to the dispatch board** — and that is precisely what the funded leaders ship. Avoca just raised $125M+ at a $1B valuation explicitly to "answer every call, fill every board" ([avoca.ai](https://www.avoca.ai/), accessed 2026-06-06; [PRNewswire](https://www.prnewswire.com/news-releases/avoca-raises-125m-at-1b-valuation-to-power-americas-services-economy-with-ai-302753962.html), accessed 2026-06-06). Sameday markets "AI CSRs [that] will answer the phone... and book jobs — just like your best salesperson" with a "92% success rate" ([gosameday.com](https://www.gosameday.com/), accessed 2026-06-06). Even the dominant FSM platform, ServiceTitan, now ships a **native AI Voice Agent** that books straight to the dispatch board in real time with a claimed 90% capacity-adjusted booking rate ([servicetitan.com](https://www.servicetitan.com/features/pro/contact-center/voice-agents), accessed 2026-06-06).

The category is also unusually well-capitalized and FSM-native: most tools integrate with ServiceTitan / Housecall Pro / Jobber rather than replace them — the same "integrate-not-replace" posture agentplain claims, but executed around the phone, not the inbox.

## Top competitors

### 1. Avoca AI — the funded category leader (AI voice, OPPOSITE of agentplain)
- **What:** "The AI Front Office for Home Services." AI CSR answers calls/texts/chat 24/7, a Simple Scheduler for self-service booking, web chat, **outbound** Speed-to-Lead and SMS/call drip campaigns, Google LSA integration, plus a Coach tool that scores live calls ([avoca.ai](https://www.avoca.ai/), accessed 2026-06-06).
- **Pricing:** No public pricing; sales-led demo run on your actual ServiceTitan/HCP data before quoting; audience-fit gate around $3M+ revenue ([avoca.ai](https://www.avoca.ai/), accessed 2026-06-06) [pricing tier exactness unverified].
- **Funding:** $125M+ across Seed/A/B at a **$1B valuation**, announced April 2026; Series B led by Meritech + General Catalyst, Series A by Kleiner Perkins ([PRNewswire](https://www.prnewswire.com/news-releases/avoca-raises-125m-at-1b-valuation-to-power-americas-services-economy-with-ai-302753962.html), accessed 2026-06-06).
- **R-I-A:** Reads (FSM data), Interprets (lead scoring, call coaching), **Acts autonomously** — answers calls, books jobs, fires outbound campaigns.
- **Ships vs claims:** Ships. 1,000+ service leaders; "on track to book $1B in jobs in 2026" ([avoca.ai](https://www.avoca.ai/), accessed 2026-06-06) [the $1B-jobs figure is a vendor claim].
- **Answers calls / auto-books?** **YES to both, plus outbound.** Direct opposite of agentplain on every axis.

### 2. Sameday AI — "AI workforce for the trades" (AI voice, OPPOSITE)
- **What:** AI CSRs answer phone + texts and book jobs; qualifies leads, follows up on estimates, includes **pre-built outbound call/text campaigns** ([gosameday.com](https://www.gosameday.com/), accessed 2026-06-06).
- **Pricing (public, real numbers):** Launch from **$449/mo** (500 min, 3 locations); Scale from **$789/mo** (1,000 min, voice cloning); Enterprise custom ([gosameday.com/pricing](https://www.gosameday.com/pricing), accessed 2026-06-06). No long-term contracts.
- **Funding:** Pre-Seed; Y Combinator company; based in Lindon, Utah ([ycombinator.com/companies/sameday](https://www.ycombinator.com/companies/sameday), accessed 2026-06-06) [exact $ unverified].
- **R-I-A:** Reads + Interprets + **Acts** (answers, books, outbound).
- **Ships vs claims:** Ships; "92% [booking] success rate" is a vendor claim ([gosameday.com](https://www.gosameday.com/), accessed 2026-06-06).
- **Answers calls / auto-books?** **YES + outbound.** Opposite of agentplain. Notable for being the cheapest, most price-transparent entry point — directly competes with agentplain's $99–$199/seat on sticker.

### 3. ServiceTitan Titan Intelligence + AI Voice Agent — the incumbent platform (OPPOSITE, and inside the FSM)
- **What:** The dominant trades FSM is now AI-native. **AI Voice Agent** answers inbound calls and books straight to the dispatch board using live tech availability; reschedules/confirms; escalates to humans. **Dispatch Pro** auto-optimizes the board by predicted job value + flags unbooked calls for recovery. **Atlas** AI sidekick + SMS Booking Agent ([servicetitan.com/features/pro/contact-center/voice-agents](https://www.servicetitan.com/features/pro/contact-center/voice-agents), accessed 2026-06-06; [servicetitan.com/features/titan-intelligence](https://www.servicetitan.com/features/titan-intelligence), accessed 2026-06-06).
- **Pricing:** Platform ~$150–$500+/mo per the third-party estimate; AI add-ons quoted ([fieldcamp.ai/reviews/servicetitan](https://fieldcamp.ai/reviews/servicetitan/), accessed 2026-06-06) [third-party, not official].
- **Funding:** Public company (NASDAQ: TTAN).
- **R-I-A:** Full R-I-A and **Acts** end-to-end — and it owns the system of record agentplain would integrate against.
- **Ships vs claims:** Ships; 20-min setup, native, no third-party integration. 90% capacity-adjusted booking rate is a vendor claim ([servicetitan.com](https://www.servicetitan.com/features/pro/contact-center/voice-agents), accessed 2026-06-06).
- **Answers calls / auto-books?** **YES, natively.** This is the most dangerous competitor: it answers the phone AND books AND lives where agentplain's data would come from.

### 4. Hatch — AI CSR across call/text/email, conversion-focused (mostly OPPOSITE, outbound-heavy)
- **What:** "Complete AI CSR platform" — AI agents across calls, texts, emails for lead engagement, speed-to-lead, estimate follow-up, dead-lead revival, recurring-service campaigns. Runs campaigns on top of your existing ServiceTitan database ([usehatchapp.com](https://www.usehatchapp.com/), accessed 2026-06-06).
- **Pricing:** Custom quote only; no public sticker ([softwarefinder.com/customer-service-software/hatch](https://softwarefinder.com/customer-service-software/hatch), accessed 2026-06-06).
- **Funding:** Y Combinator (2019 batch); ~73 employees; 2,000+ businesses served ([crunchbase.com/organization/hatch-0729](https://www.crunchbase.com/organization/hatch-0729), accessed 2026-06-06) [exact funding unverified].
- **R-I-A:** Reads + Interprets + **Acts** (autonomous outbound text/call/email).
- **Ships vs claims:** Ships, mature (since 2019). Heavily **outbound** — the exact thing agentplain's no-outbound architecture forbids.
- **Answers calls / auto-books?** Yes to AI voice/text outreach and engagement; outbound-first. Opposite of agentplain.

### 5. Rilla — AI sales coaching / virtual ride-along (CLOSEST adjacency, does NOT answer calls)
- **What:** "Virtual ridealong" — records in-person sales/service visits, transcribes, and AI-coaches reps. Used in roofing, HVAC, solar, kitchens/baths ([rilla.com](https://www.rilla.com/), accessed 2026-06-06; [rilla.com/industry/home-services](https://www.rilla.com/industry/home-services), accessed 2026-06-06).
- **Pricing (public-ish):** $199–$349 per rep/mo, 5-user minimum, annual contract; Roleplay add-on $50/rep/mo; implementation $1K–$5K ([salesask.com/rilla-pricing-guide-2026](https://www.salesask.com/rilla-pricing-guide-2026), accessed 2026-06-06) [third-party].
- **Funding:** ~$3.8M raised; ~$40M ARR, ~133 employees as of Jan 2026 ([crunchbase.com/organization/rillavoice](https://www.crunchbase.com/organization/rillavoice), accessed 2026-06-06; [salesask.com](https://www.salesask.com/rilla-pricing-guide-2026), accessed 2026-06-06).
- **R-I-A:** Reads (call recordings) + Interprets (coaching) — **does NOT Act** on the customer's behalf.
- **Ships vs claims:** Ships; one customer cited a 14% conversion lift ([rilla.com](https://www.rilla.com/), accessed 2026-06-06) [single-customer vendor claim].
- **Answers calls / auto-books?** **NO.** This is the only seed competitor whose posture (read + advise, no execution) rhymes with agentplain — but it coaches humans on closed-door sales, it doesn't run the back office.

## Competitive matrix

| Competitor | Price | Posture | Answers/books? | Vertical depth | Threat |
|---|---|---|---|---|---|
| **Avoca AI** | Sales-quoted (no public; $3M+ rev gate) | AI voice front office + outbound | **YES + outbound** | Deep (HVAC/plumb/elec/roof) | **High** — $1B funded category king |
| **ServiceTitan AI Voice / TI** | ~$150–$500+/mo + AI add-ons | Native FSM AI, end-to-end | **YES, native** | Deepest (owns the FSM) | **High** — owns system of record |
| **Sameday AI** | $449–$789+/mo (public) | AI voice CSR + outbound | **YES + outbound** | Deep, trades-only | **Med-High** — cheap, transparent |
| **Hatch** | Custom quote | AI CSR call/text/email, outbound | YES (outbound-first) | Deep, home-improvement | **Med** — mature, outbound-heavy |
| **Rilla** | $199–$349/rep/mo | Read + advise (sales coaching) | **NO** | Deep (in-person sales) | **Low-Med** — closest posture, different job |

## agentplain's honest differentiation (and honest mismatch)

agentplain's structural differentiator — **never dial, never book, never commit itself; draft and advise, customer's systems execute** — is a *governance/liability* feature. In a regulated, brokerage-liability vertical (realty, insurance) that's a selling point. In **home services it is a direct collision with the buyer's #1 felt pain.** The trades owner is not lying awake about audit trails; he is lying awake about the after-hours call that went to voicemail and became the competitor's job. Every funded competitor in this vertical sells the answer to that. agentplain, by architecture, cannot.

Where agentplain remains coherent here: it is the **back-office partner that augments the FSM** (categorize inbox, draft estimate follow-ups, coordinate scheduling, surface what needs a human), a single named partner ("Plaino") as a *service* not just software, at a transparent $99–$199/seat. That's a real and underserved slice — but it is the *quieter* slice, and it sits adjacent to, not on top of, the revenue-critical phone.

## Where agentplain WINS

- **Governance/liability posture** — for an owner who explicitly does NOT want an AI committing to customers in his name, agentplain's human-in-the-loop, draft-only model is the safe choice. (Niche in trades, but real.)
- **Integrate-not-replace + portable architecture** — augments ServiceTitan/Housecall Pro/Jobber rather than forcing a rip-and-replace; no vendor lock-in by design.
- **Price transparency at the low end** — public $99–$199/seat undercuts Avoca's enterprise sales-quote and beats Sameday's $449 floor for a small shop, *if* the job-to-be-done is back-office coordination rather than call answering.
- **Service partnership** — one named partner vs. a faceless "AI workforce"; relationship-led, which resonates with owner-operators.
- **Multi-surface back office** — reads email + calendar + FSM + CRM + docs and coordinates across them; most trades tools are narrowly phone/SMS-centric.

## Where agentplain LOSES (be blunt)

- **It cannot answer the phone or book the job — the entire reason this vertical buys AI.** Avoca, Sameday, and ServiceTitan all do exactly this. A trades owner comparing tools will ask "does it pick up when I'm under a truck and book the job?" agentplain's honest answer is **no**, and that ends most deals in this vertical.
- **No outbound = no speed-to-lead.** Speed-to-lead (instant text/call to a fresh inquiry) is a headline feature for Avoca, Sameday, and Hatch and a proven revenue driver. agentplain's no-outbound architecture forbids it outright.
- **The incumbent already owns the surface.** ServiceTitan ships native AI Voice + Dispatch Pro inside the FSM agentplain would integrate against — bundled, 20-min setup, no extra vendor. Hard to wedge a back-office add-on against the platform's own free-ish AI.
- **Capital + category mindshare mismatch.** Avoca is a $1B-valued, $125M-funded gorilla aiming this vertical specifically. agentplain is a transparent-priced challenger with a *different* job-to-be-done. In a head-to-head trades bake-off, agentplain isn't losing on quality — it's not even in the same race the buyer is running.

**Net: home services is agentplain's worst-fit vertical. Recommend not leading GTM here; if entered, position strictly as FSM-augmenting back office for owners who deliberately want human-approved execution — and expect to lose any deal where "answer the phone / book the job" is the buying criterion.**

## ROI claims (strongest number + source)

The strongest *competitor* ROI proof points (which agentplain must answer to): Avoca claims it is "on track to book $1B in jobs in 2026" and customers "capture millions in additional annual revenue" ([avoca.ai](https://www.avoca.ai/), accessed 2026-06-06); Sameday claims a "92% [booking] success rate" ([gosameday.com](https://www.gosameday.com/), accessed 2026-06-06); ServiceTitan claims a "90% capacity-adjusted booking rate" ([servicetitan.com](https://www.servicetitan.com/features/pro/contact-center/voice-agents), accessed 2026-06-06). All are vendor-stated. agentplain's own framing (ROI 15–107x vs $99–$199/mo) is an internal positioning claim, not independently verifiable for this vertical [unverified externally]. The honest read: competitor ROI is tied to *captured jobs from answered calls* — a number agentplain structurally cannot produce.

## Sharpest positioning delta (one sentence)

Every funded competitor in home services wins by **answering the phone and booking the job autonomously** — the one thing agentplain is architecturally built never to do — which makes this the vertical where agentplain's defining governance discipline reads to the buyer not as a feature but as the missing feature.
