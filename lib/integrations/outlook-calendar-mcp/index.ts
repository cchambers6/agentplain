/**
 * lib/integrations/outlook-calendar-mcp/index.ts
 *
 * Factory for the workspace-scoped Outlook Calendar MCP server. Mirrors
 * `lib/integrations/google-calendar-mcp/index.ts`. Routes to the prod or the
 * deterministic test impl based on env or explicit flag.
 *
 * Per `feedback_runner_portability.md`: the per-call selector lives here.
 * No call site outside this file branches on impl name.
 */

import {
  buildConnectorApprovalDeps,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import { ProdOutlookCalendarMcpServer } from './server';
import {
  TestOutlookCalendarMcpServer,
  type TestOutlookCalendarSeed,
} from './test-server';
import { withOutlookCalendarApproval } from './with-approval';
import type { OutlookCalendarMcpServer } from './types';

export interface OutlookCalendarMcpFactoryArgs {
  workspaceId: string;
  /** Force the test impl regardless of env. */
  preferTestImpl?: boolean;
  /** Test seed (ignored by prod). */
  testSeed?: TestOutlookCalendarSeed;
  /** Optional `fetch` override (prod only). */
  fetchImpl?: typeof fetch;
  /**
   * Approval gate + audit sink. Defaults to `buildConnectorApprovalDeps()`
   * (in-memory under `INTEGRATIONS_PROVIDER=test`, Prisma otherwise). Tests
   * inject an in-memory gate so they can seed grants deterministically.
   */
  deps?: ConnectorApprovalDeps;
}

/**
 * Build the Outlook Calendar MCP server. The mutating methods (`bookMeeting`,
 * `rescheduleMeeting`, `updateEvent`, `cancelEvent`) are approval-gated at
 * this seam — an ungated server can't be obtained. Reads pass through.
 */
export function buildOutlookCalendarMcpServer(
  args: OutlookCalendarMcpFactoryArgs,
): OutlookCalendarMcpServer {
  const deps = args.deps ?? buildConnectorApprovalDeps();
  const useTest =
    args.preferTestImpl === true ||
    process.env.TEST_OUTLOOK_CALENDAR_MCP === 'true' ||
    process.env.INTEGRATIONS_PROVIDER === 'test';
  if (useTest) {
    return withOutlookCalendarApproval(
      new TestOutlookCalendarMcpServer({
        workspaceId: args.workspaceId,
        seed: args.testSeed,
      }),
      deps,
    );
  }
  return withOutlookCalendarApproval(
    new ProdOutlookCalendarMcpServer({
      workspaceId: args.workspaceId,
      fetchImpl: args.fetchImpl,
    }),
    deps,
  );
}

export type {
  OutlookCalendarMcpServer,
  OutlookCalendarMcpResult,
  OutlookCalendarMcpError,
  OutlookCalendarMcpErrorCode,
  OutlookCalendarToolName,
  CalendarDescriptor,
  CalendarEventDto,
  CalendarEventDetailDto,
  GetEventInput,
  GetEventOutput,
  ListCalendarsOutput,
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
  parseGraphEventDetail,
} from './server';
export {
  TestOutlookCalendarMcpServer,
  type TestOutlookCalendarSeed,
  type RecordedCalendarWrite,
} from './test-server';
export { resolveCredential } from './auth';
export { withOutlookCalendarApproval } from './with-approval';
export {
  OUTLOOK_CALENDAR_CONNECTOR,
  BOOK_MEETING,
  RESCHEDULE_MEETING,
  UPDATE_EVENT,
  CANCEL_EVENT,
  calendarAction,
  type WriteActionDescriptor,
  type BookMeetingInput,
  type BookMeetingOutput,
  type RescheduleMeetingInput,
  type RescheduleMeetingOutput,
  type UpdateEventInput,
  type UpdateEventOutput,
  type CancelEventInput,
  type CancelEventOutput,
  type FindAvailabilityInput,
  type FindAvailabilityOutput,
  type ProposeTimesInput,
  type ProposeTimesOutput,
} from './actions';
export {
  OUTLOOK_CALENDAR_NAMESPACE,
  OUTLOOK_CALENDAR_TOOLS,
} from './tools';
export { computeProposals, validateProposeTimesInput } from './propose-times';
