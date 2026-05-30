import { skillOk, type SkillResult } from '../types';
import type { ComplianceApprovalSink, ComplianceProposal } from './types';

export interface RecordedComplianceProposal {
  workspaceId: string;
  proposal: ComplianceProposal;
  sinkId: string;
}

export class RecordingComplianceApprovalSink implements ComplianceApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedComplianceProposal[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    proposal: ComplianceProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `compliance-recorded-${this.nextId++}`;
    this.calls.push({
      workspaceId: args.workspaceId,
      proposal: args.proposal,
      sinkId,
    });
    return skillOk({ sinkId });
  }
}
