/**
 * scripts/corpus-ingest/normalize.ts
 *
 * Text normalization + content hashing for the corpus pipeline.
 *
 * Normalization is intentionally conservative — corpus bodies are already
 * clean prose, but a future live-scrape path will hand us HTML-stripped
 * text with ragged whitespace, smart quotes, and soft hyphens. Doing the
 * cleanup here (one place) keeps the content hash stable across cosmetic
 * upstream churn: a source that only re-flows its whitespace must NOT look
 * like a content change to the refresh cron (that would burn embedding
 * spend for nothing).
 *
 * Every non-ASCII target is built with `new RegExp` + `\\uXXXX` escapes so
 * this source file stays pure ASCII (no raw control chars / smart quotes
 * to get mangled by an editor).
 */

import { createHash } from 'node:crypto';

// Curly single quotes + prime -> "'".
const SMART_SINGLE = new RegExp('[\\u2018\\u2019\\u201A\\u201B\\u2032]', 'g');
// Curly double quotes + double prime -> '"'.
const SMART_DOUBLE = new RegExp('[\\u201C\\u201D\\u201E\\u201F\\u2033]', 'g');
// En dash, em dash, horizontal bar, minus sign -> '-'.
const DASHES = new RegExp('[\\u2013\\u2014\\u2015\\u2212]', 'g');
// NBSP, the en/em/thin space block, narrow NBSP, ideographic space -> ' '.
const EXOTIC_SPACES = new RegExp('[\\u00A0\\u2000-\\u200A\\u202F\\u205F\\u3000]', 'g');
// Soft hyphen + zero-width chars (ZWSP/ZWNJ/ZWJ/BOM) -> dropped.
const ZERO_WIDTH = new RegExp('[\\u00AD\\u200B\\u200C\\u200D\\uFEFF]', 'g');
// C0/C1 control chars EXCEPT \t (\\u0009) and \n (\\u000A) -> ' '.
const CONTROLS = new RegExp('[\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F]', 'g');

/** Collapse whitespace, normalize quotes/dashes, strip control chars, trim.
 *  Deterministic and idempotent: normalize(normalize(x)) === normalize(x). */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(SMART_SINGLE, "'")
    .replace(SMART_DOUBLE, '"')
    .replace(DASHES, '-')
    .replace(EXOTIC_SPACES, ' ')
    .replace(ZERO_WIDTH, '')
    .replace(CONTROLS, ' ')
    // Collapse runs of spaces/tabs.
    .replace(/[ \t]+/g, ' ')
    // Trim line edges, collapse blank-line runs to a single paragraph break.
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** SHA-256 hex of the normalized text. The refresh cron compares this to
 *  the stored hash to decide re-embed (changed) vs. lastSeen bump
 *  (unchanged). Hashing the NORMALIZED text is the whole point — cosmetic
 *  upstream reflow is invisible. */
export function contentHash(normalizedBody: string): string {
  return createHash('sha256').update(normalizedBody, 'utf8').digest('hex');
}
