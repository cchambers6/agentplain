#!/usr/bin/env tsx
/**
 * scripts/classify-connections.ts
 *
 * Migration / audit tool for the BYO ↔ we-bring split. Prints the full unified
 * connection catalog with each connection's bucket + cost model, then runs the
 * classifier and prints any misclassification warnings. Exits non-zero if any
 * ERROR-severity warning is found, so it can gate CI alongside the test.
 *
 * Run: `npx tsx scripts/classify-connections.ts`
 *
 * Per `feedback_no_silent_vendor_lock.md`: the catalog is the one seam; this
 * script reads it rather than re-deriving the split anywhere.
 */

import {
  buildConnectionCatalog,
  classifyConnections,
} from '@/lib/integrations/connection-catalog';

function main(): void {
  const catalog = buildConnectionCatalog();
  const byo = catalog.filter((c) => c.sourcing === 'byo');
  const weBring = catalog.filter((c) => c.sourcing === 'we-bring');

  console.log('\n=== CONNECTION CATALOG — BYO ↔ we-bring split ===\n');

  console.log(`YOU BRING (customer-brought) — ${byo.length} connections`);
  console.log('  the customer authorizes their own account and pays their own vendor\n');
  for (const c of byo) {
    console.log(`  • ${pad(c.name, 22)} ${pad(c.category, 14)} ${c.costModelLabel}`);
  }

  console.log(`\nWE BRING — ${weBring.length} services`);
  console.log('  agentplain owns the vendor account; included or pass-through\n');
  for (const c of weBring) {
    const meter = c.meterUnit ? ` · metered in ${c.meterUnit}` : '';
    console.log(`  • ${pad(c.name, 30)} ${pad(c.category, 16)} ${pad(c.costModelLabel, 14)}${meter}`);
  }

  const { warnings } = classifyConnections();
  console.log('\n=== CLASSIFICATION WARNINGS ===\n');
  if (warnings.length === 0) {
    console.log('  ✓ none — every connection is classified cleanly.\n');
  } else {
    for (const w of warnings) {
      console.log(`  [${w.severity.toUpperCase()}] ${w.id}: ${w.message}`);
    }
    console.log('');
  }

  const errors = warnings.filter((w) => w.severity === 'error');
  if (errors.length > 0) {
    console.error(`FAIL: ${errors.length} error-severity classification warning(s).`);
    process.exit(1);
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

main();
