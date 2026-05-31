/**
 * lib/integrations/hubspot-mcp/types.ts
 *
 * Wave-7 HubSpot MCP. HubSpot is the most-installed universal CRM at the
 * SMB tier and the biggest demand-unlock for non-realty customers. Uses
 * OAuth 2.0 with offline scopes (long-lived refresh tokens).
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the ONLY place
 * that names HubSpot's REST shape. Skills + cron sweeps speak the typed
 * MCP interface below.
 *
 * Per `project_no_outbound_architecture.md`: the MCP exposes
 * `create_note` and `update_contact` (write paths) for INTERNAL
 * annotations on the broker's own CRM — these are not customer-facing
 * outbound. No tool here sends email, SMS, or anything to a contact.
 *
 * Per `feedback_runner_portability.md`: two impls — `ProdHubspotMcpServer`
 * (production REST) and `RecordingHubspotMcpServer` (test).
 */

import type { McpResult } from '@/lib/integrations/mcp-core';

// ── DTOs the MCP returns ──────────────────────────────────────────────

export interface HubspotContactSummary {
  /** HubSpot contact id. */
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  /** HubSpot lifecycle stage (e.g. subscriber, lead, marketingqualifiedlead, customer). */
  lifecycleStage: string | null;
  /** Free-text lead source HubSpot tracks. */
  leadSource: string | null;
  /** UTC ISO timestamps. */
  createdAt: string | null;
  updatedAt: string | null;
}

export interface HubspotDealSummary {
  id: string;
  name: string | null;
  amount: number | null;
  /** Pipeline + stage ids HubSpot returns; the marketplace UI / triage skill
   *  may map these to friendly names via `list_deals` filters. */
  pipeline: string | null;
  dealStage: string | null;
  /** Close-date if the deal carries one (ISO). */
  closeDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface HubspotCompanySummary {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  city: string | null;
  /** HubSpot uses ISO country codes. */
  country: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ── Tool I/O shapes ───────────────────────────────────────────────────

export interface ListContactsInput {
  limit?: number;
  /** When set, only contacts modified after this ISO timestamp. */
  modifiedSince?: string;
}
export interface ListContactsOutput {
  contacts: HubspotContactSummary[];
}

export interface GetContactInput {
  contactId: string;
}
export interface GetContactOutput {
  contact: HubspotContactSummary;
}

export interface UpdateContactInput {
  contactId: string;
  /** Properties to set on the contact. HubSpot's property API accepts
   *  string-valued updates; the MCP forwards them verbatim. Whitelisted
   *  here so callers can't smuggle unintended writes. */
  properties: Partial<{
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    company: string;
    lifecyclestage: string;
    hs_lead_status: string;
    /** Free-text note property — some workspaces stamp triage decisions
     *  here. */
    notes_last_contacted: string;
  }>;
}
export interface UpdateContactOutput {
  contactId: string;
}

export interface ListDealsInput {
  limit?: number;
  /** Optional pipeline filter. */
  pipeline?: string;
}
export interface ListDealsOutput {
  deals: HubspotDealSummary[];
}

export interface GetDealInput {
  dealId: string;
}
export interface GetDealOutput {
  deal: HubspotDealSummary;
}

export interface UpdateDealInput {
  dealId: string;
  properties: Partial<{
    dealname: string;
    amount: string;
    dealstage: string;
    closedate: string;
    pipeline: string;
  }>;
}
export interface UpdateDealOutput {
  dealId: string;
}

export interface ListCompaniesInput {
  limit?: number;
}
export interface ListCompaniesOutput {
  companies: HubspotCompanySummary[];
}

export interface GetCompanyInput {
  companyId: string;
}
export interface GetCompanyOutput {
  company: HubspotCompanySummary;
}

export interface CreateNoteInput {
  /** Object type to attach the note to ('contacts', 'deals', or 'companies'). */
  objectType: 'contacts' | 'deals' | 'companies';
  objectId: string;
  body: string;
}
export interface CreateNoteOutput {
  noteId: string;
}

// ── Server interface ──────────────────────────────────────────────────

export interface HubspotMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  listContacts(input: ListContactsInput): Promise<McpResult<ListContactsOutput>>;
  getContact(input: GetContactInput): Promise<McpResult<GetContactOutput>>;
  updateContact(input: UpdateContactInput): Promise<McpResult<UpdateContactOutput>>;
  listDeals(input: ListDealsInput): Promise<McpResult<ListDealsOutput>>;
  getDeal(input: GetDealInput): Promise<McpResult<GetDealOutput>>;
  updateDeal(input: UpdateDealInput): Promise<McpResult<UpdateDealOutput>>;
  listCompanies(input: ListCompaniesInput): Promise<McpResult<ListCompaniesOutput>>;
  getCompany(input: GetCompanyInput): Promise<McpResult<GetCompanyOutput>>;
  createNote(input: CreateNoteInput): Promise<McpResult<CreateNoteOutput>>;
}
