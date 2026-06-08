/**
 * lib/agents/sentinel/prisma-redline-store.ts
 *
 * Prisma-backed `RedlineStore` — the production implementation of the
 * counsel-feedback redline loop. Peer of `InMemoryRedlineStore` per the
 * two-implementation rule (`feedback_runner_portability.md`).
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Prisma call lives here, behind
 * the `RedlineStore` port. The rewrite engine + snapshot builder never import
 * Prisma directly.
 *
 * Per `feedback_cold_start_safe_agents.md`: every method reads durable state
 * fresh from the `CounselRedline` table — there is no in-process cache.
 *
 * RLS: the `CounselRedline` table is operator-only (matches LeadCapture /
 * compliance posture). Reads + writes run under the system-operator context.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { withRls, SYSTEM_OPERATOR_CONTEXT } from "../../db/rls";
import {
  normalizeClausePattern,
  reduceLearnedLanguage,
  type CounselRedline,
  type LearnedClauseLanguage,
  type ProposedCounselRedline,
  type RedlineStore,
} from "./redline-store";

export interface PrismaRedlineStoreOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaRedlineStore implements RedlineStore {
  readonly name = "prisma" as const;

  constructor(private readonly options: PrismaRedlineStoreOptions = {}) {}

  async record(redline: ProposedCounselRedline): Promise<CounselRedline> {
    const data: Prisma.CounselRedlineUncheckedCreateInput = {
      workspaceId: redline.workspaceId,
      verticalSlug: redline.verticalSlug,
      ruleId: redline.ruleId,
      clausePattern: normalizeClausePattern(redline.clausePattern),
      preferredLanguage: redline.preferredLanguage.trim(),
      rationale: redline.rationale ?? null,
      recordedBy: redline.recordedBy ?? null,
    };
    const created = await this.run((tx) =>
      tx.counselRedline.create({ data }),
    );
    return toDomain(created);
  }

  async listForRule(args: {
    workspaceId: string;
    verticalSlug: string;
    ruleId: string;
  }): Promise<CounselRedline[]> {
    const rows = await this.run((tx) =>
      tx.counselRedline.findMany({
        where: {
          workspaceId: args.workspaceId,
          verticalSlug: args.verticalSlug,
          ruleId: args.ruleId,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
    return rows.map(toDomain);
  }

  async learnedLanguageForRule(args: {
    workspaceId: string;
    verticalSlug: string;
    ruleId: string;
  }): Promise<LearnedClauseLanguage[]> {
    const rows = await this.listForRule(args);
    return reduceLearnedLanguage(rows);
  }

  private run<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (this.options.tx) return fn(this.options.tx);
    return withRls(
      SYSTEM_OPERATOR_CONTEXT,
      fn,
      this.options.client ? { client: this.options.client } : undefined,
    );
  }
}

interface CounselRedlineRow {
  id: string;
  workspaceId: string;
  verticalSlug: string;
  ruleId: string;
  clausePattern: string;
  preferredLanguage: string;
  rationale: string | null;
  recordedBy: string | null;
  createdAt: Date;
}

function toDomain(row: CounselRedlineRow): CounselRedline {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    verticalSlug: row.verticalSlug,
    ruleId: row.ruleId,
    clausePattern: row.clausePattern,
    preferredLanguage: row.preferredLanguage,
    rationale: row.rationale,
    recordedBy: row.recordedBy,
    createdAt: row.createdAt,
  };
}
