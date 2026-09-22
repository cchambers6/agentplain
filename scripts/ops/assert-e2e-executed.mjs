// assert-e2e-executed.mjs — a green E2E run must be backed by tests that ran.
//
// THE PATTERN THIS CLOSES
// -----------------------
// A pipeline that passes while unable to do its job is the bug that hid 140
// failed production deploys. e2e-nightly had the same shape, and its own header
// described it as a feature:
//
//   "The specs SELF-SKIP when their env tier isn't configured ... so this never
//    false-reds"
//
// With no E2E_BASE_URL every spec skips, Playwright exits 0, and the workflow
// reports success. It has reported success on its last five runs while
// E2E_PREVIEW_URL, E2E_SESSION_COOKIE and E2E_WORKSPACE_ID have never existed
// (verified 2026-09-21 by presence probe).
//
// `rls-live.yml` already learned this lesson the hard way — its header records
// "no database, so it reported exit 0 — 5,928 tests, 0 fail, and that line
// among the 21 skips". This is the same fix applied to the nightly.
//
// The rule: a pass must be backed by a COUNT OF WORK DONE. Zero executed specs
// is not a pass, it is an absence of evidence, and the two must not look alike.
//
// Usage: node scripts/ops/assert-e2e-executed.mjs [report.json]

import fs from "node:fs";

export const DEFAULT_REPORT = "playwright-report/results.json";

/**
 * Count outcomes from a Playwright JSON report.
 *
 * Prefers the top-level `stats` block the JSON reporter emits. Falls back to
 * walking the suite tree, because a report shape change must not silently
 * become "zero tests, therefore fail" OR "unknown, therefore pass" — both are
 * wrong. An unreadable report is its own distinct verdict.
 */
export function countOutcomes(report) {
  if (report && typeof report.stats === "object" && report.stats !== null) {
    const s = report.stats;
    const num = (v) => (typeof v === "number" ? v : 0);
    const expected = num(s.expected);
    const unexpected = num(s.unexpected);
    const flaky = num(s.flaky);
    const skipped = num(s.skipped);
    return { expected, unexpected, flaky, skipped, executed: expected + unexpected + flaky, source: "stats" };
  }

  // Fallback: walk suites -> specs -> tests -> results.
  let expected = 0, unexpected = 0, flaky = 0, skipped = 0, seen = 0;
  const walkSuite = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        seen++;
        const status = t.status ?? t.results?.[t.results.length - 1]?.status;
        if (status === "skipped") skipped++;
        else if (status === "expected") expected++;
        else if (status === "flaky") flaky++;
        else if (status === "unexpected") unexpected++;
      }
    }
    for (const child of suite.suites ?? []) walkSuite(child);
  };
  for (const s of report?.suites ?? []) walkSuite(s);
  if (seen === 0 && !report?.suites) return { unreadable: true, source: "none" };
  return { expected, unexpected, flaky, skipped, executed: expected + unexpected + flaky, source: "suites" };
}

/** Pure verdict, so the test can drive every branch without a real report. */
export function verdict(counts) {
  if (counts.unreadable) {
    return {
      ok: false,
      code: "unreadable",
      message:
        "Could not read a Playwright report. This is INCONCLUSIVE, not a pass — " +
        "treating an unreadable report as success is how a suite goes green while doing nothing.",
    };
  }
  if (counts.executed === 0) {
    return {
      ok: false,
      code: "zero-executed",
      message:
        `Zero specs executed (${counts.skipped} skipped). A run that exercised nothing is ` +
        "not a pass. The usual cause is an unset E2E_BASE_URL, which makes every spec self-skip.",
    };
  }
  return {
    ok: true,
    code: "executed",
    message: `${counts.executed} spec(s) executed (${counts.skipped} skipped).`,
  };
}

export function main(argv = process.argv.slice(2)) {
  const path = argv[0] ?? DEFAULT_REPORT;
  let report = null;
  try {
    report = JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (err) {
    const v = verdict({ unreadable: true });
    console.error(`[e2e-evidence] ${v.message}`);
    console.error(`[e2e-evidence] (${path}: ${err.message})`);
    return 1;
  }

  const counts = countOutcomes(report);
  const v = verdict(counts);
  console.log(`[e2e-evidence] ${v.message}`);
  if (!counts.unreadable) {
    console.log(
      `[e2e-evidence] expected=${counts.expected} unexpected=${counts.unexpected} ` +
        `flaky=${counts.flaky} skipped=${counts.skipped} (source: ${counts.source})`,
    );
  }
  if (!v.ok) console.error(`::error::e2e-nightly reported no real coverage — ${v.code}`);
  return v.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  process.exit(main());
}
