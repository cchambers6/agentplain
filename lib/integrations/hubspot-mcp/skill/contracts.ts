/**
 * lib/integrations/hubspot-mcp/skill/contracts.ts
 *
 * The RUNTIME contract for every HubSpot action — the zod half of the
 * Chiron-style skill discipline (`lib/integrations/skill-core.ts`).
 *
 * `../types.ts` describes the same 15 actions as TypeScript interfaces. Those
 * are compile-time only: they cannot stop an agent-authored argument object or
 * a HubSpot JSON body from being wrong at runtime, which is precisely where
 * connector bugs live. This file states the same shapes as schemas that
 * actually run, with the constraints the interfaces could not express (ids are
 * non-empty, `limit` is 1..100, timestamps are ISO, enums are closed).
 *
 * Nothing here calls HubSpot, and nothing here replaces the legacy interfaces —
 * this is additive for the migration window. The `_drift` type aliases at the
 * bottom of each section assert the zod-inferred type and the legacy interface
 * are mutually assignable, so the two contracts cannot silently diverge while
 * both exist: if someone edits `../types.ts` without editing this file (or vice
 * versa), typecheck fails.
 *
 * Objects parse in zod's default (strip) mode, so unknown keys are dropped
 * before the server sees them — a caller cannot smuggle an unvetted field
 * through the skill into a HubSpot request body.
 */

import { z } from 'zod';
import type {
  CreateNoteInput,
  CreateNoteOutput,
  GetCompanyInput,
  GetCompanyOutput,
  GetContactInput,
  GetContactOutput,
  GetDealInput,
  GetDealOutput,
  HubspotCompanySummary,
  HubspotContactSummary,
  HubspotDealSummary,
  ListCompaniesInput,
  ListCompaniesOutput,
  ListContactsInput,
  ListContactsOutput,
  ListDealsInput,
  ListDealsOutput,
  UpdateContactInput,
  UpdateContactOutput,
  UpdateDealInput,
  UpdateDealOutput,
} from '../types';
import type {
  CreateDealInput,
  CreateDealOutput,
  CreateTaskInput,
  CreateTaskOutput,
  LogActivityInput,
  LogActivityOutput,
  SendEmailTemplateInput,
  SendEmailTemplateOutput,
  SendSequenceEnrollmentInput,
  SendSequenceEnrollmentOutput,
  UpdateDealStageInput,
  UpdateDealStageOutput,
} from '../actions';

// ── Drift guards ────────────────────────────────────────────────────────────
// One mutual-assignability check per action. Cheap, compile-time only, and the
// only thing standing between the runtime contract and the legacy interface
// during the migration window.

type Assignable<From, To> = [From] extends [To] ? true : false;
type Mutual<A, B> =
  Assignable<A, B> extends true ? (Assignable<B, A> extends true ? true : false) : false;
type Expect<T extends true> = T;

// ── Shared primitives ───────────────────────────────────────────────────────

/** HubSpot object ids are opaque strings — non-empty is the real constraint. */
const id = z.string().min(1);
/** Matches the tool registry: 1..100, default 25 applied by the server. */
const limit = z.number().int().min(1).max(100).optional();
/** Approval token; only meaningful on mutating actions. */
const pendingApprovalId = z.string().min(1).optional();
/** ISO 8601 instant (UTC or explicit offset). */
const isoTimestamp = z.iso.datetime({ offset: true });
/** HubSpot date properties accept a calendar date or a full instant. */
const isoDateOrTimestamp = z.union([z.iso.date(), isoTimestamp]);

const objectTypeEnum = z.enum(['contacts', 'deals', 'companies']);
const activityTypeEnum = z.enum(['NOTE', 'CALL', 'EMAIL', 'MEETING']);

// ── DTO schemas ─────────────────────────────────────────────────────────────
// Field-for-field with `../types.ts`. Timestamps stay plain nullable strings
// here (not `isoTimestamp`): these are HubSpot's values on the way OUT, and the
// legacy interface promises only `string | null`. Format strictness belongs on
// the input side, where we control what is sent.

