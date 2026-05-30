/**
 * lib/skills/approval-threshold.ts
 *
 * Wave-1 audit fix §9 #2 — make WorkThresholdConfig actually gate
 * approval execution. The work-thresholds settings page persisted
 * severity gates; zero code read them. Every queued item landed
 * PENDING regardless of the customer's stated bar. That made the
 * "Decide what needs your eyes" promise theatrical.
 *
 * This module is the reader. It runs at each approval-queue write
 * site, looks up the workspace's `WorkThresholdConfig` for the kind
 * being written, and decides whether the row should land PENDING
 * (manual review required — the safe default) or AUTO_APPROVED
 * (workspace explicitly opted in, the row meets the bar).
 *
 * SAFE DEFAULT: when no threshold row exists OR the relevant field
 * (autoApproveWhen for drafts, requiresApprovalAboveSeverity for
 * compliance flags) is null/empty, the gate returns PENDING. Opt-in
 * means an explicit write — the customer says "yes, auto-approve
 * these" before anything flips.
 *
 * Per `project_no_outbound_architecture.md`: AUTO_APPROVED still does
 * NOT send. The customer's existing system (email, calendar, CRM)
 * performs any downstream action; agentplain's contract is draft-only.
 * AUTO_APPROVED means "the workspace has pre-blessed this draft for
 * its downstream pickup," not "agentplain just sent it."
 */

import type { Prisma } from '@prisma/client';
import type {
  ComplianceSeverity,
  WorkApprovalKind,
  WorkApprovalStatus,
} from '@prisma/client';

/** Auto-approve config persisted in `WorkThresholdConfig.autoApproveWhen`.
 *  Optional fields are AND-ed: every present field must hold for the
 *  row to flip to AUTO_APPROVED. */
export interface AutoApproveWhenConfig {
  /** Required minimum confidence (0–1). Row's `confidence` must meet
   *  this OR auto-approve does NOT fire (we default to safe-stay).
   *  Omit = no confidence gate; any confidence passes if other gates do. */
  minConfidence?: number;
  /** Severity ceiling — compliance-flag rows with severity STRICTLY
   *  above this stay PENDING regardless of other gates. */
  maxSeverity?: ComplianceSeverity;
}

const SEVERITY_RANK: Record<ComplianceSeverity, number> = {
  INFO: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  BLOCKER: 5,
};

export interface ApplyApprovalThresholdArgs {
  workspaceId: string;
  kind: WorkApprovalKind;
  /** Draft confidence on the producing skill output. Omit for kinds
   *  that have no native confidence (admin codes, etc.). */
  confidence?: number;
  /** Compliance severity on a flag row. Omit for non-compliance kinds. */
  severity?: ComplianceSeverity;
  /** Active transaction client — the reader uses the caller's existing
   *  RLS-scoped transaction so the read flows through workspace
   *  isolation. */
  tx: Prisma.TransactionClient;
}

export interface ApprovalThresholdDecision {
  status: WorkApprovalStatus;
  decidedAt: Date | null;
  /** AUTO_APPROVED rows carry a system-actor null userId so the audit
   *  trail records "no human user decided this." */
  decidedByUserId: string | null;
  decisionReason: string | null;
}

/** PENDING decision — the safe default. Exposed for callers that want
 *  to spread this into an unchecked-create payload without re-typing. */
export const PENDING_DECISION: ApprovalThresholdDecision = {
  status: 'PENDING',
  decidedAt: null,
  decidedByUserId: null,
  decisionReason: null,
};

/**
 * Decide PENDING vs AUTO_APPROVED based on the workspace's threshold
 * config. Reads `WorkThresholdConfig.{kind}` for the workspace within
 * the caller's transaction. NEVER throws — a missing row, a malformed
 * `autoApproveWhen` JSON, or a read error all resolve to PENDING (safe
 * default).
 */
export async function applyApprovalThreshold(
  args: ApplyApprovalThresholdArgs,
): Promise<ApprovalThresholdDecision> {
  let config: {
    requiresApprovalAboveSeverity: ComplianceSeverity | null;
    autoApproveWhen: Prisma.JsonValue | null;
  } | null = null;
  try {
    config = await args.tx.workThresholdConfig.findUnique({
      where: {
        workspaceId_kind: { workspaceId: args.workspaceId, kind: args.kind },
      },
      select: {
        requiresApprovalAboveSeverity: true,
        autoApproveWhen: true,
      },
    });
  } catch {
    // Read failure → safe default. The /approvals page renders PENDING
    // and the operator handles it; nothing fake auto-approves on a
    // transient DB hiccup.
    return PENDING_DECISION;
  }
  if (!config) return PENDING_DECISION;

  if (args.kind === 'COMPLIANCE_FLAG') {
    return decideForComplianceFlag({
      severity: args.severity,
      requiresApprovalAboveSeverity: config.requiresApprovalAboveSeverity,
    });
  }
  return decideForDraft({
    confidence: args.confidence,
    severity: args.severity,
    autoApproveWhen: config.autoApproveWhen,
  });
}

