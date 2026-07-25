/**
 * lib/integrations/outlook-calendar-mcp/test-server.ts
 *
 * Deterministic fixture-backed `OutlookCalendarMcpServer`. Pair to
 * `./server.ts` per the two-implementation rule. Mirrors
 * `google-calendar-mcp/test-server.ts` so provider-neutral scheduler tests
 * run unchanged against either fixture.
 */

import {
  type CalendarDescriptor,
  type CalendarEventDetailDto,
  type CalendarEventDto,
  type GetEventInput,
  type GetEventOutput,
  type ListCalendarsOutput,
  type OutlookCalendarMcpResult,
  type OutlookCalendarMcpServer,
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
  UpdateEventInput,
  UpdateEventOutput,
  CancelEventInput,
  CancelEventOutput,
  FindAvailabilityInput,
  FindAvailabilityOutput,
  ProposeTimesInput,
  ProposeTimesOutput,
} from './actions';
import { computeProposals, validateProposeTimesInput } from './propose-times';

export interface TestOutlookCalendarSeed {
  events?: CalendarEventDto[];
  /** Calendars returned by `listCalendars`. Defaults to a single primary. */
  calendars?: CalendarDescriptor[];
  /** Busy intervals returned by `findAvailability` (and constraining
   *  `proposeTimes`, which runs the same shared slot arithmetic as prod). */
  busy?: { start: string; end: string }[];
  /** When set, every tool call returns this error. Used by tests that
   *  exercise the MCP-down path. */
  forcedError?: {
    code: import('./types').OutlookCalendarMcpErrorCode;
    message: string;
  };
}

/** One recorded mutating call, for test assertions. */
export interface RecordedCalendarWrite {
  method: 'bookMeeting' | 'rescheduleMeeting' | 'updateEvent' | 'cancelEvent';
  input: BookMeetingInput | RescheduleMeetingInput | UpdateEventInput | CancelEventInput;
}

export class TestOutlookCalendarMcpServer implements OutlookCalendarMcpServer {
  readonly name = 'outlook-calendar-test' as const;
  readonly workspaceId: string;
  private readonly seed: TestOutlookCalendarSeed;
  /** Mutations the recording server "executed" (post-gate). */
  readonly writes: RecordedCalendarWrite[] = [];

  constructor(args: { workspaceId: string; seed?: TestOutlookCalendarSeed }) {
    this.workspaceId = args.workspaceId;
    this.seed = args.seed ?? {};
  }

  async listCalendars(): Promise<OutlookCalendarMcpResult<ListCalendarsOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    return calendarOk({
      calendars: this.seed.calendars ?? [
        {
          id: 'primary',
          title: 'Calendar',
          isPrimary: true,
          accessRole: 'writer',
          timezone: null,
        },
      ],
    });
  }

  async listEvents(
    input: ListEventsInput,
  ): Promise<OutlookCalendarMcpResult<ListEventsOutput>> {
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

  async getEvent(
    input: GetEventInput,
  ): Promise<OutlookCalendarMcpResult<GetEventOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    if (!input.eventId?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'getEvent requires an eventId');
    }
    const found = (this.seed.events ?? []).find((e) => e.id === input.eventId);
    if (!found) {
      return calendarError('NOT_FOUND', `No event ${input.eventId} in the fixture seed`);
    }
    const detail: CalendarEventDetailDto = {
      ...found,
      description: null,
      location: null,
      attendees: [],
      htmlLink: `https://outlook.office365.com/calendar/item/${found.id}`,
      status: 'confirmed',
    };
    return calendarOk({ event: detail });
  }

  async findAvailability(
    input: FindAvailabilityInput,
  ): Promise<OutlookCalendarMcpResult<FindAvailabilityOutput>> {
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

  async proposeTimes(
    input: ProposeTimesInput,
  ): Promise<OutlookCalendarMcpResult<ProposeTimesOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    const validated = validateProposeTimesInput(input);
    if (!validated.ok) return validated;
    // Same shared arithmetic as prod (lib/integrations/scheduling) over the
    // seeded busy intervals — the fixture proposes exactly like production.
    return calendarOk({
      proposals: computeProposals(validated.value, this.seed.busy ?? []),
    });
  }

  async bookMeeting(
    input: BookMeetingInput,
  ): Promise<OutlookCalendarMcpResult<BookMeetingOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    this.writes.push({ method: 'bookMeeting', input });
    const eventId = `evt-${this.writes.length}`;
    return calendarOk({
      eventId,
      htmlLink: `https://outlook.office365.com/calendar/item/${eventId}`,
    });
  }

  async rescheduleMeeting(
    input: RescheduleMeetingInput,
  ): Promise<OutlookCalendarMcpResult<RescheduleMeetingOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    this.writes.push({ method: 'rescheduleMeeting', input });
    return calendarOk({ eventId: input.eventId });
  }

  async updateEvent(
    input: UpdateEventInput,
  ): Promise<OutlookCalendarMcpResult<UpdateEventOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    if (!input.eventId?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'updateEvent requires an eventId');
    }
    if ((input.start === undefined) !== (input.end === undefined)) {
      return calendarError(
        'INVALID_ARGUMENT',
        'updateEvent requires start and end together (or neither)',
      );
    }
    this.writes.push({ method: 'updateEvent', input });
    return calendarOk({
      eventId: input.eventId,
      htmlLink: `https://outlook.office365.com/calendar/item/${input.eventId}`,
    });
  }

  async cancelEvent(
    input: CancelEventInput,
  ): Promise<OutlookCalendarMcpResult<CancelEventOutput>> {
    if (this.seed.forcedError) {
      return calendarError(this.seed.forcedError.code, this.seed.forcedError.message);
    }
    if (!input.eventId?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'cancelEvent requires an eventId');
    }
    this.writes.push({ method: 'cancelEvent', input });
    return calendarOk({ eventId: input.eventId, cancelled: true as const });
  }

  async listResources(): Promise<
    OutlookCalendarMcpResult<ResourceDescriptor[]>
  > {
    return calendarOk([
      {
        uri: `outlook-calendar://workspace/${this.workspaceId}/events`,
        name: 'Calendar events (test)',
        description: 'Deterministic test fixture.',
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    _input: ReadResourceInput,
  ): Promise<OutlookCalendarMcpResult<ReadResourceOutput>> {
    return calendarError('NOT_IMPLEMENTED', 'Test server does not implement readResource');
  }
}
