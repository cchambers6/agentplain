# Product-in-the-Ad Integration — agentplain, 2026-06-06

> How the **real product** (web + the mobile app being scaffolded in parallel) shows up inside
> the Wave-1 films. The pitch lands harder when the viewer *sees* the briefing arrive, the
> approval swipe, the connect tile light up — not a stock "AI dashboard." Every product frame is
> the **real agentplain UI** (paper/ink/clay tokens, Instrument Serif, Plaino footer); never a
> mockup pretending to be the product, and never AI-generated (AI_VIDEO_STACK.md standing rule).
>
> **Grounded in what exists today.** Routes verified in the repo on 2026-06-06. The web app under
> `app/(product)/app/...` is complete enough to film from a seeded dev instance; the mobile app
> (`apps/mobile/`, branch `feat/mobile-app-v1-scaffold-2026-06-06`, local_7f682615) is an early
> Expo scaffold — see §3 for filmable-today vs. waits-for-scaffold.

---

## 1. Screens that exist today (the filmable inventory)

All real routes, renderable from a seeded dev instance (production is paused on the sentinel, but
the marketing pages render in prod and every app screen renders in dev):

| Step in the journey | Route | What's on screen | Source |
|---|---|---|---|
| Vertical landing | `/[vertical]` (`/real-estate`, `/cpa`, `/home-services`) | Hero + day-in-the-life + ROI | `app/(marketing)/[vertical]/page.tsx` (live in prod) |
| Magic-link signup | `/app/sign-up` → `/checkout-success` | Email entry, magic-link, first-month-free | `app/(product)/app/sign-up/page.tsx` |
| Onboarding | `/app/workspace/[id]/onboarding` | "Hi {name}, I'm Plaino…" tone/hours setup | `…/onboarding/page.tsx` |
| Connect a tool | `/app/workspace/[id]/integrations` | Connect tiles (Gmail/Outlook/Drive/DocuSign/QBO), OAuth | `…/integrations/page.tsx` |
| The fleet | `/app/workspace/[id]/marketplace` · `/agents` | Skill cards w/ honest `live`/`schema-only` badges | `…/marketplace/page.tsx` |
| Morning briefing | `/app/workspace/[id]/briefings` | **"Two weeks of mornings."** Plaino files one/workday ~9 ET | `…/briefings/page.tsx` |
| **The approval** | `/app/workspace/[id]/approvals` | **"Decisions waiting for you."** PENDING cards, approve/edit/reject | `…/approvals/page.tsx` |
| Talk to Plaino | `/app/workspace/[id]/talk` | Plaino chat surface | `…/talk/page.tsx` |
| Activity feed | `/app/workspace/[id]/activity` | Append-only handoff log | `…/activity/page.tsx` |
| Workspace today | `/app/workspace/[id]` | Plaino "your service partner" band + today view | `…/[id]/page.tsx` |

**The single most valuable frame in the whole campaign** is the approvals screen, because its
on-page copy *is* the brand promise, verbatim:

> "Nothing leaves agentplain on its own. We draft; you decide; your existing system is what
> actually sends." — `app/(product)/app/workspace/[id]/approvals/page.tsx` L48-52

Shoot that line legibly in every concept. It carries the no-outbound thesis without a word of VO.

---

## 2. Screen-to-concept mapping (top 3)

Each concept gets a **product mini-arc**: land → sign up → connect → fleet works → **approve**.
The bolded screen is the climax (§4).

### C1 · "Before You Open the Laptop" (realty)
1. `/real-estate` vertical landing (the hero the ad echoes)
2. `/app/sign-up` magic-link (first-month-free)
3. `/app/workspace/[id]/integrations` — connect **Gmail + Google Drive + DocuSign** tiles
   (real-estate day-one integrations, `lib/verticals/real-estate/content.ts` L229-234)
4. `/briefings` — the 6:30am "Two weeks of mornings" summary Plaino filed
5. **`/approvals` — the drafted counter-offer response as a PENDING card (climax)**
6. Send executed from the customer's own system (dotloop) — *not* from agentplain

