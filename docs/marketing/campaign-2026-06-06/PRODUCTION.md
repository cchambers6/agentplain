# Production Plan — agentplain Wave 1 (top 3 concepts), 2026-06-06

> Vendor shortlist, the case for AI-generated B-roll, a budget estimate for the three flagship
> concepts (C1 · C2 · C5), and a timeline to launch.
>
> **Companion docs:** the full AI-tool ranking + one-tool-per-job stack is in **AI_VIDEO_STACK.md**;
> how the real product appears in each film (screen map, capture method, mobile strategy, climax
> moments) is in **DEMO_INTEGRATION.md**; the per-frame shot lists with `[PRODUCT UI]` tags are in
> **STORYBOARDS/**. This plan now treats **product screen capture + interactive demos** as
> first-class production deliverables, not afterthoughts.
>
> **Estimate discipline:** the dollar ranges below are **market planning bands** for SMB-grade
> branded video, used to scope the budget — not quoted figures. Per
> `feedback_no_guesses_no_estimates.md`, any number later asserted as *the* cost must cite the
> studio's written quote. Get three quotes before committing.
>
> **Brand discipline on every frame:** "Intelligence rooted in reality." The product UI on
> screen must be the **real agentplain UI** (paper/ink/clay tokens, Instrument Serif; Plaino
> footer per `components/ui/ap/PlainoAvatar.tsx`) — captured from the product and composited, not
> faked. Human principals are real-looking operators, not models. Look is heritage/Main-Street,
> not coastal-tech. No glowing-orb "AI" cliché; no "plane" wordplay.

---

## 1. Vendor shortlist

The three flagship films need: (a) credible human principals, (b) real, grounded locations, (c)
clean compositing of real product screens, (d) a heritage tone. That favors **managed video
marketplaces** (predictable cost, fast turnaround, SMB-friendly) for the volume work, with one
**boutique narrative studio** option if we want a single hero film with more craft.

### Option A — Managed video marketplaces (recommended for Wave 1 volume)
Best fit for producing **3 concepts × multiple cuts (30s/60s/15s + aspect ratios)** on a
predictable budget and timeline. These platforms match you to vetted crews and manage delivery.

1. **QuickFrame (by MNTN)** — performance-video marketplace built for paid-social volume; good at
   producing many platform-native cuts from one shoot. Strong fit for the C1/C5 direct-response
   need and the storm-mode short cuts.
2. **Tongal** — crowdsourced/managed creative marketplace; competitive on cost, good for
   concept-driven branded films when you want options. Fit for testing multiple creative
   directions cheaply.
3. **Lemonlight** — full-service affordable branded-video studio with productized packages and
   transparent-ish pricing; a single point of contact for all three films. Strong fit if we want
   one vendor to own the whole slate.

*(All three are real, established SMB-facing video vendors. Confirm current pricing, crew
locations matching our heritage/Main-Street look, and product-UI compositing capability by
written quote before selecting.)*

### Option B — Boutique narrative studio (optional hero upgrade)
For one premium hero film (most likely **C1**, the brand-flagship), a small narrative/branded-
documentary studio buys more craft per dollar than a big agency. Source 2–3 regional studios in
heartland markets (their reels should show *real people in real places*, not stock gloss) — a
regional studio also reinforces the "rooted in reality" brand and tends to be materially cheaper
than coastal shops. **Source by reel + quote; do not pre-commit to a name without seeing work.**

### Selection criteria (score every quote against these)
- Can composite our **real product UI** convincingly (ask for an example).
- Reel shows **authentic operators in grounded locations**, not models in glass offices.
- Can deliver **multi-aspect cuts** (16:9 / 9:16 / 1:1) + captions from one shoot.
- Turnaround fits the timeline (§4).
- Music: works with a **licensed library** (Musicbed / Artlist / Soundstripe) — no bespoke
  score needed at this budget.

---

## 2. The case for AI-generated B-roll (Runway / Sora / Veo)

**Use AI generation for atmosphere and transitions — never for the human performances or the
product UI.** This is the right division of labor for a "rooted in reality" brand:

- **Where AI generation earns its place (B-roll / non-literal):**
  - Establishing atmosphere: the hailstorm hammering a roof at night (C5); blue-hour → golden-
    hour time-passage (C1); abstract paper/ink texture transitions and end-card motion.
  - Weather/scale shots that are expensive or unsafe to film (storm, lightning, overhead roof
    fields).
  - Rapid variant generation for paid-social testing (alt backgrounds, alt establishing shots).
  - Tools: ranked in **AI_VIDEO_STACK.md** (verified pricing/capability, 2026-06-06). Picks:
    **Adobe Firefly Generative Extend** on our own real plates (cleanest licensing — C2PA +
    indemnified) as the primary move, with **Runway Gen-4 (image-to-video)** / **Luma Ray2** for
    motion. **Avoid Pika** (slop-prone) and **text-to-video Sora 2** for hero shots (visible
    moving watermark). **Veo** carries an invisible SynthID mark on all output — note for
    disclosure.
- **Where AI generation is banned for this brand:**
  - The **human principals** (Sarah at the laptop, the CPA partner, the trades owner). These
    carry the trust; synthetic humans read as fake and would directly undercut "rooted in
    reality." Cast and film real people.
  - The **product UI**. Always real screen capture of the actual agentplain app. Never a
    generated/fictional interface.
  - Anything making a **factual/ROI claim** — no synthetic "proof" footage.
- **Why this is on-brand, not a shortcut:** the brand thesis is *intelligence rooted in
  reality*. Using AI for weather and texture while keeping every human and every product moment
  real is the literal expression of that thesis — and it cuts B-roll cost meaningfully (storm
  VFX and overhead plates are otherwise a budget line of their own).
- **Cost posture:** AI B-roll is largely **internal-tool subscription cost** (low hundreds/mo
  across Runway/Sora/Veo) plus artist time, vs. thousands for filmed/stock equivalents. Treat the
  savings as freeing budget for better casting and locations on the real shoots.

---

## 3. Budget estimate (planning bands — confirm by quote)

Scope per concept: one shoot day's worth of material → **30s + 60s + a 15s cut**, delivered in
**16:9 + 9:16 + 1:1** with burned-in captions, plus AI-generated B-roll and real-UI compositing.

| Line item | Per-concept band | Basis |
|---|---|---|
| Pre-production (script lock, casting, location, shotlist) | $2,000–$5,000 | scripts already drafted (SCRIPTS/) — reduces this line |
| Production (1 shoot day, crew, talent, location) | $6,000–$15,000 | managed-marketplace SMB band |
| Real-UI capture + compositing (seeded dev workspace, Tella/Descript) | $1,500–$3,500 | product screens already exist; DEMO_INTEGRATION.md §3A |
| Interactive demo (Supademo/Arcade) + Figma push-banner prototype | $500–$1,500 | reused on `/promo/[slug]`; one not-yet-built mobile screen |
| AI B-roll generation (atmosphere/transitions) | $500–$1,500 | mostly tool-subscription + artist time |
| Edit, multi-aspect cuts, captions, color, mix | $3,000–$7,000 | one master + platform cuts |
| Licensed music + SFX | $300–$1,000 | Musicbed/Artlist library license |
| **Per-concept subtotal** | **$13,800–$34,500** | incl. product capture + interactive demo |

| Slate scenario | Estimate | Notes |
|---|---|---|
| **Lean (all 3 via managed marketplace, shared shoot efficiencies)** | **~$42,000–$58,000** | recommended Wave-1 path; volume + reused crew/edit pipeline; incl. product capture + demos |
| **Mid (2 marketplace + 1 boutique hero film for C1)** | **~$55,000–$80,000** | upgrades the brand-flagship |
| **Premium (all 3 boutique narrative)** | **~$90,000–$130,000** | only if Wave-1 paid results justify it |

**Recommendation:** start **Lean (~$42k–$58k)**. It matches the Wave-1 working-media budget
(CHANNELS.md, $40k/mo) — i.e., roughly one month of media to produce a slate that will run for
many months. Reserve the boutique-hero upgrade for C1 in Wave 2 if paid results warrant.

*(All figures are market planning bands. Real numbers come from three written quotes per §1
selection criteria. — `feedback_no_guesses_no_estimates.md`.)*

---

## 4. Timeline to launch

Assumes scripts are already drafted (they are — SCRIPTS/) and decisions move at a normal SMB pace.

| Phase | Duration | Owner | Output |
|---|---|---|---|
| **Vendor selection** | Week 1 | Conner / marketing | 3 quotes per §1, vendor chosen |
| **Pre-production** | Weeks 2–3 | Vendor + us | Casting, location lock, shotlist, real-UI capture brief, music selects |
| **Real-UI capture** | Week 2 (parallel) | Eng/product | Seed dev workspace per concept (`scripts/seed-loop-demo.ts`); record the product mini-arcs incl. the climax approve (DEMO_INTEGRATION.md §2,§4) at 4K + phone-viewport |
| **Interactive demos** | Week 2 (parallel) | Marketing | One Supademo/Arcade per concept — embedded on `/promo/[slug]` + exported for the film |
| **Figma push-banner prototype** | Week 2 (parallel) | Design | The one not-yet-built mobile screen (DEMO_INTEGRATION.md §3-mobile, method C), in real tokens |
| **AI B-roll generation** | Weeks 2–3 (parallel) | Vendor/artist | Storm, time-passage, texture plates approved |
| **Shoot** | Week 4 | Vendor | All 3 concepts' principal footage (stagger or block days) |
| **Edit v1** | Weeks 5–6 | Vendor | 30s/60s/15s masters, rough |
| **Review + revisions** | Week 6 | Us | 2 revision rounds; claim/voice/legal check per SCRIPTS briefs |
| **Multi-aspect cuts + captions + color/mix** | Week 7 | Vendor | Final deliverables, all aspects |
| **Landing pages built** | Weeks 5–7 (parallel) | Eng | `/promo/[slug]` pages per LANDING.md |
| **Trafficking + QA** | Week 8 | Marketing | Pixels, UTMs, audiences, creative uploaded |
| **LAUNCH** | **End of Week 8** | — | Wave-1 live across the CHANNELS.md mix |

**Critical path:** vendor selection → shoot → edit. **Parallelizable (do now):** real-UI capture,
interactive demos, the Figma push prototype, and AI B-roll can all start as soon as scripts are
locked, independent of vendor pick. **Fastest possible:** a single-vendor Lean slate with a
blocked 2-day shoot can compress to ~6 weeks. **Storm-mode (C5) caveat:** the 15s storm-trigger
cut should be finished *first* so it's ready to deploy against the next qualifying weather event.
**Mobile reshoot (Wave-1.5):** the push-to-approve climax ships Wave-1 as composited real
mobile-web + Figma push banner; reshoot fully native (iOS-sim capture) the moment the Expo
notification + approvals screens land on `feat/mobile-app-v1-scaffold-2026-06-06`.

---

## 5. Pre-launch checklist (brand + compliance)

- [ ] Every film: product UI is the **real app** captured from a seeded dev workspace (not a
      mockup, not AI-generated); Plaino footer present; no autonomous-send implied.
- [ ] Every film: at least one `[PRODUCT UI]` frame + the ~4s climax approve moment (STORYBOARDS/).
- [ ] No screen overclaims: `schema-only`/`rooting` agents never shown as `live`; roadmap
      integrations shown as "planned," not connected.
- [ ] Mobile: native push-to-approve is composited (real mobile-web + Figma banner) and flagged
      for the Wave-1.5 native reshoot — no faked native screen presented as shipped.
- [ ] AI-generated frames carry no disqualifying watermark (no visible Sora mark); B-roll only.
- [ ] Every film: ROI figure on screen matches its cited `lib/verticals/*/content.ts` source.
- [ ] Every film: "first month free," never "pilot"; no "AI magic" / "automate everything."
- [ ] End cards name the vertical breadth (page-one-verticals rule).
- [ ] C2: the named alternative (Claude for Small Business / free chatbot) is framed as *useful
      but different*, never disparaged.
- [ ] Captions burned in on all sound-off cuts (Meta Reels / LinkedIn).
- [ ] Human principals are real people, not synthetic; AI used only for B-roll/atmosphere.
- [ ] Music is library-licensed with documented rights.
