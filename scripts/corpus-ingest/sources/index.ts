/**
 * scripts/corpus-ingest/sources/index.ts
 *
 * The corpus source registry. `ingestCorpus()` and `refreshCorpus()` pull
 * from `ALL_SOURCES` by default. Adding a new vertical / state corpus =
 * write a new source file and add it here. Each source's `id` MUST be
 * unique (it namespaces the natural key).
 *
 * V1 ships the four GA free-source corpora the strategic build called for:
 * real estate, CPA/tax (federal + GA), law, and property management.
 * General uses the LLM's own knowledge (no corpus) by design. Paid
 * sources (ALM, Tax Notes, RealPage, Stessa) are parked as Conner TODOs.
 */

import type { CorpusSource } from '../types';
import { gaCpaSource } from './ga-cpa';
import { gaLawSource } from './ga-law';
import { gaPropertyManagementSource } from './ga-property-management';
import { gaRealEstateSource } from './ga-real-estate';

export const ALL_SOURCES: CorpusSource[] = [
  gaRealEstateSource,
  gaCpaSource,
  gaLawSource,
  gaPropertyManagementSource,
];

// Fail fast on duplicate source ids — they'd collide on the natural key.
{
  const seen = new Set<string>();
  for (const s of ALL_SOURCES) {
    if (seen.has(s.id)) throw new Error(`Duplicate corpus source id: ${s.id}`);
    seen.add(s.id);
  }
}

export { gaRealEstateSource, gaCpaSource, gaLawSource, gaPropertyManagementSource };
