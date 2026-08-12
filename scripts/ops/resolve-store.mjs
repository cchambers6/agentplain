// resolve-store.mjs — canonical-path resolver (M4 part 1).
//
// Prints the absolute path of a logical store ONLY after its liveness tell
// passes. Exit codes are load-bearing:
//   0 — resolved, tell passed; path on stdout
//   2 — tell failed (or no candidate path exists); reason on stderr
//   3 — resolved path matches a known_bad entry; entry named on stderr
//   4 — unknown logical name / registry unreadable
//
// Usage:
//   node scripts/ops/resolve-store.mjs <logical-name> [--override-path <p>]
//
// Every ops script resolves store paths exclusively through resolveStore().

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import yaml from "js-yaml";
import { repoRoot, argValue } from "./lib.mjs";

const REGISTRY = path.join(repoRoot, "ops", "canonical-paths.yaml");

function norm(p) {
  return path.resolve(String(p)).toLowerCase();
}

export function resolveStore(name, { overridePath } = {}) {
  let registry;
  try {
    registry = yaml.load(fs.readFileSync(REGISTRY, "utf8"));
  } catch (e) {
    return { code: 4, error: `registry unreadable: ${REGISTRY}: ${e.message}` };
  }
  const entry = registry?.[name];
  if (!entry) return { code: 4, error: `unknown logical store: ${name}` };

  const candidates = overridePath
    ? [overridePath]
    : [entry.path, ...(entry.aliases || [])];
  const knownBad = entry.known_bad || [];

  for (const cand of candidates) {
    for (const bad of knownBad) {
      const badIsPath = /[\\/]/.test(bad);
      const hit = badIsPath ? norm(cand) === norm(bad) : norm(cand).includes(bad.toLowerCase());
      if (hit) {
        return {
          code: 3,
          error: `known_bad: candidate '${cand}' matches registry known_bad entry '${bad}'`,
        };
      }
    }
  }

  const existing = candidates.find((c) => fs.existsSync(c));
  if (!existing) {
    return { code: 2, error: `no candidate path exists for '${name}': ${candidates.join(" | ")}` };
  }

  const tell = entry.tell;
  if (tell) {
    const tellFile = path.join(existing, tell.file);
    if (!fs.existsSync(tellFile)) {
      return { code: 2, error: `tell failed: ${tell.file} missing under ${existing}` };
    }
    const content = fs.readFileSync(tellFile, "utf8");
    const count = (content.match(new RegExp(tell.pattern, "g")) || []).length;
    if (count < tell.min_count) {
      return {
        code: 2,
        error: `tell failed: ${tell.file} has ${count} matches of /${tell.pattern}/, min_count ${tell.min_count} — this is not the live store`,
      };
    }
  }

  return { code: 0, path: path.resolve(existing) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const name = process.argv[2];
  if (!name || name.startsWith("--")) {
    process.stderr.write("usage: node scripts/ops/resolve-store.mjs <logical-name> [--override-path <p>]\n");
    process.exit(4);
  }
  const result = resolveStore(name, { overridePath: argValue("--override-path") });
  if (result.code === 0) {
    process.stdout.write(result.path + "\n");
    process.exit(0);
  }
  process.stderr.write(result.error + "\n");
  process.exit(result.code);
}
