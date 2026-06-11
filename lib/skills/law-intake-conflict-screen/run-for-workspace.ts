/**
 * lib/skills/law-intake-conflict-screen/run-for-workspace.ts
 *
 * Production entry point for the law conflict-screen across one workspace.
 * The base skill (`./skill.ts`) screens ONE intake. This wrapper does the
 * workspace-level work the production caller needs:
 *
 *   1. Fetch the firm's UN-SCREENED new-matter intakes (PrismaIntakeFetcher).
 *   2. Run the deterministic conflict screen on each, against the firm
 *      ledger (PrismaLedgerFetcher), writing the verdict card +
 *      engagement-letter draft as a WorkApprovalQueueItem the responsible
 *      attorney reviews in /approvals (PrismaConflictApprovalSink).
 *
 * Closes the audit's silent-gating gap: law-intake-conflict-screen shipped
 * (PR #206) module-complete but had NO production caller — a paying law
 * workspace never saw a conflict-screen verdict. This is that caller.
 *
 * Per `project_no_outbound_architecture.md`: writes WorkApprovalQueueItem
 * rows ONLY. The attorney decides per MRPC 1.7 / 1.18; nothing auto-sends.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless — fresh fetcher +
 * sink per call; the ledger is fetched once and reused across the run's
 * intakes (a within-run read, not a cross-fire cache).
 */

import { runSkill } from './skill';
import { PrismaLedgerFetcher } from './prisma-ledger-fetcher';
import { PrismaConflictApprovalSink } from './prisma-approval-sink';
import { PrismaIntakeFetcher, type IntakeFetcher } from './prisma-intake-fetcher';
import type {
  ConflictApprovalSink,
  IntakeConflictScreenOutput,
  LedgerFetcher,
  ProspectiveIntake,
} from './types';

export interface RunConflictScreenForWorkspaceInput {
  workspaceId: string;
  now?: Date;
  /** When false, the caller's fire-gate denied — the skill returns
   *  NOT_APPLICABLE per intake. Threaded through to runSkill. */
  gateAllow?: boolean;
  /** Override the intake source. Production reads un-screened intakes from
   *  KnowledgeDocument; tests inject a JsonIntakeFetcher. */
  intakeFetcher?: IntakeFetcher;
  /** Override the ledger source. */
  ledgerFetcher?: LedgerFetcher;
  /** Override the approval sink. */
  sink?: ConflictApprovalSink;
  /** Override the pending-intake list directly (highest-priority hook for
   *  the sweep's tests). */
  intakes?: ProspectiveIntake[];
}

export interface ConflictScreenForWorkspaceResult {
  ok: boolean;
  workspaceId: string;
  intakesConsidered: number;
  intakesScreened: number;
  /** Verdict counts for the sweep's audit log. */
  clear: number;
  flagged: number;
  needsCounselReview: number;
  outputs: IntakeConflictScreenOutput[];
  failures: Array<{ matterId: string; reason: string }>;
}

export async function runConflictScreenForWorkspace(
  input: RunConflictScreenForWorkspaceInput,
): Promise<ConflictScreenForWorkspaceResult> {
  const intakeFetcher =
    input.intakeFetcher ?? new PrismaIntakeFetcher();
  const ledgerFetcher = input.ledgerFetcher ?? new PrismaLedgerFetcher();
  const sink = input.sink ?? new PrismaConflictApprovalSink();

  const result: ConflictScreenForWorkspaceResult = {
    ok: true,
    workspaceId: input.workspaceId,
    intakesConsidered: 0,
    intakesScreened: 0,
    clear: 0,
    flagged: 0,
    needsCounselReview: 0,
    outputs: [],
    failures: [],
  };

  // Resolve the pending intakes.
  let intakes: ProspectiveIntake[];
  if (input.intakes) {
    intakes = input.intakes;
  } else {
    const res = await intakeFetcher.fetchPendingIntakes({
      workspaceId: input.workspaceId,
    });
    if (!res.ok) {
      result.ok = false;
      result.failures.push({
        matterId: '(intake-fetch)',
        reason: `${res.error.code}: ${res.error.message}`,
      });
      return result;
    }
    intakes = res.value;
  }
  result.intakesConsidered = intakes.length;

  for (const intake of intakes) {
    try {
      const res = await runSkill({
        workspaceId: input.workspaceId,
        intake,
        fetcher: ledgerFetcher,
        sink,
        now: input.now,
        ...(input.gateAllow === undefined ? {} : { gateAllow: input.gateAllow }),
      });
      if (!res.ok) {
        // Gate-denied returns NOT_APPLICABLE — a clean skip, not a failure.
        if (res.error.code === 'NOT_APPLICABLE') continue;
        result.failures.push({
          matterId: intake.matterId,
          reason: `${res.error.code}: ${res.error.message}`,
        });
        continue;
      }
      result.intakesScreened += 1;
      result.outputs.push(res.value);
      switch (res.value.status) {
        case 'clear':
          result.clear += 1;
          break;
        case 'flagged':
          result.flagged += 1;
          break;
        case 'needs-counsel-review':
          result.needsCounselReview += 1;
          break;
      }
    } catch (err) {
      result.failures.push({
        matterId: intake.matterId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
