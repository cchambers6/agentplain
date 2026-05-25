/**
 * lib/skills/inbox-triage-general/approval-sink.ts
 *
 * In-memory `TriageApprovalSink` for tests. Mirrors the chief-of-staff
 * `RecordingApprovalSink` pattern — records proposals with no side
 * effects so tests can assert the no-outbound contract.
 */

import { skillOk, type SkillResult } from '../types';
import type { TriageApprovalSink, TriageProposal } from './types';

export interface RecordedTriageProposal {
  workspaceId: string;
  proposal: TriageProposal;
  sinkId: string;
}

export class RecordingTriageApprovalSink implements TriageApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedTriageProposal[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    proposal: TriageProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `triage-recorded-${this.nextId++}`;
    this.calls.push({ workspaceId: args.workspaceId, proposal: args.proposal, sinkId });
    return skillOk({ sinkId });
  }

  byPriority(priority: TriageProposal['priority']): RecordedTriageProposal[] {
    return this.calls.filter((c) => c.proposal.priority === priority);
  }
}
