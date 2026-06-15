/**
 * lib/integrations/follow-up-boss-mcp/index.ts
 *
 * Builder + barrel for the Follow Up Boss MCP. `buildFollowUpBossMcpServer`
 * returns the prod server, or the in-memory recording server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`). Skills + cron sweeps + the HTTP route import
 * from here only.
 */

import { ProdFollowUpBossMcpServer } from './server';
import { RecordingFollowUpBossMcpServer } from './test-server';
import type { FollowUpBossMcpServer } from './types';

export function buildFollowUpBossMcpServer(args: { workspaceId: string }): FollowUpBossMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new RecordingFollowUpBossMcpServer(args);
  }
  return new ProdFollowUpBossMcpServer(args);
}

export { FOLLOW_UP_BOSS_TOOLS, FOLLOW_UP_BOSS_NAMESPACE } from './tools';
export { ProdFollowUpBossMcpServer, FUB_API_BASE } from './server';
export { RecordingFollowUpBossMcpServer } from './test-server';
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
