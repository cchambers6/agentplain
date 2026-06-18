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

import {
  buildConnectorApprovalDeps,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import { ProdGoogleCalendarMcpServer } from './server';
import {
  TestGoogleCalendarMcpServer,
  type TestGoogleCalendarSeed,
} from './test-server';
import { withGoogleCalendarApproval } from './with-approval';
import type { GoogleCalendarMcpServer } from './types';

export interface GoogleCalendarMcpFactoryArgs {
  workspaceId: string;
  /** Force the test impl regardless of env. */
  preferTestImpl?: boolean;
  /** Test seed (ignored by prod). */
  testSeed?: TestGoogleCalendarSeed;
  /**
   * Approval gate + audit sink. Defaults to `buildConnectorApprovalDeps()`
   * (in-memory under `INTEGRATIONS_PROVIDER=test`, Prisma otherwise). Tests
   * inject an in-memory gate so they can seed grants deterministically.
   */
  deps?: ConnectorApprovalDeps;
}

/**
 * Build the Google Calendar MCP server. The mutating methods (`bookMeeting`,
 * `rescheduleMeeting`) are approval-gated at this seam — an ungated server
 * can't be obtained. Reads (`listEvents`, `findAvailability`) pass through.
 */
export function buildGoogleCalendarMcpServer(
  args: GoogleCalendarMcpFactoryArgs,
): GoogleCalendarMcpServer {
  const deps = args.deps ?? buildConnectorApprovalDeps();
  const useTest =
    args.preferTestImpl === true ||
    process.env.TEST_GOOGLE_CALENDAR_MCP === 'true' ||
    process.env.INTEGRATIONS_PROVIDER === 'test';
  if (useTest) {
    return withGoogleCalendarApproval(
      new TestGoogleCalendarMcpServer({
        workspaceId: args.workspaceId,
        seed: args.testSeed,
      }),
      deps,
    );
  }
  return withGoogleCalendarApproval(
    new ProdGoogleCalendarMcpServer({ workspaceId: args.workspaceId }),
    deps,
  );
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
export { withGoogleCalendarApproval } from './with-approval';
export {
  GOOGLE_CALENDAR_CONNECTOR,
  BOOK_MEETING,
  RESCHEDULE_MEETING,
  calendarAction,
  type WriteActionDescriptor,
  type BookMeetingInput,
  type BookMeetingOutput,
  type RescheduleMeetingInput,
  type RescheduleMeetingOutput,
  type FindAvailabilityInput,
  type FindAvailabilityOutput,
} from './actions';
