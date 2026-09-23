// Regression tests for the 2026-09-23 incident: a non-deploy job silenced the
// deploy alarms.
//
// A throwaway secret-presence probe ran with `environment: Production`. GitHub
// creates a Production deployment record for any such job; the job passed, so
// the record read `success`. deploy-state's walk stops at the first success, so
// it concluded production had deployed 1.77 days earlier — while production was
// still serving the 2026-06-17 build and every real deploy was failing. Both
// alarms went quiet. A green alarm over a dead production is the exact thing
// this checker exists to prevent.

import test from "node:test";
import assert from "node:assert/strict";
import { isProductionDeployOfMain } from "./deploy-state.mjs";
import fs from "node:fs";
import path from "node:path";

test("the actual record that caused the incident is rejected", () => {
  // Verbatim shape of deployment 6575197967.
  assert.equal(
    isProductionDeployOfMain({
      ref: "chore/secret-presence-probe",
      sha: "c30165321a4fd4e19c9ec403e8959a8c6eff7a99",
      environment: "Production",
    }),
    false,
  );
});

test("a Vercel git-integration deploy of main is accepted", () => {
  assert.equal(isProductionDeployOfMain({ ref: "main" }), true);
});

test("a production-deploy.yml record (ref is a SHA) is accepted", () => {
  assert.equal(
    isProductionDeployOfMain({ ref: "9620379358445 75efe858058e0d12c8356fcee0c".replace(/\s/g, "") }),
    true,
  );
});

test("any other branch name is rejected", () => {
  for (const ref of ["feat/whatever", "chore/probe", "release", "Production", ""]) {
    assert.equal(isProductionDeployOfMain({ ref }), false, `ref=${ref}`);
  }
});

test("a short sha is not mistaken for a full one", () => {
  assert.equal(isProductionDeployOfMain({ ref: "c301653" }), false);
});

test("a missing ref is rejected rather than assumed good", () => {
  assert.equal(isProductionDeployOfMain({}), false);
  assert.equal(isProductionDeployOfMain(null), false);
});

test("the default branch is configurable without code change", () => {
  assert.equal(isProductionDeployOfMain({ ref: "trunk" }, "trunk"), true);
  assert.equal(isProductionDeployOfMain({ ref: "main" }, "trunk"), false);
});

// Belt and braces: stop the pollution at source as well as filtering it out.
test("only production-deploy.yml may declare environment: Production", () => {
  const dir = ".github/workflows";
  const ALLOWED = new Set(["production-deploy.yml"]);
  const offenders = [];
  for (const f of fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    // The YAML job key, not the github-script argument inside production-deploy.
    const declaresEnv = /^\s+environment:\s*['"]?Production['"]?\s*$/m.test(src);
    if (declaresEnv && !ALLOWED.has(f)) offenders.push(f);
  }
  assert.deepEqual(
    offenders,
    [],
    `these workflows declare environment: Production and will create Production ` +
      `deployment records that the deploy-age alarm reads as real deploys: ${offenders.join(", ")}`,
  );
});
