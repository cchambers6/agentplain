/**
 * lib/verticals/launch.ts
 *
 * THE LAUNCH WINDOW — which slugs are ON SALE today.
 *
 * PARAMETERISED. The launch decision is ONE named constant
 * (`LAUNCH_VERTICAL_SLUG`, below). Nothing else in the codebase names a
 * vertical to make this decision. Switching the launch vertical is a
 * one-line edit here plus content; it is not a diff threaded through nine
 * files. (The predecessor, PR #440 `launch/narrow-to-law`, threaded `law`
 * through the surfaces as literal prose. The mechanism it introduced was
 * right; the hardcoding was the part that had to go.)
 *
 * TWO GATES, DIFFERENT QUESTIONS — both must be true before a customer pays:
 *
 *   readiness.ts — "CAN we serve this vertical?" Registry truth: the killer
 *                  skill is catalog-live AND has a production caller. Never
 *                  edited to make a go-to-market decision.
 *   launch.ts    — "ARE we selling it today?" A product decision about how
 *                  wide the front door is open.
 *
 * THE PROPERTY THIS MODULE GUARANTEES:
 *
 *   ON_SALE_SLUGS is a SUBSET of the reachable set, BY CONSTRUCTION.
 *
 * `ON_SALE_SLUGS` is not a list someone writes. It is
 * `LAUNCH_INTENT ∩ canTakeMoney`, computed at module load. So the launch
 * constant can only ever CLOSE a door: naming a slug that cannot take money
 * silently drops it from the on-sale set rather than opening it. The test
 * (`launch.test.ts`) then fails LOUDLY on the discrepancy, so a silent drop
 * is never also a quiet one. Structural first, asserted second — #440's
 * version was asserted only, which meant a red test was the only thing
 * standing between a mis-set constant and a vertical on sale.
 *
 * WHAT `canTakeMoney` CHECKS — three legs, not two. The third leg is the one
 * #440 did not have, and it is load-bearing:
 *
 *   1. The slug is published (`lib/verticals/index.ts`).
 *   2. It clears the money gate: readiness says `supported`, OR it is on the
 *      `SIGNUP_ON_RAMP_ALLOWLIST` hatch in `readiness.ts`.
 *   3. It can actually be PERSISTED — `verticalEnumFromSlug(slug)` is
 *      non-null. `app/(product)/app/actions.ts` requires the Prisma `Vertical`
 *      enum at line 75, BEFORE it consults the on-ramp allowlist at line 99.
 *      A slug with no enum is rejected with "Pick a vertical to continue" and
 *      never reaches the hatch at all. Leg 2 passing while leg 3 fails is
 *      exactly the `general` case (see below): allowlisted, and unbuyable.
 *
 * MEASURED ON origin/main (2026-08-31), by executing the real `signUpAction`:
 *   general -> {"ok":false,"error":"Pick a vertical to continue"}
 * `general` has content and is on `SIGNUP_ON_RAMP_ALLOWLIST`, but there is no
 * `GENERAL` member of the Prisma `Vertical` enum and no `general` key in
 * `SLUG_TO_ENUM` (`lib/auth/vertical-enum.ts:17-28`). The on-ramp hatch is
 * unreachable code with respect to the only slug it names.
 */

import { verticalEnumFromSlug } from '@/lib/auth/vertical-enum';
import { VERTICAL_SLUGS, ON_RAMP_SLUGS, getVerticalContent } from './index';
import {
  resolveVerticalReadiness,
  SIGNUP_ON_RAMP_ALLOWLIST,
} from './readiness';

