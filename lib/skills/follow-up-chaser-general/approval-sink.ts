/**
 * lib/skills/follow-up-chaser-general/approval-sink.ts
 *
 * In-memory `FollowUpApprovalSink` for tests. Mirrors the chief-of-staff
 * recording-sink pattern.
 */

import { skillOk, type SkillResult } from '../types';
import type { FollowUpApprovalSink, FollowUpProposal } from './types';

export interface RecordedFollowUpProposal {
  workspaceId: string;
  proposal: FollowUpProposal;
  sinkId: string;
}

export class RecordingFollowUpApprovalSink implements FollowUpApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedFollowUpProposal[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    proposal: FollowUpProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `followup-recorded-${this.nextId++}`;
    this.calls.push({ workspaceId: args.workspaceId, proposal: args.proposal, sinkId });
    return skillOk({ sinkId });
  }
}
