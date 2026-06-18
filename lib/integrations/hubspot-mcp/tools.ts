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
  pendingApprovalId: z.string().optional(),
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
  pendingApprovalId: z.string().optional(),
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
  pendingApprovalId: z.string().optional(),
});

// ── Write-action-depth schemas (all approval-gated) ────────────────────────

const objectEnum = z.enum(['contacts', 'deals', 'companies']);

const createDealSchema = z.object({
  dealName: z.string().min(1),
  amount: z.string().optional(),
  pipeline: z.string().optional(),
  dealStage: z.string().optional(),
  closeDate: z.string().optional(),
  associatedContactId: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const updateDealStageSchema = z.object({
  dealId: z.string().min(1),
  dealStage: z.string().min(1),
  pipeline: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const logActivitySchema = z.object({
  objectType: objectEnum,
  objectId: z.string().min(1),
  activityType: z.enum(['NOTE', 'CALL', 'EMAIL', 'MEETING']),
  body: z.string().min(1),
  timestamp: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  dueDate: z.string().optional(),
  ownerId: z.string().optional(),
  associatedObjectType: objectEnum.optional(),
  associatedObjectId: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const sendEmailTemplateSchema = z.object({
  contactId: z.string().min(1),
  recipientEmail: z.string().min(1),
  emailId: z.string().min(1),
  customProperties: z.record(z.string(), z.string()).optional(),
  pendingApprovalId: z.string().optional(),
});

const sendSequenceEnrollmentSchema = z.object({
  contactId: z.string().min(1),
  sequenceId: z.string().min(1),
  senderEmail: z.string().min(1),
  pendingApprovalId: z.string().optional(),
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
      'Attach an internal note to a contact, deal, or company (objectType + objectId + body). Approval-gated.',
    schema: createNoteSchema,
    invoke: (s, a) => s.createNote(createNoteSchema.parse(a)),
  },
  // ── Write-action-depth tools (approval-gated mutations) ──────────────────
  {
    name: `${HUBSPOT_NAMESPACE}.create_deal`,
    description:
      'Create a new deal (dealName required; amount/pipeline/dealStage/closeDate/associatedContactId optional). Approval-gated.',
    schema: createDealSchema,
    invoke: (s, a) => s.createDeal(createDealSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.update_deal_stage`,
    description: 'Move a deal to a new pipeline stage (dealId + dealStage). Approval-gated.',
    schema: updateDealStageSchema,
    invoke: (s, a) => s.updateDealStage(updateDealStageSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.log_activity`,
    description:
      'Log an activity (NOTE/CALL/EMAIL/MEETING) against a contact, deal, or company. Approval-gated.',
    schema: logActivitySchema,
    invoke: (s, a) => s.logActivity(logActivitySchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.create_task`,
    description:
      'Create a task (title required; body/dueDate/ownerId/association optional). Approval-gated.',
    schema: createTaskSchema,
    invoke: (s, a) => s.createTask(createTaskSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.send_email_template`,
    description:
      'Send a HubSpot transactional (template) email to a contact. OUTBOUND — approval-gated.',
    schema: sendEmailTemplateSchema,
    invoke: (s, a) => s.sendEmailTemplate(sendEmailTemplateSchema.parse(a)),
  },
  {
    name: `${HUBSPOT_NAMESPACE}.send_sequence_enrollment`,
    description:
      'Enroll a contact into a HubSpot sales sequence. OUTBOUND — approval-gated.',
    schema: sendSequenceEnrollmentSchema,
    invoke: (s, a) => s.sendSequenceEnrollment(sendSequenceEnrollmentSchema.parse(a)),
  },
];
