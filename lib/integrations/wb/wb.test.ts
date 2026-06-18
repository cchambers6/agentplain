/**
 * lib/integrations/wb/wb.test.ts
 *
 * We-Bring framework: registry invariants, usage aggregation, fair-use caps,
 * pass-through Stripe metering, and observability ranking. node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  WE_BRING_SERVICES,
  getWeBringService,
  passThroughServices,
  includedServices,
} from './registry';
import {
  aggregateUsage,
  InMemoryWeBringUsageMeter,
  NullWeBringUsageMeter,
  rankConsumers,
} from './meter';
import { evaluateFairUse, evaluateAllFairUse } from './fair-use';
import {
  passThroughMeterEvents,
  withMarkupMicroCents,
} from './passthrough';
import type { MeteredUsageEvent, UsageMeterReading } from './types';

const T0 = new Date('2026-06-01T00:00:00.000Z');
const T1 = new Date('2026-06-15T00:00:00.000Z');
const PERIOD_END = new Date('2026-07-01T00:00:00.000Z');

describe('registry invariants', () => {
  it('every service is included or pass-through (never customer-direct)', () => {
    for (const s of WE_BRING_SERVICES) {
      assert.ok(s.costModel === 'included' || s.costModel === 'pass-through');
    }
  });

  it('pass-through services carry a Stripe meter env key; included ones may cap', () => {
    for (const s of passThroughServices()) {
      assert.ok(s.stripeMeterEnvKey, `${s.id} pass-through needs a meter env key`);
      assert.equal(s.fairUseCap ?? null, null); // no cap on pay-per-use
    }
    // At least Twilio is pass-through.
    assert.ok(passThroughServices().some((s) => s.id === 'twilio-voice'));
  });

  it('Anthropic + embeddings + voice are included and observable', () => {
    for (const id of ['anthropic-llm', 'openai-embeddings', 'voice-synthesis']) {
      const s = getWeBringService(id);
      assert.ok(s, `${id} missing`);
      assert.equal(s.costModel, 'included');
      assert.equal(s.observable, true);
    }
  });

  it('shared infra / corpora / runtime are included but not per-customer observable', () => {
    for (const id of ['platform-infra', 'knowledge-corpora', 'plaino-runtime']) {
      const s = getWeBringService(id);
      assert.ok(s);
      assert.equal(s.observable, false);
      assert.equal(s.meterUnit, null);
    }
  });

  it('includedServices + passThroughServices partition the registry', () => {
    assert.equal(
      includedServices().length + passThroughServices().length,
      WE_BRING_SERVICES.length,
    );
  });
});

describe('usage aggregation', () => {
  const events: MeteredUsageEvent[] = [
    { serviceId: 'twilio-voice', unit: 'minutes', quantity: 4, costMicroCents: 2_000_000n, occurredAt: T0 },
    { serviceId: 'twilio-voice', unit: 'minutes', quantity: 6, costMicroCents: 3_000_000n, occurredAt: T1 },
    { serviceId: 'voice-synthesis', unit: 'characters', quantity: 1200, costMicroCents: 500_000n, occurredAt: T1 },
    // outside the period — dropped
    { serviceId: 'twilio-voice', unit: 'minutes', quantity: 99, costMicroCents: 9_000_000n, occurredAt: new Date('2026-05-01T00:00:00.000Z') },
  ];

  it('sums quantity + cost per service inside the period, drops out-of-period', () => {
    const readings = aggregateUsage(events, T0, PERIOD_END);
    const twilio = readings.find((r) => r.serviceId === 'twilio-voice');
    assert.ok(twilio);
    assert.equal(twilio.quantity, 10); // 4 + 6, NOT the May 99
    assert.equal(twilio.costMicroCents, 5_000_000n);
    assert.equal(twilio.eventCount, 2);
  });

  it('returns no reading for services with no in-period events', () => {
    const readings = aggregateUsage(events, T0, PERIOD_END);
    assert.equal(readings.find((r) => r.serviceId === 'anthropic-llm'), undefined);
  });
});

describe('usage meter adapters', () => {
  it('InMemory records + reads aggregated; Null always empty', async () => {
    const meter = new InMemoryWeBringUsageMeter();
    meter.record('ws-1', { serviceId: 'twilio-voice', unit: 'minutes', quantity: 5, costMicroCents: 2_500_000n, occurredAt: T1 });
    const got = await meter.read('ws-1', T0, PERIOD_END);
    assert.equal(got.length, 1);
    assert.equal(got[0].quantity, 5);

    const nul = new NullWeBringUsageMeter();
    assert.deepEqual(await nul.read('ws-1', T0, PERIOD_END), []);
  });
});

describe('fair-use caps', () => {
  it('flags over when an included service exceeds its cap', () => {
    const reading: UsageMeterReading = {
      serviceId: 'voice-synthesis', unit: 'characters', quantity: 2_500_000,
      costMicroCents: 1n, eventCount: 1, periodStart: T0, periodEnd: PERIOD_END,
    };
    const v = evaluateFairUse(reading);
    assert.ok(v);
    assert.equal(v.status, 'over');
    assert.ok(v.fraction > 1);
  });

  it('flags approaching at >=80% of cap', () => {
    const reading: UsageMeterReading = {
      serviceId: 'voice-synthesis', unit: 'characters', quantity: 1_700_000,
      costMicroCents: 1n, eventCount: 1, periodStart: T0, periodEnd: PERIOD_END,
    };
    const v = evaluateFairUse(reading);
    assert.ok(v);
    assert.equal(v.status, 'approaching');
  });

  it('pass-through services have no cap → null verdict', () => {
    const reading: UsageMeterReading = {
      serviceId: 'twilio-voice', unit: 'minutes', quantity: 10_000,
      costMicroCents: 1n, eventCount: 1, periodStart: T0, periodEnd: PERIOD_END,
    };
    assert.equal(evaluateFairUse(reading), null);
  });

  it('evaluateAllFairUse keeps only capped services', () => {
    const readings: UsageMeterReading[] = [
      { serviceId: 'voice-synthesis', unit: 'characters', quantity: 100, costMicroCents: 1n, eventCount: 1, periodStart: T0, periodEnd: PERIOD_END },
      { serviceId: 'twilio-voice', unit: 'minutes', quantity: 100, costMicroCents: 1n, eventCount: 1, periodStart: T0, periodEnd: PERIOD_END },
      { serviceId: 'platform-infra', unit: null, quantity: 0, costMicroCents: 0n, eventCount: 0, periodStart: T0, periodEnd: PERIOD_END },
    ];
    const verdicts = evaluateAllFairUse(readings);
    assert.equal(verdicts.length, 1);
    assert.equal(verdicts[0].serviceId, 'voice-synthesis');
  });
});

describe('pass-through Stripe metering', () => {
  const readings: UsageMeterReading[] = [
    { serviceId: 'twilio-voice', unit: 'minutes', quantity: 10, costMicroCents: 5_000_000n, eventCount: 2, periodStart: T0, periodEnd: PERIOD_END },
    { serviceId: 'voice-synthesis', unit: 'characters', quantity: 1200, costMicroCents: 500_000n, eventCount: 1, periodStart: T0, periodEnd: PERIOD_END },
  ];

  const resolveEventName = (key: string) =>
    key === 'STRIPE_TWILIO_METER_EVENT_NAME' ? 'agentplain_twilio_usage' : undefined;

  it('emits one event for Twilio (pass-through), none for voice-synthesis (included)', () => {
    const events = passThroughMeterEvents(readings, {
      providerCustomerId: 'cus_123',
      periodStamp: '20260617',
      resolveEventName,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].eventName, 'agentplain_twilio_usage');
    assert.equal(events[0].providerCustomerId, 'cus_123');
    assert.equal(events[0].quantity, 5_000_000); // flat pass-through, micro-cents
    assert.equal(events[0].identifier, 'agentplain-wb-twilio-voice-20260617');
  });

  it('applies a markup fraction when set', () => {
    assert.equal(withMarkupMicroCents(5_000_000n, 0), 5_000_000n);
    assert.equal(withMarkupMicroCents(5_000_000n, 0.2), 6_000_000n);
    const events = passThroughMeterEvents(readings, {
      providerCustomerId: 'cus_123',
      periodStamp: '20260617',
      resolveEventName,
      markupFraction: 0.2,
    });
    assert.equal(events[0].quantity, 6_000_000);
  });

  it('emits nothing when the meter env key is unconfigured', () => {
    const events = passThroughMeterEvents(readings, {
      providerCustomerId: 'cus_123',
      periodStamp: '20260617',
      resolveEventName: () => undefined,
    });
    assert.equal(events.length, 0);
  });
});

describe('observability — rank consumers', () => {
  it('ranks workspaces by cost of a service, biggest first', () => {
    const ranked = rankConsumers(
      [
        { workspaceId: 'ws-light', readings: [{ serviceId: 'twilio-voice', unit: 'minutes', quantity: 3, costMicroCents: 1_500_000n, eventCount: 1, periodStart: T0, periodEnd: PERIOD_END }] },
        { workspaceId: 'ws-heavy', readings: [{ serviceId: 'twilio-voice', unit: 'minutes', quantity: 40, costMicroCents: 20_000_000n, eventCount: 9, periodStart: T0, periodEnd: PERIOD_END }] },
        { workspaceId: 'ws-none', readings: [] },
      ],
      'twilio-voice',
    );
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].workspaceId, 'ws-heavy');
    assert.equal(ranked[1].workspaceId, 'ws-light');
  });
});
