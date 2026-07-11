// Regression gate for the Charlotte Mason philosophy pack.
// Run with: npm run pack:verify   (tsx)
//
// Fails (exit 1) if:
//   1. pack.json has drifted from the TS modules (source of truth)
//   2. any citation rule_ref points at a pack path that does not exist
//   3. any citation id referenced by a module (cite arrays or inline
//      [vol1-...] markers in prose) is missing from the citation registry
//   4. any quote exceeds the short-quote limit (Truth Wave: 1–2 sentences,
//      never paragraphs of the source text)
//   5. any pack string breaks vendor invisibility (this pack surfaces in
//      parent-facing reasoning traces)
//   6. the citation registry falls below the fidelity floor, or the minute
//      caps stop being monotonic by age
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { charlotteMasonPack } from "../lib/philosophies/charlotte-mason";

const QUOTE_MAX_CHARS = 320;
const CITATION_FLOOR = 40;

const errors: string[] = [];
const pack = charlotteMasonPack as unknown as Record<string, unknown>;

// -- 1. pack.json in sync -----------------------------------------------
const packJsonPath = join(
  __dirname,
  "..",
  "lib",
  "philosophies",
  "charlotte-mason",
  "pack.json"
);
try {
  const onDisk = JSON.parse(readFileSync(packJsonPath, "utf8"));
  if (JSON.stringify(onDisk) !== JSON.stringify(charlotteMasonPack)) {
    errors.push("pack.json drifted from TS modules — run `npm run pack:build`");
  }
} catch {
  errors.push("pack.json missing or unparsable — run `npm run pack:build`");
}

// -- helpers --------------------------------------------------------------
function resolvePath(root: unknown, dotPath: string): unknown {
  let node: unknown = root;
  for (const key of dotPath.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function walkStrings(node: unknown, visit: (s: string, at: string) => void, at = "pack"): void {
  if (typeof node === "string") return visit(node, at);
  if (Array.isArray(node)) return node.forEach((v, i) => walkStrings(v, visit, `${at}[${i}]`));
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walkStrings(v, visit, `${at}.${k}`);
  }
}

// -- 2. rule_refs resolve -------------------------------------------------
for (const c of charlotteMasonPack.citations) {
  for (const ref of c.rule_refs) {
    if (resolvePath(pack, ref) === undefined) {
      errors.push(`citation ${c.id}: rule_ref "${ref}" resolves to nothing in the pack`);
    }
  }
}

// -- 3. every referenced citation id exists -------------------------------
const known = new Set(charlotteMasonPack.citations.map((c) => c.id));
const referenced = new Set<string>();

function collectCites(node: unknown): void {
  if (Array.isArray(node)) return node.forEach(collectCites);
  if (node && typeof node === "object") {
    const rec = node as Record<string, unknown>;
    if (Array.isArray(rec.cite)) {
      for (const id of rec.cite) if (typeof id === "string") referenced.add(id);
    }
    for (const v of Object.values(rec)) collectCites(v);
  }
}
collectCites(charlotteMasonPack);
walkStrings(charlotteMasonPack, (s) => {
  for (const m of s.matchAll(/\b(?:vol[1-6]|pneu|terms)-[a-z][a-z0-9-]*\b/g)) {
    referenced.add(m[0]);
  }
});
for (const id of referenced) {
  if (!known.has(id)) errors.push(`referenced citation id "${id}" missing from citations registry`);
}
for (const id of known) {
  if (!referenced.has(id)) errors.push(`citation "${id}" is registered but nothing references it`);
}

// -- 4. quotes stay short -------------------------------------------------
for (const c of charlotteMasonPack.citations) {
  if (!c.quote.trim()) errors.push(`citation ${c.id}: empty quote`);
  if (c.quote.length > QUOTE_MAX_CHARS) {
    errors.push(`citation ${c.id}: quote is ${c.quote.length} chars (limit ${QUOTE_MAX_CHARS})`);
  }
  if (!c.url.startsWith("http")) errors.push(`citation ${c.id}: missing url`);
  if (!c.chapter.trim()) errors.push(`citation ${c.id}: missing chapter`);
}

// -- 5. vendor invisibility ------------------------------------------------
const vendorPattern = /\b(claude|anthropic|openai|chatgpt|gpt-\d|llm|language model)\b/i;
walkStrings(charlotteMasonPack, (s, at) => {
  const hit = s.match(vendorPattern);
  if (hit) errors.push(`vendor-invisibility violation at ${at}: "${hit[0]}"`);
});

// -- 6. fidelity floor + monotonic caps ------------------------------------
if (charlotteMasonPack.citations.length < CITATION_FLOOR) {
  errors.push(
    `citation registry has ${charlotteMasonPack.citations.length} entries (floor ${CITATION_FLOOR})`
  );
}
const caps = charlotteMasonPack.lesson_shape.max_block_minutes_by_age;
const ages = Object.keys(caps).map(Number).sort((a, b) => a - b);
for (let i = 1; i < ages.length; i++) {
  if (caps[ages[i]] < caps[ages[i - 1]]) {
    errors.push(`max_block_minutes_by_age not monotonic at age ${ages[i]}`);
  }
}

// -- report ----------------------------------------------------------------
if (errors.length) {
  console.error(`pack:verify FAILED (${errors.length} problem${errors.length === 1 ? "" : "s"}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `pack:verify OK — ${charlotteMasonPack.citations.length} citations, ` +
    `${referenced.size} referenced ids, pack.json in sync`
);
