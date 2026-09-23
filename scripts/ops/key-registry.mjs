// key-registry.mjs — keep credential DEMAND and credential SUPPLY in sync.
//
// Demand  = every `secrets.NAME` a workflow references.
// Supply  = what ops/key-registry.yaml declares, and (for the presence half)
//           what the secrets context actually expands to inside CI.
//
// This file does the STATIC half only: no network, no credentials, therefore
// always conclusive. The presence half lives in
// .github/workflows/key-registry.yml because it needs the `secrets` context.
//
// THE HONESTY RULE
// ----------------
// This tool never reports "absent". It reports "not declared" (a fact it can
// establish from files on disk) or it reports nothing. Presence is decided by
// the workflow, which can actually see the secrets context. The REST secrets
// endpoints 403 for both the default GITHUB_TOKEN and the fleet app token, so
// anything API-based here could only ever mean "I could not look" — and a
// check that renders could-not-look as absent is the exact defect this repo
// keeps paying for.
//
// Subcommands:
//   refs              list every secrets.* reference found in workflows
//   check             fail if a referenced secret is undeclared; warn on orphans
//   matrix            emit JSON of required GitHub keys for the presence job

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export const WORKFLOW_DIR = ".github/workflows";
export const REGISTRY_PATH = "ops/key-registry.yaml";

/** Secrets the platform injects. Never declared, never checked. */
export const AMBIENT = new Set(["GITHUB_TOKEN"]);

/**
 * Extract `secrets.NAME` references from workflow YAML source.
 * Deliberately a regex over raw text rather than a YAML walk: references can
 * appear anywhere an expression is allowed (env blocks, `if:`, `with:`, inline
 * run strings), and missing one would produce a false all-clear.
 */
export function extractRefs(source) {
  // Strip whole-line YAML comments first. Without this, a doc comment that
  // merely NAMES a secret registers as a dependency — this checker caught
  // exactly that in its own header on first run. Inline trailing `#` is left
  // alone: `#` inside a quoted string is legal YAML, and over-reporting only
  // costs a registry entry whereas under-reporting is a false all-clear.
  const body = source
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  const out = new Set();
  for (const m of body.matchAll(/secrets\.([A-Z_][A-Z0-9_]*)/g)) out.add(m[1]);
  // `secrets[matrix.name]`-style dynamic lookups cannot be resolved statically.
  // Report them so a reader knows this file did not silently skip something.
  const dynamic = /secrets\[/.test(body);
  return { refs: [...out].sort(), dynamic };
}

export function readWorkflowRefs(dir = WORKFLOW_DIR) {
  const byWorkflow = {};
  let anyDynamic = false;
  for (const f of fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    const { refs, dynamic } = extractRefs(fs.readFileSync(path.join(dir, f), "utf8"));
    if (dynamic) anyDynamic = true;
    const named = refs.filter((r) => !AMBIENT.has(r));
    if (named.length) byWorkflow[f] = named;
  }
  return { byWorkflow, anyDynamic };
}

export function readRegistry(p = REGISTRY_PATH) {
  const doc = yaml.load(fs.readFileSync(p, "utf8"));
  const keys = doc?.keys ?? [];
  return {
    doc,
    declared: new Set(keys.map((k) => k.name)),
    required: keys.filter((k) => k.github_actions === "required").map((k) => k.name).sort(),
    byName: new Map(keys.map((k) => [k.name, k])),
  };
}

/**
 * Pure diff, so the test can drive it without touching the filesystem.
 * Returns the two directions that can be decided from files alone.
 */
export function diff({ byWorkflow, declared, declaredNames }) {
  const referenced = new Set();
  for (const names of Object.values(byWorkflow)) for (const n of names) referenced.add(n);

  const undeclared = [];
  for (const [wf, names] of Object.entries(byWorkflow)) {
    for (const n of names) if (!declared.has(n)) undeclared.push({ workflow: wf, name: n });
  }
  const orphans = declaredNames.filter((n) => !referenced.has(n));
  return { referenced: [...referenced].sort(), undeclared, orphans };
}

function cmdRefs() {
  const { byWorkflow, anyDynamic } = readWorkflowRefs();
  for (const [wf, names] of Object.entries(byWorkflow)) {
    console.log(`${wf}: ${names.join(", ")}`);
  }
  if (anyDynamic) {
    console.log("\nnote: a workflow uses secrets[...] dynamic lookup; those are not statically resolvable.");
  }
  return 0;
}

function cmdCheck() {
  const { byWorkflow } = readWorkflowRefs();
  const reg = readRegistry();
  const { undeclared, orphans } = diff({
    byWorkflow,
    declared: reg.declared,
    declaredNames: [...reg.declared],
  });

  let failed = false;

  if (undeclared.length) {
    failed = true;
    console.error("FAIL: workflows reference secrets that are not declared in ops/key-registry.yaml:\n");
    for (const u of undeclared) console.error(`  ${u.workflow} -> ${u.name}`);
    console.error(
      "\nDeclare each one in ops/key-registry.yaml (name, purpose, where it lives).\n" +
        "This is a paperwork check, not a presence check: declaring it does not\n" +
        "make it exist. The presence matrix in key-registry.yml decides that.",
    );
  }

  // A key declared for a workflow that has not merged yet is not an orphan.
  // Distinguishing the two keeps the warning meaningful instead of routinely
  // noisy — a warning people learn to ignore is worth less than no warning.
  const pending = orphans.filter((n) => reg.byName.get(n)?.pending_pr);
  const trueOrphans = orphans.filter((n) => !reg.byName.get(n)?.pending_pr);

  if (pending.length) {
    const byPr = new Map();
    for (const n of pending) {
      const pr = reg.byName.get(n).pending_pr;
      byPr.set(pr, [...(byPr.get(pr) ?? []), n]);
    }
    for (const [pr, names] of byPr) {
      console.log(
        `\nPENDING: declared for a workflow that has not merged yet (PR #${pr}): ${names.join(", ")}`,
      );
      console.log(`  Expected. These become live references when #${pr} lands.`);
    }
  }

  if (trueOrphans.length) {
    console.warn(`\nWARN: declared but referenced by no workflow: ${trueOrphans.join(", ")}`);
    console.warn("  Either a workflow was deleted, or the key is no longer needed.");
  }

  // Third direction: declared as required for GitHub, but recorded as living
  // only in Vercel. Guidance, not a failure — the presence job is the gate.
  const needsCopy = [...reg.byName.values()].filter(
    (k) => k.github_actions === "required" && k.vercel?.present === true && k.github?.present === false,
  );
  if (needsCopy.length) {
    console.log(
      `\nNOTE: exist in Vercel but not in GitHub Actions (copy the value across):\n  ${needsCopy
        .map((k) => k.name)
        .join(", ")}`,
    );
    console.log("  Actions cannot read Vercel project env vars. Two separate stores.");
  }

  if (!failed) console.log("\nkey-registry: every referenced secret is declared.");
  return failed ? 1 : 0;
}

function cmdMatrix() {
  const reg = readRegistry();
  console.log(JSON.stringify(reg.required));
  return 0;
}

export function main(argv = process.argv.slice(2)) {
  switch (argv[0]) {
    case "refs": return cmdRefs();
    case "matrix": return cmdMatrix();
    case "check":
    case undefined: return cmdCheck();
    default:
      console.error(`unknown subcommand: ${argv[0]}`);
      return 2;
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  process.exit(main());
}
