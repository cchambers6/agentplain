/**
 * lib/integrations/sierra-mcp/index.ts
 *
 * Builder + barrel for the Sierra Interactive MCP. `buildSierraMcpServer`
 * returns the prod server, or the in-memory recording server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`). Skills + cron sweeps + the HTTP route import
 * from here only.
 */

import { ProdSierraMcpServer } from './server';
import { RecordingSierraMcpServer } from './test-server';
import type { SierraMcpServer } from './types';

export function buildSierraMcpServer(args: { workspaceId: string }): SierraMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new RecordingSierraMcpServer(args);
  }
  return new ProdSierraMcpServer(args);
}

export { SIERRA_TOOLS, SIERRA_NAMESPACE } from './tools';
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
