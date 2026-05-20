/**
 * lib/integrations/docusign-mcp/index.ts
 *
 * Builder + barrel for the DocuSign MCP server. `buildDocuSignMcpServer`
 * returns the prod server, or the fixture server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`).
 */

import { DOCUSIGN_NAMESPACE, type DocuSignMcpServer } from './types';
import { ProdDocuSignMcpServer } from './server';
import { TestDocuSignMcpServer } from './test-server';
import { DOCUSIGN_TOOLS } from './tools';

export function buildDocuSignMcpServer(args: { workspaceId: string }): DocuSignMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestDocuSignMcpServer(args);
  }
  return new ProdDocuSignMcpServer(args);
}

export { DOCUSIGN_TOOLS, DOCUSIGN_NAMESPACE };
export type { DocuSignMcpServer } from './types';
export { ProdDocuSignMcpServer } from './server';
export { TestDocuSignMcpServer } from './test-server';
