/**
 * lib/integrations/follow-up-boss-mcp/index.ts
 *
 * Builder + barrel for the Follow Up Boss MCP. `buildFollowUpBossMcpServer`
 * returns the prod server, or the in-memory recording server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`). Skills + cron sweeps + the HTTP route import
 * from here only.
 */

import {
  buildConnectorApprovalDeps,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import { ProdFollowUpBossMcpServer } from './server';
import { RecordingFollowUpBossMcpServer } from './test-server';
import { withFollowUpBossApproval } from './with-approval';
import type { FollowUpBossMcpServer } from './types';

/**
 * Build the Follow Up Boss MCP server. Every mutating method is approval-gated
 * at this seam — an ungated server can't be obtained. Tests inject `deps`
 * carrying an in-memory gate + audit sink so they can seed grants
 * deterministically.
 */
export function buildFollowUpBossMcpServer(args: {
  workspaceId: string;
  deps?: ConnectorApprovalDeps;
}): FollowUpBossMcpServer {
  const deps = args.deps ?? buildConnectorApprovalDeps();
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return withFollowUpBossApproval(
      new RecordingFollowUpBossMcpServer(args),
      deps,
    );
  }
  return withFollowUpBossApproval(new ProdFollowUpBossMcpServer(args), deps);
}

export { FOLLOW_UP_BOSS_TOOLS, FOLLOW_UP_BOSS_NAMESPACE } from './tools';
export { ProdFollowUpBossMcpServer, FUB_API_BASE } from './server';
export { RecordingFollowUpBossMcpServer } from './test-server';
export { withFollowUpBossApproval } from './with-approval';
export {
  FOLLOW_UP_BOSS_CONNECTOR,
  CREATE_LEAD,
  SEND_TEXT_TEMPLATE,
  SCHEDULE_ACTION_PLAN,
  fubAction,
  type CreateLeadInput,
  type CreateLeadOutput,
  type SendTextTemplateInput,
  type SendTextTemplateOutput,
  type ScheduleActionPlanInput,
  type ScheduleActionPlanOutput,
  type WriteActionDescriptor,
} from './actions';
export { FubLeadFetcher } from './fub-lead-fetcher';
export { toLeadRecord } from './to-lead-record';
export {
  resolveFollowUpBossCredential,
  type ResolvedFollowUpBoss,
} from './auth';
export type {
  FollowUpBossMcpServer,
  FubLeadListSummary,
  FubLeadSummary,
  FubPipelineSummary,
  FubUserSummary,
  ListLeadsInput,
  ListLeadsOutput,
  GetLeadInput,
  GetLeadOutput,
  CreateNoteInput,
  CreateNoteOutput,
  AddTagInput,
  AddTagOutput,
  ListPipelinesInput,
  ListPipelinesOutput,
  GetPipelineStageInput,
  GetPipelineStageOutput,
  ListUsersInput,
  ListUsersOutput,
  ListLeadListsInput,
  ListLeadListsOutput,
} from './types';