### C2 · "You Get the Tool. We Run It For You." (regulated finance / CPA)
1. `/cpa` vertical landing
2. `/app/sign-up` magic-link
3. `/app/workspace/[id]/integrations` — connect **Outlook + QuickBooks Online**
4. `/marketplace` — the CPA fleet visible (Document Chase, Compliance Sentinel, Client Inbound),
   honest `live`/`rooting` badges (don't hide what isn't live yet)
5. **`/approvals` — 23 drafted doc-chase reminders stacked as PENDING; partner approves (climax)**
6. The "We draft; you decide" line held on screen — the literal answer to "why pay vs. a chatbot"

### C5 · "The 73-Call Tuesday" (trades)
1. `/home-services` vertical landing
2. `/app/sign-up` magic-link
3. `/app/workspace/[id]/integrations` — connect **Gmail + QuickBooks Online** (day-one; FSM/lead
   sources are roadmap, `home-services/content.ts` L298-313 — show them as "planned," stay honest)
4. `/app/workspace/[id]` today view / lead queue — 41 leads ranked by margin
5. **`/approvals` — drafted intake replies + the supplement line-item rebuttal; owner approves (climax)**
6. Crews dispatched from the owner's own FSM — agentplain drafted and ranked, owner decided

---

## 3. Capture method — recommendation

Three methods, used for different jobs. **Default to live capture of the real product.**

### A. Live screen recording from a seeded dev instance — PRIMARY (web)
- **Why:** it's the actual product, zero fabrication, on-brand by construction.
- **How:** stand up a dev/staging workspace and populate it with realistic (non-real-customer)
  data using the existing seed scripts — `scripts/seed-loop-demo.ts`, `scripts/seed-knowledge.ts`
  (production is paused on the sentinel, so we seed rather than use a live customer). Set the
  vertical per concept; seed a believable approvals queue (the counter-offer draft; the 23
  doc-chase drafts; the ranked intake replies + supplement).
- **Tool:** **Tella** for produced screen capture (styled zoom/cursor), or raw capture finished in
  **Descript** (AI_VIDEO_STACK.md). 4K, scaled-cursor, smooth zoom on the approve tap.
- **Deliverable:** clean recordings of each concept's product mini-arc (§2), composited into the
  film at the storyboard's `[PRODUCT UI]` frames (STORYBOARDS/).

