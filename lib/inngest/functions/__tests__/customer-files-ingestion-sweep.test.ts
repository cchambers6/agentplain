/**
 * Behavior + smoke tests for `customer-files-ingestion-sweep`.
 *
 * Behavior (via dependency injection — no DB):
 *   - NOT_CONFIGURED sources count as `workspacesSkippedUnconfigured`
 *     and contribute zero chunks. This is the safe-to-ship-before-OAuth
 *     guarantee.
 *   - A configured fixture source ingests, dedupes across re-fires, and
 *     contributes to filesIngested + chunksWritten.
 *   - A throwing source factory surfaces as a per-workspace failure and
 *     does NOT stall the sweep.
 *
 * Smoke (mirrors `integration-renewal-sweep.test.ts`):
 *   - Function id + cron schedule are the documented constants.
 *   - Disable env var follows the normalization rule.
 */

import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOMER_FILES_INGESTION_SWEEP_CRON,
  CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID,
  customerFilesIngestionSweepFn,
  runCustomerFilesIngestionSweep,
} from '../customer-files-ingestion-sweep';
import { disableFlagEnvName } from '../../disable-flag';
import { FixtureFileSource } from '@/lib/customer-files';
import {
  TestEmbeddingProvider,
  TestKnowledgeStore,
} from '@/lib/knowledge';
import type { IFileSource } from '@/lib/customer-files';
import { fileSourceError, fileSourceOk } from '@/lib/customer-files';

const FIXTURE_DIR = path.join(
  process.cwd(),
  'tests',
  'fixtures',
  'customer-files',
);

const WORKSPACE_A = 'aaaaaaaa-1111-2222-3333-444444444444';
const WORKSPACE_B = 'bbbbbbbb-9999-8888-7777-666666666666';

function makeStore(): TestKnowledgeStore {
  return new TestKnowledgeStore(new TestEmbeddingProvider({ dimensions: 1536 }));
}

class UnconfiguredSource implements IFileSource {
  readonly name = 'unconfigured-stub' as const;
  async listFiles() {
    return fileSourceError(
      'NOT_CONFIGURED',
      'integration not connected on this workspace',
    );
  }
  async fetchFile() {
    return fileSourceError('NOT_CONFIGURED', 'never reached in the unconfigured path');
  }
}

describe('runCustomerFilesIngestionSweep — NOT_CONFIGURED workspaces NO-OP', () => {
  it('counts unconfigured workspaces as skipped, not failed', async () => {
    const result = await runCustomerFilesIngestionSweep({
      listWorkspaces: async () => [
        { id: WORKSPACE_A, slug: 'workspace-a' },
        { id: WORKSPACE_B, slug: 'workspace-b' },
      ],
      buildSource: () => new UnconfiguredSource(),
      store: makeStore(),
    });

    assert.equal(result.workspacesConsidered, 2);
    assert.equal(result.workspacesSkippedUnconfigured, 2);
    assert.equal(result.workspacesIngested, 0);
    assert.equal(result.filesIngested, 0);
    assert.equal(result.chunksWritten, 0);
    assert.equal(result.failures.length, 0);
  });
});

describe('runCustomerFilesIngestionSweep — fixture source ingests', () => {
  it('writes chunks per file for each workspace and re-fires dedupe', async () => {
    const store = makeStore();
    const source = new FixtureFileSource({ rootDir: FIXTURE_DIR });

    const first = await runCustomerFilesIngestionSweep({
      listWorkspaces: async () => [
        { id: WORKSPACE_A, slug: 'workspace-a' },
        { id: WORKSPACE_B, slug: 'workspace-b' },
      ],
      buildSource: () => source,
      store,
    });

    assert.equal(first.workspacesConsidered, 2);
    assert.equal(first.workspacesIngested, 2);
    assert.equal(first.workspacesSkippedUnconfigured, 0);
    assert.ok(first.filesIngested >= 2, `expected >= 2 files ingested, got ${first.filesIngested}`);
    assert.ok(first.chunksWritten >= 2, `expected >= 2 chunks, got ${first.chunksWritten}`);
    assert.equal(first.failures.length, 0);

    // Re-fire: same files, dedupe key in `ingestWorkspaceFiles` replaces
    // chunks in place. Result shape stays the same — no duplicate
    // accumulation visible at the sweep boundary.
    const second = await runCustomerFilesIngestionSweep({
      listWorkspaces: async () => [
        { id: WORKSPACE_A, slug: 'workspace-a' },
        { id: WORKSPACE_B, slug: 'workspace-b' },
      ],
      buildSource: () => source,
      store,
    });

    assert.equal(second.workspacesIngested, 2);
    assert.equal(second.filesIngested, first.filesIngested);
    assert.equal(second.chunksWritten, first.chunksWritten);
    assert.equal(second.failures.length, 0);
  });
});

