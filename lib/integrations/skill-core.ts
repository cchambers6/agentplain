/**
 * lib/integrations/skill-core.ts
 *
 * The connector-skill discipline core — written once, reused by every
 * connector that gets converted to the skill shape.
 *
 * The rule is transplanted from Chiron's Integrator
 * (`chiron/lib/agents/integrator/schema.ts`): NOTHING CROSSES THE BOUNDARY
 * UNTIL IT PARSES. There, a model's JSON is never persisted until a zod schema
 * accepts it. Here, the boundary is a vendor API instead of a model: a
 * connector skill refuses to touch the vendor until the caller's input parses,
 * and refuses to hand a value back to the caller until the vendor's response
 * parses. TypeScript interfaces alone cannot do this — they vanish at runtime,
 * and the values at both ends of a connector (agent-authored arguments, vendor
 * JSON) are exactly the values TypeScript never saw.
 *
 * Four requirements define the discipline; this file supplies the plumbing for
 * the first two and the vocabulary for the last two:
 *   (a) an explicit INPUT contract, as a runtime schema;
 *   (b) an explicit OUTPUT contract, as a runtime schema;
 *   (c) a validation test proving known input → known output;
 *   (d) idempotency asserted against what the code actually does.
 *
 * Per `project_no_outbound_architecture.md`: a skill built on this core never
 * gains a write path of its own — it only ever calls an approval-gated
 * connector server, and `APPROVAL_REQUIRED` survives the mapping below as its
 * own code so callers can branch on "a human still has to say yes".
 */

import type { ZodType } from 'zod';
import type { McpError } from '@/lib/integrations/mcp-core';

// ── Result shape ────────────────────────────────────────────────────────────

/**
 * Why a connector skill refused or failed.
 *
 * `INVALID_INPUT`       — the caller's arguments did not satisfy the input
 *                         contract. The vendor was never touched.
 * `APPROVAL_REQUIRED`   — the connector's approval gate has no matching grant.
 *                         Passed through (not folded into UPSTREAM_ERROR)
 *                         because it is the one error a caller can resolve by
 *                         asking a human, and the /approvals surface keys off
 *                         it.
 * `UPSTREAM_ERROR`      — the vendor call itself failed; `reference` carries
 *                         the underlying `McpErrorCode`.
 * `CONTRACT_VIOLATION`  — the vendor answered, but its payload did not satisfy
 *                         the output contract. The unparsed value is dropped:
 *                         it never reaches the caller.
 */
export type ConnectorSkillErrorCode =
  | 'INVALID_INPUT'
  | 'APPROVAL_REQUIRED'
  | 'UPSTREAM_ERROR'
  | 'CONTRACT_VIOLATION';

export interface ConnectorSkillError {
  code: ConnectorSkillErrorCode;
  message: string;
  /** Upstream `McpErrorCode` (or approval token) when one is relevant. */
  reference?: string;
}

export type ConnectorSkillResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ConnectorSkillError };

export function connectorSkillOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function connectorSkillError(
  code: ConnectorSkillErrorCode,
  message: string,
  reference?: string,
): { ok: false; error: ConnectorSkillError } {
  return { ok: false, error: { code, message, reference } };
}

// ── Contract parsing ────────────────────────────────────────────────────────

/** Which side of the boundary a parse guards — it picks the error code. */
export type ContractSide = 'input' | 'output';

/**
 * Parse `value` against `schema`.
 *
 * An input failure is the caller's fault → `INVALID_INPUT`, and the vendor must
 * not be called. An output failure is the vendor's (or our adapter's) fault →
 * `CONTRACT_VIOLATION`, and the malformed value must not be returned.
 *
 * The message summarizes zod issues as `path: code` pairs ONLY. Received values
 * are deliberately excluded: connector payloads carry customer PII and vendor
 * tokens, and this message is logged.
 */
export function parseContract<T>(
  schema: ZodType<T>,
  value: unknown,
  side: ContractSide,
): ConnectorSkillResult<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return connectorSkillOk(parsed.data);

  const summary = summarizeIssues(
    parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      code: issue.code,
    })),
  );
  return side === 'input'
    ? connectorSkillError('INVALID_INPUT', `Input contract rejected: ${summary}`)
    : connectorSkillError('CONTRACT_VIOLATION', `Output contract rejected: ${summary}`);
}

/** `path: code` pairs, capped so a large payload cannot flood a log line. */
function summarizeIssues(issues: Array<{ path: string; code: string }>): string {
  const MAX = 8;
  const shown = issues
    .slice(0, MAX)
    .map((issue) => `${issue.path === '' ? '(root)' : issue.path}: ${issue.code}`)
    .join('; ');
  const extra = issues.length > MAX ? ` (+${issues.length - MAX} more)` : '';
  return `${shown}${extra}`;
}

// ── Upstream error mapping ──────────────────────────────────────────────────

/**
 * Map a connector-layer `McpError` onto the skill's error vocabulary.
 *
 * `APPROVAL_REQUIRED` keeps its identity — the gate is load-bearing, and a
 * caller must be able to distinguish "a human has to approve this" from "the
 * vendor is down". Everything else becomes `UPSTREAM_ERROR` with the original
 * code preserved in `reference`, so no diagnostic detail is lost.
 */
export function fromMcpError(err: McpError): ConnectorSkillError {
  if (err.code === 'APPROVAL_REQUIRED') {
    return { code: 'APPROVAL_REQUIRED', message: err.message, reference: err.reference };
  }
  return { code: 'UPSTREAM_ERROR', message: err.message, reference: err.code };
}
