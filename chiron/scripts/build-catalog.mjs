// Builds lib/catalog/catalog.json from the research corpus at
// ../docs/research/2026-07-10-classical-curricula/*.yaml (agentplain monorepo
// interim layout; becomes ./docs/research/... after the move to the dedicated
// repo). The generated JSON is committed so the app builds without the
// research tree present (e.g. on Vercel with chiron/ as project root).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(here, "../../docs/research/2026-07-10-classical-curricula"), // monorepo
  resolve(here, "../docs/research/2026-07-10-classical-curricula"), // dedicated repo
];
const srcDir = candidates.find((d) => existsSync(d));
if (!srcDir) {
  console.error("research corpus not found in:", candidates.join(", "));
  process.exit(1);
}

const entries = [];
for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".yaml"))) {
  const doc = YAML.parse(readFileSync(join(srcDir, file), "utf8"));
  if (!doc?.id || !doc?.name) {
    console.error(`skipping ${file}: missing id/name`);
    continue;
  }
  entries.push({
    id: doc.id,
    name: doc.name,
    publisher: doc.publisher ?? null,
    subjects: doc.subjects ?? [],
    stages: doc.stages ?? [],
    philosophyAffinity: doc.philosophy_affinity ?? [],
    format: doc.format ?? [],
    pace: doc.pace ?? null,
    entryAge: doc.entry_age ?? null,
    scopeSequenceUrl: doc.public_scope_and_sequence_url ?? null,
    knownPairings: doc.known_pairings ?? [],
    knownConflicts: doc.known_conflicts ?? [],
    philosophyNotes: doc.philosophy_notes ?? null,
  });
}

entries.sort((a, b) => a.id.localeCompare(b.id));
const outDir = resolve(here, "../lib/catalog");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "catalog.json"), JSON.stringify(entries, null, 2) + "\n");
console.log(`wrote ${entries.length} catalog entries to lib/catalog/catalog.json`);
