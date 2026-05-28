/**
 * lib/integrations/outlook-calendar-mcp/test-server.ts
 *
 * Deterministic fixture-backed `OutlookCalendarMcpServer`. Pair to
 * `./server.ts` per the two-implementation rule.
 */

import {
  type CalendarEventDto,
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

export interface TestOutlookCalendarSeed {
  events?: CalendarEventDto[];
  forcedError?: {
    code: import('./types').OutlookCalendarMcpErrorCode;
    message: string;
  };
}

export class TestOutlookCalendarMcpServer implements OutlookCalendarMcpServer {
  readonly name = 'outlook-calendar-test' as const;
  readonly workspaceId: string;
  private readonly seed: TestOutlookCalendarSeed;

  constructor(args: { workspaceId: string; seed?: TestOutlookCalendarSeed }) {
    this.workspaceId = args.workspaceId;
    this.seed = args.seed ?? {};
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
