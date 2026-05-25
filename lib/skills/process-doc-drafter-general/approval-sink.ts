/**
 * lib/skills/process-doc-drafter-general/approval-sink.ts
 *
 * In-memory `ProcessDocApprovalSink` for tests.
 */

import { skillOk, type SkillResult } from '../types';
import type { ProcessDocApprovalSink, ProcessDocProposal } from './types';

export interface RecordedProcessDocProposal {
  workspaceId: string;
  proposal: ProcessDocProposal;
  sinkId: string;
}

export class RecordingProcessDocApprovalSink implements ProcessDocApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedProcessDocProposal[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    proposal: ProcessDocProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `processdoc-recorded-${this.nextId++}`;
    this.calls.push({ workspaceId: args.workspaceId, proposal: args.proposal, sinkId });
    return skillOk({ sinkId });
  }
}
