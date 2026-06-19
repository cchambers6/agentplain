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
import type {
  BookMeetingInput,
  BookMeetingOutput,
  RescheduleMeetingInput,
  RescheduleMeetingOutput,
  FindAvailabilityInput,
  FindAvailabilityOutput,
} from './actions';

export interface TestGoogleCalendarSeed {
  events?: CalendarEventDto[];
  /** Busy intervals returned by `findAvailability`. */
  busy?: { start: string; end: string }[];
  /** When set, every tool call returns this error. Used by tests that
   *  exercise the MCP-down path. */
  forcedError?: { code: import('./types').GoogleCalendarMcpErrorCode; message: string };
}

/** One recorded mutating call, for test assertions. */
export interface RecordedCalendarWrite {
  method: 'bookMeeting' | 'rescheduleMeeting';
  input: BookMeetingInput | RescheduleMeetingInput;
}

export class TestGoogleCalendarMcpServer implements GoogleCalendarMcpServer {
  readonly name = 'google-calendar-test' as const;
  readonly workspaceId: string;
  private readonly seed: TestGoogleCalendarSeed;
  /** Mutations the recording server "executed" (post-gate). */
  readonly writes: RecordedCalendarWrite[] = [];

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

  async findAvailability(
    input: FindAvailabilityInput,
  ): Promise<GoogleCalendarMcpResult<FindAvailabilityOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    const timeMin = new Date(input.timeMin);
    const timeMax = new Date(input.timeMax);
    if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime())) {
      return calendarError(
        'INVALID_ARGUMENT',
        'findAvailability requires ISO 8601 timeMin + timeMax',
      );
    }
    if (timeMax.getTime() <= timeMin.getTime()) {
      return calendarError(
        'INVALID_ARGUMENT',
        'findAvailability requires timeMax strictly after timeMin',
      );
    }
    return calendarOk({ busy: this.seed.busy ?? [] });
  }

  async bookMeeting(
    input: BookMeetingInput,
  ): Promise<GoogleCalendarMcpResult<BookMeetingOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    this.writes.push({ method: 'bookMeeting', input });
    const eventId = `evt-${this.writes.length}`;
    return calendarOk({
      eventId,
      htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
    });
  }

  async rescheduleMeeting(
    input: RescheduleMeetingInput,
  ): Promise<GoogleCalendarMcpResult<RescheduleMeetingOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    this.writes.push({ method: 'rescheduleMeeting', input });
    return calendarOk({ eventId: input.eventId });
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
