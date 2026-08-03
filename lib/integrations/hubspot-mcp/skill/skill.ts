/**
 * lib/integrations/hubspot-mcp/skill/skill.ts
 *
 * The HubSpot connector as a Chiron-discipline SKILL — one entry point that
 * parses its input, dispatches to exactly one server method, and parses the
 * response before returning it. `lib/integrations/skill-core.ts` holds the
 * rule: nothing crosses the boundary until it parses.
 *
 * What that buys over calling the server directly:
 *   - an agent-authored argument object that is wrong (empty id, limit of 500,
 *     a garbage timestamp, an action that does not exist) is refused HERE, and
 *     HubSpot is never called;
 *   - a HubSpot response that does not match the declared shape is refused too,
 *     so a malformed value can never reach a caller that believes the type;
 *   - the caller gets one result union with four codes instead of fifteen
 *     method signatures.
 *
 * Per `project_no_outbound_architecture.md`: this file adds no write path of
 * its own. Reads pass straight through; every mutation goes to the server
 * built by `buildHubspotMcpServer`, which installs the approval gate at the
 * factory seam — so an ungated server is not constructible through the skill,
 * and `send_email_template` / `send_sequence_enrollment` (the genuinely
 * outbound pair) cannot fire without a recorded human approval. The gate's
 * refusal survives as its own `APPROVAL_REQUIRED` code rather than being
 * flattened into a generic upstream failure.
 */

import type { ZodType } from 'zod';
import type { McpResult } from '@/lib/integrations/mcp-core';
import {
  connectorSkillError,
  connectorSkillOk,
  fromMcpError,
  parseContract,
  type ConnectorSkillResult,
} from '@/lib/integrations/skill-core';
import type { HubspotMcpServer } from '../types';
import {
  createDealOutputSchema,
  createNoteOutputSchema,
  createTaskOutputSchema,
  getCompanyOutputSchema,
  getContactOutputSchema,
  getDealOutputSchema,
  hubspotSkillInputSchema,
  listCompaniesOutputSchema,
  listContactsOutputSchema,
  listDealsOutputSchema,
  logActivityOutputSchema,
  sendEmailTemplateOutputSchema,
  sendSequenceEnrollmentOutputSchema,
  updateContactOutputSchema,
  updateDealOutputSchema,
  updateDealStageOutputSchema,
  type HubspotSkillAction,
  type HubspotSkillOutput,
} from './contracts';

export const HUBSPOT_SKILL_NAME = 'hubspot-connector';

export interface HubspotSkillDeps {
  /** An approval-gated HubSpot server (always the factory's output). */
  server: HubspotMcpServer;
}

/**
 * Run one HubSpot action end to end.
 *
 * `input` is `unknown` on purpose: the whole point is that it has not been
 * validated yet. It is parsed against `hubspotSkillInputSchema` before the
 * server is touched, and the server's answer is parsed against that action's
 * output schema before it is returned.
 */
export async function runHubspotSkill(
  input: unknown,
  deps: HubspotSkillDeps,
): Promise<ConnectorSkillResult<HubspotSkillOutput>> {
  const parsed = parseContract(hubspotSkillInputSchema, input, 'input');
  if (!parsed.ok) return parsed;

  const command = parsed.value;
  const server = deps.server;

  switch (command.action) {
    // ── Reads ──────────────────────────────────────────────────────────────
    case 'list_contacts':
      return settle('list_contacts', await server.listContacts(command.params), listContactsOutputSchema);
    case 'get_contact':
      return settle('get_contact', await server.getContact(command.params), getContactOutputSchema);
    case 'list_deals':
      return settle('list_deals', await server.listDeals(command.params), listDealsOutputSchema);
    case 'get_deal':
      return settle('get_deal', await server.getDeal(command.params), getDealOutputSchema);
    case 'list_companies':
      return settle(
        'list_companies',
        await server.listCompanies(command.params),
        listCompaniesOutputSchema,
      );
    case 'get_company':
      return settle('get_company', await server.getCompany(command.params), getCompanyOutputSchema);

    // ── Internal-annotation writes (gated) ─────────────────────────────────
    case 'update_contact':
      return settle(
        'update_contact',
        await server.updateContact(command.params),
        updateContactOutputSchema,
      );
    case 'update_deal':
      return settle('update_deal', await server.updateDeal(command.params), updateDealOutputSchema);
    case 'create_note':
      return settle('create_note', await server.createNote(command.params), createNoteOutputSchema);

    // ── Write-action-depth mutations (gated) ───────────────────────────────
    case 'create_deal':
      return settle('create_deal', await server.createDeal(command.params), createDealOutputSchema);
    case 'update_deal_stage':
      return settle(
        'update_deal_stage',
        await server.updateDealStage(command.params),
        updateDealStageOutputSchema,
      );
    case 'log_activity':
      return settle('log_activity', await server.logActivity(command.params), logActivityOutputSchema);
    case 'create_task':
      return settle('create_task', await server.createTask(command.params), createTaskOutputSchema);
    case 'send_email_template':
      return settle(
        'send_email_template',
        await server.sendEmailTemplate(command.params),
        sendEmailTemplateOutputSchema,
      );
    case 'send_sequence_enrollment':
      return settle(
        'send_sequence_enrollment',
        await server.sendSequenceEnrollment(command.params),
        sendSequenceEnrollmentOutputSchema,
      );

    default: {
      // Exhaustiveness: adding an action to the envelope without a case here
      // fails typecheck rather than silently falling through at runtime.
      const unreachable: never = command;
      return connectorSkillError(
        'INVALID_INPUT',
        `Unhandled HubSpot action: ${String((unreachable as { action?: unknown }).action)}`,
      );
    }
  }
}

/**
 * Turn one server call into a skill result: upstream failures map through
 * `fromMcpError` (APPROVAL_REQUIRED preserved), successes must satisfy the
 * action's output contract before they are handed back.
 */
function settle<A extends HubspotSkillAction, T>(
  action: A,
  result: McpResult<unknown>,
  schema: ZodType<T>,
): ConnectorSkillResult<{ action: A; result: T }> {
  if (!result.ok) return { ok: false, error: fromMcpError(result.error) };
  const parsed = parseContract(schema, result.value, 'output');
  if (!parsed.ok) return parsed;
  return connectorSkillOk({ action, result: parsed.value });
}

/** A named skill handle, matching the `ISkill` shape used in `lib/skills`. */
export interface HubspotSkill {
  readonly name: typeof HUBSPOT_SKILL_NAME;
  run(input: unknown): Promise<ConnectorSkillResult<HubspotSkillOutput>>;
}

// `buildHubspotSkill` lives in `../index` next to `buildHubspotMcpServer`: the
// helper that closes over the factory belongs beside the factory, and keeping it
// out of this file keeps `skill/` free of an import cycle through the barrel —
// load-bearing for the template, since a copied cycle breaks the moment a
// converted connector's factory is not a hoisted function declaration.
