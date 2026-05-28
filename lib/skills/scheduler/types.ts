/**
 * lib/skills/scheduler/types.ts
 *
 * The narrow `CalendarFetcher` port the chief-of-staff scheduler skill
 * reads its calendar window from. Lives one level above the per-provider
 * MCP servers in `lib/integrations/{google,outlook}-calendar-mcp/` so the
 * skill speaks ONE shape regardless of which provider backs the
 * workspace.
 *
 * Per `feedback_runner_portability.md`: this port has at least two
 * implementations (`GoogleCalendarFetcher` against the Google MCP server,
 * `OutlookCalendarFetcher` against the Microsoft Graph MCP server), and
 * a third multiplexer that picks the right one per workspace.
 *
 * Per `project_no_outbound_architecture.md`: every fetcher is READ-ONLY
 * — no booking, no inviting, no modifying. The skill proposes; the
 * customer's calendar performs the actual booking after operator
 * approval.
 *
 * Per `feedback_cold_start_safe_agents.md`: the fetcher carries no
 * in-memory state. Every call re-reads from the underlying MCP server,
 * which itself re-reads from durable IntegrationCredential state.
 */

import { z } from 'zod';
import type { SkillResult } from '../types';
import type { CalendarEvent } from '../chief-of-staff-scheduler/types';

/**
 * Zod schema for the calendar event DTO crossing the MCP boundary.
 * Both Google + Outlook calendar MCP servers return the same shape; we
 * validate at the seam so a schema drift on either side surfaces as a
 * PARSE_ERROR up the stack rather than a runtime crash inside the skill.
 */
export const CalendarEventDtoSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  startUtc: z.string().min(1),
  endUtc: z.string().min(1),
  isBusy: z.boolean(),
});

export const CalendarEventsResponseSchema = z.object({
  events: z.array(CalendarEventDtoSchema),
});

export type CalendarEventDto = z.infer<typeof CalendarEventDtoSchema>;

export interface CalendarFetcherInput {
  workspaceId: string;
  /** Inclusive window start. */
  from: Date;
  /** Exclusive window end. */
  to: Date;
}

export interface CalendarFetcher {
  /** Implementation discriminator — `google-calendar` / `outlook-calendar`
   *  / `multiplex` / `null`. */
  readonly name: string;
  /** Provider identifier so the multiplexer can announce which arm fired.
   *  Returns `null` when no arm fired (the workspace has no active
   *  calendar credential). */
  readonly provider: 'google' | 'm365' | null;
  fetchEvents(
    input: CalendarFetcherInput,
  ): Promise<SkillResult<CalendarEvent[]>>;
}
