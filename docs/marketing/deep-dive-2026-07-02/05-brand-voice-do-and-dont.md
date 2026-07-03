# Brand + voice: the applied do/don't for marketing writers

**Who this is for:** anyone — human or agent — producing marketing copy. It is the working summary of the ratified canon; where it conflicts with the sources, the sources win. **Sources of truth, in authority order:**

1. `docs/brand/voice-guidelines-2026-06-19.md` — the voice spec and the full anti-pattern catalog (memory: `project_voice_guidelines_de_ai_2026_06_19`). The verbatim banned-phrase lists live THERE, deliberately: that file isn't scanned by the gate; this one is.
2. `docs/marketing/CREATIVE_PACK_GROUND_TRUTH.md` — the claims whitelist (what is true today). Known drift: its trial language predates the ratified policy; trial facts come from `lib/billing/facts.ts` (7-day trial, card at signup, 14-day CPA/law, 14-day money-back), never from older copy.
3. `project_agentplain_mission_and_positioning` — locked mission, vision, tagline, the nine questions, audience words.
4. `feedback_everything_tells_a_story`, `feedback_customer_vocab_not_engineer`, `feedback_model_vendor_invisible_on_customer_surfaces` — the three feedback rules writers trip most.

The mechanical enforcement: `tools/brand/brand-gate.mjs` (hype words) and `tools/brand/voice-gate.mjs` (LLM-ese families A–D) run on customer surfaces *and on markdown under `docs/marketing/`* — including your drafts. Write clean or the push fails.

---

## What's ON brand

**The one voice:** a heritage local-business partner talking owner to owner. Calm, concrete, plain. Someone who has done the work and respects your time. The test that settles every argument: *would you say it, in these words, to a business owner standing across the counter from you?*

**Say these, exactly:**
- The control line, every surface, every time: **"The fleet drafts and proposes; you approve and send."** Variants: "Nothing goes out without your name on it." / "You stay the only one who hits send."
- **"Run-for-you"** / "done-for-you" / "we install, configure, and run a monthly review." The category words we own. The comparison frame is always *DIY vs. run-for-you*, vendor-generic.
- **The tagline:** *Intelligence rooted in reality.* Heroes, about-page close, proof-section framing.
- **The mission:** *We lift up local businesses by doing the work that takes their time and money away from the people they serve.*
- **Audience:** "local businesses," "local business owners," "entrepreneurs." Named verticals when context calls for it.
- **The unit:** "the fleet" or "capable AI partners." Never a count of agents.
- **Plaino** — the one named character: our 8-bit service dog, capitalized, calm, honest about limits. Plaino sits, fetches, watches, waits at heel; Plaino never gushes, never claims to be human, never performs enthusiasm. One character. No siblings, no mascot variants (`project_plaino_named_agent`, `project_plaino_icon_system_two_families` — identity marks and product-status icons never mix).
- **Customer vocabulary, not engineer labels** (`feedback_customer_vocab_not_engineer`): the product states are **Setting up / Working / Watching**. Never surface internal words like "rooting," "schema-only," "degraded," "cron," "dispatch."
- **Cadence language:** "drafts land in your queue," "every five minutes," "by morning." This is both the honest frame (the production reality includes degraded mode) and the differentiator against chat tools.
- **The honest concession:** every comparison names where the alternative wins first. It is a signature move, not a weakness.
- **Story discipline** (`feedback_everything_tells_a_story`): every surface earns its place in the arc — why we exist → what it is → how it works → why believe us → what it costs → start. Copy that serves no step gets cut.

**Register by context:** punchy for heroes, buttons, ad hooks (short declaratives, fragments only when each names a real step). Warm for onboarding, support, email (full sentences, owner-to-owner). Both are plain; neither is chirpy.

## What's BANNED

Each family below is enforced; the verbatim word lists live in the voice guidelines (§3) and brand-gate R4. Learn the families, check the catalog when unsure.

1. **Hype and buzzwords** (brand-gate R4). The whole superlative-tech vocabulary: the s-word every SaaS page uses for "integrated," the l-word for "use," anything promising 10x or magic or effortlessness. If an adjective is doing the persuading, the sentence is broken — state what the thing does and let the fact persuade.
2. **AI-tell vocabulary** (voice-gate family A). The words a model reaches for to sound profound; none carry information. Delete the phrase, say the fact.
3. **The antithesis reflex** (family B). The "reframe one thing as secretly another" sentence shape. It sounds like a thesis and never is one. If the point is "we run it for you," write *we run it for you.*
4. **Chatbot warmth** (family C). Performed enthusiasm, praise for the question, exclamation spam, emoji as tone. A calm, competent partner doesn't gush — and Plaino especially doesn't.
5. **Essay scaffolding** (family D). Connective-tissue openers, launch-ese ("Meet X" and the farewell-to-your-old-problem construction), rhetorical what-if openers. Plus the two cadence tells: three-plus em-dashes in one line, and decorative staccato-fragment triads. One idea per sentence; vary the rhythm like a person.
6. **Model/vendor names on customer surfaces** (`feedback_model_vendor_invisible_on_customer_surfaces`). No model or provider names in any value copy, ad, email, or page. Sole exception: the subprocessor lists on the privacy/security pages, which are compliance disclosures, not marketing. In comparisons we neither confirm nor deny what runs underneath; the value we sell is the service layer.
7. **Unearned social proof.** No customer counts, no logos, no ratings, no "trusted by," no invented testimonials — nothing until a named customer has given written permission. Zero paying customers is the current truth; the dogfooding brokerage is the only production story we tell.
8. **Autonomy overclaims.** The fleet never "sends, files, pays, posts, books, or commits." Banned outright: "automate everything," "replace your team/staff/assistant," "fully automated," and any live-magic framing ("instant AI," "watch it work in real time") — cadence is the honest frame.
9. **Data overclaims.** Banned: "we store nothing," "it forgets," "auto-deletes." The ratified two-bucket story (`project_two_bucket_data_positioning_2026_06_18`): working memory persists for the life of the account — that's a feature — and raw tool data is read where it lives, never warehoused. Say it that way.
10. **Pricing drift.** Three tiers: Regular $199→$99/seat, Partner $299→$199, Max sales-led, plus Custom builds. Trial: 7 days, card at signup, 14 for CPA/law, 14-day money-back. Banned: "pilot pricing" and "first month free" (dead policy that keeps resurfacing in older packs — kill on contact).
11. **Coastal-SaaS voice.** Growth-hacker idiom, "crushing it," ironic-detached Twitter voice, corporate softening ("we wanted to reach out"). We sound like the plains, not the pitch deck.
12. **Airplane wordplay.** The name is **agentplain** — plain as in plain-spoken, plains as in heritage. No flight puns, no runway/takeoff/altitude metaphors, ever. (Also: lowercase **agentplain**, always, even sentence-initial.)
13. **Audience mislabels.** No "SMB," no "knowledge workers," no "white-collar." And no real-estate-only framing on page one — all ten verticals appear up front (mission rule).

## The pre-ship checklist (60 seconds, every asset)

1. **Across-the-counter test** — would you say it to an owner's face in these words?
2. **Autonomy test** — does anything imply the fleet sends/pays/files/books? Rewrite.
3. **Adjective-delete test** — remove every adjective; if the meaning survives, the adjectives were lying.
4. **Claims test** — is every number and integration on the ground-truth whitelist, with trial facts from `lib/billing/facts.ts`?
5. **Vendor test** — zero model/provider names?
6. **Run the gates** — `node tools/brand/brand-gate.mjs` and `node tools/brand/voice-gate.mjs`. Zero new violations or it doesn't ship.
