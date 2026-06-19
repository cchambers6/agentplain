/**
 * scripts/corpus-ingest/chunk.ts
 *
 * Sentence-aware chunker. Turns a normalized body into one or more
 * embeddable windows.
 *
 * V1 corpus items are single self-contained paragraphs (~120-280 words),
 * so almost every item yields exactly ONE chunk — keeping the per-vertical
 * chunk count equal to the item count and each citation atomic. The
 * chunker still exists (and is unit-tested) because the live-scrape path
 * will hand us multi-page IRS publications and long statute sections that
 * MUST be windowed: pgvector retrieval quality collapses when a single
 * embedding spans thousands of tokens of mixed topics.
 *
 * Strategy: greedily pack whole sentences into windows up to `maxChars`,
 * carrying `overlapChars` of trailing context into the next window so a
 * fact split across a window boundary is still retrievable from both
 * sides. Sentences longer than `maxChars` are emitted whole (we never cut
 * mid-sentence — a fragmented legal sentence is worse than a long one).
 */

export interface ChunkOptions {
  /** Soft upper bound on chunk length in characters. Default 2000 — chosen
   *  so the curated single-paragraph items stay 1 chunk, while real
   *  long-form source text still gets windowed. ~500 tokens at 4 chars/tok. */
  maxChars?: number;
  /** Trailing characters of one window repeated at the head of the next.
   *  Default 200. Set 0 to disable overlap. */
  overlapChars?: number;
}

const DEFAULT_MAX = 2000;
const DEFAULT_OVERLAP = 200;

/** Split `body` into chunk strings. Always returns at least one chunk
 *  (the trimmed body) for non-empty input; returns [] for empty input. */
export function chunkBody(body: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX;
  const overlapChars = Math.min(options.overlapChars ?? DEFAULT_OVERLAP, Math.floor(maxChars / 2));
  const text = body.trim();
  if (text.length === 0) return [];
  if (text.length <= maxChars) return [text];

  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed.length > 0) chunks.push(trimmed);
  };

  for (const sentence of sentences) {
    if (current.length === 0) {
      current = sentence;
      continue;
    }
    if (current.length + 1 + sentence.length <= maxChars) {
      current = `${current} ${sentence}`;
      continue;
    }
    // Window full — flush, then seed the next window with an overlap tail
    // of the one we just closed (whole-sentence-aligned).
    const closed = current;
    flush();
    current = overlapChars > 0 ? `${tail(closed, overlapChars)}${sentence}` : sentence;
  }
  flush();
  return chunks;
}

/** Take a whole-sentence-aligned tail of `text` up to ~maxLen chars, with a
 *  trailing space so it reads cleanly as a prefix to the next sentence. */
function tail(text: string, maxLen: number): string {
  if (maxLen <= 0) return '';
  if (text.length <= maxLen) return text.length ? `${text} ` : '';
  const slice = text.slice(text.length - maxLen);
  // Align to a sentence start so the overlap isn't a mid-sentence fragment.
  const m = slice.match(/[.!?]\s+([\s\S]*)$/);
  const aligned = m ? m[1] : slice;
  return aligned.length ? `${aligned} ` : '';
}

/** Sentence split on the whitespace that follows `. ! ?` when the next
 *  token looks like a sentence start (capital/digit/open quote). Uses a
 *  lookbehind+lookahead so neither the punctuation nor the leading char is
 *  consumed. Good enough for windowing; never relied on for semantics. */
function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [text];
}
