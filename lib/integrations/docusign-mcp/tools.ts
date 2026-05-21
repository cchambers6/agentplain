/**
 * lib/integrations/docusign-mcp/tools.ts
 *
 * The DocuSign tool registry — zod arg schemas + descriptions + wiring to the
 * `DocuSignMcpServer` interface. Shared by the HTTP route and the smoke test
 * via `lib/integrations/mcp-core/dispatch.ts`.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { DOCUSIGN_NAMESPACE, type DocuSignMcpServer } from './types';

const listEnvelopesSchema = z.object({
  fromDate: z.string().optional(),
  status: z.string().optional(),
  count: z.number().int().positive().max(100).optional(),
});

const envelopeIdSchema = z.object({ envelopeId: z.string().min(1) });

const templateRoleSchema = z.object({
  roleName: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
});
const signerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  routingOrder: z.string().optional(),
});
const documentSchema = z.object({
  name: z.string().min(1),
  fileExtension: z.string().min(1),
  documentBase64: z.string().min(1),
});
const sendEnvelopeSchema = z.object({
  emailSubject: z.string().min(1),
  templateId: z.string().optional(),
  templateRoles: z.array(templateRoleSchema).optional(),
  documents: z.array(documentSchema).optional(),
  signers: z.array(signerSchema).optional(),
  status: z.enum(['sent', 'created']).optional(),
});

const downloadSchema = z.object({
  envelopeId: z.string().min(1),
  documentId: z.string().optional(),
});

const voidSchema = z.object({
  envelopeId: z.string().min(1),
  voidedReason: z.string().min(1),
});

export const DOCUSIGN_TOOLS: ReadonlyArray<ToolRegistration<DocuSignMcpServer>> = [
  {
    name: `${DOCUSIGN_NAMESPACE}.list_envelopes`,
    description: 'List envelopes changed since a date, optionally filtered by status (sent/completed/declined/voided).',
    schema: listEnvelopesSchema,
    invoke: (s, a) => s.listEnvelopes(listEnvelopesSchema.parse(a)),
  },
  {
    name: `${DOCUSIGN_NAMESPACE}.get_envelope_status`,
    description: 'Get a single envelope and its current status by envelopeId.',
    schema: envelopeIdSchema,
    invoke: (s, a) => s.getEnvelopeStatus(envelopeIdSchema.parse(a)),
  },
  {
    name: `${DOCUSIGN_NAMESPACE}.get_recipient_status`,
    description: 'Get per-recipient signing status for an envelope (who has signed, who is waiting).',
    schema: envelopeIdSchema,
    invoke: (s, a) => s.getRecipientStatus(envelopeIdSchema.parse(a)),
  },
  {
    name: `${DOCUSIGN_NAMESPACE}.send_envelope`,
    description:
      'Send an envelope for signature from a template (templateId + templateRoles) or from documents (documents + signers). Acts as the customer via their DocuSign account.',
    schema: sendEnvelopeSchema,
    invoke: (s, a) => s.sendEnvelope(sendEnvelopeSchema.parse(a)),
  },
  {
    name: `${DOCUSIGN_NAMESPACE}.download_completed_document`,
    description: 'Download the signed PDF for an envelope (documentId, or `combined` for the merged document). Returns base64.',
    schema: downloadSchema,
    invoke: (s, a) => s.downloadCompletedDocument(downloadSchema.parse(a)),
  },
  {
    name: `${DOCUSIGN_NAMESPACE}.void_envelope`,
    description: 'Void an in-flight envelope with a reason. Acts as the customer via their DocuSign account.',
    schema: voidSchema,
    invoke: (s, a) => s.voidEnvelope(voidSchema.parse(a)),
  },
];
