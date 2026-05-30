/**
 * lib/integrations/follow-up-boss-mcp/index.ts
 *
 * Public surface for the Follow Up Boss MCP. Skills + cron sweeps
 * import from here only.
 */

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
  FubLeadSummary,
  FubPipelineSummary,
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
} from './types';
