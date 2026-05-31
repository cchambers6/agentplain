/**
 * lib/skills/compliance-watch-general/skill.ts
 *
 * Pure orchestration. The activity-snapshot builder feeds us a list of
 * already-flagged matches; the skill composes a digest prose body and
 * persists one approval row when matches > 0. When zero matches, no
 * row lands — the legal discipline only surfaces on real findings.
 */

import { randomUUID } from 'node:crypto';
import { getLlmProvider } from '@/lib/llm';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ComplianceSkillInput,
  ComplianceSkillOutput,
  ComplianceProposal,
  ComplianceSnapshot,
} from './types';

const NO_OUTBOUND_NOTE =
  'No outbound. The compliance digest is drafted into /approvals for the ' +
  'operator. Per project_no_outbound_architecture.md sentinel ADVISES; ' +
  'nothing is blocked, edited, or escalated automatically.';

const SYSTEM_PROMPT = [
  'You are Plaino, the workspace\'s named service partner at agentplain.',
  'A daily compliance sweep over the last 24h of approval drafts found ',
  'one or more matches. Compose a SHORT (3-6 sentence) digest for the ',
  'operator. Lead with what was flagged, then what they should check ',
  'before approving each affected draft. Tone: calm, precise, never ',
  'alarmist. No emoji. No marketing fluff.',
  '',
  'Hard rules:',
  '- Ground every claim in the matches below. Do NOT invent flags.',
  '- Reference matches by their ruleLabel + the kind of approval ',
  '  ("a BUYER_INQUIRY_REPLY_DRAFT carried a fair-housing literal match").',
  '- Never state that anything has been changed or blocked. Sentinel ',
  '  ADVISES — the operator decides whether to edit or approve.',
  '- Close with one sentence on what to do next: "review the flagged ',
  '  drafts on /approvals before approving them today" or equivalent.',
  '',
  '── OUTPUT FORMAT ──',
  'Return STRICTLY a single JSON object — no prose outside it:',
  '{',
  '  "body": string   // the digest paragraph itself',
  '}',
].join('\n');

export async function runSkill(
  input: ComplianceSkillInput,
): Promise<SkillResult<ComplianceSkillOutput>> {
  const llm = input.llm ?? getLlmProvider();
  const now = input.now ?? new Date();
  const snapshot = input.snapshot;

  if (snapshot.matches.length === 0) {
    // Nothing to surface. No row lands — the legal discipline doesn't
    // need a daily "all clear" if there's nothing to flag.
    return skillOk({
      proposal: null,
      sunk: false,
      noOutboundNote:
        'No matches in window; no digest row written. The sweep ran honestly.',
    });
  }

  const completion = await llm.complete({
    system: SYSTEM_PROMPT,
    cacheSystem: true,
    messages: [
      { role: 'user', content: renderUserPrompt(snapshot, input.feedbackRulesBlock ?? '') },
    ],
    maxTokens: 400,
    temperature: 0.3,
    responseFormat: 'json',
    meta: {
      skill: 'compliance-watch-general',
      workspaceId: snapshot.workspaceId,
      sourceSurface: 'OTHER',
    },
  });

  let body: string;
  if (!completion.ok) {
    // Hard LLM failure — still emit a templated digest so the operator
    // sees the flags. Compliance is high-stakes; never lose the signal.
    body = buildTemplatedDigest(snapshot);
  } else {
    const parsed = parseLlmOutput(completion.value.text);
    body = parsed.ok ? parsed.value.body : buildTemplatedDigest(snapshot);
  }

  const proposal: ComplianceProposal = {
    proposalId: randomUUID(),
    forDate: now.toISOString().slice(0, 10),
    body,
    matches: snapshot.matches,
    snapshot,
  };

  let sunk = false;
  if (input.sink) {
    const sinkRes = await input.sink.record({
      workspaceId: input.workspaceId,
      proposal,
    });
    sunk = sinkRes.ok;
  }
  return skillOk({
    proposal,
    sunk,
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

function renderUserPrompt(snapshot: ComplianceSnapshot, feedbackRules: string): string {
  const lines: string[] = [];
  lines.push(`Workspace: ${snapshot.workspaceName}`);
  lines.push(`Vertical: ${snapshot.verticalSlug}`);
  lines.push(`Window: ${snapshot.windowFrom} → ${snapshot.windowTo}`);
  lines.push(`Approvals scanned: ${snapshot.approvalsScanned}`);
  lines.push(`Matches found: ${snapshot.matches.length}`);
  lines.push('');
  lines.push('Matches:');
  for (const m of snapshot.matches.slice(0, 25)) {
    lines.push(
      `- [${m.ruleSeverity}] ${m.ruleLabel} — ${m.approvalKind} ${m.approvalItemId} — "${m.excerpt}"`,
    );
  }
  if (feedbackRules.trim().length > 0) {
    lines.push('');
    lines.push(feedbackRules);
  }
  return lines.join('\n');
}

function buildTemplatedDigest(snapshot: ComplianceSnapshot): string {
  const counts = countBySeverity(snapshot.matches);
  return (
    `Plaino's compliance sweep flagged ${snapshot.matches.length} match` +
    `${snapshot.matches.length === 1 ? '' : 'es'} across ` +
    `${snapshot.approvalsScanned} draft${snapshot.approvalsScanned === 1 ? '' : 's'} ` +
    `in the last 24 hours: ${counts.HIGH} high-severity, ${counts.MEDIUM} medium, ` +
    `${counts.LOW + counts.INFO} low/info. Review the flagged drafts on /approvals ` +
    `before approving them today. Sentinel ADVISES; nothing has been blocked or edited automatically.`
  );
}

function countBySeverity(matches: ComplianceSnapshot['matches']): Record<string, number> {
  const out = { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, BLOCKER: 0 };
  for (const m of matches) {
    out[m.ruleSeverity] = (out[m.ruleSeverity] ?? 0) + 1;
  }
  return out;
}

interface ParsedOutput {
  body: string;
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
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'not an object' };
  }
  const obj = parsed as Record<string, unknown>;
  const body = typeof obj.body === 'string' ? obj.body.trim() : '';
  if (!body) return { ok: false, error: 'missing body' };
  return { ok: true, value: { body } };
}

// Used by tests but exported via the typed surface to suppress unused
// import warnings — keep the export footprint small.
void skillError;

export const __testing = { parseLlmOutput, buildTemplatedDigest };
