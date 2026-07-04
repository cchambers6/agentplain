# 04 — What Sales needs from the other heads (14-day window)

Ranked within each department by proximity to the three scoreboard numbers (sends / replies / call booked). Everything here is small; nothing is a new program. If a head can only do one item, do the first one on their list.

---

## Marketing — the case-study carrot, publishable

1. **One-pager, sendable form (by Thu 07-09).** The warm-yes reply (outreach kit doc 03) promises a one-pager; today it exists as repo markdown. Need: a clean single page (PDF or public URL) with claims traced to `CLAIMS_GROUND_TRUTH.md`, design-partner terms, and zero unresolved tokens. This is the first artifact a warm reply receives — it must not look like an internal doc.
2. **The case-study carrot made visible (by 07-13).** Kit doc 05 defines it; sales needs the *shape* shown to prospects: a one-screen mock of what "a case study you approve word by word" will look like (structure only, clearly labeled as the template — no fabricated numbers, no fake logos). On the DP-TALK call this converts the testimonial ask from abstract to concrete.
3. **Recorded product walkthrough (by end of week 2).** The proof-ladder substitute (deep-dive doc 02 §3) and the async alternative for prospects who won't book. Synthetic-data runtime, fabricated-data disclosure on screen, under 15 minutes. Unblocks the DISCOVERY unstick play ("watch it whenever").
4. **Standing constraint:** no new positioning, no new claims. Anything customer-visible passes voice-gate + claims spine.

## Product — a demo that cannot embarrass us

1. **Named demo state, verified weekly (by Sun 07-05, then every Sunday).** The 20-minute playbook names the synthetic-data demo runtime (PR #303) as *the* demo. Sales needs: the exact URL/workspace, seeded with the real-estate workflow, working **without the prod Anthropic key** (the runtime is LLM-free by design — verify that's still true on current main), and a reset path so call #2 doesn't inherit call #1's edits.
2. **The demo beat, scripted (by first booked call).** One workflow: draft in queue → edit → approve. Confirm the queue UI shows the draft/approve/reject-with-reason loop cleanly on a screen-share at laptop resolution. If any click in that path is broken on main, sales needs to know *before* a call books, not during.
3. **Activation readiness signal (standing).** The moment a discovery call books, sales tells Product; Product owns confirming the Week-0 stack-check path (email + QBO + DocuSign connect) actually works for a real workspace — the connectors audit found tiles that lie. Do not let sales sell a connect that 404s.

## Engineering — the send path, verified end to end

1. **Production verification sweep (by Sun 07-05).** PR #355 landed the pieces; verify on prod: `/how-it-works` resolves (no stale redirect), `/contact` renders, booking CTA appears once `NEXT_PUBLIC_BOOKING_URL` is set, `/operator/outreach` CRM-lite loads and persists rows on doc-06 stages. One pass/fail note to Conner Sunday night. (Known: main fails 41 pre-existing tests — don't re-diagnose; this is a five-URL manual check.)
2. **Cost-governor verification done-and-documented (by 07-10).** CEO open question #3, recommendation B: prod-key un-pause triggers on first booked discovery call, *pre-verified so the switch is instant*. Engineering's deliverable is the verification, not the un-pause — sales will call the trigger.
3. **Saved-time writers (before first pilot week 1, not this window).** Flagged now so it's sequenced: audit 9's P0 (4/7 calibrated actions write no saved-time) breaks case-study measurement and the guarantee. Must be fixed before a partner activates — that's ~2–4 weeks out if Monday goes well.

## Design — two assets, through the creative pipeline

1. **One-pager layout (with Marketing, by Thu 07-09).** Heritage tokens, Plaino brand rules, produced via the creative-router (tools or humans — never improvised SVG/PNG, per the ratified rule). Print-clean and attach-clean.
2. **Conner's LinkedIn banner (by 07-13).** Prospects 2 and 5 will look at Conner's profile within minutes of the email — right now the founder is the only proof surface we have (founder-bio decision, CEO question #1d). One banner: agentplain, the tagline, the robot-dog mark per the public-mark ratification. No new brand elements.
3. **Explicitly not needed:** pitch deck, website redesign, new icons. Don't spend the cycles.

---

## The one thing Sales owes everyone back

A verbatim market-feedback loop: every reply, objection, and no-with-reason logged and routed — product asks to Product, claim pushback to Marketing, connect-path friction to Engineering. The first five prospects are the cheapest user research this company will ever run, and the departments should get it raw, same week, not summarized a month later.
