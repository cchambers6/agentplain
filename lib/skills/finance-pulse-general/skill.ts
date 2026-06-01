/**
 * lib/skills/finance-pulse-general/skill.ts
 *
 * Pure orchestration: compose the weekly finance pulse from a snapshot
 * and persist via the injected sink. Mirrors the structure of
 * `analytics-weekly-pulse-general/skill.ts` so the two cousins read
 * identically — counts in, calm prose out, templated honesty when the
 * LLM is silent or the snapshot has nothing to lean on.
 *
 * Per `project_no_outbound_architecture.md`: the skill DRAFTS one row.
 * The operator reviews on /approvals — agentplain sends nothing.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. The caller passes
 * a freshly-built snapshot on every fire.
 *
 * Per the honesty bar (`feedback_no_quick_fixes.md` + `feedback_no_guesses_no_estimates.md`):
 *   - Quiet workspaces (no internal finance activity AND no QB
 *     connection) skip the LLM and emit a templated "quiet week +
 *     connect QuickBooks for a richer pulse" body.
 *   - LLM failures fall back to a templated body grounded on the
 *     same snapshot counts so the row still lands honestly.
 */

import { randomUUID } from 'node:crypto';
import { getLlmProvider } from '@/lib/llm';
import { MODEL_OPUS } from '@/lib/llm/model-tiers';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  FinancePulseProposal,
  FinancePulseSkillInput,
  FinancePulseSkillOutput,
  FinancePulseSnapshot,
} from './types';

const NO_OUTBOUND_NOTE =
  'No emails or messages sent. The finance pulse is a single draft row in /approvals ' +
  'for the operator to read. Per project_no_outbound_architecture.md.';

const SYSTEM_PROMPT = [
  'You are Plaino, the workspace\'s named service partner at agentplain.',
  'Write ONE weekly finance pulse — a calm, specific paragraph (3-5 sentences) ',
  'on how the workspace\'s finance discipline did this week. Tone: calm, ',
  'service-partner, never chirpy or promotional. No emoji. No headers. No ',
  'bullet points more than 2 deep.',
  '',
  'Hard rules:',
  '- Ground EVERY claim in the snapshot below. Do NOT invent counts.',
  '- When QuickBooks is connected, reference the AR aging + open-invoice ',
  '  counts specifically. When QuickBooks is NOT connected, say so plainly ',
  '  (one short sentence) and ground the pulse on the internal draft + ',
  '  approval counts only. Do NOT estimate AR / dollars when QB is dark.',
  '- If a vertical-specific skill (invoice-chasing-realestate or ',
  '  month-end-close-cpa) is the workspace\'s natural fit and produced ',
  '  zero drafts this week, name that gap as a candidate to lean on next ',
  '  week.',
  '- Close with one short concrete suggestion for next week, not promises.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "body": string,                  // the pulse paragraph(s) themselves',
  '  "recommendations": string[]      // 0-3 short fragment bullets the operator could act on this week',
  '}',
].join('\n');

export async function runSkill(
  input: FinancePulseSkillInput,
): Promise<SkillResult<FinancePulseSkillOutput>> {
  const now = input.now ?? new Date();
  const llm = input.llm ?? getLlmProvider();
  const snapshot = input.snapshot;
  const pulseDepth = input.pulseDepth ?? 'summary';

  const forWeekStarting = isoMonday(now);

  const isQuiet =
    snapshot.internal.invoiceChaseDrafts === 0 &&
    snapshot.internal.monthEndCloseDrafts === 0 &&
    snapshot.internal.financeApprovalsDecided === 0 &&
    snapshot.internal.financeApprovalsPending === 0 &&
    snapshot.quickbooks.connected === false;

  if (isQuiet) {
    const proposal = buildQuietProposal({ snapshot, forWeekStarting });
    return finalize({ input, proposal });
  }

  const userPrompt = renderUserPrompt({
    snapshot,
    feedbackRulesBlock: (input.feedbackRulesBlock ?? '').trim(),
  });
  const completion = await llm.complete({
    system: SYSTEM_PROMPT,
    model: MODEL_OPUS,
    cacheSystem: true,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: pulseDepth === 'detailed' ? 900 : 600,
    temperature: 0.4,
    responseFormat: 'json',
    meta: {
      skill: 'finance-pulse-general',
      workspaceId: snapshot.workspaceId,
      sourceSurface: 'OTHER',
    },
  });

  if (!completion.ok) {
    return skillError(
      'UPSTREAM_LLM_ERROR',
      `finance-pulse LLM call failed: ${completion.error.message}`,
      completion.error.code,
    );
  }

  const parsed = parseLlmOutput(completion.value.text);
  if (!parsed.ok) {
    const proposal = buildTemplatedProposal({
      snapshot,
      forWeekStarting,
      reason: `LLM returned malformed JSON: ${parsed.error}`,
    });
    return finalize({ input, proposal });
  }

  const proposal: FinancePulseProposal = {
    proposalId: randomUUID(),
    forWeekStarting,
    body: parsed.value.body.trim(),
    snapshot,
    recommendations: parsed.value.recommendations
      .map((r) => r.trim())
      .filter((r) => r.length > 0),
    llmComposed: true,
  };
  return finalize({ input, proposal });
}

