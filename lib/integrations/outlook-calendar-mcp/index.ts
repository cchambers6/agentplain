/**
 * lib/integrations/outlook-calendar-mcp/index.ts
 *
 * Factory for the workspace-scoped Outlook Calendar MCP server. Mirrors
 * `lib/integrations/outlook-mcp/index.ts`.
 */

import { ProdOutlookCalendarMcpServer } from './server';
import {
  TestOutlookCalendarMcpServer,
  type TestOutlookCalendarSeed,
} from './test-server';
import type { OutlookCalendarMcpServer } from './types';

export interface OutlookCalendarMcpFactoryArgs {
  workspaceId: string;
  preferTestImpl?: boolean;
  testSeed?: TestOutlookCalendarSeed;
  /** Optional `fetch` override (prod only). */
  fetchImpl?: typeof fetch;
}

export function buildOutlookCalendarMcpServer(
  args: OutlookCalendarMcpFactoryArgs,
): OutlookCalendarMcpServer {
  const useTest =
    args.preferTestImpl === true ||
    process.env.TEST_OUTLOOK_CALENDAR_MCP === 'true' ||
    process.env.INTEGRATIONS_PROVIDER === 'test';
  if (useTest) {
    return new TestOutlookCalendarMcpServer({
      workspaceId: args.workspaceId,
      seed: args.testSeed,
    });
  }
  return new ProdOutlookCalendarMcpServer({
    workspaceId: args.workspaceId,
    fetchImpl: args.fetchImpl,
  });
}

export type {
  OutlookCalendarMcpServer,
  OutlookCalendarMcpResult,
  OutlookCalendarMcpError,
  OutlookCalendarMcpErrorCode,
  OutlookCalendarToolName,
  CalendarEventDto,
  ListEventsInput,
  ListEventsOutput,
  ResourceDescriptor,
  ReadResourceInput,
  ReadResourceOutput,
} from './types';
export {
  OUTLOOK_CALENDAR_TOOL_NAMES,
  calendarError,
  calendarOk,
} from './types';
export {
  ProdOutlookCalendarMcpServer,
  parseGraphEvent,
} from './server';
export {
  TestOutlookCalendarMcpServer,
  type TestOutlookCalendarSeed,
} from './test-server';
export { resolveCredential } from './auth';
