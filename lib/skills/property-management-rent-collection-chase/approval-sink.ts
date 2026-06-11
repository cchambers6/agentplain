/**
 * lib/skills/property-management-rent-collection-chase/approval-sink.ts
 *
 * In-memory `RentChaseApprovalSink` for unit tests.
 *
 * Mirrors the recording-sink pattern from home-services-estimate-followup /
 * follow-up-chaser-general. Tests bind this; production binds the
 * `PrismaRentChaseApprovalSink` in prisma-approval-sink.ts.
 */

import { skillOk, type SkillResult } from '../types';
import type { RentChaseApproval, RentChaseApprovalSink } from './types';

export interface RecordedRentChaseApproval {
  workspaceId: string;
  approval: RentChaseApproval;
  sinkId: string;
}

export class RecordingRentChaseApprovalSink implements RentChaseApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: RecordedRentChaseApproval[] = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    approval: RentChaseApproval;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const sinkId = `rent-chase-recorded-${this.nextId++}`;
    this.calls.push({ workspaceId: args.workspaceId, approval: args.approval, sinkId });
    return skillOk({ sinkId });
  }
}
