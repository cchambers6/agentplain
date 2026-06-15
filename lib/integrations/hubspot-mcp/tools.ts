/**
 * lib/integrations/hubspot-mcp/tools.ts
 *
 * The HubSpot tool registry — zod arg schemas + descriptions + wiring to the
 * `HubspotMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/hubspot-mcp/[workspaceId]/route.ts`) and the smoke
 * test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: the write tools (`update_contact`,
 * `update_deal`, `create_note`) annotate the broker's OWN CRM — they are not
 * customer-facing outbound. No tool here sends mail, SMS, or anything to a
 * contact.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import type { HubspotMcpServer } from './types';

/** Namespace prefix for HubSpot MCP tools (e.g. `hubspot.list_contacts`). */
export const HUBSPOT_NAMESPACE = 'hubspot';

const listContactsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  modifiedSince: z.string().optional(),
});

const contactIdSchema = z.object({ contactId: z.string().min(1) });

const updateContactSchema = z.object({
  contactId: z.string().min(1),
  properties: z
    .object({
      firstname: z.string(),
      lastname: z.string(),
      email: z.string(),
      phone: z.string(),
      company: z.string(),
      lifecyclestage: z.string(),
      hs_lead_status: z.string(),
      notes_last_contacted: z.string(),
    })
    .partial(),
});

const listDealsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  pipeline: z.string().optional(),
});

const dealIdSchema = z.object({ dealId: z.string().min(1) });

const updateDealSchema = z.object({
  dealId: z.string().min(1),
  properties: z
    .object({
      dealname: z.string(),
      amount: z.string(),
      dealstage: z.string(),
      closedate: z.string(),
      pipeline: z.string(),
    })
    .partial(),
});

const listCompaniesSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

const companyIdSchema = z.object({ companyId: z.string().min(1) });

const createNoteSchema = z.object({
  objectType: z.enum(['contacts', 'deals', 'companies']),
  objectId: z.string().min(1),
  body: z.string().min(1),
});

export const HUBSPOT_TOOLS: ReadonlyArray<ToolRegistration<HubspotMcpServer>> = [
  {
    name: `${HUBSPOT_NAMESPACE}.list_contacts`,
    description:
      'List contacts. limit is 1..100 (default 25). modifiedSince (ISO) returns only contacts changed after that time.',
    schema: listContactsSchema,
    invoke: (s, a) => s.listContacts(listContactsSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.get_contact`,
    description: 'Get a single contact by its HubSpot id.',
    schema: contactIdSchema,
    invoke: (s, a) => s.getContact(contactIdSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.update_contact`,
    description:
      'Update whitelisted properties on a contact (internal CRM annotation; does not send anything to the contact).',
    schema: updateContactSchema,
    invoke: (s, a) => s.updateContact(updateContactSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.list_deals`,
    description: 'List deals, optionally filtered by pipeline. limit is 1..100 (default 25).',
    schema: listDealsSchema,
    invoke: (s, a) => s.listDeals(listDealsSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.get_deal`,
    description: 'Get a single deal by its HubSpot id.',
    schema: dealIdSchema,
    invoke: (s, a) => s.getDeal(dealIdSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.update_deal`,
    description: 'Update whitelisted properties on a deal (internal CRM annotation).',
    schema: updateDealSchema,
    invoke: (s, a) => s.updateDeal(updateDealSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.list_companies`,
    description: 'List companies. limit is 1..100 (default 25).',
    schema: listCompaniesSchema,
    invoke: (s, a) => s.listCompanies(listCompaniesSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.get_company`,
    description: 'Get a single company by its HubSpot id.',
    schema: companyIdSchema,
    invoke: (s, a) => s.getCompany(companyIdSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.create_note`,
    description:
      'Attach an internal note to a contact, deal, or company (objectType + objectId + body). Internal annotation only.',
    schema: createNoteSchema,
    invoke: (s, a) => s.createNote(createNoteSchema.parse(a)),
  },
];
