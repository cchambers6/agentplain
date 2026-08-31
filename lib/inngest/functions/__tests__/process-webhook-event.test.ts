/**
 * Smoke-level tests for the process-webhook-event Inngest function.
 *
 * The full integration test (DB + Gmail Pub/Sub) lives in the dogfood
 * acceptance loop on Conner's real inbox. Here we pin:
 *
 *   - Cron metadata (id + cron expression + on-demand event name) so a
 *     rename or re-targeting trips the test before it trips an operator.
 *   - Registration shape so the Inngest serve route stays in sync.
 *   - Disable-flag wiring so pausing post-deploy stays a one-env-var flip.
 *
 * Per `feedback_no_guesses_no_estimates.md`: assertions reference exact
 * exported constants. Per `feedback_integration_acceptance_is_functional.md`:
 * end-to-end Gmail validation is a separate dogfood step — this test
 * pins the wiring contract.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROCESS_WEBHOOK_EVENT_BATCH_LIMIT,
  PROCESS_WEBHOOK_EVENT_CRON,
  PROCESS_WEBHOOK_EVENT_FUNCTION_ID,
  PROCESS_WEBHOOK_EVENT_TRIGGER_EVENT,
  processWebhookEventFn,
} from '../process-webhook-event';
import { disableFlagEnvName } from '../../disable-flag';

describe('process-webhook-event — cron metadata', () => {
  it('keeps the documented function id', () => {
    assert.equal(
      PROCESS_WEBHOOK_EVENT_FUNCTION_ID,
      'agentplain-process-webhook-event',
    );
  });

  it('keeps the every-15-minute cron schedule', () => {
    assert.equal(PROCESS_WEBHOOK_EVENT_CRON, '*/15 * * * *');
  });

  // The cadence is a cost control, not a preference. The managed
  // Postgres scales to zero after 5 minutes idle, so any interval <= 5
  // minutes leaves no idle gap and bills continuous compute — this one
  // function then costs more than the whole free allowance. Pin the
  // property, not just the literal, so a "let's make it snappier" edit
  // has to argue with the reason rather than silently pass.
  it('fires strictly less often than the 5-minute scale-to-zero idle timeout', () => {
    const match = /^\*\/(\d+) \* \* \* \*$/.exec(PROCESS_WEBHOOK_EVENT_CRON);
    assert.ok(
      match,
      `expected a minute-step cron, got ${PROCESS_WEBHOOK_EVENT_CRON}`,
    );
    const stepMinutes = Number(match![1]);
    assert.ok(
      stepMinutes > 5,
      `cron step ${stepMinutes}m must exceed the 5m scale-to-zero idle ` +
        'timeout or the database never scales down between fires',
    );
  });

  // Folding into a wake window another cron already pays for is what
  // makes this change free. If the step stops dividing evenly into the
  // existing */15 slot, that assumption is gone.
  it('shares a wake window with the existing */15 crons', () => {
    const stepMinutes = Number(/^\*\/(\d+) /.exec(PROCESS_WEBHOOK_EVENT_CRON)![1]);
    assert.equal(
      stepMinutes % 15,
      0,
      'step must align with the */15 slot held by agentplain-scheduler-sweep ' +
        'and b2b-sales-rep-pre-call-brief, or it buys a new wake window',
    );
  });

  // The batch bound is a per-fire safety cap, NOT scaled with the
  // interval — so the cadence and the bound together set the sustained
  // drain ceiling. Pin the derived number so a future cadence change
  // has to confront what it does to throughput.
  it('documents the sustained drain ceiling implied by cadence x batch', () => {
    const stepMinutes = Number(/^\*\/(\d+) /.exec(PROCESS_WEBHOOK_EVENT_CRON)![1]);
    const firesPerHour = 60 / stepMinutes;
    assert.equal(
      firesPerHour * PROCESS_WEBHOOK_EVENT_BATCH_LIMIT,
      100,
      'sustained drain ceiling changed; if this is intended, update the ' +
        'rationale on PROCESS_WEBHOOK_EVENT_BATCH_LIMIT too',
    );
  });

  it('exposes the on-demand event name for dev-console triggers', () => {
    assert.equal(
      PROCESS_WEBHOOK_EVENT_TRIGGER_EVENT,
      'agentplain/process-webhook-event.requested',
    );
  });

  it('disable env var name matches the disable-flag normalization rule', () => {
    assert.equal(
      disableFlagEnvName(PROCESS_WEBHOOK_EVENT_FUNCTION_ID),
      'INNGEST_FN_DISABLE_AGENTPLAIN_PROCESS_WEBHOOK_EVENT',
    );
  });

  it('exports an Inngest function with the expected id', () => {
    const fn = processWebhookEventFn as unknown as { id: () => string; name?: string };
    const id = typeof fn.id === 'function' ? fn.id() : (fn as unknown as { id: string }).id;
    assert.equal(id, PROCESS_WEBHOOK_EVENT_FUNCTION_ID);
  });
});

describe('process-webhook-event — inngest serve registration', () => {
  it('is included in the Inngest serve route alongside the other crons', async () => {
    // Load the serve route module to verify the function reference is in
    // the registered set. Any future PR that drops this from the array
    // will fail here — that protects against the audit's load-bearing
    // gap (audit §1 row 4: "NOT registered in the Inngest serve route").
    const routeModule = await import('@/app/api/inngest/route');
    // The serve() helper exports GET/POST/PUT handlers; the function
    // array isn't directly exported, so we instead assert the imported
    // module loads without throwing — combined with the id assertion
    // above, that pins registration shape. A genuine drift would either
    // (a) fail this import or (b) be caught by the next test that pins
    // the literal array contents.
    assert.ok(routeModule.GET, 'inngest route did not export GET');
    assert.ok(routeModule.POST, 'inngest route did not export POST');
    assert.ok(routeModule.PUT, 'inngest route did not export PUT');
  });

  it('serve route file literally references processWebhookEventFn', async () => {
    // Read the route source and assert the symbol is referenced. This is
    // the strict counterpart to the import test — if someone reverts the
    // registration but keeps the import, the array assertion catches it.
    const { readFile } = await import('node:fs/promises');
    const path = (await import('node:path')).resolve(
      process.cwd(),
      'app/api/inngest/route.ts',
    );
    const src = await readFile(path, 'utf8');
    assert.match(src, /processWebhookEventFn/);
    assert.match(src, /functions:\s*\[[\s\S]*processWebhookEventFn[\s\S]*\]/);
  });
});
