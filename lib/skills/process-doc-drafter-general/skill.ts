/**
 * lib/skills/process-doc-drafter-general/skill.ts
 *
 * Cross-role process-doc drafter. Clusters past operator actions by
 * (kind, triggerHint) and PROPOSES a drafted Standard Operating
 * Procedure for every pattern that repeats ≥ `minOccurrences` times.
 *
 * Hard rules:
 *   - skill DOES NOT publish to Notion / Confluence / Google Docs / any
 *     external doc system. Output is a drafted markdown body that
 *     lives in the approval queue.
 *   - every SOP body ALWAYS contains at least one `{{operator: ...}}`
 *     merge field — the skill can show what happened, but it can't
 *     decide what the canonical process IS. The operator does.
 *   - patterns with an existing SOP (matched by normalized title) are
 *     skipped.
 *   - per-run cap (`maxProposalsPerRun`) keeps the queue sane.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_MAX_PROPOSALS_PER_RUN,
  DEFAULT_MIN_OCCURRENCES,
  DEFAULT_PROCESS_DOC_LOOKBACK_DAYS,
  type PastAction,
  type ProcessDocFetcher,
  type ProcessDocInput,
  type ProcessDocOutput,
  type ProcessDocProposal,
  type ProcessDocSnapshot,
} from './types';

const NO_OUTBOUND_NOTE =
  'No SOP published, no doc written to any external system. Every draft ' +
  'lands in the approval queue PENDING for the operator to copy into ' +
  'their own documentation. Per project_no_outbound_architecture.md.';

export async function runSkill(
  input: ProcessDocInput,
): Promise<SkillResult<ProcessDocOutput>> {
  const now = input.now ?? new Date();
  const minOccurrences = input.minOccurrences ?? DEFAULT_MIN_OCCURRENCES;
  const maxProposals = input.maxProposalsPerRun ?? DEFAULT_MAX_PROPOSALS_PER_RUN;
  const lookbackDays = input.lookbackDays ?? DEFAULT_PROCESS_DOC_LOOKBACK_DAYS;
  const sinkThreshold = input.sinkThreshold ?? 0;

  const snapshotRes = await fetchSnapshot(input.fetcher, {
    workspaceId: input.workspaceId,
    asOf: now,
    lookbackDays,
  });
  if (!snapshotRes.ok) return snapshotRes;
  const snapshot = snapshotRes.value;

  const clusters = clusterActions(snapshot.pastActions);
  const existingTitles = new Set(
    snapshot.existingProcessDocs.map((d) => normalizeTitle(d.title)),
  );

  const proposals: ProcessDocProposal[] = [];
  // Sort clusters by occurrence count desc — most frequent patterns first.
  const sortedKeys = [...clusters.keys()].sort(
    (a, b) => (clusters.get(b)!.length - clusters.get(a)!.length),
  );

  for (const key of sortedKeys) {
    if (proposals.length >= maxProposals) break;
    const actions = clusters.get(key)!;
    if (actions.length < minOccurrences) continue;
    const proposal = buildProposal({ key, actions });
    const normalizedNew = normalizeTitle(proposal.title);
    if (existingTitles.has(normalizedNew)) continue;
    // Substring dedupe — existing "Send deposit receipt" matches new
    // "Send deposit receipt after signed estimate" and vice versa.
    let dup = false;
    for (const existing of existingTitles) {
      if (existing.length === 0) continue;
      if (existing.includes(normalizedNew) || normalizedNew.includes(existing)) {
        dup = true;
        break;
      }
    }
    if (dup) continue;
    proposals.push(proposal);
  }

  let sunk = 0;
  if (input.sink) {
    for (const proposal of proposals) {
      if (proposal.confidence < sinkThreshold) continue;
      const res = await input.sink.record({
        workspaceId: input.workspaceId,
        proposal,
      });
      if (res.ok) sunk += 1;
    }
  }

  return skillOk({
    asOf: now.toISOString(),
    actionsScanned: snapshot.pastActions.length,
    patternsFound: [...clusters.values()].filter((arr) => arr.length >= minOccurrences).length,
    proposals,
    sunk,
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

async function fetchSnapshot(
  fetcher: ProcessDocFetcher,
  args: { workspaceId: string; asOf: Date; lookbackDays: number },
): Promise<SkillResult<ProcessDocSnapshot>> {
  const res = await fetcher.fetchSnapshot(args);
  if (!res.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `process-doc-drafter fetcher (${fetcher.name}) failed: ${res.error.message}`,
      res.error.code,
    );
  }
  return res;
}

function clusterActions(actions: PastAction[]): Map<string, PastAction[]> {
  const clusters = new Map<string, PastAction[]>();
  for (const a of actions) {
    const key = clusterKey(a);
    const arr = clusters.get(key) ?? [];
    arr.push(a);
    clusters.set(key, arr);
  }
  return clusters;
}

function clusterKey(a: PastAction): string {
  const kind = a.kind.toLowerCase().trim();
  const trigger = a.triggerHint.toLowerCase().trim().replace(/\s+/g, '-');
  return `${kind}::${trigger}`;
}

function buildProposal(args: { key: string; actions: PastAction[] }): ProcessDocProposal {
  const { key, actions } = args;
  const [kind, trigger] = key.split('::');
  // Sort actions newest-first so the SOP quotes the most recent example.
  const sorted = [...actions].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
  );
  const newest = sorted[0];
  const title = renderTitle({ kind, trigger });
  const body = renderBody({ kind, trigger, occurrences: actions.length, example: newest });
  // Confidence scales with occurrence count: 3 = floor (just over min),
  // 5 = clearly repeating, 8+ = the pattern is the process.
  const confidence = actions.length >= 8 ? 0.78 : actions.length >= 5 ? 0.66 : 0.55;
  return {
    proposalId: randomUUID(),
    kind: 'process-doc',
    status: 'PENDING',
    patternKey: key,
    title,
    body,
    occurrenceCount: actions.length,
    lastObservedAt: newest.occurredAt.toISOString(),
    sourceActionIds: sorted.map((a) => a.id),
    confidence,
    reasoning:
      `Pattern "${kind} → ${trigger}" observed ${actions.length} times; drafted SOP ` +
      'for operator to verify + publish. noOutbound: drafted, never published.',
  };
}

function renderTitle(args: { kind: string; trigger: string }): string {
  const kindLabel = humanizeSlug(args.kind);
  const triggerLabel = humanizeSlug(args.trigger);
  return `SOP: ${kindLabel} — ${triggerLabel}`;
}

function humanizeSlug(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function renderBody(args: {
  kind: string;
  trigger: string;
  occurrences: number;
  example: PastAction;
}): string {
  const { kind, trigger, occurrences, example } = args;
  const exampleSubject = example.subject.replace(/\s+/g, ' ').trim();
  const exampleSnippet = example.bodySnippet.slice(0, 280).replace(/\s+/g, ' ').trim();
  return [
    `# SOP: ${humanizeSlug(kind)} — ${humanizeSlug(trigger)}`,
    '',
    `_Observed ${occurrences} times in the past activity window._`,
    '',
    '## Trigger',
    '',
    `${humanizeSlug(trigger)} — {{operator: confirm the exact trigger condition (e.g. "estimate signed in QuickBooks", "new lead created in CRM"); this draft saw it as a tag/keyword, not a verified upstream event}}`,
    '',
    '## Action',
    '',
    `${humanizeSlug(kind)} — {{operator: confirm and adjust if the action varies; if this changes by counterparty type, list the variants here}}`,
    '',
    '## Last representative example',
    '',
    `**Subject:** ${exampleSubject || '(no subject captured)'}`,
    '',
    `**Body excerpt:** "${exampleSnippet}${example.bodySnippet.length > 280 ? '…' : ''}"`,
    '',
    '## Owner',
    '',
    '{{operator: who owns this process — name + role}}',
    '',
    '## Cadence / frequency',
    '',
    `Observed ~${occurrences} times in the lookback window. {{operator: confirm the expected cadence (every new lead, monthly, ad-hoc, etc.)}}`,
    '',
    '## Notes',
    '',
    '{{operator: anything that varies — exceptions, escalation rules, "if X then Y" forks}}',
  ].join('\n');
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export const __testing = {
  clusterActions,
  clusterKey,
  buildProposal,
  normalizeTitle,
};
