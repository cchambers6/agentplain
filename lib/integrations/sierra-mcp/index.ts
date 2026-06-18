/**
 * lib/integrations/sierra-mcp/index.ts
 *
 * Builder + barrel for the Sierra Interactive MCP. `buildSierraMcpServer`
 * returns the prod server, or the in-memory recording server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`). Skills + cron sweeps + the HTTP route import
 * from here only.
 */

import {
  buildConnectorApprovalDeps,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import { ProdSierraMcpServer } from './server';
import { RecordingSierraMcpServer } from './test-server';
import { withSierraApproval } from './with-approval';
import type { SierraMcpServer } from './types';

/**
 * Build the Sierra MCP server. Every mutating method is approval-gated at this
 * seam — an ungated server can't be obtained. Tests inject `deps` carrying an
 * in-memory gate + audit sink so they can seed grants deterministically.
 */
export function buildSierraMcpServer(args: {
  workspaceId: string;
  deps?: ConnectorApprovalDeps;
}): SierraMcpServer {
  const deps = args.deps ?? buildConnectorApprovalDeps();
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return withSierraApproval(new RecordingSierraMcpServer(args), deps);
  }
  return withSierraApproval(new ProdSierraMcpServer(args), deps);
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
export {
  SIERRA_CONNECTOR,
  CREATE_CONTACT,
  SEND_DRIP,
  UPDATE_STATUS,
  sierraAction,
  type CreateContactInput,
  type CreateContactOutput,
  type SendDripInput,
  type SendDripOutput,
  type UpdateStatusInput,
  type UpdateStatusOutput,
  type WriteActionDescriptor,
} from './actions';
export { withSierraApproval } from './with-approval';
