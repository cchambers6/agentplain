/**
 * lib/skills/chief-of-staff-scheduler/approval-sink.ts
 *
 * In-memory implementation of `ApprovalSink`. Records every proposal the
 * skill emits without performing any side effect. Tests use it to assert
 * the no-outbound contract: every proposal lands here with PENDING, and
 * NO calendar `events.insert` / Gmail `messages.send` / Linear task
 * creation runs.
 *
 * The production binding for `ApprovalSink` (a Prisma-backed adapter
 * that writes `WorkApprovalQueueItem` rows) lives outside this directory
 * so the skill stays vendor-neutral. The catalog entry for this skill
 * (`lib/skills/registry.ts`) notes the production sink is the next
 * integration step.
 */

import { skillOk, type SkillResult } from '../types';
import type { ApprovalSink, ChiefOfStaffProposal } from './types';

export interface RecordedProposal {
  workspaceId: string;
  proposal: ChiefOfStaffProposal;
  sinkId: string;
}

export class RecordingApprovalSink implements ApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedProposal[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    proposal: ChiefOfStaffProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `recorded-${this.nextId++}`;
    this.calls.push({ workspaceId: args.workspaceId, proposal: args.proposal, sinkId });
    return skillOk({ sinkId });
  }

  byKind(kind: ChiefOfStaffProposal['kind']): RecordedProposal[] {
    return this.calls.filter((c) => c.proposal.kind === kind);
  }
}
