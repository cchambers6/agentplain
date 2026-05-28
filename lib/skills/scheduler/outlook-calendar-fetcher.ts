/**
 * lib/skills/scheduler/outlook-calendar-fetcher.ts
 *
 * MCP-backed implementation of `CalendarFetcher` for Outlook (Microsoft
 * Graph). Mirrors `./google-calendar-fetcher.ts` one-for-one so the
 * scheduler skill runs unchanged against either provider through the
 * multiplexer in `./calendar-multiplex-fetcher.ts`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this adapter never imports
 * `@microsoft/microsoft-graph-client` or hits `graph.microsoft.com`
 * directly. The single seam to Microsoft Graph lives in
 * `lib/integrations/outlook-calendar-mcp/server.ts`.
 *
 * Per `feedback_cold_start_safe_agents.md`: no caching.
 *
 * Per `project_no_outbound_architecture.md`: read-only.
 */

import {
  buildOutlookCalendarMcpServer,
  type OutlookCalendarMcpServer,
} from '@/lib/integrations/outlook-calendar-mcp';
import type { CalendarEvent } from '../chief-of-staff-scheduler/types';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  CalendarEventsResponseSchema,
  type CalendarFetcher,
  type CalendarFetcherInput,
} from './types';

export interface OutlookCalendarFetcherConfig {
  workspaceId: string;
  server?: OutlookCalendarMcpServer;
}

export class OutlookCalendarFetcher implements CalendarFetcher {
  readonly name = 'outlook-calendar' as const;
  readonly provider = 'm365' as const;
  private readonly server: OutlookCalendarMcpServer;

  constructor(config: OutlookCalendarFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('OutlookCalendarFetcher: workspaceId is required');
    }
    this.server =
      config.server ??
      buildOutlookCalendarMcpServer({ workspaceId: config.workspaceId });
  }

  async fetchEvents(
    input: CalendarFetcherInput,
  ): Promise<SkillResult<CalendarEvent[]>> {
    if (input.workspaceId !== this.server.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `OutlookCalendarFetcher workspaceId mismatch: server=${this.server.workspaceId}, asked=${input.workspaceId}`,
      );
    }
    const res = await this.server.listEvents({
      from: input.from,
      to: input.to,
    });
    if (!res.ok) {
      if (res.error.code === 'CREDENTIAL_NOT_FOUND') {
        return skillError(
          'NOT_CONFIGURED',
          `Outlook Calendar credential not connected for workspace ${input.workspaceId}.`,
          res.error.code,
        );
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `Outlook Calendar MCP listEvents failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const parsed = CalendarEventsResponseSchema.safeParse(res.value);
    if (!parsed.success) {
      return skillError(
        'PARSE_ERROR',
        `Outlook Calendar MCP response failed schema validation: ${parsed.error.message}`,
      );
    }
    const events: CalendarEvent[] = parsed.data.events.map((dto) => ({
      id: dto.id,
      title: dto.title,
      startUtc: new Date(dto.startUtc),
      endUtc: new Date(dto.endUtc),
      isBusy: dto.isBusy,
    }));
    return skillOk(events);
  }
}
