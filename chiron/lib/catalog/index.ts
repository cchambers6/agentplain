// Curriculum catalog — generated from docs/research YAML by
// scripts/build-catalog.mjs (`npm run catalog:build`). Metadata only:
// titles, publishers, pacing, scope/sequence URLs — never lesson content.
import catalogJson from "./catalog.json";

export interface CatalogEntry {
  id: string;
  name: string;
  publisher: string | null;
  subjects: string[];
  stages: string[];
  philosophyAffinity: string[];
  format: string[];
  pace: string | null;
  entryAge: string | number | null;
  scopeSequenceUrl: string | null;
  knownPairings: unknown[];
  knownConflicts: unknown[];
  philosophyNotes: string | null;
}

export const catalog = catalogJson as CatalogEntry[];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Loose name match for onboarding autofill. */
export function findCatalogEntry(name: string): CatalogEntry | undefined {
  const q = norm(name);
  if (!q) return undefined;
  return (
    catalog.find((c) => norm(c.name) === q) ??
    catalog.find((c) => norm(c.name).includes(q) || q.includes(norm(c.name)))
  );
}
