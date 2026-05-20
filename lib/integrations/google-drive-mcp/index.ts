/**
 * lib/integrations/google-drive-mcp/index.ts
 *
 * Builder + barrel for the Google Drive MCP server. `buildDriveMcpServer`
 * returns the prod server, or the fixture server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`).
 */

import { DRIVE_NAMESPACE, type DriveMcpServer } from './types';
import { ProdDriveMcpServer } from './server';
import { TestDriveMcpServer } from './test-server';
import { DRIVE_TOOLS } from './tools';

export function buildDriveMcpServer(args: { workspaceId: string }): DriveMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestDriveMcpServer(args);
  }
  return new ProdDriveMcpServer(args);
}

export { DRIVE_TOOLS, DRIVE_NAMESPACE };
export type { DriveMcpServer } from './types';
export { ProdDriveMcpServer } from './server';
export { TestDriveMcpServer } from './test-server';
