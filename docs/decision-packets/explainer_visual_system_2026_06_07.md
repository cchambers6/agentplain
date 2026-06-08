# Decision packet — Explainer + Journey + Retention Visual System

**2026-06-07 · for Conner · 2-min read**

## What this is
The inventory of visuals that **do work** — each one answers a question a real owner asks at a specific moment in the journey, as a picture instead of a paragraph. This is the complement to the brand-asset gap audit (PR #173, which covered hero/OG/favicon/avatar art). Where they overlap, this defers to #173.

Your direction, made operational: *"when someone asks Plaino, what do I do next, there is not only readable material but visual explanations that help our users be successful and retain them."*

## The headline
**34 visuals** mapped across 6 journey stages (cold → signup → first hour → first week → steady state → the Plaino chat layer that rides all of them). Breakdown:
- **10 code-generated SVG diagrams** — a Wave can build these directly, no design tool needed.
- **19 interactive React components** — data-bound to real workspace state.
- **2 net-new illustration prompts** for you to run in ChatGPT (the rest defer to #173).
- **2 email twins** of in-app dashboards.

## The 10 to ship first (P0)
1. **The value loop** — "what even is this?" (homepage)
2. **Build-it-yourself vs run-for-you** — "how is this different from Claude SBM?" (homepage/pricing)
3. **Vertical value-loop selector** — "will it work for MY business?" — answers it for 9 verticals at once
4. **ROI value-stack** — "what's the return?" (subscription is a sliver against the value bar)
5. **Draft-then-approve control loop** — "does it send things on its own?" (no, made visible)
6. **Trust architecture** — "how do you protect my data?"
7. **Onboarding roadmap** — "what happens after I sign up?"
8. **"We have you covered" coverage map** — the assurance visual you named explicitly
9. **Weekly digest dashboard** — "what did Plaino do for me this week?" — the recurring retention proof
10. **Plaino "what next" card** — the retention payload (below)

## The retention payload — Plaino's "what next" card
Today Plaino answers "what should I do next?" with a **paragraph**. A paragraph is the wrong shape for a next-step question.

The fix: Plaino's reply carries an optional **visual card** beneath the text — a glance at your queue + 2–4 tappable next steps that deep-link into the workspace. And when Plaino has to say "I can't do that yet," the card turns the dead-end into a path forward (named gap → connect this tool).

**Why it's clean:** it rides the chat reply's existing metadata field — **zero database change, no new approval kind, additive and accessible** (the text answer is always there; the card is an enhancement). The same card renders in both the in-app chat and the marketing widget.

**Why it retains:** the activated owner's most common chat is *"what now?" / "can you also…?"*. Answered as two tappable steps instead of prose, the conversational front door becomes a re-engagement surface every single time.

## What I need from you
- **2 ChatGPT illustration prompts** are in the catalog (the "rooted in reality" proof panel + the "a week with agentplain" strip) — self-contained, brand hexes inlined. Everything else is code a Wave builds.

## What happens next
- This PR carries the full inventory + briefs + prompts (mobile-readable in the description).
- The master orchestrator is asked to spin up a wiring wave that: builds the code/React visuals, wires each into its named surface, commits illustration placeholders with `CONNER ACTION:` notes pointing at the prompts, and implements the Plaino "what next" card.

**Full doc:** `docs/explainer-visual-system-2026-06-07.md` · also at `~/memory/EXPLAINER_VISUAL_SYSTEM_2026_06_07.md`.
