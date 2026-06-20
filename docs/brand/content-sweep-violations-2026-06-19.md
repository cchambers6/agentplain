# Content sweep — AI-tic violations + rewrites (2026-06-19)

De-AI-fication item 3 of 4. Swept every customer-facing string across marketing,
product, email, and voice for the AI-generated "tells," then rewrote the genuine
offenders in the authentic agentplain voice (grounded, heartland, service-partner,
Plaino-as-loyal-working-dog). Truth Wave compliance held throughout — no fabricated
metrics, customers, or claims; no model vendor named.

## Headline finding

The customer-facing copy is **already in strong shape**. Prior Truth Wave and
marketing waves (#261, #262, #290, #284–289) did deep work, so a keyword scan for
the classic tells — `delve`, `seamless`, `leverage`, `unlock`, `elevate`,
`supercharge`, `empower`, `robust`, `streamline`, `effortless`, `world-class`,
`cutting-edge`, `tapestry`, `navigate the landscape`, `in today's fast-paced world`,
`it's not just X — it's Y`, `whether you're… has you covered` — came back **almost
empty** across marketing + components + emails + voice. The only matches were inside
code comments (out of scope) and the locked vision line (`best-in-class`, off-limits).

So this was a **surgical** sweep, not a rewrite. The real AI tells that survived were
subtler and structural:

1. **Empty intensifier tricolons** — "Not magic, not pixie dust — real product, real
   operators, real outcomes." This phrase had propagated to four surfaces (homepage,
   about, custom ×2). It's the single most AI-sounding construction on the site:
   rhythmic, content-free, self-congratulatory.
2. **Abstract / un-named day-in-the-life scenarios** — 5 of the 10 verticals opened
   their `valueLoopExample` with a faceless event ("Renewal week. 47 commercial
   accounts…") while the gold-standard real-estate file uses a named, time-stamped,
   sensory human ("Sarah's counter-offer lands Tuesday 9:14pm. She wakes Wednesday at
   6:30am."). Faceless = generic = AI.
3. **Engineer/SaaS vocab leaking into Plaino's voice** — the morning briefing email
   described work "moved through your fleet" and "running its cadence" (infrastructure
   talk), instead of Plaino reporting in.
4. **One stale factual claim** — "first month free" survived on two surfaces the
   Truth Wave trial-policy fix (#262/#290) missed.

## Anti-pattern catalog applied (seed list, session 1/4 catalog pending)

| Tic | Found? | Where |
|---|---|---|
| delve / tapestry / navigate the landscape / fast-paced world | none | — |
| seamless / leverage / unlock / elevate / supercharge / empower / robust / streamline | none (copy) | only in code comments |
| "It's not just X — it's Y" / "more than just" | none | — |
| "Whether you're a… has you covered" | none | — |
| Sycophantic openers ("Great question!" / "Absolutely!") | none | — |
| Generic chatbot stiffness ("How can I assist you today?") | none | voice greetings already warm |
| Over-hedged superlatives ("most innovative", "uniquely positioned") | none | — |
| Empty intensifier tricolons ("real X, real Y, real Z" / "pixie dust") | **YES** | homepage, about, custom ×2 |
| Generic/abstract vertical scenarios (no named human) | **YES** | insurance, recruiting, ria, property-management, title-escrow |
| Engineer labels on customer surface ("fleet"/"cadence" in Plaino's mouth) | **YES** | briefing email headlines |
| Em-dash spam (>2/para) | minor | trimmed in scenario rewrites |
| Claude/Anthropic vendor leak | none | clean |
| Stale claim ("first month free") | **YES** | how-it-works, waitlist |

## Files changed (11)

### Marketing
- `app/(marketing)/page.tsx` — homepage proof intro: killed the "pixie dust /
  real-X-real-Y-real-Z" tricolon.
- `app/(marketing)/about/page.tsx` — 2 edits: removed the same tricolon from the
  "Not magic" thesis bullet; replaced a flat trailing fragment in the "Not a chatbot"
  bullet with a concrete line ("it works whether you're looking or not").
- `app/(marketing)/custom/page.tsx` — 2 edits: removed the tricolon from the proof
  intro and the closing headline.
- `app/(marketing)/how-it-works/page.tsx` — 1 edit: stale "first month free / by
  month two" → 7-day trial language (matches the rest of the site).
- `app/(marketing)/waitlist/page.tsx` — 1 edit: same stale-trial fix.

### Per-vertical content (named the human, added sensory texture)
- `lib/verticals/insurance/content.ts` — scenario + after + outcome named "Dana";
  also "navigate the carrier portal" → "dig through the carrier portal."
- `lib/verticals/recruiting/content.ts` — named "Priya"; "12 hours stolen from the
  rest of her desk."
- `lib/verticals/ria/content.ts` — named "James"; "87 prep packets that don't exist
  yet."
- `lib/verticals/property-management/content.ts` — named "Maria"; leaned into the
  weekend-maintenance dread ("the message every property manager dreads").
- `lib/verticals/title-escrow/content.ts` — named "Rosa"; "ships four reviewed
  messages before 5:30pm and goes home."

### Product / email / voice
- `lib/skills/briefing-generator/email.ts` — 2 headline rewrites so Plaino reports
  in ("Plaino moved along for you" / "Plaino kept watch and there is nothing waiting
  on you") instead of describing infrastructure.

## Left untouched (deliberately) and why

- **real-estate, cpa, home-services, law, mortgage** verticals — already at or above
  the bar (named, time-stamped, gritty). Churning them would only add risk.
- **general** vertical — the "any local business" catch-all; a generic-but-specific
  persona is intentional. Naming a fictional owner would fabricate false specificity.
- **glossary.ts** — definitions are intentionally crisp/dictionary-style for AEO
  (answer engines quote them). Heartland-ifying them would hurt the AEO intent.
- **comparisons.ts** — parallel bullet/row structure is intentional AEO table shape,
  and the prose is honest and varied.
- **components/portal, components/workspace, components/onboarding** — already warm
  and honest ("Received — we're checking your document…", "a real person reads every
  note"). No tics.
- **voice playbook welcomeGreetings** — already short, warm, natural for speech; no
  phone-tree stiffness.
- **Legal pages** (privacy / terms / security / aup) — counsel-gated, out of scope.
- **pricing/page.tsx** — pricing numbers are off-limits; no tics worth the risk.

## Truth Wave note

The "first month free" → "7-day free trial" edits on `how-it-works` and `waitlist`
are a **truthfulness fix**, not a style change — those surfaces were missed by the
#262/#290 trial-policy correction and contradicted the rest of the site. No new
numbers introduced. Flagged for Conner in TODOS.
