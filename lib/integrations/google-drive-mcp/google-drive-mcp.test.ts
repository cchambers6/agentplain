/**
 * lib/integrations/google-drive-mcp/google-drive-mcp.test.ts
 *
 * Smoke test for the Google Drive MCP server via the in-process MCP client +
 * fixture server. Exercises the exact dispatcher the HTTP route runs. Pure,
 * no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestDriveMcpServer } from './test-server';
import { DRIVE_NAMESPACE, type DriveMcpServer } from './types';
import { DRIVE_TOOLS } from './tools';

function client() {
  const server: DriveMcpServer = new TestDriveMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: DRIVE_TOOLS, namespace: DRIVE_NAMESPACE });
}

describe('google-drive-mcp dispatch', () => {
  it('tools/list exposes the seven Drive tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'google-drive.create_folder',
      'google-drive.download_file',
      'google-drive.get_file_metadata',
      'google-drive.list_files',
      'google-drive.search_files',
      'google-drive.share_file',
      'google-drive.upload_file',
    ]);
  });

  it('list_files returns fixtures and filters by query substring', async () => {
    const all = (await client().call('list_files', {})) as { files: unknown[] };
    assert.equal(all.files.length, 2);
    const filtered = (await client().call('list_files', { query: 'Peachtree' })) as {
      files: { name: string }[];
    };
    assert.equal(filtered.files.length, 1);
    assert.match(filtered.files[0].name, /Peachtree/);
  });

  it('get_file_metadata returns metadata for a known file', async () => {
    const res = (await client().call('get_file_metadata', { fileId: 'file-1001' })) as {
      file: { id: string; mimeType: string };
    };
    assert.equal(res.file.id, 'file-1001');
    assert.equal(res.file.mimeType, 'application/pdf');
  });

  it('download_file exports Google-native docs to PDF', async () => {
    const native = (await client().call('download_file', { fileId: 'file-1002' })) as {
      mimeType: string;
      exported: boolean;
      contentBase64: string;
    };
    assert.equal(native.mimeType, 'application/pdf');
    assert.equal(native.exported, true);
    assert.ok(native.contentBase64.length > 0);

    const binary = (await client().call('download_file', { fileId: 'file-1001' })) as {
      mimeType: string;
      exported: boolean;
    };
    assert.equal(binary.exported, false);
    assert.equal(binary.mimeType, 'application/pdf');
  });

  it('upload_file returns a new file id', async () => {
    const res = (await client().call('upload_file', {
      name: 'notes.txt',
      mimeType: 'text/plain',
      contentBase64: Buffer.from('hello', 'utf8').toString('base64'),
    })) as { id: string; name: string };
    assert.equal(res.id, 'file-new-3001');
    assert.equal(res.name, 'notes.txt');
  });

  it('create_folder returns a new folder id with parents', async () => {
    const res = (await client().call('create_folder', {
      name: 'Closings',
      parentFolderId: 'folder-root',
    })) as { id: string; parents: string[] };
    assert.equal(res.id, 'folder-new-4001');
    assert.deepEqual(res.parents, ['folder-root']);
  });

  it('search_files matches the full-text term', async () => {
    const res = (await client().call('search_files', { text: 'Checklist' })) as {
      files: { id: string }[];
    };
    assert.equal(res.files.length, 1);
    assert.equal(res.files[0].id, 'file-1002');
  });

  it('share_file is blocked without an approvalToken (APPROVAL_REQUIRED)', async () => {
    // Schema rejects the missing token at the dispatcher (INVALID_PARAMS)…
    await assert.rejects(
      () => client().call('share_file', { fileId: 'file-1001', role: 'reader', emailAddress: 'a@b.com' }),
      /Invalid params/,
    );
    // …and an explicit empty string trips the server-side gate.
    await assert.rejects(
      async () => {
        try {
          await client().call('share_file', {
            fileId: 'file-1001',
            role: 'reader',
            emailAddress: 'a@b.com',
            approvalToken: '   ',
          });
        } catch (err) {
          assert.ok(err instanceof McpClientError);
          assert.equal(err.mcpErrorCode, 'APPROVAL_REQUIRED');
          throw err;
        }
      },
      McpClientError,
    );
  });

  it('share_file proceeds with a non-empty approvalToken', async () => {
    const res = (await client().call('share_file', {
      fileId: 'file-1001',
      role: 'writer',
      emailAddress: 'agent@example.com',
      approvalToken: 'approved-by-human-abc123',
    })) as { permissionId: string; role: string };
    assert.equal(res.permissionId, 'perm-5001');
    assert.equal(res.role, 'writer');
  });
});