### B. Interactive demo platform (Arcade / Supademo) — REUSE (video + landing)
- **Why:** one capture of the real flow serves twice — (1) exported MP4/GIF dropped into the film
  as product-motion, and (2) embedded on `/promo/[slug]` as the CTA ("click through the actual
  product") per LANDING.md.
- **Tool:** **Supademo** (value) or **Arcade** (polish). Capture the same mini-arcs as §2.
- **Deliverable:** one interactive demo per concept, embedded on its landing page and exported for
  the video.

### C. High-fidelity Figma prototype → video — ONLY for not-yet-built UI
- **Why:** the native mobile push-notification + tap-to-approve flow does not exist yet (§3-mobile).
  Rather than fake it with a generic phone mockup, build it as a **high-fidelity Figma prototype in
  the real design tokens** and render to video — clearly tracked internally as "preview, pending
  the Expo notification screen," and **reshot natively the moment the scaffold lands.**
- **Tool:** Figma → screen recording / Figma's prototype-to-video, finished in Descript.
- **Scope limit:** prototype *only* the push banner + the approve gesture. Everything else is real
  capture. We never prototype a screen that already exists.

**What we never do:** generate a fake "AI dashboard" with Runway/Sora; use stock dashboard
footage; or show a screen that overclaims (e.g. a `schema-only` agent rendered as `live`). The
honesty rules baked into the product surfaces (`marketplace/page.tsx` runtime badges) apply to
the ads too.

---

## 3-mobile. Mobile-app demo strategy

The mobile app is `@agentplain/mobile` — Expo (expo-router 6, `react-native` 0.85), with
**`expo-notifications`**, `expo-secure-store`, `expo-web-browser` in `package.json`. As of
2026-06-06 the scaffold contains `src/api.ts`, `src/auth/session-store.ts`, `src/config.ts`,
`src/theme.ts` — i.e. **auth + API client + theming**, no feature screens yet.

| Mobile moment | Filmable today? | How |
|---|---|---|
| App theme / shell / splash | **Yes** | Expo web build or iOS sim — themed shell only |
| Magic-link sign-in | **Yes (auth scaffold exists)** | iOS sim recording of the magic-link entry |
| Home / today screen | **No — not built** | waits for scaffold |
| **Push notification (7am)** | **No — `expo-notifications` is a dep, no notification screen wired** | Wave-1: Figma prototype (method C); reshoot native when wired |
| **Tap-to-approve on mobile** | **Partial — the real web `/approvals` is responsive and films in a phone viewport** | Wave-1: capture real mobile-web approve; native gesture waits for the mobile approvals screen |

**Wave-1 mobile recommendation:** for the push-to-approve climax (Conner's "7am Sunday" beat),
**composite two pieces** — (1) a Figma-prototyped push banner in the real tokens (method C) for
the notification itself, and (2) the **real, responsive web `/approvals` screen filmed in a phone-
sized viewport** for the tap-approve. This is honest (the approve is real product), avoids faking
a screen that exists, and limits the prototype to the one piece of UI not yet built. **Re-shoot
fully native** (iOS-sim capture of the Expo notification + approvals screens) as soon as the
mobile scaffold lands those screens — schedule that as a Wave-1.5 creative refresh.

---

## 4. The exact climax product moment per concept (goes in the storyboard)

Each is a **~4-second sequence** of real product UI — the emotional peak where the value loop
becomes literal. These are now frames in STORYBOARDS/ and called out in SCRIPTS/.

### C1 — realty — **"6:30am approve"**
> The `/approvals` screen, header "Decisions waiting for you." The top PENDING card is the
> drafted counter-offer response (Buyer Inquiry Router / Chief of Staff agent). Sarah taps the
> card, changes one number in the editable draft, taps **Approve**. The card clears with a quiet
> "sent from your system" confirmation. The line "We draft; you decide; your existing system is
> what actually sends" sits beneath. **4 seconds. Real web capture (method A), phone-viewport
> alt for the 9:16 cut.**

### C2 — finance/CPA — **"23 drafts, one signature at a time"**
> March 17 on the workspace clock. The `/approvals` screen stacked with 23 PENDING doc-chase
> reminders (Document Chase / Client Inbound agents), each citing its missing item. The partner
> taps **Approve, Approve**, edits one, **Approve** — the queue count ticks down. The on-screen
> promise "Nothing leaves agentplain on its own. We draft; you decide." is held legible. **4
> seconds. Real web capture (method A). This frame is the literal answer to the ad's whole thesis.**

### C5 — trades — **"Approve the batch, dispatch by 1pm"**
> A laptop in a truck cab (or phone-viewport). The `/approvals` / lead queue shows drafted intake
> replies ranked by margin (Lead Router), then a supplement line-item rebuttal card (Supplement
> agent). The owner taps **Approve** on the batch; the dispatch/today view fills. **4 seconds.
> Real web capture (method A), phone-viewport primary (owner is in the field).**

---

## 5. Build deliverables this adds (tracked in PRODUCTION.md)

- [ ] Seeded dev workspace per concept (real-estate / cpa / home-services) via seed scripts.
- [ ] Live screen recordings of each concept's product mini-arc (method A, 4K + phone-viewport).
- [ ] One interactive demo per concept (Supademo/Arcade) — embedded on `/promo/[slug]` + exported.
- [ ] Figma push-banner prototype in real tokens (method C) — the one not-yet-built UI piece.
- [ ] Wave-1.5 reshoot ticket: native iOS-sim capture once the mobile notification + approvals
      screens land on `feat/mobile-app-v1-scaffold-2026-06-06`.
