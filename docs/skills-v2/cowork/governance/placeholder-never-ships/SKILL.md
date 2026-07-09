---
name: placeholder-never-ships
description: No placeholder — a {{token}} in copy, a labeled stand-in asset, an unresolved link — ever reaches a customer or prospect. Every placeholder convention needs a blocking gate or a final-quality fallback. Use before any send, any asset PR, any launch surface, and when designing a swap-later convention.
---

# Placeholder never ships (token scan + launch gate)

Two recorded shipwrecks, one rule: the swap-later pattern is fine for parallel work, but only with an enforcement mechanism — otherwise the swap never happens and the customer sees the scaffolding.

## The incidents

- **27 labeled SVGs in production.** `PlainoScene` stand-ins with literal "PLACEHOLDER · …" text baked in shipped and sat live on pricing, 11 vertical pages, homepage ×3, auth, and legal — no CI check failed, nothing flagged it (`feedback_placeholder_convention_needs_launch_gate`).
- **The `{{CALENDLY_LINK}}` dead-end.** Every prior outreach draft ended at a booking-link token that was never wired; prospects would have received the literal token.

## Procedure

**For copy/sends (the outreach kit's pre-send guard):**
1. **Token scan:** search the outgoing text for `{{`. Zero hits or no send.
2. **Fallback beats blocking:** the booking link is optional, the offered times are not — if `{{booking-url}}` isn't live, delete the line and book by reply; the email works without it. Design every placeholder with a works-without-it fallback.
3. Links that do ship resolve to live destinations (click them).

**For assets/surfaces:**
1. Any placeholder convention gets ONE of: (a) a **launch-blocking check** (grep rendered output for the placeholder label/filename), or (b) a **final-quality default** — a real brand motif that renders acceptably if the swap never happens, so "never swapped" degrades to "plain," not to "PLACEHOLDER".
2. Audit for existing labeled stand-ins before GA — the 27 known slots were found only by a manual audit.

## Rules

- **A swap contract without an expiry gate is a launch blocker in disguise.**
- **Brand-gate R2 mechanizes the asset half** (no placeholder SVGs on launch surfaces) — keep it green, don't baseline around it ([[brand-gate-check]]).
- **Same family as env-var wiring:** a CTA pointing at an unset `NEXT_PUBLIC_BOOKING_URL` is a placeholder with extra steps — verify the variable resolves in the deployed environment before the surface ships.
- Pairs with the pre-send truth scan ([[truth-wave-check]]) and, for outreach, the manual voice read ([[voice-gate-check]] doesn't scan `docs/outreach/`).

## Example invocation

> **Input:** "Send follow-up 2 to the Tuesday cohort."
>
> **Output shape:** token scan (0 hits) → both offered time-windows confirmed open on the calendar → booking line either resolves live or is deleted → send logged to the CRM row. Any `{{` hit stops the send and names the unresolved token.

## Compose with

[[brand-gate-check]] · [[truth-wave-check]] · [[voice-gate-check]] · [[wired-not-just-built]] (the code-side cousin: existing ≠ wired)

## Origin

`feedback_placeholder_convention_needs_launch_gate` (2026-06-10 audit, 27 live "PLACEHOLDER" SVGs) · `docs/outreach/2026-07-03-design-partner-kit/03-reply-follow-up-chain.md` (the token-scan guard + "the token itself must never reach a prospect") · `docs/outreach/2026-07-03-design-partner-kit/01-first-touch-emails.md` pre-send checks.