async function finalize(args: {
  input: FinancePulseSkillInput;
  proposal: FinancePulseProposal;
}): Promise<SkillResult<FinancePulseSkillOutput>> {
  let sunk = false;
  if (args.input.sink) {
    const res = await args.input.sink.record({
      workspaceId: args.input.workspaceId,
      proposal: args.proposal,
    });
    sunk = res.ok;
  }
  return skillOk({
    proposal: args.proposal,
    sunk,
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

function renderUserPrompt(args: {
  snapshot: FinancePulseSnapshot;
  feedbackRulesBlock: string;
}): string {
  const s = args.snapshot;
  const lines: string[] = [];
  lines.push(`Workspace: ${s.workspaceName}`);
  lines.push(`Vertical: ${s.workspaceVertical}`);
  lines.push(`Window: ${s.windowFrom} → ${s.windowTo}`);
  lines.push('');
  lines.push('Internal finance activity (trailing 7 days):');
  lines.push(`- Invoice-chase drafts produced: ${s.internal.invoiceChaseDrafts}`);
  lines.push(`- Month-end-close drafts produced: ${s.internal.monthEndCloseDrafts}`);
  lines.push(`- Finance approvals decided: ${s.internal.financeApprovalsDecided}`);
  lines.push(`- Finance approvals still pending: ${s.internal.financeApprovalsPending}`);
  lines.push(`- Learned notes from finance corrections: ${s.internal.learnedNotes}`);
  lines.push('');
  if (s.quickbooks.connected) {
    const qb = s.quickbooks.summary;
    lines.push('QuickBooks (connected — counts only, no dollars):');
    lines.push(`- Open invoices on file: ${qb.openInvoices}`);
    lines.push(`- Overdue invoices: ${qb.overdueInvoices}`);
    lines.push(`- Deeply aged invoices (60+ days past due): ${qb.deeplyAgedInvoices}`);
    lines.push(`- Active customers: ${qb.activeCustomers}`);
    lines.push(`- Recent expenses: ${qb.recentExpenses}`);
  } else {
    lines.push(
      `QuickBooks: NOT CONNECTED (${s.quickbooks.reason}). Detail: ${s.quickbooks.detail}`,
    );
    lines.push(
      'When you reference QuickBooks-derived numbers, you MUST instead name ',
    );
    lines.push(
      'this gap and recommend connecting QuickBooks for a richer pulse next week.',
    );
  }
  if (args.feedbackRulesBlock.length > 0) {
    lines.push('');
    lines.push(args.feedbackRulesBlock);
  }
  return lines.join('\n');
}

function buildQuietProposal(args: {
  snapshot: FinancePulseSnapshot;
  forWeekStarting: string;
}): FinancePulseProposal {
  const body =
    `${args.snapshot.workspaceName} had a quiet finance week — no invoice ` +
    `chases, no month-end close drafts, and no finance approvals moved. ` +
    `QuickBooks is not connected, so the pulse cannot read AR aging or open ` +
    `invoices on your behalf. Connecting QuickBooks gives next week's pulse ` +
    `the data to actually be useful.`;
  return {
    proposalId: randomUUID(),
    forWeekStarting: args.forWeekStarting,
    body,
    snapshot: args.snapshot,
    recommendations: [
      'Connect QuickBooks from Settings → Integrations so the pulse can read AR aging next week',
    ],
    llmComposed: false,
  };
}

function buildTemplatedProposal(args: {
  snapshot: FinancePulseSnapshot;
  forWeekStarting: string;
  reason: string;
}): FinancePulseProposal {
  const s = args.snapshot;
  const qbLine = s.quickbooks.connected
    ? `QuickBooks reports ${s.quickbooks.summary.openInvoices} open invoices ` +
      `(${s.quickbooks.summary.overdueInvoices} overdue, ${s.quickbooks.summary.deeplyAgedInvoices} deeply aged).`
    : `QuickBooks is not connected (${s.quickbooks.reason}); the pulse cannot ` +
      `read AR aging without it.`;
  const body =
    `Plaino watched finance this week — ${s.internal.invoiceChaseDrafts} invoice ` +
    `chases drafted, ${s.internal.monthEndCloseDrafts} month-end-close drafts, ` +
    `${s.internal.financeApprovalsDecided} approvals decided, and ` +
    `${s.internal.financeApprovalsPending} still waiting on you. ${qbLine} The ` +
    `pulse prose was not composed this morning (${args.reason}); the counts above ` +
    `are the honest summary.`;
  return {
    proposalId: randomUUID(),
    forWeekStarting: args.forWeekStarting,
    body,
    snapshot: s,
    recommendations: [],
    llmComposed: false,
  };
}

interface ParsedOutput {
  body: string;
  recommendations: string[];
}

function parseLlmOutput(
  raw: string,
): { ok: true; value: ParsedOutput } | { ok: false; error: string } {
  const trimmed = raw.trim();
  const unwrapped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapped);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'not an object' };
  }
  const obj = parsed as Record<string, unknown>;
  const body = typeof obj.body === 'string' ? obj.body : null;
  if (!body || body.trim().length === 0) {
    return { ok: false, error: 'missing body' };
  }
  const rawRecs = Array.isArray(obj.recommendations) ? obj.recommendations : [];
  const recs = rawRecs
    .filter((r): r is string => typeof r === 'string')
    .slice(0, 5);
  return { ok: true, value: { body, recommendations: recs } };
}

function isoMonday(d: Date): string {
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(d.getTime() - offset * 24 * 60 * 60 * 1000);
  return monday.toISOString().slice(0, 10);
}

export const __testing = {
  parseLlmOutput,
  isoMonday,
};
