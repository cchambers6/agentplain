/**
 * lib/integrations/google-calendar-mcp/test-server.ts
 *
 * Deterministic fixture-backed `GoogleCalendarMcpServer`. Pair to
 * `./server.ts` per the two-implementation rule. Tests + CI route here;
 * production routes to `./server.ts` via `./index.ts`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: no `googleapis` import here.
 * Skill code consumes the MCP interface, so the test impl exercises the
 * same code path as production minus the Google round-trip.
 */

import {
  type CalendarEventDto,
  type GoogleCalendarMcpResult,
  type GoogleCalendarMcpServer,
  type ListEventsInput,
  type ListEventsOutput,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  calendarError,
  calendarOk,
} from './types';

export interface TestGoogleCalendarSeed {
  events?: CalendarEventDto[];
  /** When set, every tool call returns this error. Used by tests that
   *  exercise the MCP-down path. */
  forcedError?: { code: import('./types').GoogleCalendarMcpErrorCode; message: string };
}

export class TestGoogleCalendarMcpServer implements GoogleCalendarMcpServer {
  readonly name = 'google-calendar-test' as const;
  readonly workspaceId: string;
  private readonly seed: TestGoogleCalendarSeed;

  constructor(args: { workspaceId: string; seed?: TestGoogleCalendarSeed }) {
    this.workspaceId = args.workspaceId;
    this.seed = args.seed ?? {};
  }

  async listEvents(
    input: ListEventsInput,
  ): Promise<GoogleCalendarMcpResult<ListEventsOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    if (!(input.from instanceof Date) || !(input.to instanceof Date)) {
      return calendarError('INVALID_ARGUMENT', 'listEvents requires from + to Dates');
    }
    if (input.to.getTime() <= input.from.getTime()) {
      return calendarError(
        'INVALID_ARGUMENT',
        'listEvents requires `to` strictly after `from`',
      );
    }
    const fromMs = input.from.getTime();
    const toMs = input.to.getTime();
    const events = (this.seed.events ?? []).filter((e) => {
      const startMs = new Date(e.startUtc).getTime();
      const endMs = new Date(e.endUtc).getTime();
      return endMs > fromMs && startMs < toMs;
    });
    return calendarOk({ events });
  }

  async listResources(): Promise<
    GoogleCalendarMcpResult<ResourceDescriptor[]>
  > {
    return calendarOk([
      {
        uri: `google-calendar://workspace/${this.workspaceId}/events`,
        name: 'Calendar events (test)',
        description: 'Deterministic test fixture.',
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    _input: ReadResourceInput,
  ): Promise<GoogleCalendarMcpResult<ReadResourceOutput>> {
    return calendarError('NOT_IMPLEMENTED', 'Test server does not implement readResource');
  }
}
