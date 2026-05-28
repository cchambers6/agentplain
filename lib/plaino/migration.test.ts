/**
 * lib/plaino/migration.test.ts
 *
 * Migration-shape regression. We can't spin a Postgres cluster from
 * the standard test run, but we can pin the migration SQL itself:
 *
 *   - Both new tables (ChatThread, ChatMessage) are created.
 *   - Both have ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY.
 *   - Both have a workspace-isolation policy that gates on the
 *     `app.workspace_id` GUC + the `app.is_operator` operator escape.
 *   - ChatMessage.body is TEXT (encrypted ciphertext envelope) and
 *     ChatMessage.role has a CHECK constraint binding it to
 *     "customer" or "plaino".
 *
 * The live cross-workspace cannot-read-cannot-write assertion runs in
 * the deploy-time smoke pass; this file is the local-tooling proxy.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_PATH = join(
  process.cwd(),
  'prisma',
  'migrations',
  '20260528300000_add_chat_thread_message',
  'migration.sql',
);

const SQL = readFileSync(MIGRATION_PATH, 'utf8');

describe('chat-thread-message migration — shape', () => {
  it('creates both tables', () => {
    assert.match(SQL, /CREATE TABLE "ChatThread"/);
    assert.match(SQL, /CREATE TABLE "ChatMessage"/);
  });

  it('FORCE ROW LEVEL SECURITY on both — the same posture other tenant tables use', () => {
    // Without FORCE, an RLS-bypass role (the migration runner itself)
    // could read across workspaces. FORCE binds even the table owner.
    assert.match(SQL, /ALTER TABLE "ChatThread" ENABLE ROW LEVEL SECURITY/);
    assert.match(SQL, /ALTER TABLE "ChatThread" FORCE ROW LEVEL SECURITY/);
    assert.match(SQL, /ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY/);
    assert.match(SQL, /ALTER TABLE "ChatMessage" FORCE ROW LEVEL SECURITY/);
  });

  it('workspace-isolation policy on ChatThread reads workspaceId GUC', () => {
    const policyRegex = new RegExp(
      'CREATE POLICY "chat_thread_workspace_isolation" ON "ChatThread"' +
        '[\\s\\S]*current_setting\\(\'app\\.is_operator\', true\\) = \'true\'' +
        '[\\s\\S]*"workspaceId"::text = current_setting\\(\'app\\.workspace_id\', true\\)',
    );
    assert.match(SQL, policyRegex);
  });

  it('workspace-isolation policy on ChatMessage reads workspaceId GUC', () => {
    const policyRegex = new RegExp(
      'CREATE POLICY "chat_message_workspace_isolation" ON "ChatMessage"' +
        '[\\s\\S]*current_setting\\(\'app\\.is_operator\', true\\) = \'true\'' +
        '[\\s\\S]*"workspaceId"::text = current_setting\\(\'app\\.workspace_id\', true\\)',
    );
    assert.match(SQL, policyRegex);
  });

  it('ChatMessage.body is TEXT — the v1 ciphertext envelope is stored as a string', () => {
    assert.match(SQL, /"body"\s+TEXT NOT NULL/);
  });

  it('ChatMessage.role is constrained to customer / plaino', () => {
    assert.match(SQL, /"ChatMessage_role_check"/);
    assert.match(SQL, /"role" IN \('customer', 'plaino'\)/);
  });

  it('ChatThread cascade-deletes on Workspace delete', () => {
    assert.match(
      SQL,
      /"ChatThread_workspaceId_fkey"[\s\S]*REFERENCES "Workspace"[\s\S]*ON DELETE CASCADE/,
    );
  });

  it('ChatMessage cascade-deletes on ChatThread + Workspace delete', () => {
    assert.match(
      SQL,
      /"ChatMessage_threadId_fkey"[\s\S]*REFERENCES "ChatThread"[\s\S]*ON DELETE CASCADE/,
    );
    assert.match(
      SQL,
      /"ChatMessage_workspaceId_fkey"[\s\S]*REFERENCES "Workspace"[\s\S]*ON DELETE CASCADE/,
    );
  });
});
