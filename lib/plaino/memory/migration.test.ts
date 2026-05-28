/**
 * lib/plaino/memory/migration.test.ts
 *
 * Migration-shape regression for WorkspaceMemoryEntry. We can't spin
 * a Postgres cluster from the standard test run, but we can pin the
 * migration SQL itself:
 *
 *   - WorkspaceMemoryEntry table is created.
 *   - WorkspaceMemoryKind enum is created with the four buckets.
 *   - ENABLE + FORCE ROW LEVEL SECURITY (same posture as ChatThread /
 *     ChatMessage / SupportRequest).
 *   - Workspace-isolation policy gates on the app.workspace_id GUC
 *     with the operator escape.
 *   - body is TEXT (encrypted v1 envelope), title is TEXT (plaintext,
 *     the extractor is instructed to keep PII out).
 *   - The composite (workspaceId, kind, pinned, createdAt) index
 *     exists — it's the load-bearing dispatch-read index.
 *
 * The live cross-workspace cannot-read-cannot-write assertion runs in
 * the deploy-time smoke pass; this is the local-tooling proxy.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_PATH = join(
  process.cwd(),
  'prisma',
  'migrations',
  '20260528400000_add_workspace_memory_entry',
  'migration.sql',
);

const SQL = readFileSync(MIGRATION_PATH, 'utf8');

describe('workspace-memory-entry migration — shape', () => {
  it('creates the table', () => {
    assert.match(SQL, /CREATE TABLE "WorkspaceMemoryEntry"/);
  });

  it('creates the WorkspaceMemoryKind enum with the four buckets', () => {
    assert.match(
      SQL,
      /CREATE TYPE "WorkspaceMemoryKind" AS ENUM \('USER', 'FEEDBACK', 'PROJECT', 'REFERENCE'\)/,
    );
  });

  it('FORCE ROW LEVEL SECURITY — same posture as other tenant tables', () => {
    assert.match(
      SQL,
      /ALTER TABLE "WorkspaceMemoryEntry" ENABLE ROW LEVEL SECURITY/,
    );
    assert.match(
      SQL,
      /ALTER TABLE "WorkspaceMemoryEntry" FORCE ROW LEVEL SECURITY/,
    );
  });

  it('workspace-isolation policy reads the workspaceId GUC + operator escape', () => {
    const policyRegex = new RegExp(
      'CREATE POLICY "workspace_memory_entry_workspace_isolation" ON "WorkspaceMemoryEntry"' +
        '[\\s\\S]*current_setting\\(\'app\\.is_operator\', true\\) = \'true\'' +
        '[\\s\\S]*"workspaceId"::text = current_setting\\(\'app\\.workspace_id\', true\\)',
    );
    assert.match(SQL, policyRegex);
  });

  it('body is TEXT — the v1 ciphertext envelope is stored as a string', () => {
    assert.match(SQL, /"body"\s+TEXT NOT NULL/);
  });

  it('title is TEXT — plaintext for fast list/search; PII kept out at extract', () => {
    assert.match(SQL, /"title"\s+TEXT NOT NULL/);
  });

  it('uses the WorkspaceMemoryKind enum for the kind column', () => {
    assert.match(SQL, /"kind"\s+"WorkspaceMemoryKind" NOT NULL/);
  });

  it('cascade-deletes on Workspace delete', () => {
    assert.match(
      SQL,
      /"WorkspaceMemoryEntry_workspaceId_fkey"[\s\S]*REFERENCES "Workspace"[\s\S]*ON DELETE CASCADE/,
    );
  });

  it('source-message FK is SET NULL — the memory outlives the source turn', () => {
    assert.match(
      SQL,
      /"WorkspaceMemoryEntry_sourceChatMessageId_fkey"[\s\S]*REFERENCES "ChatMessage"[\s\S]*ON DELETE SET NULL/,
    );
  });

  it('composite (workspaceId, kind, pinned, createdAt) index — the dispatch-read load-bearing index', () => {
    assert.match(
      SQL,
      /CREATE INDEX "WorkspaceMemoryEntry_workspaceId_kind_pinned_createdAt_idx"[\s\S]*"WorkspaceMemoryEntry"\("workspaceId", "kind", "pinned", "createdAt"\)/,
    );
  });

  it('(workspaceId, pinned, updatedAt) index — the memory-page list index', () => {
    assert.match(
      SQL,
      /CREATE INDEX "WorkspaceMemoryEntry_workspaceId_pinned_updatedAt_idx"[\s\S]*"WorkspaceMemoryEntry"\("workspaceId", "pinned", "updatedAt"\)/,
    );
  });
});
