# The 5-minute first-value path — Georgia RE broker, screen by screen

**Persona:** broker-owner or agent at a small Georgia brokerage (JTBD BO-1..BO-8, `lib/verticals/real-estate/content.ts`). Arrives from one of Conner's five design-partner emails or a referral. Liability-conscious, phone-first, allergic to setup work.

**The promise being kept:** the locked activation headline — *"Every lead gets a first touch in 5 minutes"* (`lib/plaino/killer-workflow.ts`, REAL_ESTATE entry). The path below is the product-side delivery of that promise, timed.

**Reality constraints honored throughout:** prod LLM key paused (degraded mode is the live experience); no outbound (agents draft, the broker's own systems send); card-at-signup and trial length come from `lib/billing/facts.ts`, nowhere else.

---

## The path, minute by minute

| Min | Screen | What happens | Default that makes it fast |
|---|---|---|---|
| 0:00 | **Landing** — `/real-estate` | Broker lands from the outreach email's link. Hero states the killer-workflow promise verbatim; one primary CTA: "Start free trial". Secondary: "How it works" (now unshadowed) and "Book a call" (booking env CTA, PR #355) | Outreach links point at `/real-estate`, not `/` — the vertical page pre-answers "is this for me" |
| 0:30 | **Sign-up** — `/signup?vertical=real-estate` | Email → magic link (or passkey). Trial terms and card requirement rendered from `facts.ts` — one sentence, no asterisks | `vertical=real-estate` carried in the URL so the workspace is born knowing its trade |
| 1:00 | **Check-your-email interstitial** | POST-confirm interstitial so a corporate mail scanner can't burn the magic link (audit 02 P1-5 fix) | Link opens straight into workspace creation |
| 1:30 | **Workspace creation** | One screen, two fields: brokerage name, confirm vertical (pre-selected: Real estate). No team invites, no checklist, no tour | Everything else (team, notifications, billing details) is deferred to moments where it earns its interruption |
| 2:00 | **Today tab, demo mode** — `/app/workspace/[id]` | `isDemoMode` is true (no approvals, no handoffs — `lib/demo/demo-mode.ts`), so the Today tab leads with the **killer-workflow runtime autoplaying**: "9:14pm — a new buyer lead landed while you were off the clock" → caught → enriched → drafted → two showing times → logged in CRM, with the saved-time counter ticking (calibrated minutes, `ACTION_MINUTES`) | Autoplay, no click required. Clearly labeled as a demonstration on sample data — the honesty is the differentiator |
| 3:00 | **The one connect card** | The runtime ends on the killer-workflow activation card: *"Connect Follow Up Boss and this runs on your real leads."* Single CTA. No marketplace grid, no second option on this screen | `unlockedBy: FOLLOW_UP_BOSS` is the registry's single named unlock — the path never presents a choice it doesn't need to |
| 3:30 | **Data disclosure** — the #306 page | One screen before credentials: what we read, what passes through, what Plaino remembers for the life of the account, in the broker's vocabulary. Continue → credential form | Routed through the disclosure by default (closes audit 05 P0-2). For this persona the disclosure **is** trust-building, not friction |
| 4:00 | **Connect Follow Up Boss** — api-key form | Paste API key (FUB Admin → API). Inline "where do I find this" expander with the exact click path. Verify happens on submit against the live provider — never from the DB row alone (the audit-10 decorative-test-connection anti-pattern) | Api-key connect mode per the send-path fix (PR #355) — the OAuth dead-end that killed this path is the one bug this spec is not allowed to inherit |
| 4:30 | **"It's live" state** — Today tab | Connections shows Follow Up Boss **connected**; the killer-workflow card flips to "see it run"; the next after-hours lead produces a real drafted first-touch in Approvals | If the prod key is paused (design-partner pre-pilot state), the card says so honestly: watching and logging run now; drafting turns on when the pilot starts (03 §4) |
| 5:00 | **Done** | Broker has seen the workflow run (demo), wired the one connector, and knows exactly what happens next and when | TTFDV clock stops at demo-completed OR first-draft-queued, whichever the funnel event records first |

## What is deliberately NOT on this path

- **No onboarding checklist, no product tour, no team invite step.** One workflow, one connector, one approval. Breadth is what the audits say we already over-built.
- **No email/calendar OAuth on the critical path.** Gmail/Outlook are live and useful, but they are minute-6 material — the killer workflow's unlock is FUB, and one connect action is all a first sitting gets.
- **No portal, no BYO storage, no discipline configuration.** Frozen (05).
- **No fake liveness.** Demo mode is labeled; the saved-time counter only ever renders `sum(perActionMinutes × count)` over completed steps (`lib/workflows/runtime.ts`); nothing invents numbers at render time.

## UX affordances that carry the path

1. **Progress ribbon** (3 dots: See it → Connect it → It's live) pinned during minutes 2–5. Orientation, not gamification.
2. **"Skip to my workspace"** always visible in demo mode — the runtime is a first impression, never a cage.
3. **Degraded banner** (PR #276) stays universal but reads per 03: "Paused" state language, with the one next action named.
4. **44px touch targets** on every CTA in this path (audit 03 F4) — this persona activates from a phone in a parking lot between showings.
5. **Loading states** for Connections/Reports (`loading.tsx`, audit 03 F1/F2) — no blank tabs inside the first five minutes.

## Gaps this spec closes (with their audit lineage)

| Gap | Lineage | Fix owner |
|---|---|---|
| Connect CTA dead-ends for api-key providers | audit 05 P1-5; journey `activation.connect.1` | Engineering E1 (verify #355 on main) |
| Connect bypasses the data disclosure | audit 05 P0-2 | Engineering E2 |
| Trial/card copy contradicts `facts.ts` | audit 10 P1-10/11 | Engineering E3 + Conner (7d vs 30d) |
| Magic link burned by mail scanners | audit 02 P1-5 | Engineering (day 4–7 window) |
| No measurement of any of this | audit 1: zero tracking | Data DA1 (5 funnel events) |

Everything downstream of the Connect button already exists on main: runtime (PR #303), demo predicate, synthetic RE dataset, registry card. **This path is a wiring-and-truth job, not a build job** — which is exactly why it fits the 14-day window.
