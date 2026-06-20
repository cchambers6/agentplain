# agentplain Voice Guidelines — De-AI-fication Source of Truth

**Ratified target:** 2026-06-19 · **Status:** draft for Conner sign-off (see open decisions at end)

This is the brand-voice source of truth for **how agentplain sounds** — and, specifically,
how it sounds like a *person who runs a real business* rather than a language model
describing one. It exists because the product's copy, while honest and on-message, still
*reads* AI-generated: the em-dash cadence, the antithesis rhythm, the tidy triads, the
faint vocabulary of a model trying to sound profound.

This file does two jobs the existing canon doesn't:

1. **Codifies the authentic voice** extracted from Conner's own words and the on-brand copy
   that already ships — so writers reach for a real reference, not an invented one.
2. **Names the AI tics** — the specific, mechanical tells of machine-written prose — and
   bans them, with a lint gate (`tools/brand/voice-gate.mjs`) that enforces the catalog.

It **complements, does not replace**, two existing documents. Read all three:

- `docs/marketing/brand-voice-scenario-library.md` — 37 worked scenarios (email, support,
  Plaino chat, per-vertical drafts). The *shape* of every message type. **Still canon.**
- `docs/marketing/CREATIVE_PACK_GROUND_TRUTH.md` — the honesty spine (what we can and
  cannot claim) for outbound creative.

Where those govern **hype** (supercharge, seamless, leverage — already linted by
`tools/brand/brand-gate.mjs` rule R4), **this** file governs **LLM-ese**: the stylistic
fingerprints of generated text that survive a hype scrub and still feel synthetic.

---

## 1. Who is talking

A heritage local-business partner, owner to owner. Someone who has done the work, knows
the trade, and respects your time enough to be plain with you. Calm, concrete, confident,
warm — never chirpy, never grand. We do real work for real businesses and we say so
plainly.

**Plaino** — our named AI partner, the 8-bit service dog — talks the same way. Grounded,
honest about limits, never a perky chatbot. Plaino never claims to be human, never
over-apologizes, never performs enthusiasm.

The test that settles every argument (from the scenario library, kept here because it is
the whole philosophy in one line):

> **The across-the-counter test.** Would you say it, in these words, to a business owner
> standing across the counter from you? If not, rewrite it until you would.

People don't say "in today's fast-paced world" across a counter. They don't say "it's not
just software — it's a partnership." They don't open with "Great question!" They say the
thing.

---

## 2. Voice principles (the six)

Memorable on purpose. If you only remember these, you'll write on-brand.

### P1 — Say the thing.
Lead with the fact or the thing the reader gets. No throat-clearing, no setup, no "in this
section we'll explore." *"Your trial ends Friday."* not *"We wanted to take a moment to
reach out regarding your upcoming trial expiration."*

### P2 — Concrete beats clever.
A specific, true detail outperforms any adjective. *"Drafts land in your queue every five
minutes"* beats *"lightning-fast automation."* When tempted to describe how good something
is, describe what it does instead. The fact does the persuading.

### P3 — Plain words, real sentences.
Write the way a smart person talks, not the way a model writes an essay. No "delve,"
"realm," "tapestry," "underscore," "boasts," "navigate the landscape." No essay
connectives ("Moreover," "Furthermore," "In conclusion"). Vary your sentence length like a
human does — not every sentence is a balanced clause.

### P4 — Earn the em-dash; kill the antithesis reflex.
One em-dash in a sentence is fine and often good. Two or three in one line is the model's
tell — break it into sentences. And retire the **"not just X — it's Y"** / **"it's not
about X, it's about Y"** construction. It feels insightful and means nothing; a model
reaches for it when it has no specific point. Make the specific point instead.

### P5 — One idea per sentence; resist the triad.
Short declaratives, one idea each. The rule-of-three ("faster, smarter, simpler";
"read, understand, act") is the single most recognizable AI cadence. Use a triad only when
all three items are real and load-bearing — never as rhythm for its own sake. Two honest
items beat three padded ones.

### P6 — Honest about limits; never perform.
If a thing isn't connected yet, say so. If Plaino doesn't know, it says it doesn't know and
routes to a person. No manufactured excitement ("We're thrilled!"), no false urgency
("Don't miss out!"), no self-congratulation ("our robust, resilient systems"). Confidence
is quiet. The control line — *the fleet drafts and proposes; you approve and send* — is our
honesty, stated plainly, every time.

