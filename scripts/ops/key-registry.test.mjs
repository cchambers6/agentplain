// Tests for the credential registry's static half.
//
// The defect being guarded against is specific: a workflow that depends on a
// credential nobody wrote down, and a checker that reports "absent" when it
// actually means "I could not look". The first is caught by `diff`. The second
// is a design property — this module has no network path at all — so the test
// that matters is that `extractRefs` does not silently miss a reference shape.

import test from "node:test";
import assert from "node:assert/strict";
import { extractRefs, diff, AMBIENT } from "./key-registry.mjs";

test("extracts references from an env block", () => {
  const { refs } = extractRefs(`
    env:
      DB: \${{ secrets.DATABASE_URL }}
      TOK: \${{ secrets.VERCEL_TOKEN }}
  `);
  assert.deepEqual(refs, ["DATABASE_URL", "VERCEL_TOKEN"]);
});

test("finds references outside env blocks — if:, with:, and inline run", () => {
  // These are the shapes a YAML-walking implementation tends to miss, and
  // missing one produces a false all-clear.
  const { refs } = extractRefs(`
    - if: \${{ secrets.FEATURE_KEY != '' }}
      with:
        token: \${{ secrets.WITH_KEY }}
      run: curl -H "auth: \${{ secrets.RUN_KEY }}" https://example.test
  `);
  assert.deepEqual(refs, ["FEATURE_KEY", "RUN_KEY", "WITH_KEY"]);
});

test("a secret NAMED in a comment is not a dependency", () => {
  // Regression: the first run of this checker failed against its own workflow,
  // because the header comment explains the tool using the words
  // "secrets.FOO". Prose that mentions a key is not a dependency on it.
  const { refs } = extractRefs(`
# someone added a secrets.FOO and nobody wrote down what FOO is
    env:
      REAL: \${{ secrets.ACTUALLY_USED }}
  `);
  assert.deepEqual(refs, ["ACTUALLY_USED"]);
});

test("an indented comment is stripped too", () => {
  const { refs } = extractRefs("    # \${{ secrets.COMMENTED_OUT }}\n    X: \${{ secrets.LIVE }}");
  assert.deepEqual(refs, ["LIVE"]);
});

test("de-duplicates repeated references", () => {
  const { refs } = extractRefs("${{ secrets.A }} ${{ secrets.A }} ${{ secrets.B }}");
  assert.deepEqual(refs, ["A", "B"]);
});

test("reports dynamic secrets[...] lookups instead of silently skipping them", () => {
  const { dynamic } = extractRefs("VALUE: ${{ secrets[matrix.name] }}");
  assert.equal(dynamic, true);
});

test("GITHUB_TOKEN is ambient and never requires declaration", () => {
  assert.ok(AMBIENT.has("GITHUB_TOKEN"));
});

test("an undeclared reference is reported against its workflow", () => {
  const r = diff({
    byWorkflow: { "e2e-nightly.yml": ["E2E_PREVIEW_URL"] },
    declared: new Set([]),
    declaredNames: [],
  });
  assert.deepEqual(r.undeclared, [{ workflow: "e2e-nightly.yml", name: "E2E_PREVIEW_URL" }]);
});

test("a declared and referenced key is clean", () => {
  const r = diff({
    byWorkflow: { "a.yml": ["DATABASE_URL"] },
    declared: new Set(["DATABASE_URL"]),
    declaredNames: ["DATABASE_URL"],
  });
  assert.deepEqual(r.undeclared, []);
  assert.deepEqual(r.orphans, []);
});

test("a declared key referenced by nothing is an orphan, not a failure", () => {
  const r = diff({
    byWorkflow: { "a.yml": ["USED"] },
    declared: new Set(["USED", "STALE"]),
    declaredNames: ["USED", "STALE"],
  });
  assert.deepEqual(r.undeclared, []);
  assert.deepEqual(r.orphans, ["STALE"]);
});

test("the same secret referenced by two workflows is reported for both", () => {
  const r = diff({
    byWorkflow: { "a.yml": ["X"], "b.yml": ["X"] },
    declared: new Set([]),
    declaredNames: [],
  });
  assert.equal(r.undeclared.length, 2);
  assert.deepEqual(r.referenced, ["X"]);
});
