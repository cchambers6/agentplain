// Builds lib/philosophies/packs.json from ../docs/research/philosophies/*.md
// (agentplain monorepo interim layout; ./docs/research/... after the move to
// the dedicated repo). Each pack markdown carries a machine-usable ```yaml
// block; we parse it here at build time so the app needs no YAML parser at
// runtime. Generated JSON is committed so the app builds without the research
// tree present (e.g. on Vercel with chiron/ as project root).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(here, "../../docs/research/philosophies"), // monorepo
  resolve(here, "../docs/research/philosophies"), // dedicated repo
];
const srcDir = candidates.find((d) => existsSync(d));
if (!srcDir) {
  console.error("philosophy packs not found in:", candidates.join(", "));
  process.exit(1);
}

const packs = {};
for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".md"))) {
  const markdown = readFileSync(join(srcDir, file), "utf8");
  const yamlBlock = markdown.match(/```yaml\s*([\s\S]*?)```/);
  if (!yamlBlock) {
    console.error(`skipping ${file}: no \`\`\`yaml pack block`);
    continue;
  }
  const parsed = YAML.parse(yamlBlock[1]);
  const spec = parsed?.pack;
  if (!spec?.key) {
    console.error(`skipping ${file}: yaml block has no pack.key`);
    continue;
  }
  packs[spec.key] = { spec, markdown };
}

const outDir = resolve(here, "../lib/philosophies");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "packs.json"), JSON.stringify(packs, null, 2) + "\n");
console.log(
  `wrote ${Object.keys(packs).length} philosophy packs to lib/philosophies/packs.json`,
);
