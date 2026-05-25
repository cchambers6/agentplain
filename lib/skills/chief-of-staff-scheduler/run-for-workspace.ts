/**
 * lib/skills/chief-of-staff-scheduler/run-for-workspace.ts
 *
 * Production entry point for the chief-of-staff scheduler. Wraps
 * `runSkill` with a `PrismaApprovalSink` bound to the workspace so each
 * proposal lands in `WorkApprovalQueueItem` as PENDING for the
 * operator's `/approvals` page.
 *
 * The skill itself (`./skill.ts`) stays Prisma-free per
 * `feedback_runner_portability.md` — only this thin wrapper imports the
 * Prisma binding. Tests can still call `runSkill` directly with a
 * `RecordingApprovalSink` and assert the no-outbound contract without
 * touching the database.
 *
 * Per `feedback_cold_start_safe_agents.md`: this function holds no
 * in-memory state. Every call constructs a fresh `PrismaApprovalSink`
 * and reads everything it needs from the caller's input.
 */

import { runSkill } from './skill';
import { PrismaApprovalSink } from './prisma-approval-sink';
import type { SkillResult } from '../types';
import type {
  ApprovalSink,
  ChiefOfStaffInput,
  ChiefOfStaffOutput,
} from './types';

export interface RunChiefOfStaffForWorkspaceInput
  extends Omit<ChiefOfStaffInput, 'sink'> {
  /** Override the sink — defaults to `PrismaApprovalSink`. Tests pass a
   *  `RecordingApprovalSink` to assert no-outbound without touching the
   *  database. Production callers should leave this undefined. */
  sink?: ApprovalSink | null;
}

export async function runChiefOfStaffForWorkspace(
  input: RunChiefOfStaffForWorkspaceInput,
): Promise<SkillResult<ChiefOfStaffOutput>> {
  const sink = input.sink === undefined ? new PrismaApprovalSink() : input.sink;
  return runSkill({ ...input, sink });
}
