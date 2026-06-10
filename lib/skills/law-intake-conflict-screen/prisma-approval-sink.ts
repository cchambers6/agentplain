/**
 * lib/skills/law-intake-conflict-screen/prisma-approval-sink.ts
 *
 * Production implementation of `ConflictApprovalSink`. Persists the
 * conflict-screen verdict as a `WorkApprovalQueueItem` row:
 *
 *   CLEAR                → kind=PROCESS_DOC_DRAFT, carrying the engagement-
 *                          letter draft so the attorney can review, edit, and
 *                          sign. The draft is the deliverable; the attorney
 *                          approves and routes it from their own system.
 *
 *   FLAGGED /
 *   NEEDS-COUNSEL-REVIEW → kind=COMPLIANCE_FLAG, carrying the cited conflict
 *                          matches so the attorney can decide per MRPC 1.7 /
 *                          1.18. The row is PENDING — no decision is made
 *                          for the attorney.
 *
 * Per `project_no_outbound_architecture.md`: write-only into agentplain's
 * own tables. Nothing here sends, signs, or auto-executes.
 *
 * Per `feedback_runner_portability.md` two-implementation rule:
 *   - This file (Prisma/production).
 *   - `RecordingConflictApprovalSink` (test, see `index.ts`).
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Each `record()`
 * call opens its own RLS-scoped transaction.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '../../disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ConflictApprovalSink,
  EngagementLetterDraft,
  IntakeConflictScreenOutput,
} from './types';

/** Agent slug attributed to conflict-screen rows in the approval queue.
 *  Matches the catalog slug in `lib/skills/registry.ts`. */
export const CONFLICT_SCREEN_AGENT_SLUG = 'law-intake-conflict-screen';

/** Ref-table on the WorkApprovalQueueItem row. We use a synthetic table
 *  name (not a real Prisma model) — the intake lives in the matter-
 *  management MCP, not in our schema. The matterId serves as the stable
 *  refId so re-runs overwrite in place rather than accumulating. */
export const CONFLICT_SCREEN_REF_TABLE = 'LawMatter';

export interface PrismaConflictApprovalSinkOptions {
  client?: PrismaClient;
  /** Bypass the RLS wrapper and write directly — used by tests that inject
   *  a stub `tx.workApprovalQueueItem.create`. */
  tx?: Prisma.TransactionClient;
}

export class PrismaConflictApprovalSink implements ConflictApprovalSink {
  readonly name = 'prisma' as const;

  constructor(
    private readonly options: PrismaConflictApprovalSinkOptions = {},
  ) {}

  async record(args: {
    workspaceId: string;
    screen: IntakeConflictScreenOutput;
    engagementLetter: EngagementLetterDraft | null;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildConflictApprovalRow(
      args.workspaceId,
      args.screen,
      args.engagementLetter,
    );
    try {
      if (this.options.tx) {
        const created = await this.options.tx.workApprovalQueueItem.create({
          data: row,
          select: { id: true },
        });
        return skillOk({ sinkId: created.id });
      }
      const ctx = {
        userId: null,
        workspaceId: args.workspaceId,
        isOperator: true,
      } as const;
      const id = await withRls(
        ctx,
        async (tx) => {
          const created = await tx.workApprovalQueueItem.create({
            data: row,
            select: { id: true },
          });
          return created.id;
        },
        this.options.client ? { client: this.options.client } : undefined,
      );
      return skillOk({ sinkId: id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError(
        'UNKNOWN',
        `PrismaConflictApprovalSink failed for matter ${args.screen.matterId}: ${message}`,
      );
    }
  }
}

/**
 * Map a conflict-screen outcome to a WorkApprovalQueueItem row.
 * Exposed for tests that want to assert the row shape without a DB.
 */
export function buildConflictApprovalRow(
  workspaceId: string,
  screen: IntakeConflictScreenOutput,
  engagementLetter: EngagementLetterDraft | null,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  const discipline =
    SKILL_DISCIPLINE[CONFLICT_SCREEN_AGENT_SLUG] ?? 'legal';

  if (screen.status === 'clear') {
    // CLEAR path → engagement-letter draft for attorney review.
    return {
      workspaceId,
      agentSlug: CONFLICT_SCREEN_AGENT_SLUG,
      kind: 'PROCESS_DOC_DRAFT',
      refTable: CONFLICT_SCREEN_REF_TABLE,
      refId: screen.matterId,
      status: 'PENDING',
      discipline,
      payload: encryptPayloadForWrite({
        screenStatus: screen.status,
        matterId: screen.matterId,
        prospectName: screen.prospectName,
        conflictCount: 0,
        kind: 'engagement-letter-draft',
        engagementLetter: engagementLetter
          ? {
              draftId: engagementLetter.draftId,
              body: engagementLetter.body,
            }
          : null,
        attorneyNotice: {
          subject: screen.attorneyNotice.subject,
          body: screen.attorneyNotice.body,
          confidence: screen.attorneyNotice.confidence,
        },
        noOutbound:
          'No email sent. Attorney reviews the draft engagement letter in /approvals, ' +
          'edits the {{operator: ...}} fields, and sends via their own system.',
      }),
    };
  }

  // FLAGGED / NEEDS-COUNSEL-REVIEW path → compliance flag row.
  return {
    workspaceId,
    agentSlug: CONFLICT_SCREEN_AGENT_SLUG,
    kind: 'COMPLIANCE_FLAG',
    refTable: CONFLICT_SCREEN_REF_TABLE,
    refId: screen.matterId,
    status: 'PENDING',
    discipline,
    payload: encryptPayloadForWrite({
      screenStatus: screen.status,
      matterId: screen.matterId,
      prospectName: screen.prospectName,
      conflictCount: screen.conflicts.length,
      kind: 'conflict-review-card',
      conflicts: screen.conflicts.map((c) => ({
        severity: c.severity,
        matchedAgainst: c.matchedAgainst,
        opposingPartyText: c.opposingPartyText ?? null,
        existingClientName: c.existingClient.clientName,
        existingClientStatus: c.existingClient.status,
        existingClientMatterLabel: c.existingClient.matterLabel ?? null,
        normalizedMatch: c.normalizedMatch,
      })),
      attorneyNotice: {
        subject: screen.attorneyNotice.subject,
        body: screen.attorneyNotice.body,
        confidence: screen.attorneyNotice.confidence,
      },
      mrpcNote:
        'MRPC 1.7 / 1.18: attorney must determine whether the firm may accept ' +
        'the representation, obtain informed consent, or decline. ' +
        'No legal conclusion is stated here — this is the deterministic match report.',
      noOutbound: 'No email sent. Attorney decides in /approvals.',
    }),
  };
}

// ── Recording test sink ──────────────────────────────────────────────────

/**
 * In-memory test implementation of `ConflictApprovalSink`. Captures
 * `record()` calls for assertion. The `calls` array is public so tests
 * can inspect workspaceId, screen, and engagementLetter without parsing
 * encrypted payloads.
 */
export class RecordingConflictApprovalSink implements ConflictApprovalSink {
  readonly name = 'recording' as const;
  readonly calls: Array<{
    workspaceId: string;
    screen: IntakeConflictScreenOutput;
    engagementLetter: EngagementLetterDraft | null;
  }> = [];
  private nextId = 1;

  async record(args: {
    workspaceId: string;
    screen: IntakeConflictScreenOutput;
    engagementLetter: EngagementLetterDraft | null;
  }): Promise<SkillResult<{ sinkId: string }>> {
    this.calls.push({ ...args });
    return skillOk({ sinkId: `test-sink-${this.nextId++}` });
  }
}
