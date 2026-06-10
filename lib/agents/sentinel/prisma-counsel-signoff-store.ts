/**
 * lib/agents/sentinel/prisma-counsel-signoff-store.ts
 *
 * Prisma-backed `CounselSignoffStore` — production impl, peer of
 * `InMemoryCounselSignoffStore`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Prisma calls live here, behind
 * the `CounselSignoffStore` port. The gate (`counsel-signoff.ts`) and the
 * rewrite engine never import Prisma directly.
 *
 * Per `feedback_cold_start_safe_agents.md`: `get`/`list` read durable state
 * fresh — no in-process cache. The gate calls `get` on every rewrite fire.
 *
 * RLS: the `ComplianceCounselSignoff` table is operator-only (matches
 * CounselRedline / LeadCapture). Reads + writes run under the
 * system-operator context.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { withRls, SYSTEM_OPERATOR_CONTEXT } from "../../db/rls";
import type {
  CounselSignoff,
  CounselSignoffStore,
  RecordSignoffInput,
} from "./counsel-signoff";

export interface PrismaCounselSignoffStoreOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

interface SignoffRow {
  verticalSlug: string;
  signedAt: Date | null;
  revokedAt: Date | null;
  artifactRef: string | null;
  signedByEmail: string | null;
  signedByUserId: string | null;
  note: string | null;
  updatedAt: Date;
}

function toDomain(row: SignoffRow): CounselSignoff {
  return {
    verticalSlug: row.verticalSlug,
    signedAt: row.signedAt,
    revokedAt: row.revokedAt,
    artifactRef: row.artifactRef,
    signedByEmail: row.signedByEmail,
    signedByUserId: row.signedByUserId,
    note: row.note,
    updatedAt: row.updatedAt,
  };
}

export class PrismaCounselSignoffStore implements CounselSignoffStore {
  readonly name = "prisma" as const;

  constructor(
    private readonly options: PrismaCounselSignoffStoreOptions = {},
  ) {}

  async get(verticalSlug: string): Promise<CounselSignoff | null> {
    const row = await this.run((tx) =>
      tx.complianceCounselSignoff.findUnique({
        where: { verticalSlug },
      }),
    );
    return row ? toDomain(row) : null;
  }

  async list(): Promise<CounselSignoff[]> {
    const rows = await this.run((tx) =>
      tx.complianceCounselSignoff.findMany({
        orderBy: { verticalSlug: "asc" },
      }),
    );
    return rows.map(toDomain);
  }

  async record(input: RecordSignoffInput): Promise<CounselSignoff> {
    const data = {
      signedAt: input.signedAt,
      revokedAt: null,
      artifactRef: input.artifactRef ?? null,
      signedByEmail: input.signedByEmail ?? null,
      signedByUserId: input.signedByUserId ?? null,
      note: input.note ?? null,
    };
    const row = await this.run((tx) =>
      tx.complianceCounselSignoff.upsert({
        where: { verticalSlug: input.verticalSlug },
        create: { verticalSlug: input.verticalSlug, ...data },
        update: data,
      }),
    );
    return toDomain(row);
  }

  async revoke(
    verticalSlug: string,
    actor: { email?: string | null; userId?: string | null },
  ): Promise<CounselSignoff | null> {
    const existing = await this.get(verticalSlug);
    if (!existing) return null;
    const row = await this.run((tx) =>
      tx.complianceCounselSignoff.update({
        where: { verticalSlug },
        data: {
          revokedAt: new Date(),
          // record who revoked, for the audit trail on the row
          signedByEmail: actor.email ?? existing.signedByEmail,
          signedByUserId: actor.userId ?? existing.signedByUserId,
        },
      }),
    );
    return toDomain(row);
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
