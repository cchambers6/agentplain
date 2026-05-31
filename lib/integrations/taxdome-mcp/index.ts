/**
 * lib/integrations/taxdome-mcp/index.ts
 *
 * Builder + barrel for the TaxDome MCP server. `buildTaxdomeMcpServer`
 * returns the prod server, or the fixture server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`).
 */

import { TAXDOME_NAMESPACE, type TaxdomeMcpServer } from './types';
import { ProdTaxdomeMcpServer } from './server';
import { TestTaxdomeMcpServer } from './test-server';
import { TAXDOME_TOOLS } from './tools';

export function buildTaxdomeMcpServer(args: { workspaceId: string }): TaxdomeMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestTaxdomeMcpServer(args);
  }
  return new ProdTaxdomeMcpServer(args);
}

export { TAXDOME_TOOLS, TAXDOME_NAMESPACE };
export type {
  GetClientInput,
  GetClientOutput,
  GetTaxDocumentInput,
  GetTaxDocumentOutput,
  ListClientsInput,
  ListClientsOutput,
  ListEngagementLettersInput,
  ListEngagementLettersOutput,
  ListReceivedDocumentsInput,
  ListReceivedDocumentsOutput,
  ListTaxDocumentsInput,
  ListTaxDocumentsOutput,
  TaxdomeClientSummary,
  TaxdomeDocumentSummary,
  TaxdomeMcpServer,
} from './types';
export { ProdTaxdomeMcpServer } from './server';
export { TestTaxdomeMcpServer } from './test-server';