---

## 3. The anti-pattern catalog (the AI tics)

These are the mechanical tells the lint gate enforces. Each is banned on customer surfaces.
Grouped by family. The first four families are **net-new** here; the hype family is already
covered by `brand-gate.mjs` R4 and listed only for completeness.

### A. LLM-ese vocabulary — words a model reaches for to sound profound
Never on a customer surface:

> delve · tapestry · realm ("in the realm of") · testament ("a testament to") ·
> underscore(s) (as a verb) · boasts / boasting · treasure trove · myriad · plethora ·
> bustling · vibrant (as filler) · foster (as filler) · "navigate the
> {landscape, complexities, world}" · "in today's {fast-paced, digital, ever-changing}
> world" · "ever-evolving" · "the digital age/landscape" · "at the forefront" · "stand out
> from the crowd" · "look no further" · "rest assured" · "needless to say" · "it goes
> without saying" · "it's worth noting" · "when it comes to" · "the world of {X}" ·
> "embark on a journey" · "take it to the next level" · "harness the power of"

**Why they're banned:** none of them carry information. They are the texture a model adds
when it has nothing specific to say. Delete the phrase and say the fact.

### B. The antithesis reflex — "not just X, it's Y"
Banned constructions:

> "it's not just {X}, it's {Y}" · "it's not about {X}, it's about {Y}" · "more than just
> {X}" · "{X} isn't {Y} — it's {Z}" used as a rhetorical reveal

**Why:** it *sounds* like a thesis and almost never is one. It's the model's way of
inflating an ordinary statement into an apparent insight. State the actual point. If the
point is "we run it for you," write *"we run it for you"* — not *"it's not just software,
it's a partnership."*

### C. Sycophantic / chatbot register — performed warmth
Banned openers and fillers (in Plaino chat, support drafts, and all copy):

> "Great question!" · "Great point!" · "Absolutely!" / "Certainly!" (as a standalone
> opener) · "I'd be happy to" · "I'd love to" · "Sure thing!" · "No problem at all!" ·
> "I hope this {email, message} finds you well" · "Let's dive in / dive into" ·
> "Let's get started!" · "Happy {Monday, Friday}!" · calling anyone "superstar," "rockstar,"
> "champ," or "friend" · emoji as enthusiasm · exclamation-point spam

