/**
 * lib/integrations/google-calendar-mcp/index.ts
 *
 * Factory for the workspace-scoped Google Calendar MCP server. Mirrors
 * `lib/integrations/gmail-mcp/index.ts`. Routes to the prod or the
 * deterministic test impl based on env or explicit flag.
 *
 * Per `feedback_runner_portability.md`: the per-call selector lives here.
 * No call site outside this file branches on impl name.
 */

import { ProdGoogleCalendarMcpServer } from './server';
import {
  TestGoogleCalendarMcpServer,
  type TestGoogleCalendarSeed,
} from './test-server';
import type { GoogleCalendarMcpServer } from './types';

export interface GoogleCalendarMcpFactoryArgs {
  workspaceId: string;
  /** Force the test impl regardless of env. */
  preferTestImpl?: boolean;
  /** Test seed (ignored by prod). */
  testSeed?: TestGoogleCalendarSeed;
}

export function buildGoogleCalendarMcpServer(
  args: GoogleCalendarMcpFactoryArgs,
): GoogleCalendarMcpServer {
  const useTest =
    args.preferTestImpl === true ||
    process.env.TEST_GOOGLE_CALENDAR_MCP === 'true' ||
    process.env.INTEGRATIONS_PROVIDER === 'test';
  if (useTest) {
    return new TestGoogleCalendarMcpServer({
      workspaceId: args.workspaceId,
      seed: args.testSeed,
    });
  }
  return new ProdGoogleCalendarMcpServer({ workspaceId: args.workspaceId });
}

export type {
  GoogleCalendarMcpServer,
  GoogleCalendarMcpResult,
  GoogleCalendarMcpError,
  GoogleCalendarMcpErrorCode,
  GoogleCalendarToolName,
  CalendarEventDto,
  ListEventsInput,
  ListEventsOutput,
  ResourceDescriptor,
  ReadResourceInput,
  ReadResourceOutput,
} from './types';
export {
  GOOGLE_CALENDAR_TOOL_NAMES,
  calendarError,
  calendarOk,
} from './types';
export {
  ProdGoogleCalendarMcpServer,
  parseGoogleEvent,
} from './server';
export {
  TestGoogleCalendarMcpServer,
  type TestGoogleCalendarSeed,
} from './test-server';
export { resolveCredential } from './auth';
