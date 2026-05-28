/**
 * lib/skills/scheduler/google-calendar-fetcher.ts
 *
 * MCP-backed implementation of `CalendarFetcher` for Google Calendar.
 * Per the MCP-first integration architecture, this adapter speaks ONLY
 * the `GoogleCalendarMcpServer` interface — no `googleapis` import here.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the single seam to Google's
 * Calendar API lives in `lib/integrations/google-calendar-mcp/server.ts`.
 * This fetcher is a thin adapter that re-shapes the MCP response into
 * the scheduler skill's `CalendarEvent[]` shape (with `Date` instants).
 *
 * Per `feedback_cold_start_safe_agents.md`: no caching. Every call
 * re-resolves the MCP server, which itself re-resolves the underlying
 * credential.
 *
 * Per `feedback_no_guesses_no_estimates.md`: zod-validates the MCP
 * response at the seam. A schema drift on the MCP side surfaces as
 * `PARSE_ERROR` here, not a runtime crash deep inside the skill.
 *
 * Per `project_no_outbound_architecture.md`: read-only — no event create
 * / update / delete. The scheduler proposes; the customer's calendar
 * performs the booking.
 */

import {
  buildGoogleCalendarMcpServer,
  type GoogleCalendarMcpServer,
} from '@/lib/integrations/google-calendar-mcp';
import type { CalendarEvent } from '../chief-of-staff-scheduler/types';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  CalendarEventsResponseSchema,
  type CalendarFetcher,
  type CalendarFetcherInput,
} from './types';

export interface GoogleCalendarFetcherConfig {
  /** Workspace this fetcher serves. */
  workspaceId: string;
  /** Pre-built MCP server — tests inject the deterministic test impl. */
  server?: GoogleCalendarMcpServer;
}

export class GoogleCalendarFetcher implements CalendarFetcher {
  readonly name = 'google-calendar' as const;
  readonly provider = 'google' as const;
  private readonly server: GoogleCalendarMcpServer;

  constructor(config: GoogleCalendarFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('GoogleCalendarFetcher: workspaceId is required');
    }
    this.server =
      config.server ??
      buildGoogleCalendarMcpServer({ workspaceId: config.workspaceId });
  }

  async fetchEvents(
    input: CalendarFetcherInput,
  ): Promise<SkillResult<CalendarEvent[]>> {
    if (input.workspaceId !== this.server.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `GoogleCalendarFetcher workspaceId mismatch: server=${this.server.workspaceId}, asked=${input.workspaceId}`,
      );
    }
    const res = await this.server.listEvents({
      from: input.from,
      to: input.to,
    });
    if (!res.ok) {
      // Map MCP error codes onto skill error codes. CREDENTIAL_NOT_FOUND
      // bubbles as NOT_CONFIGURED so the multiplexer + cron can treat it
      // as a clean skip, not a failure.
      if (res.error.code === 'CREDENTIAL_NOT_FOUND') {
        return skillError(
          'NOT_CONFIGURED',
          `Google Calendar credential not connected for workspace ${input.workspaceId}.`,
          res.error.code,
        );
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `Google Calendar MCP listEvents failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const parsed = CalendarEventsResponseSchema.safeParse(res.value);
    if (!parsed.success) {
      return skillError(
        'PARSE_ERROR',
        `Google Calendar MCP response failed schema validation: ${parsed.error.message}`,
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
