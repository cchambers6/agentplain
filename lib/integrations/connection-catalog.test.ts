/**
 * lib/integrations/connection-catalog.test.ts
 *
 * The unified catalog classifies every connection into exactly one bucket and
 * the SHIPPED catalog must be warning-free (the migration safety net). Also
 * exercises the cost-attribution builder. node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { listIntegrations, entrySourcing } from './marketplace';
import { listWeBringServices } from './wb/registry';
import {
  buildConnectionCatalog,
  classifyConnections,
} from './connection-catalog';
import {
  buildCostAttribution,
  totalCustomerChargeMicroCents,
  totalAbsorbedMicroCents,
} from './cost-attribution';
import type { UsageMeterReading } from './wb/types';

describe('classification — migration safety net', () => {
  it('the shipped catalog produces ZERO warnings', () => {
    const { warnings } = classifyConnections();
    assert.deepEqual(
      warnings,
      [],
      `classification warnings:\n${warnings.map((w) => `  [${w.severity}] ${w.id}: ${w.message}`).join('\n')}`,
    );
  });

  it('every marketplace tile classifies as byo', () => {
    for (const entry of listIntegrations()) {
      assert.equal(entrySourcing(entry), 'byo', `${entry.id} should be byo`);
    }
  });

  it('the unified catalog covers both sides with unique ids', () => {
    const catalog = buildConnectionCatalog();
    assert.equal(
      catalog.length,
      listIntegrations().length + listWeBringServices().length,
    );
    const ids = new Set(catalog.map((c) => c.id));
    assert.equal(ids.size, catalog.length, 'ids must be unique across the split');
    assert.ok(catalog.some((c) => c.sourcing === 'byo'));
    assert.ok(catalog.some((c) => c.sourcing === 'we-bring'));
  });

  it('BYO entries are customer-direct; pass-through carries a charge model', () => {
    const catalog = buildConnectionCatalog();
    for (const c of catalog) {
      if (c.sourcing === 'byo') assert.equal(c.costModel, 'customer-direct');
      if (c.sourcing === 'we-bring') {
        assert.ok(c.costModel === 'included' || c.costModel === 'pass-through');
      }
    }
  });
});

describe('cost attribution', () => {
  const connectedByo = listIntegrations()
    .filter((e) => e.id === 'gmail' || e.id === 'hubspot')
    .slice();

  const weBringReadings: UsageMeterReading[] = [
    // pass-through: 10 minutes costing us 5_000_000 micro-cents ($5)
    { serviceId: 'twilio-voice', unit: 'minutes', quantity: 10, costMicroCents: 5_000_000n, eventCount: 2, periodStart: null, periodEnd: null },
    // included: anthropic cost we absorb
    { serviceId: 'anthropic-llm', unit: 'tokens', quantity: 120_000, costMicroCents: 8_000_000n, eventCount: 30, periodStart: null, periodEnd: null },
  ];

  it('BYO rows say you-pay-directly with no agentplain charge', () => {
    const rows = buildCostAttribution({ connectedByo, weBringReadings });
    const gmail = rows.find((r) => r.id === 'gmail');
    assert.ok(gmail);
    assert.equal(gmail.sourcing, 'byo');
    assert.equal(gmail.costModelLabel, "You're paying directly");
    assert.equal(gmail.agentplainCostMicroCents, null);
    assert.equal(gmail.customerChargeMicroCents, null);
  });

  it('pass-through Twilio charges the customer; included Anthropic does not', () => {
    const rows = buildCostAttribution({ connectedByo, weBringReadings });
    const twilio = rows.find((r) => r.id === 'twilio-voice');
    assert.ok(twilio);
    assert.equal(twilio.costModelLabel, 'Pass-through');
    assert.equal(twilio.customerChargeMicroCents, 5_000_000n); // flat at cost
    assert.equal(twilio.usageQuantity, 10);

    const anthropic = rows.find((r) => r.id === 'anthropic-llm');
    assert.ok(anthropic);
    assert.equal(anthropic.costModelLabel, 'Included');
    assert.equal(anthropic.customerChargeMicroCents, null);
    assert.equal(anthropic.agentplainCostMicroCents, 8_000_000n);
  });

  it('every we-bring service renders even with no usage', () => {
    const rows = buildCostAttribution({ connectedByo, weBringReadings: [] });
    for (const s of listWeBringServices()) {
      assert.ok(rows.find((r) => r.id === s.id), `${s.id} row missing`);
    }
  });

  it('totals: customer charge = pass-through only; absorbed = included only', () => {
    const rows = buildCostAttribution({ connectedByo, weBringReadings });
    assert.equal(totalCustomerChargeMicroCents(rows), 5_000_000n);
    assert.equal(totalAbsorbedMicroCents(rows), 8_000_000n);
  });

  it('markup raises the customer charge but never the BYO/included rows', () => {
    const rows = buildCostAttribution({ connectedByo, weBringReadings, markupFraction: 0.2 });
    const twilio = rows.find((r) => r.id === 'twilio-voice');
    assert.ok(twilio);
    assert.equal(twilio.customerChargeMicroCents, 6_000_000n);
    assert.equal(totalAbsorbedMicroCents(rows), 8_000_000n); // unchanged
  });
});
