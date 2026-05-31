/**
 * lib/integrations/taxdome-mcp/tools.ts
 *
 * The TaxDome tool registry — zod arg schemas + descriptions + wiring to
 * the `TaxdomeMcpServer` interface. Shared by the HTTP route and the
 * smoke test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Read-only tools only — no `create_*` / `update_*` paths today. When
 * we add a write surface (e.g. drafting a doc back into TaxDome) it
 * lands behind an approval gate the same way QuickBooks `record_payment`
 * does.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { TAXDOME_NAMESPACE, type TaxdomeMcpServer } from './types';

const listClientsSchema = z.object({
  count: z.number().int().positive().max(100).optional(),
});
const clientIdSchema = z.object({ clientId: z.string().min(1) });

const listTaxDocsSchema = z.object({
  clientId: z.string().optional(),
  status: z
    .enum(['pending-review', 'reviewed', 'sent-to-client', 'archived'])
    .optional(),
  count: z.number().int().positive().max(100).optional(),
});
const docIdSchema = z.object({ documentId: z.string().min(1) });
const listEngagementLettersSchema = z.object({
  clientId: z.string().optional(),
  count: z.number().int().positive().max(100).optional(),
});
const listReceivedDocsSchema = z.object({
  clientId: z.string().optional(),
  uploadedSince: z.string().optional(),
  count: z.number().int().positive().max(100).optional(),
});

export const TAXDOME_TOOLS: ReadonlyArray<ToolRegistration<TaxdomeMcpServer>> = [
  {
    name: `${TAXDOME_NAMESPACE}.list_clients`,
    description: 'List clients in the firm. count is 1..100 (default 25).',
    schema: listClientsSchema,
    invoke: (s, a) => s.listClients(listClientsSchema.parse(a)),
  },
  {
    name: `${TAXDOME_NAMESPACE}.get_client`,
    description: 'Get a single client by TaxDome client id.',
    schema: clientIdSchema,
    invoke: (s, a) => s.getClient(clientIdSchema.parse(a)),
  },
  {
    name: `${TAXDOME_NAMESPACE}.list_tax_documents`,
    description:
      'List tax documents, optionally filtered by clientId and/or status. count is 1..100 (default 25).',
    schema: listTaxDocsSchema,
    invoke: (s, a) => s.listTaxDocuments(listTaxDocsSchema.parse(a)),
  },
  {
    name: `${TAXDOME_NAMESPACE}.get_tax_document`,
    description: 'Get a single tax document by TaxDome document id.',
    schema: docIdSchema,
    invoke: (s, a) => s.getTaxDocument(docIdSchema.parse(a)),
  },
  {
    name: `${TAXDOME_NAMESPACE}.list_engagement_letters`,
    description:
      'List engagement letters (documents with kind=engagement-letter), optionally filtered by clientId. count is 1..100 (default 25).',
    schema: listEngagementLettersSchema,
    invoke: (s, a) => s.listEngagementLetters(listEngagementLettersSchema.parse(a)),
  },
  {
    name: `${TAXDOME_NAMESPACE}.list_received_documents`,
    description:
      'List client-uploaded documents (kind=received-doc), optionally filtered by clientId and/or uploadedSince (YYYY-MM-DD). count is 1..100 (default 25).',
    schema: listReceivedDocsSchema,
    invoke: (s, a) => s.listReceivedDocuments(listReceivedDocsSchema.parse(a)),
  },
];