export const hubspotContactSummarySchema = z.object({
  id,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  lifecycleStage: z.string().nullable(),
  leadSource: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const hubspotDealSummarySchema = z.object({
  id,
  name: z.string().nullable(),
  amount: z.number().nullable(),
  pipeline: z.string().nullable(),
  dealStage: z.string().nullable(),
  closeDate: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const hubspotCompanySummarySchema = z.object({
  id,
  name: z.string().nullable(),
  domain: z.string().nullable(),
  industry: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

type _ContactDrift = Expect<Mutual<z.infer<typeof hubspotContactSummarySchema>, HubspotContactSummary>>;
type _DealDrift = Expect<Mutual<z.infer<typeof hubspotDealSummarySchema>, HubspotDealSummary>>;
type _CompanyDrift = Expect<Mutual<z.infer<typeof hubspotCompanySummarySchema>, HubspotCompanySummary>>;

// ── Reads ───────────────────────────────────────────────────────────────────

export const listContactsInputSchema = z.object({
  limit,
  modifiedSince: isoTimestamp.optional(),
});
export const listContactsOutputSchema = z.object({
  contacts: z.array(hubspotContactSummarySchema),
});
type _ListContactsIn = Expect<Mutual<z.infer<typeof listContactsInputSchema>, ListContactsInput>>;
type _ListContactsOut = Expect<Mutual<z.infer<typeof listContactsOutputSchema>, ListContactsOutput>>;

export const getContactInputSchema = z.object({ contactId: id });
export const getContactOutputSchema = z.object({ contact: hubspotContactSummarySchema });
type _GetContactIn = Expect<Mutual<z.infer<typeof getContactInputSchema>, GetContactInput>>;
type _GetContactOut = Expect<Mutual<z.infer<typeof getContactOutputSchema>, GetContactOutput>>;

export const listDealsInputSchema = z.object({
  limit,
  pipeline: z.string().min(1).optional(),
});
export const listDealsOutputSchema = z.object({ deals: z.array(hubspotDealSummarySchema) });
type _ListDealsIn = Expect<Mutual<z.infer<typeof listDealsInputSchema>, ListDealsInput>>;
type _ListDealsOut = Expect<Mutual<z.infer<typeof listDealsOutputSchema>, ListDealsOutput>>;

export const getDealInputSchema = z.object({ dealId: id });
export const getDealOutputSchema = z.object({ deal: hubspotDealSummarySchema });
type _GetDealIn = Expect<Mutual<z.infer<typeof getDealInputSchema>, GetDealInput>>;
type _GetDealOut = Expect<Mutual<z.infer<typeof getDealOutputSchema>, GetDealOutput>>;

export const listCompaniesInputSchema = z.object({ limit });
export const listCompaniesOutputSchema = z.object({
  companies: z.array(hubspotCompanySummarySchema),
});
type _ListCompaniesIn = Expect<Mutual<z.infer<typeof listCompaniesInputSchema>, ListCompaniesInput>>;
type _ListCompaniesOut = Expect<
  Mutual<z.infer<typeof listCompaniesOutputSchema>, ListCompaniesOutput>
>;

export const getCompanyInputSchema = z.object({ companyId: id });
export const getCompanyOutputSchema = z.object({ company: hubspotCompanySummarySchema });
type _GetCompanyIn = Expect<Mutual<z.infer<typeof getCompanyInputSchema>, GetCompanyInput>>;
type _GetCompanyOut = Expect<Mutual<z.infer<typeof getCompanyOutputSchema>, GetCompanyOutput>>;

// ── Internal-annotation writes (approval-gated) ─────────────────────────────

export const updateContactInputSchema = z.object({
  contactId: id,
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
  pendingApprovalId,
});
export const updateContactOutputSchema = z.object({ contactId: id });
type _UpdateContactIn = Expect<Mutual<z.infer<typeof updateContactInputSchema>, UpdateContactInput>>;
type _UpdateContactOut = Expect<
  Mutual<z.infer<typeof updateContactOutputSchema>, UpdateContactOutput>
>;

export const updateDealInputSchema = z.object({
  dealId: id,
  properties: z
    .object({
      dealname: z.string(),
      amount: z.string(),
      dealstage: z.string(),
      closedate: z.string(),
      pipeline: z.string(),
    })
    .partial(),
  pendingApprovalId,
});
export const updateDealOutputSchema = z.object({ dealId: id });
type _UpdateDealIn = Expect<Mutual<z.infer<typeof updateDealInputSchema>, UpdateDealInput>>;
type _UpdateDealOut = Expect<Mutual<z.infer<typeof updateDealOutputSchema>, UpdateDealOutput>>;

export const createNoteInputSchema = z.object({
  objectType: objectTypeEnum,
  objectId: id,
  body: z.string().min(1),
  pendingApprovalId,
});
export const createNoteOutputSchema = z.object({ noteId: id });
type _CreateNoteIn = Expect<Mutual<z.infer<typeof createNoteInputSchema>, CreateNoteInput>>;
type _CreateNoteOut = Expect<Mutual<z.infer<typeof createNoteOutputSchema>, CreateNoteOutput>>;

// ── Write-action-depth mutations (approval-gated) ───────────────────────────

export const createDealInputSchema = z.object({
  dealName: z.string().min(1),
  amount: z.string().min(1).optional(),
  pipeline: z.string().min(1).optional(),
  dealStage: z.string().min(1).optional(),
  closeDate: isoDateOrTimestamp.optional(),
  associatedContactId: z.string().min(1).optional(),
  pendingApprovalId,
});
export const createDealOutputSchema = z.object({ dealId: id });
type _CreateDealIn = Expect<Mutual<z.infer<typeof createDealInputSchema>, CreateDealInput>>;
type _CreateDealOut = Expect<Mutual<z.infer<typeof createDealOutputSchema>, CreateDealOutput>>;

export const updateDealStageInputSchema = z.object({
  dealId: id,
  dealStage: z.string().min(1),
  pipeline: z.string().min(1).optional(),
  pendingApprovalId,
});
export const updateDealStageOutputSchema = z.object({
  dealId: id,
  dealStage: z.string().min(1),
});
type _UpdateDealStageIn = Expect<
  Mutual<z.infer<typeof updateDealStageInputSchema>, UpdateDealStageInput>
>;
type _UpdateDealStageOut = Expect<
  Mutual<z.infer<typeof updateDealStageOutputSchema>, UpdateDealStageOutput>
>;

export const logActivityInputSchema = z.object({
  objectType: objectTypeEnum,
  objectId: id,
  activityType: activityTypeEnum,
  body: z.string().min(1),
  timestamp: isoTimestamp.optional(),
  pendingApprovalId,
});
export const logActivityOutputSchema = z.object({
  activityId: id,
  activityType: activityTypeEnum,
});
type _LogActivityIn = Expect<Mutual<z.infer<typeof logActivityInputSchema>, LogActivityInput>>;
type _LogActivityOut = Expect<Mutual<z.infer<typeof logActivityOutputSchema>, LogActivityOutput>>;

export const createTaskInputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1).optional(),
  dueDate: isoDateOrTimestamp.optional(),
  ownerId: z.string().min(1).optional(),
  associatedObjectType: objectTypeEnum.optional(),
  associatedObjectId: z.string().min(1).optional(),
  pendingApprovalId,
});
export const createTaskOutputSchema = z.object({ taskId: id });
type _CreateTaskIn = Expect<Mutual<z.infer<typeof createTaskInputSchema>, CreateTaskInput>>;
type _CreateTaskOut = Expect<Mutual<z.infer<typeof createTaskOutputSchema>, CreateTaskOutput>>;

export const sendEmailTemplateInputSchema = z.object({
  contactId: id,
  recipientEmail: z.string().min(1),
  emailId: z.string().min(1),
  customProperties: z.record(z.string(), z.string()).optional(),
  pendingApprovalId,
});
export const sendEmailTemplateOutputSchema = z.object({ statusId: id });
type _SendEmailIn = Expect<
  Mutual<z.infer<typeof sendEmailTemplateInputSchema>, SendEmailTemplateInput>
>;
type _SendEmailOut = Expect<
  Mutual<z.infer<typeof sendEmailTemplateOutputSchema>, SendEmailTemplateOutput>
>;

export const sendSequenceEnrollmentInputSchema = z.object({
  contactId: id,
  sequenceId: id,
  senderEmail: z.string().min(1),
  pendingApprovalId,
});
export const sendSequenceEnrollmentOutputSchema = z.object({ enrollmentId: id });
type _SendSequenceIn = Expect<
  Mutual<z.infer<typeof sendSequenceEnrollmentInputSchema>, SendSequenceEnrollmentInput>
>;
type _SendSequenceOut = Expect<
  Mutual<z.infer<typeof sendSequenceEnrollmentOutputSchema>, SendSequenceEnrollmentOutput>
>;

// ── The skill-facing envelope ───────────────────────────────────────────────
// Action names are the snake_case strings the approval gate and the tool
// registry already use (`actions/index.ts`, `with-approval.ts`), so an
// approval card, an audit row, and a skill call all name the action the same
// way.

export const hubspotSkillInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list_contacts'), params: listContactsInputSchema }),
  z.object({ action: z.literal('get_contact'), params: getContactInputSchema }),
  z.object({ action: z.literal('update_contact'), params: updateContactInputSchema }),
  z.object({ action: z.literal('list_deals'), params: listDealsInputSchema }),
  z.object({ action: z.literal('get_deal'), params: getDealInputSchema }),
  z.object({ action: z.literal('update_deal'), params: updateDealInputSchema }),
  z.object({ action: z.literal('list_companies'), params: listCompaniesInputSchema }),
  z.object({ action: z.literal('get_company'), params: getCompanyInputSchema }),
  z.object({ action: z.literal('create_note'), params: createNoteInputSchema }),
  z.object({ action: z.literal('create_deal'), params: createDealInputSchema }),
  z.object({ action: z.literal('update_deal_stage'), params: updateDealStageInputSchema }),
  z.object({ action: z.literal('log_activity'), params: logActivityInputSchema }),
  z.object({ action: z.literal('create_task'), params: createTaskInputSchema }),
  z.object({ action: z.literal('send_email_template'), params: sendEmailTemplateInputSchema }),
  z.object({
    action: z.literal('send_sequence_enrollment'),
    params: sendSequenceEnrollmentInputSchema,
  }),
]);

export const hubspotSkillOutputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list_contacts'), result: listContactsOutputSchema }),
  z.object({ action: z.literal('get_contact'), result: getContactOutputSchema }),
  z.object({ action: z.literal('update_contact'), result: updateContactOutputSchema }),
  z.object({ action: z.literal('list_deals'), result: listDealsOutputSchema }),
  z.object({ action: z.literal('get_deal'), result: getDealOutputSchema }),
  z.object({ action: z.literal('update_deal'), result: updateDealOutputSchema }),
  z.object({ action: z.literal('list_companies'), result: listCompaniesOutputSchema }),
  z.object({ action: z.literal('get_company'), result: getCompanyOutputSchema }),
  z.object({ action: z.literal('create_note'), result: createNoteOutputSchema }),
  z.object({ action: z.literal('create_deal'), result: createDealOutputSchema }),
  z.object({ action: z.literal('update_deal_stage'), result: updateDealStageOutputSchema }),
  z.object({ action: z.literal('log_activity'), result: logActivityOutputSchema }),
  z.object({ action: z.literal('create_task'), result: createTaskOutputSchema }),
  z.object({ action: z.literal('send_email_template'), result: sendEmailTemplateOutputSchema }),
  z.object({
    action: z.literal('send_sequence_enrollment'),
    result: sendSequenceEnrollmentOutputSchema,
  }),
]);

export type HubspotSkillInput = z.infer<typeof hubspotSkillInputSchema>;
export type HubspotSkillOutput = z.infer<typeof hubspotSkillOutputSchema>;
/** The 15 action names, as a type. */
export type HubspotSkillAction = HubspotSkillInput['action'];

/** Every action the skill dispatches — the runtime companion to the type. */
export const HUBSPOT_SKILL_ACTIONS = [
  'list_contacts',
  'get_contact',
  'update_contact',
  'list_deals',
  'get_deal',
  'update_deal',
  'list_companies',
  'get_company',
  'create_note',
  'create_deal',
  'update_deal_stage',
  'log_activity',
  'create_task',
  'send_email_template',
  'send_sequence_enrollment',
] as const satisfies ReadonlyArray<HubspotSkillAction>;
