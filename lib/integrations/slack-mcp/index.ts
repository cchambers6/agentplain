/**
 * lib/integrations/slack-mcp/index.ts
 *
 * Builder + barrel for the Slack MCP server. `buildSlackMcpServer` returns the
 * prod server, or the fixture server when `INTEGRATIONS_PROVIDER=test` (parity
 * with the registry switch in `lib/integrations/index.ts`).
 */

import { SLACK_NAMESPACE, type SlackMcpServer } from './types';
import { ProdSlackMcpServer } from './server';
import { TestSlackMcpServer } from './test-server';
import { SLACK_TOOLS } from './tools';

export function buildSlackMcpServer(args: { workspaceId: string }): SlackMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestSlackMcpServer(args);
  }
  return new ProdSlackMcpServer(args);
}

export { SLACK_TOOLS, SLACK_NAMESPACE };
export type { SlackMcpServer } from './types';
export { ProdSlackMcpServer } from './server';
export { TestSlackMcpServer } from './test-server';
