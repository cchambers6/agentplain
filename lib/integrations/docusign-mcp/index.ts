/**
 * lib/integrations/docusign-mcp/index.ts
 *
 * Builder + barrel for the DocuSign MCP server. `buildDocuSignMcpServer`
 * returns the prod server, or the fixture server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`).
 *
 * Both servers are wrapped in the approval gate before they leave this
 * factory — it is impossible to obtain an ungated DocuSign server. `send` and
 * `void` therefore always pass through `withDocuSignApproval`, honoring the
 * no-outbound architecture (agents draft; an operator approves; only then does
 * the customer's DocuSign account execute). See `with-approval.ts`.
 */

import { DOCUSIGN_NAMESPACE, type DocuSignMcpServer } from './types';
import { ProdDocuSignMcpServer } from './server';
import { TestDocuSignMcpServer } from './test-server';
import { DOCUSIGN_TOOLS } from './tools';
import { withDocuSignApproval, type DocuSignApprovalGate } from './with-approval';
import { InMemoryDocuSignApprovalGate } from './approval-gate-memory';
import { PrismaDocuSignApprovalGate } from './approval-gate-prisma';

export function buildDocuSignMcpServer(args: {
  workspaceId: string;
  /** Override the approval gate (smoke tests inject an in-memory gate). */
  gate?: DocuSignApprovalGate;
}): DocuSignMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    const inner = new TestDocuSignMcpServer(args);
    return withDocuSignApproval(inner, args.gate ?? new InMemoryDocuSignApprovalGate());
  }
  const inner = new ProdDocuSignMcpServer(args);
  return withDocuSignApproval(inner, args.gate ?? new PrismaDocuSignApprovalGate());
}

export { DOCUSIGN_TOOLS, DOCUSIGN_NAMESPACE };
export type { DocuSignMcpServer } from './types';
export { ProdDocuSignMcpServer } from './server';
export { TestDocuSignMcpServer } from './test-server';
export {
  withDocuSignApproval,
  fingerprintAction,
  type DocuSignApprovalGate,
  type DocuSignApprovalGrant,
  type DocuSignGatedAction,
} from './with-approval';
export { InMemoryDocuSignApprovalGate } from './approval-gate-memory';
export {
  PrismaDocuSignApprovalGate,
  DOCUSIGN_APPROVAL_TTL_MS,
} from './approval-gate-prisma';
