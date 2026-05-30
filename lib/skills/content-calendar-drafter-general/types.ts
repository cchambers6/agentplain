/**
 * lib/skills/content-calendar-drafter-general/types.ts
 *
 * Wave-3 discipline-wrap skill — marketing. Per
 * `docs/fleet-autonomy-audit-2026-05-28.md` §10 the marketing
 * discipline was NOT-DELIVERING; this skill is the first production
 * caller that lands real rows under it.
 *
 * Once a week the cron drafts a 5-day content calendar — one suggestion
 * per business day, tagged with channel hint + topic + a short hook for
 * the operator. The draft is grounded on the workspace's vertical, the
 * trailing-week activity counts, and any FEEDBACK rules the customer has
 * set under the email-draft / customer-comms scopes.
 *
 * Per `project_no_outbound_architecture.md`: drafts a single approval
 * row; nothing posts to social or email.
 */

import type { SkillResult } from '../types';

export interface ContentCalendarDayProposal {
  /** ISO yyyy-MM-dd. Five entries per fire, Mon-Fri of the upcoming week. */
  date: string;
  /** Channel hint — short label, e.g. "email", "social", "blog". */
  channel: string;
  /** One-line topic the operator can name + own. */
  topic: string;
  /** Short hook / suggested angle. Plain prose, no marketing fluff. */
  hook: string;
}

export interface CalendarSnapshot {
  workspaceId: string;
  workspaceName: string;
  verticalSlug: string;
  /** ISO of the Monday at the top of the target week. */
  forWeekStarting: string;
  /** Activity counts over the trailing week so the LLM can name what to
   *  build on or follow up against. */
  recentCounts: {
    approvalsCreated: number;
    instructions: number;
  };
}

export interface CalendarProposal {
  proposalId: string;
  forWeekStarting: string;
  /** LLM-composed prose summary preceding the daily list. */
  preamble: string;
  /** Daily entries — 3 to 5. */
  days: ContentCalendarDayProposal[];
  snapshot: CalendarSnapshot;
}

export interface CalendarApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    proposal: CalendarProposal;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

export interface CalendarSkillInput {
  workspaceId: string;
  snapshot: CalendarSnapshot;
  sink?: CalendarApprovalSink;
  feedbackRulesBlock?: string;
  now?: Date;
  llm?: import('../../llm/types').LlmProvider;
}

export interface CalendarSkillOutput {
  proposal: CalendarProposal;
  sunk: boolean;
  noOutboundNote: string;
}

export const CALENDAR_AGENT_SLUG = 'content-calendar-drafter-general';
export const CALENDAR_REF_TABLE = 'ContentCalendarProposal';
