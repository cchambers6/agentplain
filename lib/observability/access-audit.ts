/**
 * lib/observability/access-audit.ts
 *
 * Access-pattern audit log. Every Plaino chat session and every connector read
 * is recorded here so that:
 *   - abuse can be reviewed after the fact (which account, what pattern, when),
 *   - high-risk patterns surface to Conner's operator dashboard, and
 *   - the customer has a truthful, inspectable record of what was accessed.
 *
 * ‼️ What this log is NOT FOR: model training. These rows exist for security
 * review and customer transparency only. We do not fine-tune, we do not feed
 * customer chat or connector data into any training pipeline, and the rows here
 * are never exported to one. This is the in-code counterpart to the
 * no-training commitment stated on /privacy and enforced at the model seam in
 * `lib/llm/anthropic-provider.ts` (privacy-preserving `metadata.user_id`, no
 * customer-identifying payload sent to the provider).
 *
 * What we store is deliberately MINIMAL: a kind, a workspace id, an actor id,
 * coarse identifiers (thread id, connector provider + resource name), and any
 * redacted abuse signals raised during the access. We never store raw chat
 * bodies or connector record contents in this log.
 *
 * Persistence is via the existing `AuditLog` Prisma model (no migration): the
 * `action` column namespaces the kind (`access.plaino_chat`,
 * `access.connector_read`), and the redacted detail goes in `payload`. A
 * storage port (`AccessAuditSink`) keeps the roll-up + the call sites
 * unit-testable without a database.
 */

import type { AbuseCategory, AbuseSignal } from '@/lib/abuse/detector';

export type AccessKind = 'PLAINO_CHAT' | 'CONNECTOR_READ';

/** A single recorded access. Coarse + redacted by construction. */
export interface AccessAuditEntry {
  kind: AccessKind;
  workspaceId: string;
  /** Actor (member) id, or null for a system/cron-initiated read. */
  userId: string | null;
  /** Chat thread / session id (PLAINO_CHAT) — an opaque id, never the body. */
  sessionId?: string | null;
  /** Connector provider (CONNECTOR_READ), e.g. `gmail`, `quickbooks`. */
  provider?: string | null;
  /** Coarse resource label (CONNECTOR_READ), e.g. `inbox`, `invoices`.
   *  Never a record body. */
  resource?: string | null;
  /** Redacted abuse signals raised during this access, if any. */
  signals?: AbuseSignal[];
  occurredAt: string;
}

const ACTION_BY_KIND: Record<AccessKind, string> = {
  PLAINO_CHAT: 'access.plaino_chat',
  CONNECTOR_READ: 'access.connector_read',
};

/**
 * Storage seam. The production implementation writes an `AuditLog` row; tests
 * use the in-memory sink. (`feedback_runner_portability` — two implementations.)
 */
export interface AccessAuditSink {
  record(entry: AccessAuditEntry): Promise<void>;
}

// ── Recording ─────────────────────────────────────────────────────────────

export interface LogChatAccessArgs {
  workspaceId: string;
  userId: string | null;
  sessionId: string | null;
  signals?: AbuseSignal[];
  now: Date;
}

/** Record a Plaino chat access (one per inbound chat turn). */
export async function logChatAccess(
  sink: AccessAuditSink,
  args: LogChatAccessArgs,
): Promise<AccessAuditEntry> {
  const entry: AccessAuditEntry = {
    kind: 'PLAINO_CHAT',
    workspaceId: args.workspaceId,
    userId: args.userId,
    sessionId: args.sessionId,
    signals: args.signals?.length ? args.signals : undefined,
    occurredAt: args.now.toISOString(),
  };
  await sink.record(entry);
  return entry;
}

export interface LogConnectorReadArgs {
  workspaceId: string;
  userId: string | null;
  provider: string;
  resource: string;
  signals?: AbuseSignal[];
  now: Date;
}

