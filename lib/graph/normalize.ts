/**
 * lib/graph/normalize.ts
 *
 * `naturalKeyFor(typeSlug, input)` - the identity function for graph
 * nodes. Pure, deterministic, no I/O.
 *
 * RELATIONSHIP TO THE CONFLICT SCREEN'S NORMALIZER
 *
 *   `lib/skills/law-intake-conflict-screen/skill.ts` already has a
 *   private `normalize()` that lower-cases, strips a list of entity
 *   suffixes, and collapses whitespace; its output is what lands in
 *   `ConflictHit.normalizedMatch`. This file does not replace it and does
 *   not import it (it is not exported, and exporting it would mean
 *   editing a file this unit is not allowed to touch).
 *
 *   The two are kept consistent by a deliberate containment rule:
 *
 *     naturalKeyFor('party', x) strips a SUPERSET of what the screen
 *     strips, from a SUPERSET of the characters the screen folds.
 *
 *   So any two names the screen would consider the same string also share
 *   a natural key. The graph never splits an identity the screen would
 *   have merged. It may merge one the screen would have split - which is
 *   the safe direction here, because the screen re-normalizes the node's
 *   `label` (not its natural key) when it scores a match, so a graph
 *   merge cannot manufacture a conflict hit on its own.
 *
 *   FINDING (see the unit report): the right end state is for the screen
 *   to export its normalizer and for both to call one function. Two
 *   normalizers held in agreement by a comment is a latent divergence.
 */

import { PARTY_TYPE_SLUG } from './types';

/**
 * Legal-entity and filler tokens dropped from a party natural key.
 *
 * Superset of the screen's list (llc, llp, inc, corp, corporation, co,
 * company, pc, the) plus the forms the brief calls out (ltd, lp, pllc)
 * and their spelled-out variants.
 */
const PARTY_NOISE_TOKENS: ReadonlySet<string> = new Set([
  'llc',
  'l l c',
  'pllc',
  'llp',
  'lp',
  'lllp',
  'pc',
  'plc',
  'inc',
  'incorporated',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'co',
  'company',
  'gmbh',
  'the',
]);

/**
 * Fold case and punctuation. NFKC first so that compatibility forms
 * (full-width Latin, ligatures) land on their canonical spelling before
 * anything else looks at the string.
 *
 * Everything that is not a letter or a number becomes a single space.
 * Letters are matched by Unicode property, not by [a-z], so a non-Latin
 * name normalizes to itself rather than to the empty string.
 *
 * KNOWN LIMIT: NFKC does not fold diacritics, so "Muller" and "Mueller"
 * and "Muller with an umlaut" are three identities. Fixing that needs a
 * decomposition pass and a decision about which locales it is correct
 * for; it is not silently applied here.
 */
function foldToTokens(input: string): string[] {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 0);
}

/**
 * Identity key for a node within (tenantId, typeSlug).
 *
 * For 'party': NFKC, lower-case, punctuation folded to spaces, legal
 * suffixes and filler dropped, whitespace collapsed.
 *
 * For every other type: the same fold WITHOUT suffix stripping. Dropping
 * "co" from a product or a document title loses signal, and a type with
 * no declared rule must not silently inherit the party rule.
 *
 * Returns '' for input that folds to nothing. Callers must treat '' as
 * "not identifiable" - `InMemoryGraphStore.upsertEntity` rejects it
 * rather than minting a node every caller would collide on.
 */
export function naturalKeyFor(typeSlug: string, input: string): string {
  const tokens = foldToTokens(input);
  if (tokens.length === 0) return '';
  if (typeSlug !== PARTY_TYPE_SLUG) return tokens.join(' ');

  const kept = tokens.filter((t) => !PARTY_NOISE_TOKENS.has(t));
  // A name made entirely of noise ("The Company") still needs an
  // identity. Falling through to '' here would collapse every such firm
  // onto the rejected-empty path and lose the row.
  return (kept.length > 0 ? kept : tokens).join(' ');
}

/**
 * True when two display strings resolve to the same node identity.
 * Convenience for callers that hold labels rather than keys.
 */
export function sameNaturalKey(
  typeSlug: string,
  a: string,
  b: string,
): boolean {
  const ka = naturalKeyFor(typeSlug, a);
  return ka.length > 0 && ka === naturalKeyFor(typeSlug, b);
}