describe('runCustomerFilesIngestionSweep — non-NOT_CONFIGURED listFiles errors surface as failures', () => {
  it('classifies a PROVIDER_ERROR source as a per-workspace failure and keeps going', async () => {
    class FlakyFileSource implements IFileSource {
      readonly name = 'flaky-stub' as const;
      private calls = 0;
      async listFiles() {
        this.calls += 1;
        if (this.calls === 1) {
          // The first workspace's source errors loudly — ingestion throws
          // (per ingestWorkspaceFiles' non-NOT_CONFIGURED contract).
          return fileSourceError('PROVIDER_ERROR', 'simulated outage');
        }
        // Second workspace succeeds.
        return fileSourceOk([]);
      }
      async fetchFile() {
        return fileSourceError('NOT_FOUND', 'unused in this test');
      }
    }
    const source = new FlakyFileSource();

    const result = await runCustomerFilesIngestionSweep({
      listWorkspaces: async () => [
        { id: WORKSPACE_A, slug: 'workspace-a' },
        { id: WORKSPACE_B, slug: 'workspace-b' },
      ],
      buildSource: () => source,
      store: makeStore(),
    });

    assert.equal(result.workspacesConsidered, 2);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].workspaceId, WORKSPACE_A);
    assert.match(result.failures[0].reason, /PROVIDER_ERROR|simulated outage/);
    // Second workspace returned ok with zero files — counts as ingested
    // (the source listed an empty folder, distinct from NOT_CONFIGURED).
    assert.equal(result.workspacesIngested, 1);
  });
});

describe('runCustomerFilesIngestionSweep — sweep keeps going past a thrown factory', () => {
  it('reports a thrown buildSource as a failure and processes remaining workspaces', async () => {
    const result = await runCustomerFilesIngestionSweep({
      listWorkspaces: async () => [
        { id: WORKSPACE_A, slug: 'workspace-a' },
        { id: WORKSPACE_B, slug: 'workspace-b' },
      ],
      buildSource: (workspaceId: string) => {
        if (workspaceId === WORKSPACE_A) {
          throw new Error('factory exploded for workspace A');
        }
        return new UnconfiguredSource();
      },
      store: makeStore(),
    });

    assert.equal(result.workspacesConsidered, 2);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].workspaceId, WORKSPACE_A);
    assert.match(result.failures[0].reason, /factory exploded/);
    // Workspace B's unconfigured source NO-OPs cleanly even though A blew up.
    assert.equal(result.workspacesSkippedUnconfigured, 1);
  });
});

describe('customer-files-ingestion-sweep — cron metadata', () => {
  it('keeps the documented function id', () => {
    assert.equal(
      CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID,
      'agentplain-customer-files-ingestion-sweep',
    );
  });

  it('keeps the every-6-hour UTC cron schedule', () => {
    assert.equal(CUSTOMER_FILES_INGESTION_SWEEP_CRON, '0 */6 * * *');
  });

  it('disable env var name matches the disable-flag normalization rule', () => {
    assert.equal(
      disableFlagEnvName(CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID),
      'INNGEST_FN_DISABLE_AGENTPLAIN_CUSTOMER_FILES_INGESTION_SWEEP',
    );
  });

  it('exports an Inngest function with the expected id', () => {
    const fn = customerFilesIngestionSweepFn as unknown as { id: () => string; name?: string };
    const id = typeof fn.id === 'function' ? fn.id() : (fn as unknown as { id: string }).id;
    assert.equal(id, CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID);
  });
});
