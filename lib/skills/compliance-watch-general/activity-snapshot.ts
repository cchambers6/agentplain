/**
 * lib/skills/compliance-watch-general/activity-snapshot.ts
 *
 * Reads the trailing 24h of WorkApprovalQueueItem rows, decrypts the
 * draft body text from the payload, runs each through:
 *   1. The vertical sentinel corpus (literal-match rules), and
 *   2. A built-in PII pattern set (SSN, credit-card, raw API-key,
 *      bare email when out-of-context).
 *
 * The output `ComplianceSnapshot` is what the skill grounds on. Per
 * the data-privacy stance, only short excerpts ride in the snapshot —
 * never the full body text.
 *
 * Per `feedback_cold_start_safe_agents.md`: durable read on every fire.
 * Per `project_no_outbound_architecture.md`: read + structured output only.
 */

import type { DbTransactionClient } from '@/lib/db';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import { loadCorpusFor, scanCorpus } from '@/lib/agents/sentinel';
import { stageRewrites } from '@/lib/agents/sentinel/rewrite';
import type { RedlineStore } from '@/lib/agents/sentinel/redline-store';
import { decryptPayloadForRead } from '@/lib/security/payload-crypto';
import { verticalSlugFromEnum } from '@/lib/auth/vertical-enum';
import type { LlmProvider } from '@/lib/llm/types';
import type {
  ComplianceMatch,
  ComplianceSnapshot,
} from './types';

export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

export interface BuildComplianceSnapshotInput {
  workspaceId: string;
  now?: Date;
  windowHours?: number;
  systemContext?: SystemContextRunner;
  /** Cap on matches to ride in the snapshot. Default 50. */
  maxMatches?: number;
  /**
   * LlmProvider for rewrite-and-stage. When provided, sentinel corpus
   * matches carry a `suggestedReplacement` grounded in the rule that
   * fired (pride-audit theme #9). Omit for the deterministic-fallback
   * path — matches still carry a no-LLM compliant rewrite. PII matches
   * never carry a rewrite (no corpus rule to ground one).
   */
  llm?: LlmProvider;
  /**
   * Durable counsel-redline store for the learned-language loop
   * (pride-audit theme #14). When a (rule, clause) bucket has cleared the
   * threshold, the rewrite uses counsel's converged language verbatim.
   * Omit to skip the learned path (rewrites still generate via LLM/fallback).
   */
  redlineStore?: RedlineStore;
}

const MAX_EXCERPT_CHARS = 120;

/** Built-in PII patterns. Each pattern returns a severity + label. */
const PII_PATTERNS: Array<{
  pattern: RegExp;
  ruleId: string;
  label: string;
  severity: ComplianceMatch['ruleSeverity'];
}> = [
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    ruleId: 'pii-ssn-dash',
    label: 'PII — Social Security Number pattern',
    severity: 'HIGH',
  },
  {
    pattern: /\b(?:\d[ -]?){13,16}\b/g,
    ruleId: 'pii-card-number',
    label: 'PII — possible card-number pattern',
    severity: 'HIGH',
  },
  {
    // Anthropic / OpenAI / generic API-key-like blobs (rough heuristic).
    pattern: /\b(?:sk-[A-Za-z0-9_-]{16,}|pk-[A-Za-z0-9_-]{16,})\b/g,
    ruleId: 'pii-api-key',
    label: 'PII — possible API key in draft',
    severity: 'BLOCKER',
  },
];

