/**
 * lib/integrations/sierra-mcp/index.ts
 *
 * Public surface for the Sierra Interactive MCP. Skills + cron sweeps
 * import from here only.
 */

export { ProdSierraMcpServer, SIERRA_API_BASE } from './server';
export { RecordingSierraMcpServer } from './test-server';
export { SierraLeadFetcher } from './sierra-lead-fetcher';
export { toLeadRecord } from './to-lead-record';
export {
  resolveSierraCredential,
  type ResolvedSierra,
} from './auth';
export type {
  SierraMcpServer,
  SierraLeadSummary,
  SierraPipelineSummary,
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
