/**
 * scripts/playwright-failures-to-inbox.ts
 *
 * Companion to the audit-queue-seeder: runs AFTER an E2E run and converts the
 * Playwright JSON report's failures into INBOX entries tagged
 * `audit-queue, regression` so the autofire task picks them up. This is the
 * fast path used by the nightly E2E workflow's `if: failure()` step — it needs
 * no GitHub token (it only reads the local report), so it's cheaper than the
 * full seeder when the only signal is "the E2E run went red".
 *
 * It reuses the seeder's parser + writer so the entry format and dedup behave
 * identically.
 *
 * Run:
 *   npx tsx scripts/playwright-failures-to-inbox.ts [path/to/results.json]
 *   PLAYWRIGHT_JSON_REPORT=… npx tsx scripts/playwright-failures-to-inbox.ts
 */

import { join, resolve } from "node:path";
import { parsePlaywrightReport, writeEntries } from "./audit-queue-seeder";

const reportPath =
  process.argv[2] ||
  process.env.PLAYWRIGHT_JSON_REPORT ||
  join(resolve(__dirname, ".."), "playwright-report", "results.json");

const signals = parsePlaywrightReport(reportPath);
// eslint-disable-next-line no-console
console.log(`[playwright-failures-to-inbox] ${signals.length} failed test(s) from ${reportPath}`);
const result = writeEntries(signals);
// eslint-disable-next-line no-console
console.log(
  `[playwright-failures-to-inbox] mode=${result.mode} written=${result.written} deduped=${result.skipped}`,
);
