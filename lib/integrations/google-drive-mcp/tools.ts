/**
 * lib/integrations/google-drive-mcp/tools.ts
 *
 * The Google Drive tool registry — zod arg schemas + descriptions + wiring to
 * the `DriveMcpServer` interface. Shared by the HTTP route and the smoke test
 * via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * `share_file` is the only mutating-access tool; its schema requires a
 * non-empty `approvalToken`, and the server method ALSO enforces the gate
 * (returning APPROVAL_REQUIRED) so the rule holds even if a caller bypasses
 * schema validation. Sharing changes who can access a file and the platform
 * never auto-performs it.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { DRIVE_NAMESPACE, type DriveMcpServer } from './types';

const listFilesSchema = z.object({
  query: z.string().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  pageToken: z.string().optional(),
});

const fileIdSchema = z.object({ fileId: z.string().min(1) });

const uploadFileSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
  parentFolderId: z.string().optional(),
});

const createFolderSchema = z.object({
  name: z.string().min(1),
  parentFolderId: z.string().optional(),
});

const searchFilesSchema = z.object({
  text: z.string().min(1),
  pageSize: z.number().int().positive().max(100).optional(),
  pageToken: z.string().optional(),
});

const shareFileSchema = z.object({
  fileId: z.string().min(1),
  emailAddress: z.string().email().optional(),
  role: z.enum(['reader', 'commenter', 'writer']),
  type: z.enum(['user', 'group', 'domain', 'anyone']).optional(),
  // Required + non-empty: the human-approval gate (mirrored in the server).
  approvalToken: z.string().min(1),
});

export const DRIVE_TOOLS: ReadonlyArray<ToolRegistration<DriveMcpServer>> = [
  {
    name: `${DRIVE_NAMESPACE}.list_files`,
    description:
      'List files in Drive, optionally filtered by a Drive query (mapped to `q`). Returns id/name/mimeType/modifiedTime, plus a nextPageToken.',
    schema: listFilesSchema,
    invoke: (s, a) => s.listFiles(listFilesSchema.parse(a)),
  },
  {
    name: `${DRIVE_NAMESPACE}.get_file_metadata`,
    description: 'Get metadata for a single file by fileId (name, mimeType, parents, timestamps, links).',
    schema: fileIdSchema,
    invoke: (s, a) => s.getFileMetadata(fileIdSchema.parse(a)),
  },
  {
    name: `${DRIVE_NAMESPACE}.download_file`,
    description:
      'Download a file as base64. Binary files stream their media; Google-native docs (e.g. Google Docs) export to PDF.',
    schema: fileIdSchema,
    invoke: (s, a) => s.downloadFile(fileIdSchema.parse(a)),
  },
  {
    name: `${DRIVE_NAMESPACE}.upload_file`,
    description:
      'Upload a new file from base64 content with a name + mimeType, optionally into a parent folder. Acts as the customer via their Google account.',
    schema: uploadFileSchema,
    invoke: (s, a) => s.uploadFile(uploadFileSchema.parse(a)),
  },
  {
    name: `${DRIVE_NAMESPACE}.create_folder`,
    description: 'Create a Drive folder with a name, optionally nested under a parent folder.',
    schema: createFolderSchema,
    invoke: (s, a) => s.createFolder(createFolderSchema.parse(a)),
  },
  {
    name: `${DRIVE_NAMESPACE}.search_files`,
    description: "Full-text search Drive (wraps the term into `fullText contains '...'`). Returns file summaries.",
    schema: searchFilesSchema,
    invoke: (s, a) => s.searchFiles(searchFilesSchema.parse(a)),
  },
  {
    name: `${DRIVE_NAMESPACE}.share_file`,
    description:
      'GATED — changes who can access a file. Requires a non-empty approvalToken supplied by a human approval step; without it the call returns APPROVAL_REQUIRED and does nothing. Grants a role (reader/commenter/writer) to a user/group/domain/anyone.',
    schema: shareFileSchema,
    invoke: (s, a) => s.shareFile(shareFileSchema.parse(a)),
  },
];
