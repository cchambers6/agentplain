/**
 * lib/customer-files/chunk.ts
 *
 * Text chunker for the ingestion pipeline. The KnowledgeDocument /
 * Embedding tables (prisma/migrations/20260512000000) document the
 * V1 contract as one Embedding per KnowledgeDocument; this chunker
 * keeps that contract by emitting MULTIPLE KnowledgeDocument
 * candidates per source file (one per chunk) instead of multiple
 * embeddings per document.
 *
 * Algorithm:
 *   - Normalize whitespace.
 *   - Split on paragraph boundaries (double newline) first; longer
 *     paragraphs are then sliced on sentence-ish boundaries.
 *   - Greedy-pack chunks up to `targetChars` with `overlapChars`
 *     character overlap with the previous chunk for cross-boundary
 *     query recall.
 *   - Drop chunks shorter than `minChars` (avoids embedding 5-word
 *     scraps as their own document).
 */

export interface ChunkOptions {
  /** Target chunk size in characters. Default 1500 — fits ~375 tokens
   *  on average, well under the 8192-token cap for text-embedding-3-small. */
  targetChars?: number;
  /** Overlap between adjacent chunks in characters. Default 200. */
  overlapChars?: number;
  /** Minimum chunk size — chunks below this are dropped. Default 200. */
  minChars?: number;
}

export interface TextChunk {
  /** 0-based index of this chunk within the source. */
  index: number;
  /** The chunk text body. */
  text: string;
  /** Total chunks the source split into. Same for every chunk in one
   *  ingestion pass — useful when stamping KnowledgeDocument titles. */
  total: number;
}

const DEFAULT_TARGET = 1500;
const DEFAULT_OVERLAP = 200;
const DEFAULT_MIN = 200;

export function chunkText(text: string, opts: ChunkOptions = {}): TextChunk[] {
  const target = opts.targetChars ?? DEFAULT_TARGET;
  const overlap = Math.min(opts.overlapChars ?? DEFAULT_OVERLAP, Math.floor(target / 2));
  const min = opts.minChars ?? DEFAULT_MIN;

  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (normalized.length === 0) return [];
  if (normalized.length <= target) {
    return [{ index: 0, text: normalized, total: 1 }];
  }

  // Split on paragraph breaks first so we don't slice mid-paragraph when
  // we don't have to.
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);

  const chunks: string[] = [];
  let buf = '';
  for (const para of paragraphs) {
    if (para.length > target) {
      if (buf.length > 0) {
        chunks.push(buf);
        buf = '';
      }
      // Long paragraph — slice on sentence boundaries.
      const sliced = sliceLongParagraph(para, target);
      for (const piece of sliced) chunks.push(piece);
      continue;
    }
    const candidate = buf.length === 0 ? para : `${buf}\n\n${para}`;
    if (candidate.length <= target) {
      buf = candidate;
    } else {
      chunks.push(buf);
      buf = para;
    }
  }
  if (buf.length > 0) chunks.push(buf);

  // Add character overlap between adjacent chunks for cross-boundary recall.
  const withOverlap: string[] = chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prev = chunks[i - 1];
    const tail = prev.slice(Math.max(0, prev.length - overlap));
    return `${tail}\n${chunk}`;
  });

  const final = withOverlap.filter((c) => c.length >= min);
  if (final.length === 0) return [{ index: 0, text: normalized.slice(0, target), total: 1 }];
  return final.map((text, i) => ({ index: i, text, total: final.length }));
}

function sliceLongParagraph(para: string, target: number): string[] {
  // Sentence-ish boundaries: period/?/! followed by whitespace.
  const sentences = para.split(/(?<=[.?!])\s+/);
  const out: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (s.length > target) {
      // Sentence itself is too big — hard slice.
      if (buf.length > 0) {
        out.push(buf);
        buf = '';
      }
      for (let i = 0; i < s.length; i += target) {
        out.push(s.slice(i, i + target));
      }
      continue;
    }
    const candidate = buf.length === 0 ? s : `${buf} ${s}`;
    if (candidate.length <= target) {
      buf = candidate;
    } else {
      out.push(buf);
      buf = s;
    }
  }
  if (buf.length > 0) out.push(buf);
  return out;
}
