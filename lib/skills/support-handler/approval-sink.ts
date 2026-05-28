/**
 * lib/skills/support-handler/approval-sink.ts
 *
 * Test impl of `ApprovalSink`. Records every proposal the skill emits
 * without side effects, so tests can assert the no-outbound contract:
 * every draft lands here with the right shape and NO email is ever
 * dispatched from agentplain.
 *
 * Production binding lives in `./prisma-approval-sink.ts` and writes
 * `WorkApprovalQueueItem` rows tagged with discipline=customer-success
 * + kind=SUPPORT_HANDLER_REPLY_DRAFT.
 */

import { skillOk, type SkillResult } from '../types';
import type { ApprovalSink, SupportDraftProposal } from './types';

export interface RecordedSupportDraft {
  workspaceId: string;
  proposal: SupportDraftProposal;
  sinkId: string;
}

export class RecordingApprovalSink implements ApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedSupportDraft[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    proposal: SupportDraftProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `support-recorded-${this.nextId++}`;
    this.calls.push({ workspaceId: args.workspaceId, proposal: args.proposal, sinkId });
    return skillOk({ sinkId });
  }
}