function normalise(slug: string): string {
  return String(slug ?? '')
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------
// THE PARAMETER. This is the whole launch decision.
// ---------------------------------------------------------------------

/**
 * The one slug the launch window opens, or `null` for "nothing is on sale."
 *
 * Set it to a published slug — one of the locked ten
 * (`lib/verticals/index.ts -> VERTICAL_SLUGS`) or an on-ramp surface
 * (`ON_RAMP_SLUGS`). Everything downstream — the signup gate, the picker,
 * the hero CTA, the pricing banner, the marketing chat prompt — derives from
 * this and from `getVerticalContent(slug).name`. No surface hardcodes a
 * vertical name.
 *
 * ON THIS BRANCH IT IS SET TO `'general'` — the candidate under
 * consideration, prepared for evaluation, NOT ratified. With this value the
 * derived on-sale set is EMPTY and `launch.test.ts` FAILS BY DESIGN with
 * "nothing is on sale". That failure is the finding, not a bug in the
 * mechanism: see `launchIntentDiagnostics()` and the module header. Setting
 * this to `'law'`, `'cpa'` or `'real-estate'` turns the suite green with no
 * other edit — which is the point of parameterising it.
 */
export const LAUNCH_VERTICAL_SLUG: string | null = 'general';

// ---------------------------------------------------------------------
// Derivation. Nothing below is a decision; it is all consequence.
// ---------------------------------------------------------------------

/** What the launch constant ASKS for, before any narrowing is applied. */
export const LAUNCH_INTENT: readonly string[] = LAUNCH_VERTICAL_SLUG
  ? [normalise(LAUNCH_VERTICAL_SLUG)]
  : [];

/** Why a slug the launch constant named cannot in fact be sold. */
export type MoneyBlocker =
  | 'not-published'
  | 'readiness-unsupported'
  | 'no-prisma-enum';

/**
 * The three-leg money gate. Returns `null` when the slug can genuinely take
 * money today, or the FIRST blocking reason.
 *
 * Total over any input: junk resolves to `'not-published'`, which is the
 * safe answer. Never throws — a launch module that throws at import would
 * take the whole marketing tree down.
 */
export function moneyBlockerFor(verticalSlug: string): MoneyBlocker | null {
  const slug = normalise(verticalSlug);

  // Leg 1 — published at all.
  if (!getVerticalContent(slug)) return 'not-published';

  // Leg 2 — clears the money gate: readiness-supported, or on the hatch.
  let supported = false;
  try {
    supported = resolveVerticalReadiness(slug).supported;
  } catch {
    supported = false; // fail closed, same posture as isVerticalSupportedSafe
  }
  const hatched = SIGNUP_ON_RAMP_ALLOWLIST.includes(slug);
  if (!supported && !hatched) return 'readiness-unsupported';

  // Leg 3 — can be PERSISTED. app/(product)/app/actions.ts:75 demands the
  // Prisma enum before it ever reaches the hatch at :99.
  if (verticalEnumFromSlug(slug) === null) return 'no-prisma-enum';

  return null;
}

/** True iff the slug can genuinely reach paid signup, launch window aside. */
export function canTakeMoney(verticalSlug: string): boolean {
  return moneyBlockerFor(verticalSlug) === null;
}

/**
 * Every slug that can reach paid signup today.
 *
 * INTERSECTION, not a list. This is what makes the subset property
 * structural: the launch constant can only ever remove.
 */
export const ON_SALE_SLUGS: readonly string[] =
  LAUNCH_INTENT.filter(canTakeMoney);

/** The on-sale slugs that are one of the locked ten. */
export const LAUNCH_VERTICAL_SLUGS: readonly string[] = ON_SALE_SLUGS.filter(
  (s) => VERTICAL_SLUGS.includes(s),
);

/** The on-sale slugs that are on-ramp surfaces. */
export const LAUNCH_ON_RAMP_SLUGS: readonly string[] = ON_SALE_SLUGS.filter(
  (s) => ON_RAMP_SLUGS.includes(s),
);

/** Machine reason for a hold — drives copy, never a bare boolean. */
export type LaunchHoldReason = 'outside-launch-window';

/**
 * Is this slug on sale today? Case/whitespace tolerant, total over any
 * string. An unknown slug is not on sale, which is the safe answer.
 */
export function isVerticalOnSale(verticalSlug: string): boolean {
  return ON_SALE_SLUGS.includes(normalise(verticalSlug));
}

/**
 * `null` when the slug is on sale; otherwise the machine reason the surface
 * should render. Deliberately distinct from the readiness reason: "we have
 * not opened this yet" and "the flagship workflow cannot fire" are different
 * truths and the customer deserves the accurate one.
 */
export function launchHoldReason(
  verticalSlug: string,
): LaunchHoldReason | null {
  return isVerticalOnSale(verticalSlug) ? null : 'outside-launch-window';
}

/** Slug of the one open door, or `null` when nothing is on sale. */
export function launchVerticalSlug(): string | null {
  return ON_SALE_SLUGS[0] ?? null;
}

/**
 * Display name of the one open door, for copy that points a held visitor at
 * it ("Run a law firm instead? That one's open today."). `null` when nothing
 * is on sale — every caller must handle that, because it is a real state and
 * on this branch it is the CURRENT state.
 */
export function launchVerticalName(): string | null {
  const slug = launchVerticalSlug();
  if (!slug) return null;
  return getVerticalContent(slug)?.name ?? null;
}

/**
 * Every slug the launch constant asked for that the money gate dropped, with
 * the reason. Empty = the constant got exactly what it asked for.
 *
 * This exists so a dropped slug is never a SILENT drop: `launch.test.ts`
 * asserts this is empty and prints the blocker when it is not, and an
 * operator reading a red suite gets the actionable reason rather than an
 * off-by-one list diff.
 */
export function launchIntentDiagnostics(): Array<{
  slug: string;
  blocker: MoneyBlocker;
}> {
  return LAUNCH_INTENT.map((slug) => ({
    slug,
    blocker: moneyBlockerFor(slug),
  })).filter(
    (d): d is { slug: string; blocker: MoneyBlocker } => d.blocker !== null,
  );
}
