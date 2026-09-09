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
 *   That containment holds for every name with at least one non-noise
 *   token, and it is the reason a graph merge cannot manufacture a
 *   conflict hit on its own: the screen re-normalizes the node's `label`
 *   (not its natural key) when it scores a match.
 *
 *   IT DOES NOT HOLD UNIVERSALLY, and the exception is deliberate.
 *
 *     For a name made ENTIRELY of noise tokens, the fallback on the last
 *     line of `naturalKeyFor` keeps the tokens instead of returning ''.
 *     The screen folds every such name to the SAME empty string, so the
 *     screen merges them all and the graph keeps them apart.
 *
 *   Brute-forced rather than asserted (see the test of the same name in
 *   __tests__/store-identity-and-tenancy.test.ts):
 *
 *     - Over the 85-name candidate set built from the screen's own nine
 *       suffix tokens taken 1 and 2 at a time plus four real words,
 *       3,570 unordered pairs yield 990 pairs the screen calls equal and
 *       the graph splits. 990 = C(45,2): all 45 all-noise names in that
 *       set, every pair of them.
 *     - The violating class is NOT "the screen folds to ''". Over a wider
 *       262-name set, 384 of 1,756 violations have a NON-empty screen
 *       key - e.g. 'pllc' vs 'pllc llc', which the screen folds to
 *       'pllc' both times because it does not strip 'pllc', while the
 *       graph strips both tokens, takes the fallback, and keeps
 *       'pllc llc'. The exact rule is: a violation requires at least one
 *       of the two names to take the fallback branch. Measured over that
 *       set, violations where neither name takes the fallback = 0.
 *
 *   WHY THIS IS LEFT AS-IS. Collapsing the all-noise class onto one key
 *   would put every unidentifiable firm on a single heavily-corroborated
 *   row, which is the failure `InMemoryGraphStore.upsertEntity` rejects
 *   '' to avoid. And the merge the screen performs here is not one worth
 *   matching: `namesOverlap` in skill.ts opens with `if (a === b) return
 *   true`, BEFORE its `ta.size === 0 || tb.size === 0` guard, so two
 *   all-noise names both folding to '' are an exact-normalized match and
 *   score a conflict hit. Splitting them is the graph refusing to
 *   inherit that. See FINDINGS in
 *   __tests__/store-identity-and-tenancy.test.ts.
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
 *
 * DEAD ENTRY, kept visible rather than quietly deleted: 'l l c' can
 * never match. Membership is tested per whitespace-split token, and a
 * token cannot contain a space. So "Acme Holdings L.L.C." folds to the
 * three tokens l/l/c, none of which is noise, and keys as
 * 'acme holdings l l c' - NOT 'acme holdings'. The screen splits that
 * pair too, so containment is not violated and this is not a bug, but
 * the entry advertises a merge that does not happen. Handling dotted
 * initialisms needs a token-joining pass, not a set member.
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
