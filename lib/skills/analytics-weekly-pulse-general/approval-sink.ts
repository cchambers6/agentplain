/**
 * lib/skills/analytics-weekly-pulse-general/approval-sink.ts
 *
 * In-memory `PulseApprovalSink` for tests. Mirrors the recording-sink
 * pattern used by every other /general skill.
 */

import { skillOk, type SkillResult } from '../types';
import type { PulseApprovalSink, PulseProposal } from './types';

export interface RecordedPulseProposal {
  workspaceId: string;
  proposal: PulseProposal;
  sinkId: string;
}

export class RecordingPulseApprovalSink implements PulseApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedPulseProposal[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    proposal: PulseProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `pulse-recorded-${this.nextId++}`;
    this.calls.push({
      workspaceId: args.workspaceId,
      proposal: args.proposal,
      sinkId,
    });
    return skillOk({ sinkId });
  }
}
