/**
 * lib/claims/capability-claims.ts
 *
 * The three claim-vs-code checkers. Pure functions over injected registry
 * data — see `types.ts` for why the injection matters.
 *
 * None of these import the real registries. `capability-claims.test.ts`
 * binds them to production data for the real assertions AND to synthetic
 * violating fixtures for the deliberate-failure assertions.
 */

import type { ClaimViolation } from './types';

// ─────────────────────────────────────────────────────────────────────────
// Check 1 — roster capability vs. skill that can actually fire
// ─────────────────────────────────────────────────────────────────────────

/** Minimal view of a `lib/verticals/types.ts → AgentRosterEntry`. */
export interface RosterCardLike {
  slug: string;
  runtime?: 'live' | 'rooting';
  owns?: readonly string[];
  boundSkill?: string;
}

export interface VerticalRosterLike {
  slug: string;
  agentRoster?: readonly RosterCardLike[];
}

/** Minimal view of a `lib/skills/registry.ts → SkillCatalogEntry`. */
export interface CatalogEntryLike {
  slug: string;
  runtime?: 'live' | 'schema-only' | 'coming-soon';
}

export interface RosterClaimInput {
  verticals: readonly VerticalRosterLike[];
  catalog: readonly CatalogEntryLike[];
  /**
   * Skill slugs a declared production caller fires — the union of
   * `SWEEP_DISPATCH_MANIFEST` skill slugs and `NON_SWEEP_LIVE_SKILLS` keys
   * from `lib/skills/sweep-dispatch-manifest.ts`, which is the repo's own
   * single source of truth for "this skill has a caller."
   */
  declaredCallers: ReadonlySet<string>;
}

/**
 * A roster card with `runtime: 'live'` and a `boundSkill` renders the status
 * "Watching — ready when triggered" on `/app/workspace/[id]/agents`
 * (app/(product)/app/workspace/[id]/agents/page.tsx). That sentence is a
 * claim with two halves, and BOTH have to hold:
 *
 *   • "ready"     — the bound skill resolves to a SKILL_CATALOG entry whose
 *                   `runtime` is `'live'`. The catalog's own definition of
 *                   `schema-only` is "the module exists and has tests, but NO
 *                   production caller fires it."
 *   • "triggered" — some declared caller can actually fire it. A skill in
 *                   neither SWEEP_DISPATCH_MANIFEST nor NON_SWEEP_LIVE_SKILLS
 *                   has nothing that will ever trigger it, so "ready when
 *                   triggered" resolves to never.
 *
 * Cards that are live via `owns[]` (the V1 inbox-loop attribution path) are
 * NOT checked here: their liveness is a statement about the inbox chain, not
 * about a catalog skill, and `tests/vertical-roster-bindings.test.ts` already
 * pins that table.
 */
