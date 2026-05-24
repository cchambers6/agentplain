/**
 * Unit tests for lib/inngest/with-error-reporting.ts.
 *
 * The wrapper is the agentplain answer to the flatsbo task_budget 400 —
 * a cron threw and nobody noticed until Conner did. These tests pin down:
 *
 *   1. Success path: returns the inner value, makes no reports, no flush.
 *   2. Throw path: reports through the adapter with boundary/function_id
 *      tags, flushes, then rethrows so Inngest still records the failure
 *      and applies its retry policy.
 *   3. Extra tags flow through to the reporter.
 *   4. reportInngestItemFailure surfaces a per-item failure without
 *      rethrowing — the sweep keeps going.
 *
 * Per `feedback_no_silent_vendor_lock.md`: tests run against the
 * TestErrorReporter shim, never `@sentry/nextjs` itself.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  TestErrorReporter,
  __setErrorReporterForTests,
} from '@/lib/observability';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';

describe('withInngestErrorReporting', () => {
  let recorder: TestErrorReporter;

  beforeEach(() => {
    recorder = new TestErrorReporter();
    __setErrorReporterForTests(recorder);
  });

  afterEach(() => {
    __setErrorReporterForTests(null);
  });

  it('returns the inner value when fn resolves', async () => {
    const out = await withInngestErrorReporting(
      { functionId: 'agentplain-test-fn' },
      async () => 42,
    );
    assert.equal(out, 42);
    assert.equal(recorder.exceptions.length, 0);
    assert.equal(recorder.flushed, 0);
  });

  it('reports + flushes + rethrows when fn throws', async () => {
    const boom = new Error('downstream blew up');
    await assert.rejects(
      withInngestErrorReporting(
        { functionId: 'agentplain-test-fn' },
        async () => {
          throw boom;
        },
      ),
      /downstream blew up/,
    );

    assert.equal(recorder.exceptions.length, 1);
    const [captured] = recorder.exceptions;
    assert.equal(captured.err, boom);
    assert.equal(captured.ctx?.level, 'error');
    assert.equal(captured.ctx?.tags?.boundary, 'inngest');
    assert.equal(captured.ctx?.tags?.function_id, 'agentplain-test-fn');
    assert.equal(recorder.flushed, 1);
  });

  it('merges extraTags onto the report', async () => {
    const boom = new Error('per-fire context error');
    await assert.rejects(() =>
      withInngestErrorReporting(
        {
          functionId: 'agentplain-test-fn',
          extraTags: { run_id: 'run_123', batch_size: '25' },
        },
        async () => {
          throw boom;
        },
      ),
    );
    const tags = recorder.exceptions[0]?.ctx?.tags ?? {};
    assert.equal(tags.boundary, 'inngest');
    assert.equal(tags.function_id, 'agentplain-test-fn');
    assert.equal(tags.run_id, 'run_123');
    assert.equal(tags.batch_size, '25');
  });

  it('handles non-Error throws (string, plain object) without crashing', async () => {
    await assert.rejects(() =>
      withInngestErrorReporting(
        { functionId: 'agentplain-test-fn' },
        async () => {
          // eslint-disable-next-line no-throw-literal
          throw 'string-thrown';
        },
      ),
    );
    assert.equal(recorder.exceptions.length, 1);
    assert.equal(recorder.exceptions[0]?.err, 'string-thrown');
  });
});

describe('composition with runWithDisableGate', () => {
  let recorder: TestErrorReporter;
  const fnId = 'agentplain-compose-test';
  const envKey = `INNGEST_FN_DISABLE_${fnId.replace(/-/g, '_').toUpperCase()}`;

  beforeEach(() => {
    recorder = new TestErrorReporter();
    __setErrorReporterForTests(recorder);
    delete process.env[envKey];
  });

  afterEach(() => {
    __setErrorReporterForTests(null);
    delete process.env[envKey];
  });

  it('production-shape: gate + reporter together — throw reports + rethrows', async () => {
    const { runWithDisableGate } = await import('../run-with-disable-gate');
    const boom = new Error('skill chain threw');
    await assert.rejects(
      runWithDisableGate(fnId, () =>
        withInngestErrorReporting({ functionId: fnId }, async () => {
          throw boom;
        }),
      ),
      /skill chain threw/,
    );
    assert.equal(recorder.exceptions.length, 1);
    assert.equal(recorder.exceptions[0]?.err, boom);
    assert.equal(recorder.exceptions[0]?.ctx?.tags?.function_id, fnId);
    assert.equal(recorder.flushed, 1);
  });

  it('disabled gate short-circuits BEFORE the reporter runs', async () => {
    const { runWithDisableGate } = await import('../run-with-disable-gate');
    process.env[envKey] = 'true';
    const result = await runWithDisableGate(fnId, () =>
      withInngestErrorReporting({ functionId: fnId }, async () => {
        throw new Error('should never run');
      }),
    );
    assert.equal(result.disabled, true);
    assert.equal(result.result, null);
    assert.equal(recorder.exceptions.length, 0);
    assert.equal(recorder.flushed, 0);
  });
});

describe('reportInngestItemFailure', () => {
  let recorder: TestErrorReporter;

  beforeEach(() => {
    recorder = new TestErrorReporter();
    __setErrorReporterForTests(recorder);
  });

  afterEach(() => {
    __setErrorReporterForTests(null);
  });

  it('reports without rethrowing — sweep keeps going', () => {
    const err = new Error('one row failed');
    reportInngestItemFailure(err, {
      functionId: 'agentplain-process-webhook-event',
      extraTags: {
        webhook_event_id: 'evt_42',
        workspace_id: 'ws_1',
        provider: 'GOOGLE',
      },
    });
    assert.equal(recorder.exceptions.length, 1);
    const [captured] = recorder.exceptions;
    assert.equal(captured.err, err);
    assert.equal(captured.ctx?.level, 'error');
    assert.equal(captured.ctx?.tags?.boundary, 'inngest-item');
    assert.equal(captured.ctx?.tags?.function_id, 'agentplain-process-webhook-event');
    assert.equal(captured.ctx?.tags?.webhook_event_id, 'evt_42');
    assert.equal(captured.ctx?.tags?.workspace_id, 'ws_1');
    assert.equal(captured.ctx?.tags?.provider, 'GOOGLE');
    // No flush from the per-item helper — the wrapping function flushes
    // on top-level throw; per-item reports ride that flush.
    assert.equal(recorder.flushed, 0);
  });
});
