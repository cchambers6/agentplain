/**
 * lib/plaino/degraded-copy.ts
 *
 * Single source of truth for the customer-facing copy Plaino shows when a
 * turn can't complete. Imported by BOTH the server route (`app/api/chat`)
 * and the client widget (`components/marketing/PlainoWidget`) so the two
 * surfaces never drift, and by the no-jargon snapshot test so a future
 * edit can't quietly reintroduce a stack-trace phrasing.
 *
 * Voice: Plaino is a working sheepdog (project_plaino_named_agent). A
 * failure should sound like the dog had a moment, not like an HTTP error.
 * Lowercase, calm, no exclamation points, no emoji — mirrors the widget
 * greeting. Every line LEADS INTO the email hand-off, because a bot
 * failure is a lead-capture opportunity, not an apology
 * (project_no_outbound_architecture: a real person follows up; no drip).
 *
 * Hard rule, enforced by tests/plaino-degraded-copy.test.ts: none of these
 * strings may contain engineering-internal phrasing — no "line", "reaching",
 * "endpoint", "API", "stack", "500", "request", "fetch", "server".
 */

/**
 * Spend is paused (`ANTHROPIC_API_KEY` is the `sk-ant-PAUSED-…` sentinel).
 * A durable, expected state — promise a same-day human follow-up.
 */
export const PLAINO_PAUSED_REPLY =
  "Plaino's resting just now — but a person will follow up the same day. " +
  'leave your email below and we’ll be in touch.';

/**
 * A transient model hiccup (rate limit, upstream blip, empty completion).
 * Invite a retry, and offer the hand-off so a busy moment still captures
 * the lead.
 */
export const PLAINO_TRANSIENT_REPLY =
  "Plaino’s catching his breath — give it a moment and try again. " +
  'or leave your email below and a person will follow up.';

/**
 * Client-side only: the browser couldn't even complete the round-trip
 * (offline, dropped connection). Same calm posture.
 */
export const PLAINO_NETWORK_REPLY =
  "Plaino didn’t quite catch that — try again in a moment. " +
  'or leave your email below and a person will follow up.';

/** Every customer-facing degraded string, for the no-jargon snapshot test. */
export const PLAINO_DEGRADED_STRINGS = [
  PLAINO_PAUSED_REPLY,
  PLAINO_TRANSIENT_REPLY,
  PLAINO_NETWORK_REPLY,
] as const;
