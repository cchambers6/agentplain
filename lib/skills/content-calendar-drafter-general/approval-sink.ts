/**
 * In-memory `CalendarApprovalSink` for tests.
 */

import { skillOk, type SkillResult } from '../types';
import type { CalendarApprovalSink, CalendarProposal } from './types';

export interface RecordedCalendarProposal {
  workspaceId: string;
  proposal: CalendarProposal;
  sinkId: string;
}

export class RecordingCalendarApprovalSink implements CalendarApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedCalendarProposal[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    proposal: CalendarProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `calendar-recorded-${this.nextId++}`;
    this.calls.push({
      workspaceId: args.workspaceId,
      proposal: args.proposal,
      sinkId,
    });
    return skillOk({ sinkId });
  }
}