function decideForComplianceFlag(args: {
  severity: ComplianceSeverity | undefined;
  requiresApprovalAboveSeverity: ComplianceSeverity | null;
}): ApprovalThresholdDecision {
  // No threshold set → safe default. The customer hasn't opted in.
  if (!args.requiresApprovalAboveSeverity) return PENDING_DECISION;
  // No severity on the row → can't decide; safe default.
  if (!args.severity) return PENDING_DECISION;
  // "approve when severity >= X" means: rows at-or-above X stay
  // PENDING; rows BELOW X auto-approve.
  const thresholdRank = SEVERITY_RANK[args.requiresApprovalAboveSeverity];
  const rowRank = SEVERITY_RANK[args.severity];
  if (rowRank < thresholdRank) {
    return autoApprovedDecision(
      `severity ${args.severity} below workspace threshold ${args.requiresApprovalAboveSeverity}`,
    );
  }
  return PENDING_DECISION;
}

function decideForDraft(args: {
  confidence: number | undefined;
  severity: ComplianceSeverity | undefined;
  autoApproveWhen: Prisma.JsonValue | null;
}): ApprovalThresholdDecision {
  const parsed = parseAutoApproveWhen(args.autoApproveWhen);
  if (!parsed) return PENDING_DECISION;
  // Confidence gate (when configured AND a confidence is present).
  if (typeof parsed.minConfidence === 'number') {
    if (typeof args.confidence !== 'number') return PENDING_DECISION;
    if (args.confidence < parsed.minConfidence) return PENDING_DECISION;
  }
  // Severity ceiling (rare for draft kinds, but if a kind ever carries
  // a severity we honor the cap).
  if (parsed.maxSeverity && args.severity) {
    if (SEVERITY_RANK[args.severity] > SEVERITY_RANK[parsed.maxSeverity]) {
      return PENDING_DECISION;
    }
  }
  return autoApprovedDecision(
    typeof parsed.minConfidence === 'number'
      ? `confidence ${
          typeof args.confidence === 'number'
            ? args.confidence.toFixed(2)
            : '?'
        } meets workspace threshold ${parsed.minConfidence.toFixed(2)}`
      : 'workspace pre-approved this kind',
  );
}

function autoApprovedDecision(reason: string): ApprovalThresholdDecision {
  return {
    status: 'AUTO_APPROVED',
    decidedAt: new Date(),
    decidedByUserId: null,
    decisionReason: `auto-approved by workspace threshold config — ${reason}`,
  };
}

/**
 * Parse `WorkThresholdConfig.autoApproveWhen` into a typed config.
 * Returns null when the JSON is missing, malformed, or fails shape
 * validation — caller then treats this as "no opt-in" and stays
 * PENDING (safe default).
 *
 * Exposed for tests so they can pin the parsing contract.
 */
export function parseAutoApproveWhen(
  raw: Prisma.JsonValue | null,
): AutoApproveWhenConfig | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: AutoApproveWhenConfig = {};
  const obj = raw as Record<string, unknown>;
  const minConfidence = obj.minConfidence;
  if (typeof minConfidence === 'number') {
    if (Number.isFinite(minConfidence) && minConfidence >= 0 && minConfidence <= 1) {
      out.minConfidence = minConfidence;
    } else {
      // Malformed numeric → reject the whole config to avoid surprise
      // auto-approve from a typo.
      return null;
    }
  }
  const maxSeverity = obj.maxSeverity;
  if (typeof maxSeverity === 'string') {
    if (
      maxSeverity === 'INFO' ||
      maxSeverity === 'LOW' ||
      maxSeverity === 'MEDIUM' ||
      maxSeverity === 'HIGH' ||
      maxSeverity === 'BLOCKER'
    ) {
      out.maxSeverity = maxSeverity;
    } else {
      return null;
    }
  }
  if (out.minConfidence === undefined && out.maxSeverity === undefined) {
    // An empty object is not a meaningful opt-in. Treat as PENDING.
    return null;
  }
  return out;
}
