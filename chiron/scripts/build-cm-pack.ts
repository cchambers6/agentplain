// Regenerate lib/philosophies/charlotte-mason/pack.json from the TS modules.
// Run with: npm run pack:build   (tsx)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { charlotteMasonPack } from "../lib/philosophies/charlotte-mason";

const out = join(
  __dirname,
  "..",
  "lib",
  "philosophies",
  "charlotte-mason",
  "pack.json"
);

writeFileSync(out, JSON.stringify(charlotteMasonPack, null, 2) + "\n");
console.log(`wrote ${out} (${charlotteMasonPack.citations.length} citations)`);