**Why:** performed enthusiasm is the most unmistakable chatbot tell and it erodes trust —
a calm, competent partner doesn't gush. Plaino answers the question; it doesn't praise the
asker for asking it. (See scenario library #12–15 for Plaino's correct register.)

### D. Essay scaffolding & structural tics
Banned:

> "Moreover," · "Furthermore," · "Additionally," (as sentence openers) · "In conclusion," ·
> "Ultimately," (as filler) · "That said," (as filler) · "It's important to
> {note, remember, understand} that" · "Introducing {X}" / "Say hello to {X}" /
> "Meet {X}" launch-ese · "Say goodbye to {X}" · "Gone are the days of" · "Imagine a world
> where" / "What if {X}" rhetorical openers · "Whether you're a {X} or a {Y}" setups

Plus two cadence tells the gate flags by density (not word-match):

> - **Em-dash spam** — three or more em-dashes in a single rendered line. One or two is
>   fine; three is the model loving its own asides. Break into sentences.
> - **Staccato fragment triads** — "Read. Categorize. Draft." as decoration. Allowed when
>   each fragment names a real, distinct step; banned as rhythm.

### E. Hype & buzzwords — *already enforced by `brand-gate.mjs` R4; listed for reference*
> supercharge · unlock (as hype-noun) · transform · revolutionize / revolutionary ·
> seamless · leverage · empower · game-changer · 10x · magic / AI magic · cutting-edge ·
> next-gen · robust · synergy · delight · effortless · disruptive · "automate everything" ·
> "replace your team" · "AI assistant"

The voice-gate does **not** re-lint family E (no double-counting). If you trip a hype word,
brand-gate catches it. Voice-gate owns A–D.

---

## 4. Per-context style — on-brand vs the AI draft

Five contexts, each with the realistic AI draft someone ships when they forget, and the
fix. The bad version is never a strawman — it's the plausible first generation.

### Cold email (design-partner / sales outreach)
**AI draft:**
> Hi Sarah — I hope this email finds you well! In today's fast-paced real estate market,
> staying ahead means leveraging every tool at your disposal. That's where agentplain comes
> in. It's not just software — it's a partner that helps you delve into what matters:
> your clients. Would love to hop on a quick call to explore the possibilities!

**On-brand:**
> Hi Sarah,
>
> A few brokers in Cobb County use agentplain to draft the first-touch replies to inbound
> buyer leads — the fleet reads the inquiry, drafts a qualifying reply in the agent's voice,
> and lands it in their queue. They approve and send. Nothing goes out on its own.
>
> Worth 20 minutes to see if it fits how you run things? I'll work around your schedule.
>
> — {name}

What changed: cut the "finds you well" / "fast-paced market" / antithesis / "delve" / "love
to hop on." Opened on a concrete, true fact about a peer. Named one specific job. Made one
small ask.

### Landing page section
**AI draft:**
> ## Transform How You Work
> In an ever-evolving world, local businesses need more than just tools — they need
> intelligent partners. agentplain harnesses the power of AI to streamline your workflow,
> elevate your operations, and unlock your team's true potential. The possibilities are
> endless.

**On-brand:**
> ## Your tools in. Drafts out. You approve.
> The fleet reads what's already in your systems, does the work that lives between your
> tools, and lands every result in your queue. You stay the only one who hits send.

(The second is the live homepage copy at `app/(marketing)/page.tsx:208`. It is the bar.)

### Error / system message
**AI draft:**
> Oops! Something went wrong on our end. 😅 Don't worry — our robust systems are working
> hard to resolve this. Please rest assured we're on it and try again shortly!

**On-brand:**
> Drafting is delayed right now — we found the cause and we're on it. Your data is safe and
> nothing has been sent. Try again in a few minutes; we'll post an update if it runs longer.

What changed: no "Oops," no emoji, no "rest assured," no "robust." States the impact, the
safety status, and the next step. (Cf. scenario library #10.)

### Plaino chat reply
**AI draft:**
> Great question! 🙌 I'd be happy to help you with that. Let's dive in! Connecting Outlook
> is super easy and totally seamless — you'll be up and running in no time!

**On-brand:**
> Yes — connect Outlook the same way as Gmail. Go to Integrations, choose Outlook, and sign
> in once. The fleet starts reading that mailbox right away and drafts land in your queue
> like before. If anything looks off after you connect, tell me and I'll take another look.

What changed: no "Great question," no emoji, no "dive in," no "seamless." Plaino answers the
exact question in plain steps. (Cf. scenario library #13.)

### Product UI microcopy (empty states, buttons, status)
**AI draft:**
> 🚀 You're all set! Your AI assistant is ready to supercharge your productivity. Let's get
> started on your journey to effortless efficiency!

**On-brand:**
> Connect your email and the fleet starts drafting. Your queue fills as work comes in —
> you'll see the first drafts within a few minutes.

Also: never surface internal state words ("rooting," "live," "schema-only"). Use
**Setting up / Working / Watching** (per `feedback_customer_vocab_not_engineer`).

---

## 5. When to be punchy vs warm

The voice has two registers. Both are plain; they differ in temperature.

- **Punchy** — heroes, section titles, buttons, ad hooks, subject lines. Short, declarative,
  concrete. *"Your tools in. Drafts out. You approve."* Fragments are allowed here **when
  each one is a real, distinct beat** — not decoration. One idea, no adjectives.
- **Warm** — welcome emails, onboarding, support, apologies, anniversaries, Plaino chat.
  Full sentences, owner-to-owner, a little more room to breathe. Still concrete, still no
  hype. *"A year ago this week you connected your first mailbox…"*

The line to watch: punchy can tip into **AI staccato** (rhythmic fragments that sound
designed), and warm can tip into **chatbot gush** (performed enthusiasm). The fix for both
is the same — name the real, specific thing and stop.

---

## 6. Per-persona variation

Three voices share the canon but vary in register.

| Persona | Who | Register | Signature | Never |
|---|---|---|---|---|
| **Founder** | Conner / company-as-author | Direct, plain, occasionally blunt. Uses CAPS for emphasis, not exclamation points. Asks the real question. | Owner-to-owner conviction. Concrete examples over claims. | Hype, hedging, corporate softening |
| **Plaino** | The named AI partner (the dog) | Calm, grounded, honest about limits. Helpful without performing. | "I don't have a solid answer for that one, and I'd rather not guess." | Claiming to be human, gushing, emoji, over-apologizing |
| **Product copy** | The app & marketing surface | Plain, concrete, scannable. Punchy in titles, warm in flows. | "Drafts land in your queue. You approve and send." | Buzzwords, em-dash spam, antithesis reflex |

The founder voice is the **anchor** — Plaino and the product both sound like a calmer,
more patient version of how Conner actually talks. Which is why the references below matter.

---

## 7. Conner's actual voice — references with attribution

These are verbatim. They are the ground truth for the founder register: direct, concrete,
allergic to filler, emphasis through CAPS and plain repetition rather than exclamation
marks. When in doubt about whether copy sounds like agentplain, read these and ask whether
the same person could have written it.

> "If you were selling what we are selling HOW WOULD YOU SELL IT. We need visuals, examples.
> How does it work, what are people getting… WHY SHOULD ANYONE BELIEVE US."
> — Conner, 2026-05-11 (recorded in `project_agentplain_mission_and_positioning`)

> "People get to do more relationship building and more of the work they enjoy, while
> outsourcing the work that takes their time and money that they can't and don't want to do."
> — Conner, 2026-05-11 (the seed of the locked mission line)

> "Everything is part of telling a story and everything needs to have a purpose."
> — Conner, 2026-05-11 (recorded in `feedback_everything_tells_a_story`)

> "Why are we saying anything about V0 that means nothing to consumers… You aren't leading
> with the information people most need to see."
> — Conner, 2026-05-11 (on a homepage stat block; the case for P1 — *say the thing*)

> "More like this. But in our branded colors. And more of a hound." …
> "neither dog nor robot, snout too pointy, needs to stand not sit, needs to be a dog's dog."
> — Conner, brand-mark feedback (recorded in `project_brand_public_robot_dog_ratified_2026_06_06`)

**What to extract from these:** he leads with the real question. He uses CAPS for weight,
not punctuation. He's specific ("a hound," "stand not sit," "V0 means nothing to
consumers"). He never hedges and never inflates. That is the founder register; the product
and Plaino are the same instinct, dialed calmer.

The locked brand facts the founder voice carries (from
`project_agentplain_mission_and_positioning`, still authoritative):

- **Tagline:** *Intelligence rooted in reality.*
- **Mission:** *We lift up local businesses by doing the work that takes their time and
  money away from the people they serve.*
- **Audience word:** "local businesses" / "local business owners" — never "SMB,"
  "knowledge workers," "white-collar."
- **Naming:** lowercase **agentplain**, always; capitalize **Plaino**; the unit is **the
  fleet**, never a count of agents.

---

## 8. The five quick tests (run before any copy ships)

Carried from the scenario library, with two added for de-AI-fication (4–5):

1. **Hype scan.** Search for the family-E words. Any hit is a rewrite. (`brand-gate.mjs`
   catches these.)
2. **Autonomy test.** Does any sentence imply the fleet *sends, pays, files, books, or
   commits*? If so it's wrong — the fleet drafts and proposes; the owner approves and sends.
3. **Adjective-delete test.** Delete every adjective. If the sentence still says what you
   meant, the adjectives were lying. Put back only the ones carrying real information.
4. **AI-tic scan (new).** Search for the family A–D phrases and the antithesis reflex.
   Count em-dashes per line — three or more is spam. (`voice-gate.mjs` catches these.)
5. **Across-the-counter test.** Would you say it, in these words, to a business owner
   across the counter? If not, rewrite until you would.

---

## 9. How the gate fits

`tools/brand/voice-gate.mjs` lints customer surfaces (the same set `brand-gate.mjs` scans,
plus the outbound copy under `docs/marketing/`) against families **A–D** only. It runs in
**ratchet mode**: a frozen baseline holds today's existing violations, and the gate fails
the build only on **new** ones. As fix waves land, re-baseline to shrink it toward zero.
This is the identical model `brand-gate.mjs` uses, wired into the same pre-push hook.

See `docs/brand/voice-audit-2026-06-19.md` for the current violation inventory and
`tools/brand/voice-gate.mjs --help` for the workflow.

---

*Open decisions for Conner are tracked in
`docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md` (Item 10). Nothing in this file is
enforced as build-breaking beyond the ratcheted gate until he signs off the anti-pattern
list and the per-persona attributes.*
