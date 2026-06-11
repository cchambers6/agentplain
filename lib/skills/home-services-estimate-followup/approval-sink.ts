/**
 * lib/skills/home-services-estimate-followup/approval-sink.ts
 *
 * In-memory `EstimateApprovalSink` for unit tests.
 *
 * Mirrors the recording-sink pattern from follow-up-chaser-general and
 * chief-of-staff-scheduler.  Tests bind this; production binds the
 * `PrismaEstimateApprovalSink` in prisma-approval-sink.ts.
 */

import { skillOk, type SkillResult } from '../types';
import type { EstimateApprovalSink, EstimateNudgeApproval } from './types';

export interface RecordedEstimateApproval {
  workspaceId: string;
  approval: EstimateNudgeApproval;
  sinkId: string;
}

export class RecordingEstimateApprovalSink implements EstimateApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedEstimateApproval[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    approval: EstimateNudgeApproval;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `estimate-recorded-${this.nextId++}`;
    this.calls.push({ workspaceId: args.workspaceId, approval: args.approval, sinkId });
    return skillOk({ sinkId });
  }
}
