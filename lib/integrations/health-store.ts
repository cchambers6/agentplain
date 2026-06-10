/**
 * lib/integrations/health-store.ts
 *
 * Storage seam for IntegrationHealthCheck rows (pfd-2). Carving the DB access
 * behind a small interface (rather than calling `withSystemContext` inline in
 * the health sweep) follows the adapter pattern the codebase mandates
 * (feedback_runner_portability) AND makes the sweep's transition logic — the
 * load-bearing part: first-breakage vs recovery, notify-once, escalate-once —
 * testable offline with the in-memory store below. The Prisma store is the
 * production impl; both satisfy the two-implementation rule.
 */

import type {
  IntegrationProvider,
  IntegrationHealthStatus,
  IntegrationHealthCheckKind,
} from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';

/** The fields of an IntegrationHealthCheck the sweep reads + writes. */
export interface HealthRow {
  workspaceId: string;
  provider: IntegrationProvider;
  status: IntegrationHealthStatus;
  checkKind: IntegrationHealthCheckKind;
  lastError: string | null;
  lastCheckedAt: Date | null;
  unhealthySince: Date | null;
  notifiedAt: Date | null;
  escalatedAt: Date | null;
}

/** Fields a write can set (the sweep never sets id/timestamps). */
export type HealthWrite = Partial<Omit<HealthRow, 'workspaceId' | 'provider'>>;

export interface HealthStore {
  get(workspaceId: string, provider: IntegrationProvider): Promise<HealthRow | null>;
  /** Upsert the (workspace, provider) row, applying `write` over current state. */
  upsert(
    workspaceId: string,
    provider: IntegrationProvider,
    write: HealthWrite,
  ): Promise<void>;
}

export class PrismaHealthStore implements HealthStore {
  async get(
    workspaceId: string,
    provider: IntegrationProvider,
  ): Promise<HealthRow | null> {
    const row = await withSystemContext((tx) =>
      tx.integrationHealthCheck.findUnique({
        where: { workspaceId_provider: { workspaceId, provider } },
        select: {
          workspaceId: true,
          provider: true,
          status: true,
          checkKind: true,
          lastError: true,
          lastCheckedAt: true,
          unhealthySince: true,
          notifiedAt: true,
          escalatedAt: true,
        },
      }),
    );
    return row ?? null;
  }

  async upsert(
    workspaceId: string,
    provider: IntegrationProvider,
    write: HealthWrite,
  ): Promise<void> {
    await withSystemContext((tx) =>
      tx.integrationHealthCheck.upsert({
        where: { workspaceId_provider: { workspaceId, provider } },
        create: {
          workspaceId,
          provider,
          status: write.status ?? 'UNKNOWN',
          checkKind: write.checkKind ?? 'CREDENTIAL_ONLY',
          lastError: write.lastError ?? null,
          lastCheckedAt: write.lastCheckedAt ?? null,
          unhealthySince: write.unhealthySince ?? null,
          notifiedAt: write.notifiedAt ?? null,
          escalatedAt: write.escalatedAt ?? null,
        },
        update: write,
      }),
    );
  }
}

/** In-memory store for tests — no DB. Keyed by `${workspaceId}:${provider}`. */
export class InMemoryHealthStore implements HealthStore {
  private rows = new Map<string, HealthRow>();
  constructor(seed: HealthRow[] = []) {
    for (const r of seed) this.rows.set(this.key(r.workspaceId, r.provider), r);
  }
  private key(workspaceId: string, provider: IntegrationProvider): string {
    return `${workspaceId}:${provider}`;
  }
  async get(
    workspaceId: string,
    provider: IntegrationProvider,
  ): Promise<HealthRow | null> {
    return this.rows.get(this.key(workspaceId, provider)) ?? null;
  }
  async upsert(
    workspaceId: string,
    provider: IntegrationProvider,
    write: HealthWrite,
  ): Promise<void> {
    const k = this.key(workspaceId, provider);
    const existing = this.rows.get(k);
    if (existing) {
      this.rows.set(k, { ...existing, ...write });
    } else {
      this.rows.set(k, {
        workspaceId,
        provider,
        status: write.status ?? 'UNKNOWN',
        checkKind: write.checkKind ?? 'CREDENTIAL_ONLY',
        lastError: write.lastError ?? null,
        lastCheckedAt: write.lastCheckedAt ?? null,
        unhealthySince: write.unhealthySince ?? null,
        notifiedAt: write.notifiedAt ?? null,
        escalatedAt: write.escalatedAt ?? null,
      });
    }
  }
  /** Test helper — read current state without going through `get`. */
  peek(workspaceId: string, provider: IntegrationProvider): HealthRow | undefined {
    return this.rows.get(this.key(workspaceId, provider));
  }
}
