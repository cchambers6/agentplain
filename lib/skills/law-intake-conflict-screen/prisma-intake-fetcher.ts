/**
 * lib/skills/law-intake-conflict-screen/prisma-intake-fetcher.ts
 *
 * Production source of NEW-MATTER INTAKES for the conflict-screen sweep.
 *
 * DESIGN RATIONALE — why KnowledgeDocument (mirrors the ledger fetcher)?
 *
 *   There is no `Matter` / `Intake` table in the Prisma schema — matter
 *   intake lives in the practice-management MCPs (Clio / MyCase /
 *   PracticePanther) that have not yet landed. Today the strongest durable
 *   source is the customer-file ingestion pipeline, which writes
 *   `KnowledgeDocument` rows (contextKind=CUSTOMER). A new-matter intake
 *   form (or a future Clio MCP) writes one such row carrying the structured
 *   intake in `metadata.intake`:
 *
 *     metadata = {
 *       docType: 'intake',
 *       intake: {
 *         matterId, prospectName, prospectEmail,
 *         opposingParties: string[],
 *         matterDescription,
 *         responsibleAttorney: { name, email },
 *       }
 *     }
 *
 *   This is honest because it is the SAME substrate the ledger fetcher
 *   already reads; when the Clio MCP lands, an MCP-backed intake fetcher
 *   becomes the primary impl and this stays as the fallback for firms that
 *   captured intakes via the file pipeline.
 *
 * DEDUPE — only UN-SCREENED intakes fire.
 *
 *   The conflict-screen sink writes one WorkApprovalQueueItem per matter
 *   (refTable=`LawMatter`, refId=matterId). This fetcher excludes any
 *   intake whose matterId already has such a row, so a daily sweep screens
 *   each new matter exactly once — never re-queues a verdict the attorney
 *   has already seen.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Reads DB fresh on
 * every call; holds no in-memory cache.
 *
 * Per `feedback_runner_portability.md` two-implementation rule: this is the
 * Prisma/production impl; `JsonIntakeFetcher` (below) is the test/fixture
 * impl seeded with an in-memory list.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { skillError, skillOk, type SkillResult } from '../types';
import { CONFLICT_SCREEN_REF_TABLE } from './prisma-approval-sink';
import type { ProspectiveIntake } from './types';

/** Port the sweep reads new-matter intakes from. */
export interface IntakeFetcher {
  readonly name: string;
  /** Return new-matter intakes that have NOT yet been conflict-screened. */
  fetchPendingIntakes(args: {
    workspaceId: string;
  }): Promise<SkillResult<ProspectiveIntake[]>>;
}

export interface PrismaIntakeFetcherOptions {
  client?: PrismaClient;
  /** Bypass RLS — tests inject a stub `tx`. */
  tx?: Prisma.TransactionClient;
  /** Max intake docs to scan per workspace. Default 200. */
  maxRows?: number;
}

const DEFAULT_MAX_ROWS = 200;

export class PrismaIntakeFetcher implements IntakeFetcher {
  readonly name = 'prisma' as const;

  constructor(private readonly options: PrismaIntakeFetcherOptions = {}) {}

  async fetchPendingIntakes(args: {
    workspaceId: string;
  }): Promise<SkillResult<ProspectiveIntake[]>> {
    const maxRows = this.options.maxRows ?? DEFAULT_MAX_ROWS;
    try {
      if (this.options.tx) {
        const intakes = await this.query(this.options.tx, args.workspaceId, maxRows);
        return skillOk(intakes);
      }
      const ctx = {
        userId: null,
        workspaceId: args.workspaceId,
        isOperator: true,
      } as const;
      const intakes = await withRls(
        ctx,
        async (tx) => this.query(tx, args.workspaceId, maxRows),
        this.options.client ? { client: this.options.client } : undefined,
      );
      return skillOk(intakes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError(
        'UNKNOWN',
        `PrismaIntakeFetcher failed for workspace ${args.workspaceId}: ${message}`,
      );
    }
  }

  private async query(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    maxRows: number,
  ): Promise<ProspectiveIntake[]> {
    const rows = await tx.knowledgeDocument.findMany({
      where: { workspaceId, contextKind: 'CUSTOMER' },
      select: { metadata: true },
      orderBy: { updatedAt: 'desc' },
      take: maxRows,
    });

    const intakes: ProspectiveIntake[] = [];
    for (const row of rows) {
      const intake = parseIntake(row.metadata);
      if (intake) intakes.push(intake);
    }
    if (intakes.length === 0) return [];

    // Dedupe: drop any matter already screened (has a LawMatter approval row).
    const screened = await tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId,
        refTable: CONFLICT_SCREEN_REF_TABLE,
        refId: { in: intakes.map((i) => i.matterId) },
      },
      select: { refId: true },
    });
    const screenedIds = new Set(screened.map((r) => r.refId));
    return intakes.filter((i) => !screenedIds.has(i.matterId));
  }
}

/**
 * Parse a KnowledgeDocument `metadata` blob into a ProspectiveIntake.
 * Returns null when the row is not an intake or is missing required fields
 * — we never fabricate an intake from a non-intake document.
 */
export function parseIntake(metadata: Prisma.JsonValue): ProspectiveIntake | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const meta = metadata as Record<string, unknown>;
  if (meta.docType !== 'intake') return null;
  const raw = meta.intake;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const i = raw as Record<string, unknown>;

  const matterId = asNonEmptyString(i.matterId);
  const prospectName = asNonEmptyString(i.prospectName);
  const prospectEmail = asNonEmptyString(i.prospectEmail);
  const attorney =
    i.responsibleAttorney && typeof i.responsibleAttorney === 'object'
      ? (i.responsibleAttorney as Record<string, unknown>)
      : null;
  const attorneyName = attorney ? asNonEmptyString(attorney.name) : null;
  const attorneyEmail = attorney ? asNonEmptyString(attorney.email) : null;

  if (!matterId || !prospectName || !prospectEmail || !attorneyName || !attorneyEmail) {
    return null;
  }

  const opposingParties = Array.isArray(i.opposingParties)
    ? i.opposingParties.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : [];

  return {
    matterId,
    prospectName,
    prospectEmail,
    opposingParties,
    matterDescription: asNonEmptyString(i.matterDescription) ?? '',
    responsibleAttorney: { name: attorneyName, email: attorneyEmail },
  };
}

function asNonEmptyString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/** Test/fixture impl seeded with an in-memory intake list. */
export class JsonIntakeFetcher implements IntakeFetcher {
  readonly name = 'json' as const;
  constructor(
    private readonly seed: { workspaceId: string; intakes: ProspectiveIntake[] },
  ) {}

  async fetchPendingIntakes(args: {
    workspaceId: string;
  }): Promise<SkillResult<ProspectiveIntake[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonIntakeFetcher seeded for ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    return skillOk(this.seed.intakes);
  }
}
