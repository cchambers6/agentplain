/**
 * lib/integrations/health-probe.test.ts
 *
 * The probe seam LABELS each result honestly (REAL_READ vs CREDENTIAL_ONLY) —
 * the signup-to-go audit flagged "health = credential status only" as
 * misleading, so the data model must never claim a read it didn't do. These
 * tests pin the test-probe contract the sweep depends on.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestIntegrationHealthProbe } from './health-probe';

const WS = '44444444-4444-4444-4444-444444444444';

describe('TestIntegrationHealthProbe', () => {
  it('returns the scripted outcome for a known (workspace, provider)', async () => {
    const probe = new TestIntegrationHealthProbe({
      [`${WS}:GOOGLE`]: { status: 'unhealthy', kind: 'CREDENTIAL_ONLY', detail: 'GRANT_REVOKED' },
      [`${WS}:QUICKBOOKS`]: { status: 'healthy', kind: 'REAL_READ' },
    });
    const gmail = await probe.probe(WS, 'GOOGLE');
    assert.equal(gmail.status, 'unhealthy');
    assert.equal(gmail.status === 'unhealthy' && gmail.kind, 'CREDENTIAL_ONLY');

    const qb = await probe.probe(WS, 'QUICKBOOKS');
    assert.equal(qb.status, 'healthy');
    // QuickBooks proven with a REAL read — honestly labelled, not credential-only.
    assert.equal(qb.status === 'healthy' && qb.kind, 'REAL_READ');
  });

  it('falls back to not_connected for an unscripted provider', async () => {
    const probe = new TestIntegrationHealthProbe({});
    const out = await probe.probe(WS, 'SLACK');
    assert.equal(out.status, 'not_connected');
  });
});