export function checkRosterCapabilityClaims(
  input: RosterClaimInput,
): ClaimViolation[] {
  const catalogBySlug = new Map(input.catalog.map((e) => [e.slug, e]));
  const violations: ClaimViolation[] = [];

  for (const vertical of input.verticals) {
    for (const card of vertical.agentRoster ?? []) {
      if (card.runtime !== 'live') continue;
      const skillSlug = card.boundSkill;
      if (!skillSlug) continue;

      const subject = `${vertical.slug}/${card.slug}`;
      const entry = catalogBySlug.get(skillSlug);

      if (!entry) {
        violations.push({
          check: 'roster-capability',
          subject,
          detail:
            `Fleet card renders "Watching — ready when triggered" bound to skill ` +
            `"${skillSlug}", which is not in SKILL_CATALOG at all.`,
          remedy:
            `Register "${skillSlug}" in lib/skills/registry.ts, or set the card's ` +
            `runtime to 'rooting' with a rootingNote.`,
        });
        continue;
      }

      const runtime = entry.runtime ?? 'schema-only';
      if (runtime !== 'live') {
        violations.push({
          check: 'roster-capability',
          subject,
          detail:
            `Fleet card renders "Watching — ready when triggered" bound to skill ` +
            `"${skillSlug}", whose catalog runtime is '${runtime}' — the catalog's ` +
            `own word for "no production caller fires it."`,
          remedy:
            `Wire a caller and set runtime:'live' on the catalog entry, or set the ` +
            `card's runtime to 'rooting' with a rootingNote naming what it waits on.`,
        });
        continue;
      }

      if (!input.declaredCallers.has(skillSlug)) {
        violations.push({
          check: 'roster-capability',
          subject,
          detail:
            `Fleet card renders "Watching — ready when triggered" bound to skill ` +
            `"${skillSlug}", which is catalog-live but appears in neither ` +
            `SWEEP_DISPATCH_MANIFEST nor NON_SWEEP_LIVE_SKILLS — nothing declared ` +
            `can trigger it.`,
          remedy:
            `Declare the caller in lib/skills/sweep-dispatch-manifest.ts, or set the ` +
            `card's runtime to 'rooting'.`,
        });
      }
    }
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────
// Check 2 — connector tile action vs. OAuth scope actually requested
// ─────────────────────────────────────────────────────────────────────────

/** Minimal view of a `lib/integrations/marketplace.ts → MarketplaceEntry`. */
export interface ConnectorTileLike {
  id: string;
  name: string;
  description: string;
  scopes: readonly string[];
  status: string;
  connectMode?: string;
}

export interface AdvertisedActionRule {
  /** Short action name used in the violation subject. */
  action: string;
  /** Matches the tile's customer-facing copy (name + description). */
  claimPattern: RegExp;
  /** At least one requested scope must match this for the claim to hold. */
  scopePattern: RegExp;
  /** Named in the failure so the fix is obvious. */
  scopeDescription: string;
}

/**
 * The vocabulary is deliberately SMALL and high-confidence. Every rule here
 * is one where the mapping from the advertised verb to the required OAuth
 * scope is mechanical and not a judgement call — reading mail does not need
 * a calendar scope, and no amount of mail scope will book a meeting.
 *
 * Resist growing this with fuzzy verbs ("coordinate", "organize"). A rule
 * that produces arguable failures gets argued with, then ignored, and an
 * ignored gate is the thing this whole layer exists to stop.
 */
export const ADVERTISED_ACTION_RULES: readonly AdvertisedActionRule[] = [
  {
    action: 'schedule',
    claimPattern: /schedul/i,
    scopePattern: /calendar/i,
    scopeDescription: 'a calendar scope (e.g. Calendars.ReadWrite, .../auth/calendar.events)',
  },
  {
    action: 'sign',
    claimPattern: /\bsign\b|signature|e-sign/i,
    scopePattern: /signature|esign/i,
    scopeDescription: 'a signature scope (e.g. DocuSign "signature")',
  },
];

/**
 * A tile the customer can CONNECT is a tile whose advertised actions they
 * will reasonably expect to work. When the tile sells an action for which the
 * connect flow never asks the provider for permission, every call of that
 * kind fails at the provider with a 403 the customer never sees — the tile
 * says "connected", the action silently does nothing.
 *
 * Scoped to `status: 'available'` OAuth tiles: a coming-soon tile has no
 * connect flow to be wrong about, and an api-key tile does not negotiate
 * scopes at all.
 */
export function checkConnectorActionScopes(
  tiles: readonly ConnectorTileLike[],
  rules: readonly AdvertisedActionRule[] = ADVERTISED_ACTION_RULES,
): ClaimViolation[] {
  const violations: ClaimViolation[] = [];

  for (const tile of tiles) {
    if (tile.status !== 'available') continue;
    if (tile.connectMode === 'api-key') continue;

    const copy = `${tile.name} ${tile.description}`;
    for (const rule of rules) {
      if (!rule.claimPattern.test(copy)) continue;
      const satisfied = tile.scopes.some((s) => rule.scopePattern.test(s));
      if (satisfied) continue;

      violations.push({
        check: 'connector-action-scope',
        subject: `${tile.id}:${rule.action}`,
        detail:
          `Connector tile "${tile.name}" advertises "${rule.action}" in its ` +
          `customer-facing copy, but the connect flow requests no matching scope ` +
          `(requested: ${tile.scopes.length > 0 ? tile.scopes.join(', ') : 'none'}). ` +
          `Every ${rule.action} call through this connector fails at the provider.`,
        remedy:
          `Add ${rule.scopeDescription} to the entry's scopes and wire the adapter, ` +
          `or remove the "${rule.action}" claim from the tile copy.`,
      });
    }
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────
// Check 3 — readiness manifest vs. registry reachability
// ─────────────────────────────────────────────────────────────────────────

export interface ReadinessVerdict {
  supported: boolean;
  reason: string;
}

export interface ReachabilityInput {
  /** The locked ten — `lib/verticals/index.ts → VERTICAL_SLUGS`. */
  registrySlugs: readonly string[];
  /** On-ramp surfaces — `lib/verticals/index.ts → ON_RAMP_SLUGS`. */
  onRampSlugs: readonly string[];
  /**
   * Slugs the signup action lets through WITHOUT a readiness verdict — the
   * escape hatch. Must be exported from `lib/verticals/readiness.ts` so the
   * resolver and the gate cannot hold different opinions.
   */
  signupOnRampAllowlist: readonly string[];
  /** `resolveVerticalReadiness`, injected. */
  readiness: (slug: string) => ReadinessVerdict;
}

/**
 * Verticals are gated by the readiness manifest in `lib/verticals/readiness.ts`
 * — NOT by a content file's `runtime: 'live'` or by `VerticalContent.status`.
 * (A prior audit asserted the `runtime:'live'` version; it is wrong. The
 * signup gate at app/(product)/app/actions.ts calls `isVerticalSupportedSafe`,
 * which reads the readiness resolver and nothing else.)
 *
 * What this check enforces is that the resolver is the ONLY authority:
 *
 *   1. Every published slug resolves through the resolver without throwing.
 *      A slug the resolver cannot answer for is a slug the signup gate is
 *      guessing about.
 *   2. Every escape-hatch slug is a real on-ramp surface. An escape hatch
 *      that names one of the locked ten routes a customer past the readiness
 *      gate into paid signup for a vertical we may not serve — which is the
 *      exact outcome the resolver exists to prevent.
 *   3. No slug is both `supported` and on the escape-hatch list. A redundant
 *      hatch masks the day readiness flips to unsupported: the gate keeps
 *      letting the customer pay and nothing surfaces the change.
 *   4. Every escape-hatch slug is published. A hatch for a slug that does not
 *      exist is dead code that will be misread as coverage.
 */
export function checkVerticalReachability(
  input: ReachabilityInput,
): ClaimViolation[] {
  const violations: ClaimViolation[] = [];
  const published = new Set([...input.registrySlugs, ...input.onRampSlugs]);
  const onRamps = new Set(input.onRampSlugs);
  const lockedTen = new Set(input.registrySlugs);

  for (const slug of published) {
    let verdict: ReadinessVerdict;
    try {
      verdict = input.readiness(slug);
    } catch (err) {
      violations.push({
        check: 'vertical-reachability',
        subject: slug,
        detail:
          `Published vertical "${slug}" makes the readiness resolver throw ` +
          `(${err instanceof Error ? err.message : String(err)}), so the signup gate ` +
          `has no verdict for a slug the customer can select.`,
        remedy:
          `Give "${slug}" an entry in KILLER_WORKFLOW_SKILL_BY_VERTICAL_SLUG, or ` +
          `remove it from the registry.`,
      });
      continue;
    }

    if (verdict.supported && input.signupOnRampAllowlist.includes(slug)) {
      violations.push({
        check: 'vertical-reachability',
        subject: `${slug}:redundant-hatch`,
        detail:
          `"${slug}" is both readiness-supported and on the signup on-ramp ` +
          `allowlist. The allowlist would keep taking money on the day readiness ` +
          `flips to unsupported, and nothing would surface the change.`,
        remedy: `Drop "${slug}" from SIGNUP_ON_RAMP_ALLOWLIST — readiness already covers it.`,
      });
    }
  }

  for (const slug of input.signupOnRampAllowlist) {
    if (!published.has(slug)) {
      violations.push({
        check: 'vertical-reachability',
        subject: `${slug}:unpublished-hatch`,
        detail:
          `Signup on-ramp allowlist names "${slug}", which is in neither the ` +
          `vertical registry nor the on-ramp registry. It reads as coverage and is not.`,
        remedy: `Remove "${slug}" from SIGNUP_ON_RAMP_ALLOWLIST, or publish the surface.`,
      });
      continue;
    }
    if (lockedTen.has(slug) && !onRamps.has(slug)) {
      violations.push({
        check: 'vertical-reachability',
        subject: `${slug}:hatch-bypasses-gate`,
        detail:
          `Signup on-ramp allowlist names "${slug}", one of the locked ten verticals. ` +
          `The allowlist bypasses the readiness gate entirely, so this slug reaches ` +
          `paid signup whether or not its killer workflow can fire.`,
        remedy:
          `Remove "${slug}" from SIGNUP_ON_RAMP_ALLOWLIST. The allowlist is only for ` +
          `on-ramp surfaces served by the horizontal fleet.`,
      });
    }
  }

  return violations;
}
