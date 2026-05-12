/**
 * Smoke-level tests for the renewal-sweep Inngest function module.
 *
 * The full `runIntegrationRenewalSweep` integration test (DB + Google API)
 * lands as part of the PR-C dogfood acceptance — we cannot exercise the
 * Prisma path without a live DB in the unit-test runner. Here we pin:
 *
 *   - The cron metadata (id + schedule) so renaming or re-targeting the
 *     function trips the test before it trips an operator.
 *   - The disable-gate wiring shape via the exported function object.
 *
 * Per `feedback_no_guesses_no_estimates.md`: assertions reference exact
 * exported constants rather than hard-coded strings, so a rename in the
 * source surfaces here.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  INTEGRATION_RENEWAL_SWEEP_CRON,
  INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID,
  integrationRenewalSweepFn,
} from '../integration-renewal-sweep';
import { disableFlagEnvName } from '../../disable-flag';

describe('integration-renewal-sweep — cron metadata', () => {
  it('keeps the documented function id', () => {
    assert.equal(
      INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID,
      'agentplain-integration-renewal-sweep',
    );
  });

  it('keeps the every-2-hour UTC cron schedule', () => {
    assert.equal(INTEGRATION_RENEWAL_SWEEP_CRON, '0 */2 * * *');
  });

  it('disable env var name matches the disable-flag normalization rule', () => {
    assert.equal(
      disableFlagEnvName(INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID),
      'INNGEST_FN_DISABLE_AGENTPLAIN_INTEGRATION_RENEWAL_SWEEP',
    );
  });

  it('exports an Inngest function with the expected id', () => {
    // Inngest assigns the id internally; we cast through unknown to read it
    // without depending on Inngest's private surface in a load-bearing way.
    const fn = integrationRenewalSweepFn as unknown as { id: () => string; name?: string };
    const id = typeof fn.id === 'function' ? fn.id() : (fn as unknown as { id: string }).id;
    assert.equal(id, INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID);
  });
});
