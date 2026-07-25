/**
 * lib/integrations/google-calendar-mcp/tools.ts
 *
 * The Google Calendar tool registry — zod arg schemas + descriptions + wiring
 * to the `GoogleCalendarMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/google-calendar-mcp/[workspaceId]/route.ts`) and the
 * dispatch smoke test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Tool names follow the connector's existing dotted convention
 * (`calendar.events.list` — see `GOOGLE_CALENDAR_TOOL_NAMES` in ./types.ts).
 * The mcp-core dispatcher also accepts the bare form (`events.list`) via its
 * namespace-stripping fallback.
 *
 * Per `project_no_outbound_architecture.md`: `events.book` / `.reschedule` /
 * `.update` / `.cancel` are MUTATIONS — the server the route binds is built
 * by `buildGoogleCalendarMcpServer`, which installs the approval gate, so a
 * call without a recorded grant returns APPROVAL_REQUIRED (-32004) and never
 * reaches Google.
 *
 * JSON boundary note: `listEvents` takes `Date`s at the interface, so the
 * schema here parses ISO strings and hydrates — same convention the resource
 * URI reader uses.
 */

import { z } from 'zod';
import type { McpResult, ToolRegistration } from '@/lib/integrations/mcp-core';
import type { GoogleCalendarMcpServer } from './types';

/** Namespace prefix for Google Calendar MCP tools. */
export const GOOGLE_CALENDAR_NAMESPACE = 'calendar';

const isoDate = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'must be an ISO 8601 timestamp' });

const listEventsSchema = z.object({
  from: isoDate,
  to: isoDate,
  calendarId: z.string().min(1).optional(),
  maxResults: z.number().int().positive().max(2500).optional(),
});

const getEventSchema = z.object({
  eventId: z.string().min(1),
  calendarId: z.string().min(1).optional(),
});

const findAvailabilitySchema = z.object({
  timeMin: isoDate,
  timeMax: isoDate,
  calendarIds: z.array(z.string().min(1)).optional(),
});

const proposeTimesSchema = z.object({
  timeMin: isoDate,
  timeMax: isoDate,
  durationMinutes: z.number().int().positive().max(24 * 60),
  calendarIds: z.array(z.string().min(1)).optional(),
  maxProposals: z.number().int().positive().max(20).optional(),
  workingHours: z
    .object({
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(1).max(24),
    })
    .optional(),
  timezone: z.string().min(1).optional(),
});

const bookMeetingSchema = z.object({
  calendarId: z.string().min(1).optional(),
  summary: z.string().min(1),
  start: isoDate,
  end: isoDate,
  attendees: z.array(z.string().min(1)).optional(),
  description: z.string().optional(),
  pendingApprovalId: z.string().min(1).optional(),
});

const rescheduleMeetingSchema = z.object({
  calendarId: z.string().min(1).optional(),
  eventId: z.string().min(1),
  start: isoDate,
  end: isoDate,
  pendingApprovalId: z.string().min(1).optional(),
});

const updateEventSchema = z.object({
  calendarId: z.string().min(1).optional(),
  eventId: z.string().min(1),
  summary: z.string().min(1).optional(),
  description: z.string().optional(),
  start: isoDate.optional(),
  end: isoDate.optional(),
  attendees: z.array(z.string().min(1)).optional(),
  location: z.string().optional(),
  pendingApprovalId: z.string().min(1).optional(),
});

const cancelEventSchema = z.object({
  calendarId: z.string().min(1).optional(),
  eventId: z.string().min(1),
  pendingApprovalId: z.string().min(1).optional(),
});

/**
 * Bridge the connector's own result union to the generic `McpResult` the
 * dispatcher speaks. Identity at runtime — `GoogleCalendarMcpResult`'s error
 * codes are a subset of `McpErrorCode` and the union shape is identical.
 */
function asMcp<T>(p: Promise<{ ok: true; value: T } | { ok: false; error: unknown }>): Promise<McpResult<unknown>> {
  return p as Promise<McpResult<unknown>>;
}

export const GOOGLE_CALENDAR_TOOLS: ReadonlyArray<ToolRegistration<GoogleCalendarMcpServer>> = [
  {
    name: `${GOOGLE_CALENDAR_NAMESPACE}.calendars.list`,
    description: "Enumerate the connected account's calendars (id, title, access role, timezone).",
    schema: z.object({}),
    invoke: (s) => asMcp(s.listCalendars()),
  },
  {
    name: `${GOOGLE_CALENDAR_NAMESPACE}.events.list`,
    description:
      'List events in a time window. from/to are ISO 8601; calendarId defaults to primary.',
    schema: listEventsSchema,
    invoke: (s, a) => {
      const args = listEventsSchema.parse(a);
      return asMcp(
        s.listEvents({
          from: new Date(args.from),
          to: new Date(args.to),
          calendarId: args.calendarId,
          maxResults: args.maxResults,
        }),
      );
    },
  },
  {
    name: `${GOOGLE_CALENDAR_NAMESPACE}.events.get`,
    description: 'Fetch one event by id, including attendees, description, and location.',
    schema: getEventSchema,
    invoke: (s, a) => asMcp(s.getEvent(getEventSchema.parse(a))),
  },
  {
    name: `${GOOGLE_CALENDAR_NAMESPACE}.freebusy.query`,
    description:
      'Find availability: busy intervals across the queried calendars in [timeMin, timeMax). A read — reveals no event detail.',
    schema: findAvailabilitySchema,
    invoke: (s, a) => asMcp(s.findAvailability(findAvailabilitySchema.parse(a))),
  },
  {
    name: `${GOOGLE_CALENDAR_NAMESPACE}.slots.propose`,
    description:
      'Propose open meeting slots of durationMinutes inside [timeMin, timeMax), avoiding busy blocks and staying inside local working hours. A read.',
    schema: proposeTimesSchema,
    invoke: (s, a) => asMcp(s.proposeTimes(proposeTimesSchema.parse(a))),
  },
  {
    name: `${GOOGLE_CALENDAR_NAMESPACE}.events.book`,
    description:
      'Create a calendar event and invite attendees. MUTATION — approval-gated; returns APPROVAL_REQUIRED without a recorded grant.',
    schema: bookMeetingSchema,
    invoke: (s, a) => asMcp(s.bookMeeting(bookMeetingSchema.parse(a))),
  },
  {
    name: `${GOOGLE_CALENDAR_NAMESPACE}.events.reschedule`,
    description:
      "Move an existing event's start/end. MUTATION — approval-gated.",
    schema: rescheduleMeetingSchema,
    invoke: (s, a) => asMcp(s.rescheduleMeeting(rescheduleMeetingSchema.parse(a))),
  },
  {
    name: `${GOOGLE_CALENDAR_NAMESPACE}.events.update`,
    description:
      'Update event fields (title, description, times, attendees, location). MUTATION — approval-gated.',
    schema: updateEventSchema,
    invoke: (s, a) => asMcp(s.updateEvent(updateEventSchema.parse(a))),
  },
  {
    name: `${GOOGLE_CALENDAR_NAMESPACE}.events.cancel`,
    description:
      'Cancel an event (provider notifies attendees). MUTATION — approval-gated.',
    schema: cancelEventSchema,
    invoke: (s, a) => asMcp(s.cancelEvent(cancelEventSchema.parse(a))),
  },
];
