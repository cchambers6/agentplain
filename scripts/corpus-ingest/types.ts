/**
 * scripts/corpus-ingest/types.ts
 *
 * Boundary types for the knowledge-corpus ingestion framework. The
 * ingestion pipeline turns FREE, PUBLIC source material (state statute,
 * regulator rules, federal agency publications) into grounded, cited
 * `KnowledgeDocument` + `Embedding` rows that Plaino retrieves at answer
 * time (`app/api/chat/route.ts#searchKnowledge`).
 *
 * Design (mirrors the substrate's portability contract,
 * `feedback_runner_portability.md`):
 *   - A `CorpusSource` is the unit of "where knowledge comes from". Its
 *     `fetch()` is the seam a live scraper plugs into later. V1 source
 *     impls return hand-curated, citation-bearing items verified against
 *     the public source (see each file's header for provenance + date).
 *     A future revision swaps `fetch()` for a real HTTP/PDF pull WITHOUT
 *     touching the normalizer, chunker, embedder, or store.
 *   - `RawCorpusItem` is one self-contained answer (statute section, rule,
 *     pub topic) with its citation + canonical URL.
 *   - The runner (`ingest.ts`) normalizes + chunks + hashes + upserts each
 *     item through the existing `IKnowledgeStore` abstraction. Idempotent
 *     by `(sourceType, sourceId)` natural key; the content hash drives the
 *     "re-embed only when changed" refresh path.
 *
 * Per `project_no_outbound_architecture.md`: ingestion reads public
 * source material and writes durable rows. It places no outbound message
 * on any customer's behalf.
 */

export type Jurisdiction = string; // e.g. "GA", "US"

export interface RawCorpusItem {
  /** Stable, unique-within-source slug. Becomes part of the natural key
   *  so re-ingesting updates in place instead of duplicating. */
  sourceKey: string;
  /** Question-shaped human label. Surfaces as the citation title + in
   *  operator audit logs. */
  title: string;
  /** The factual answer text. Plain prose, no markup. Embedded as-is. */
  body: string;
  /** Authoritative legal citation, e.g. "O.C.G.A. § 43-40-8" or
   *  "IRS Publication 463". Carried in metadata + shown by the Citation
   *  component. */
  citation: string;
  /** Canonical public URL for the source. */
  sourceUrl: string;
  /** Jurisdiction code. "US" = federal, "GA" = Georgia, etc. NULL-able at
   *  the row level but every corpus item should set it. */
  jurisdiction: Jurisdiction;
  /** One of the ten locked vertical slugs (`lib/verticals/<slug>/`). */
  verticalSlug: string;
  /** Provenance note: the exact URL(s) fetched to verify + the date.
   *  Audit-only; stored in metadata, never shown to customers. */
  verifiedFrom?: string;
}

export interface CorpusSource {
  /** Stable source id, e.g. "ga-real-estate". Namespaces the natural key
   *  (`corpus:<id>`) so two sources can't collide on a shared sourceKey. */
  id: string;
  /** Human label, e.g. "Georgia real estate (O.C.G.A. § 43-40 + GREC)". */
  label: string;
  /** One-line description of what this source covers. */
  description: string;
  /** Primary vertical this source serves (a CPA source may still emit US
   *  + GA rows; this is the dominant slug for reporting). */
  verticalSlug: string;
  /** `primary` = statute/regulator first-party text; `secondary` =
   *  agency guidance / explanatory. Carried in metadata for ranking +
   *  trust signalling. */
  authority: 'primary' | 'secondary';
  /**
   * Produce the raw items. The async signature IS the live-scraper seam:
   * V1 returns a curated array; a future impl fetches + parses upstream
   * HTML/PDF here. The rest of the pipeline never changes.
   */
  fetch(): Promise<RawCorpusItem[]>;
}

/** One embeddable chunk derived from a RawCorpusItem (1:1 for short
 *  items; 1:N when a long body is windowed by the chunker). */
export interface CorpusChunk {
  /** `corpus:<sourceId>` — the Embedding.sourceType namespace. */
  sourceType: string;
  /** `<item.sourceKey>#<chunkIndex>` — the Embedding.sourceId natural key. */
  sourceId: string;
  /** `<item.sourceKey>` — stable across chunks of the same item. */
  itemKey: string;
  chunkIndex: number;
  chunkCount: number;
  title: string;
  /** Normalized chunk text. */
  body: string;
  /** SHA-256 of `body`. Drives re-embed-vs-skip in the refresh path. */
  contentHash: string;
  citation: string;
  sourceUrl: string;
  jurisdiction: Jurisdiction;
  verticalSlug: string;
  metadata: Record<string, unknown>;
}