/** Record a connector read (one per provider fetch). */
export async function logConnectorRead(
  sink: AccessAuditSink,
  args: LogConnectorReadArgs,
): Promise<AccessAuditEntry> {
  const entry: AccessAuditEntry = {
    kind: 'CONNECTOR_READ',
    workspaceId: args.workspaceId,
    userId: args.userId,
    provider: args.provider,
    resource: args.resource,
    signals: args.signals?.length ? args.signals : undefined,
    occurredAt: args.now.toISOString(),
  };
  await sink.record(entry);
  return entry;
}

/** Map an entry to the shape the `AuditLog` Prisma row expects. The Prisma
 *  sink uses this; exported so the mapping is testable in isolation. */
export function toAuditLogRow(entry: AccessAuditEntry): {
  actorUserId: string | null;
  workspaceId: string;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
} {
  return {
    actorUserId: entry.userId,
    workspaceId: entry.workspaceId,
    action: ACTION_BY_KIND[entry.kind],
    targetTable: entry.kind === 'CONNECTOR_READ' ? 'integration' : 'chat_thread',
    targetId: entry.sessionId ?? entry.provider ?? null,
    payload: {
      kind: entry.kind,
      provider: entry.provider ?? null,
      resource: entry.resource ?? null,
      // Only the redacted signal metadata — never raw content.
      signals: (entry.signals ?? []).map((s) => ({
        category: s.category,
        severity: s.severity,
        rule: s.rule,
        reason: s.reason,
        evidence: s.evidence,
      })),
      purpose: 'abuse-review-and-transparency',
      not_for_training: true,
    },
    occurredAt: new Date(entry.occurredAt),
  };
}

// ── High-risk roll-up for Conner's admin dashboard ────────────────────────

export interface WorkspaceRiskSummary {
  workspaceId: string;
  totalAccesses: number;
  flaggedAccesses: number;
  /** Count of signals by category across the window. */
  byCategory: Record<AbuseCategory, number>;
  worstSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  /** Distinct detector rule ids seen. */
  rules: string[];
  /** A coarse 0–100 risk score for ranking the dashboard. */
  riskScore: number;
}

const SEVERITY_WEIGHT = { LOW: 1, MEDIUM: 4, HIGH: 12 } as const;

/**
 * Aggregate a batch of access entries into per-workspace risk summaries,
 * ranked high-to-low, for the operator dashboard. Pure — the caller fetches the
 * window of entries and feeds them in.
 */
export function surfaceHighRiskPatterns(
  entries: AccessAuditEntry[],
): WorkspaceRiskSummary[] {
  const byWorkspace = new Map<string, AccessAuditEntry[]>();
  for (const e of entries) {
    const list = byWorkspace.get(e.workspaceId) ?? [];
    list.push(e);
    byWorkspace.set(e.workspaceId, list);
  }

  const summaries: WorkspaceRiskSummary[] = [];
  for (const [workspaceId, list] of byWorkspace) {
    const byCategory: Record<AbuseCategory, number> = {
      PROMPT_EXTRACTION: 0,
      SCRAPING: 0,
      ACCOUNT_CHURN: 0,
      PROBING: 0,
    };
    const rules = new Set<string>();
    let flagged = 0;
    let score = 0;
    let worst: 'LOW' | 'MEDIUM' | 'HIGH' | null = null;

    for (const e of list) {
      const sigs = e.signals ?? [];
      if (sigs.length > 0) flagged++;
      for (const s of sigs) {
        byCategory[s.category]++;
        rules.add(s.rule);
        score += SEVERITY_WEIGHT[s.severity];
        if (
          worst === null ||
          SEVERITY_WEIGHT[s.severity] > SEVERITY_WEIGHT[worst]
        ) {
          worst = s.severity;
        }
      }
    }

    summaries.push({
      workspaceId,
      totalAccesses: list.length,
      flaggedAccesses: flagged,
      byCategory,
      worstSeverity: worst,
      rules: [...rules],
      riskScore: Math.min(100, score),
    });
  }

  return summaries
    .filter((s) => s.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore);
}

/** In-memory sink for tests + local runs. */
export class InMemoryAccessAuditSink implements AccessAuditSink {
  readonly entries: AccessAuditEntry[] = [];
  async record(entry: AccessAuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}
