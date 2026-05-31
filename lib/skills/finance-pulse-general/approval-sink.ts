/**
 * lib/skills/finance-pulse-general/approval-sink.ts
 *
 * In-memory `FinancePulseApprovalSink` for tests. Mirrors the recording-
 * sink pattern used by analytics-weekly-pulse-general.
 */

import { skillOk, type SkillResult } from '../types';
import type { FinancePulseApprovalSink, FinancePulseProposal } from './types';

export interface RecordedFinancePulseProposal {
  workspaceId: string;
  proposal: FinancePulseProposal;
  sinkId: string;
}

export class RecordingFinancePulseApprovalSink
  implements FinancePulseApprovalSink
{
  readonly name = 'recording' as const;
  readonly calls: RecordedFinancePulseProposal[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    proposal: FinancePulseProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `finance-pulse-recorded-${this.nextId++}`;
    this.calls.push({
      workspaceId: args.workspaceId,
      proposal: args.proposal,
      sinkId,
    });
    return skillOk({ sinkId });
  }
}