export async function buildComplianceSnapshot(
  input: BuildComplianceSnapshotInput,
): Promise<ComplianceSnapshot> {
  const now = input.now ?? new Date();
  const windowHours = input.windowHours ?? 24;
  const windowFrom = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const systemContext = input.systemContext ?? defaultWithSystemContext;
  const maxMatches = input.maxMatches ?? 50;

  return systemContext(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true, name: true, vertical: true },
    });
    if (!workspace) {
      throw new Error(
        `compliance-watch: workspace ${input.workspaceId} not found`,
      );
    }
    const verticalSlug = verticalSlugFromEnum(workspace.vertical);
    const corpus = loadCorpusFor(verticalSlug);

    const approvals = await tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: input.workspaceId,
        proposedAt: { gte: windowFrom },
      },
      select: {
        id: true,
        kind: true,
        payload: true,
        proposedAt: true,
      },
      orderBy: { proposedAt: 'desc' },
      take: 250,
    });

    const matches: ComplianceMatch[] = [];
    for (const a of approvals) {
      if (matches.length >= maxMatches) break;
      const { subject, body } = extractDraftFields(a.payload);
      if (!subject && !body) continue;
      const subjectStr = subject ?? '';
      const bodyStr = body ?? '';

      // Sentinel literal-match rules — if the vertical has a corpus.
      if (corpus) {
        const scan = scanCorpus({ subject: subjectStr, body: bodyStr, corpus });
        // Rewrite-and-stage: upgrade every flag into a one-tap fix carrying
        // the compliant replacement sentence + rule citation. Degrades to
        // the deterministic fallback when no LLM is wired; gates per vertical.
        const staged = await stageRewrites({
          verticalSlug,
          flags: scan.flags,
          corpus,
          workspaceId: input.workspaceId,
          llm: input.llm,
          redlineStore: input.redlineStore,
        });
        for (const s of staged) {
          if (matches.length >= maxMatches) break;
          matches.push({
            approvalItemId: a.id,
            approvalKind: a.kind,
            ruleId: s.flag.ruleId,
            ruleSeverity: 'MEDIUM',
            ruleLabel: s.flag.ruleTitle,
            excerpt: trimExcerpt(s.flag.matchedText),
            suggestedReplacement: s.gated ? null : s.suggestedReplacement,
            rewriteSource: s.source,
            rewriteCitation: s.ruleCitation.source,
            rewriteGateNote: s.gated ? (s.gateNote ?? null) : null,
          });
        }
      }

      // Built-in PII patterns (regardless of vertical).
      for (const p of PII_PATTERNS) {
        if (matches.length >= maxMatches) break;
        const reSubject = new RegExp(p.pattern.source, p.pattern.flags);
        const reBody = new RegExp(p.pattern.source, p.pattern.flags);
        const subMatch = reSubject.exec(subjectStr);
        const bodMatch = reBody.exec(bodyStr);
        const matched = subMatch?.[0] ?? bodMatch?.[0];
        if (matched) {
          matches.push({
            approvalItemId: a.id,
            approvalKind: a.kind,
            ruleId: p.ruleId,
            ruleSeverity: p.severity,
            ruleLabel: p.label,
            excerpt: trimExcerpt(matched),
          });
        }
      }
    }

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      verticalSlug,
      windowFrom: windowFrom.toISOString(),
      windowTo: now.toISOString(),
      matches,
      approvalsScanned: approvals.length,
    };
  });
}

function extractDraftFields(
  payloadJson: unknown,
): { subject: string | null; body: string | null } {
  if (!payloadJson || typeof payloadJson !== 'object') {
    return { subject: null, body: null };
  }
  let plaintext: Record<string, unknown> | null = null;
  try {
    plaintext = decryptPayloadForRead(payloadJson) as Record<string, unknown>;
  } catch {
    // Unencrypted legacy payload — read as-is.
    plaintext = payloadJson as Record<string, unknown>;
  }
  if (!plaintext || typeof plaintext !== 'object') {
    return { subject: null, body: null };
  }
  const subject =
    typeof plaintext.subject === 'string'
      ? plaintext.subject
      : typeof plaintext.draftSubject === 'string'
        ? plaintext.draftSubject
        : null;
  const body =
    typeof plaintext.body === 'string'
      ? plaintext.body
      : typeof plaintext.draftBody === 'string'
        ? plaintext.draftBody
        : null;
  return { subject, body };
}

function trimExcerpt(value: string): string {
  if (value.length <= MAX_EXCERPT_CHARS) return value;
  return value.slice(0, MAX_EXCERPT_CHARS - 1) + '…';
}

export const __testing = {
  extractDraftFields,
  trimExcerpt,
  PII_PATTERNS,
};
