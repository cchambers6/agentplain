/**
 * lib/verticals/launch.ts
 *
 * THE LAUNCH WINDOW — which verticals are ON SALE today.
 *
 * This is a SECOND, NARROWER gate that sits on top of
 * `lib/verticals/readiness.ts`. The two answer different questions and both
 * must be true before a customer can pay:
 *
 *   readiness.ts  — "CAN we serve this vertical?" Derived from registry
 *                   truth (catalog `runtime: 'live'` + a production caller).
 *                   Never edited to make a launch decision.
 *   launch.ts     — "ARE we selling this vertical today?" A product decision
 *                   about how wide the front door is open. It can only ever
 *                   SHRINK the readiness answer, never widen it — the
 *                   invariant is asserted in `launch.test.ts`.
 *
 * Why a separate module: the launch decision is not registry truth. Encoding
 * "we are opening one vertical at a time" inside the readiness resolver would
 * corrupt the one place that answers "can the flagship workflow actually
 * fire?" — and the day we widen the launch window, someone would have to
 * loosen the resolver to do it. Keeping them apart means the safety gate is
 * never touched by a go-to-market call.
 *
 * TODAY: `law` is the launch vertical. `general` stays as the on-ramp — it
 * is not one of the locked ten, it is served by the horizontal fleet, and it
 * is the honest landing path for everyone the launch window excludes.
 *
 * Everything else is OFF SALE: the surfaces route to the existing honest
 * waitlist (no charge, no workspace, a real LeadCapture row an operator
 * sees), and the marketing pages say so plainly instead of advertising a
 * trial that the signup gate will refuse.
 */

/**
 * Ratified verticals open for paid signup today. A slug here MUST also be
 * readiness-supported — `launch.test.ts` asserts it, so this list can never
 * be used to smuggle an unserveable vertical past the readiness gate.
 */
export const LAUNCH_VERTICAL_SLUGS: readonly string[] = ['law'];

/**
 * On-ramp surfaces open for paid signup today. Mirrors
 * `SIGNUP_ON_RAMP_ALLOWLIST` in `readiness.ts`; the test pins the two
 * together so the launch window and the readiness hatch cannot disagree.
 */
export const LAUNCH_ON_RAMP_SLUGS: readonly string[] = ['general'];

/** Every slug that can reach paid signup today, launch window applied. */
export const ON_SALE_SLUGS: readonly string[] = [
  ...LAUNCH_VERTICAL_SLUGS,
  ...LAUNCH_ON_RAMP_SLUGS,
];

/** Machine reason for a hold — drives copy, never a bare boolean. */
export type LaunchHoldReason = 'outside-launch-window';

/**
 * Is this slug on sale today? Case/whitespace tolerant, total over any
 * string (an unknown slug is not on sale, which is the safe answer).
 */
export function isVerticalOnSale(verticalSlug: string): boolean {
  const slug = String(verticalSlug ?? '')
    .trim()
    .toLowerCase();
  return ON_SALE_SLUGS.includes(slug);
}

/**
 * `null` when the slug is on sale; otherwise the machine reason the surface
 * should render. Separate from the readiness reason on purpose: "we have not
 * opened this vertical yet" and "the flagship workflow cannot fire" are
 * different truths and the customer deserves the accurate one.
 */
export function launchHoldReason(verticalSlug: string): LaunchHoldReason | null {
  return isVerticalOnSale(verticalSlug) ? null : 'outside-launch-window';
}

/**
 * The launch vertical's slug, for copy that points a held visitor at the one
 * door that is open ("Run a law firm instead? That one's open today.").
 */
export const LAUNCH_VERTICAL_SLUG = LAUNCH_VERTICAL_SLUGS[0];
