/**
 * docs/sales/weekly-report-2026-07-11/01-prompt.ts
 *
 * Production prompt for the weekly design-partner report NARRATIVE writer —
 * the layer that turns the deterministic Friday report data
 * (lib/reports/weekly-report-data.ts) into the first-person note a design
 * partner reads and Conner signs.
 *
 * STATUS: typechecked reference implementation, deliberately UNWIRED
 * (wiring gate in 00-README.md). It compiles against the real seams so
 * promotion to lib/reports/ is a file move, not a rewrite:
 *   - provider seam: lib/llm/types.ts (never the vendor SDK — the compose
 *     order Logging(Budget(Sentinel(Caching(provider)))) applies unchanged,
 *     project_llm_provider_compose_order);
 *   - data source: WeeklyReportData — the same audited numbers the
 *     deterministic email renders. The writer ADDS narrative; it never
 *     computes or introduces a number.
 *
 * Prompt-cache layout (real, not decorative):
 *   render order is system -> messages, and cache prefixes must be
 *   byte-stable (lib/llm/cache-wrapper.ts invariants). So:
 *   1. SYSTEM (cacheSystem: true) — writer instructions + voice rules.
 *      Stable across every partner and every week; one cache write serves
 *      the whole fleet's Friday run.
 *   2. Message block A (cacheable) — the partner profile. Stable across
 *      weeks for one partner; re-used by regenerations and by any other
 *      per-partner prompt that adopts the same block.
 *   3. Message block B (cacheable) — this week's data: report numbers,
 *      saved-time ledger rows, approval log, workflow-fire log. Stable
 *      within Friday's run, so validation retries and re-renders hit
 *      cache instead of re-paying the largest block.
 *   4. Message suffix (uncached) — the per-call ask, including corrective
 *      feedback on a retry. Volatile on purpose; everything above it
 *      stays a stable prefix.
 */

import type {
  LlmCompletionRequest,
  LlmContentBlock,
  LlmProvider,
  LlmResult,
} from '@/lib/llm/types';
import { llmError } from '@/lib/llm/types';
import type { WeeklyReportData } from '@/lib/reports/weekly-report-data';
import { parseWeeklyReport, type WeeklyReport } from './02-schema';

// ── Input shapes ───────────────────────────────────────────────────────────

/** Stable per-partner context — everything the writer needs to sound like
 *  it knows this partner, none of it changing week to week. Assembled once
 *  at pilot start from the discovery handoff sheet + case-study "before"
 *  fields, updated only when a preference genuinely changes. */
export interface PartnerNarrativeProfile {
  workspaceId: string;
  /** First name as they'd say it ("Sarah"). */
  partnerName: string;
  /** Business name as THEY write it. */
  businessName: string;
  /** Their named pain from discovery, in their words — the writer anchors
   *  "why this mattered" to it instead of inventing significance. */
  namedPainVerbatim: string;
  /** Voice notes accumulated from their edits (sign-off, formality,
   *  neighborhood names). The writer mirrors these, it does not parody them. */
  voiceNotes: string[];
  /** Standing facts (their email system, their CRM, briefing time) so the
   *  narrative can say "in your Follow Up Boss" rather than "in your CRM". */
  standingFacts: string[];
}

/** One saved-time ledger row, verbatim from TimeSavingsEntry. The `id` is
 *  what quantified.source_row_id must cite for any minutes figure. */
export interface LedgerRowInput {
  id: string;
  actionType: string;
  minutesSaved: number;
  occurredAt: string; // ISO
}

/** One approval-queue event the partner touched this week. `id` is the
 *  WorkApprovalQueueItem id — citable as a source_row_id. */
export interface ApprovalLogRowInput {
  id: string;
  title: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  proposedAt: string; // ISO
  decidedAt: string | null;
  decisionReason: string | null;
  /** True when the partner edited the draft before approving — the
   *  highest-value signal the pilot produces; the writer is told to
   *  treat edits as the partner teaching us, never as friction. */
  edited: boolean;
}

export interface WeeklyNarrativeInput {
  profile: PartnerNarrativeProfile;
  /** The deterministic report data — the writer's ONLY source of numbers. */
  report: WeeklyReportData;
  ledgerRows: LedgerRowInput[];
  approvalLog: ApprovalLogRowInput[];
  /** Anything that broke this week that the partner was (or should have
   *  been) told about, in plain language. The writer must not discover
   *  breakage on its own and must not omit an entry given here — no
   *  Friday surprises in either direction (runbook doc 03). */
  incidents: string[];
}

// ── The cached system prompt (stable across partners and weeks) ────────────

export const WEEKLY_NARRATIVE_SYSTEM = `You write the Friday weekly report for one design partner of agentplain, in the voice of Plaino — the partner's named service partner. The report is read by the business owner over coffee and signed off by our founder. Write it so both would put their name on it.

VOICE
- First person ("I caught", "I drafted", "I'm watching"). You are a colleague reporting in, not a butler and not a dashboard.
- Plain words, real sentences. One idea per sentence. Vary sentence length.
- Concrete beats clever: name the lead, the time, the day. Never let an adjective do a fact's job.
- Warm is allowed; performed enthusiasm is not. No exclamation-point cheer, no "great week!", no emoji.
- At most one em-dash per sentence. Never the "it's not just X, it's Y" construction. No rule-of-three rhythm.
- Customer vocabulary only: "Working", "Setting up", "Watching", "connected", "needs attention". Never runtime or engineering words.
- Never name any model or technology vendor. The service is agentplain; you are Plaino. That is the entire cast.
- The control line appears once, stated plainly, when the numbers are presented: drafts wait for the owner; nothing sends on its own; their systems do the sending.

TRUTH (these outrank every voice rule)
- Every number you write is copied verbatim from the DATA block. You never add, average, extrapolate, annualize, or estimate. If a figure is not in the data, the sentence that wanted it is rewritten without it.
- Every entry in "quantified" cites its source_row_id from the data (a ledger row id, an approval item id, or a named query key provided in the data block).
- Rejected and edited drafts are reported, not hidden. An edit is the partner teaching me; say so.
- Every incident listed in the data appears in "watches" in plain language. Nothing breaks silently and nothing is confessed for drama.
- A quiet week is reported as a quiet week. Do not inflate; do not apologize twice.
- No promises about next week beyond "next_week_focus", which must be one concrete, already-agreed item from the data — never an invented commitment.

OUTPUT
Respond with a single JSON object matching exactly:
{
  "partner_name": string,
  "week_of": string (copy the week label from the data),
  "highlights": string[] (3-5, each one concrete moment),
  "quantified": [{"metric": string, "value": string, "source_row_id": string}] (1-6),
  "watches": string[] (1-3, honest),
  "next_week_focus": string,
  "plaino_voice_signature": string (one line, first person, tied to something that actually happened this week)
}
No prose outside the JSON.`;

// ── Request builder ────────────────────────────────────────────────────────

function profileBlock(p: PartnerNarrativeProfile): string {
  return [
    'PARTNER PROFILE (stable — mirror their voice, do not parody it)',
    `Name: ${p.partnerName}`,
    `Business: ${p.businessName}`,
    `Their named pain, in their words: ${p.namedPainVerbatim}`,
    p.voiceNotes.length
      ? `Voice notes from their edits:\n- ${p.voiceNotes.join('\n- ')}`
      : 'Voice notes from their edits: none captured yet.',
    p.standingFacts.length
      ? `Standing facts:\n- ${p.standingFacts.join('\n- ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function weekDataBlock(input: WeeklyNarrativeInput): string {
  const r = input.report;
  const ledger = input.ledgerRows
    .map(
      (row) =>
        `- ${row.id} | ${row.actionType} | ${row.minutesSaved} min | ${row.occurredAt}`,
    )
    .join('\n');
  const approvals = input.approvalLog
    .map(
      (a) =>
        `- ${a.id} | ${a.status}${a.edited ? ' (edited first)' : ''} | "${a.title}" | proposed ${a.proposedAt}${a.decidedAt ? ` | decided ${a.decidedAt}` : ''}${a.decisionReason ? ` | reason: ${a.decisionReason}` : ''}`,
    )
    .join('\n');
  return [
    `WEEK DATA (your only source of numbers; week label: "${r.weekLabel}")`,
    `Named query keys you may cite as source_row_id when no single row applies:`,
    `- weekly-report-data:draftsCreated = ${r.draftsCreated}`,
    `- weekly-report-data:approvalsApproved = ${r.approvalsApproved}`,
    `- weekly-report-data:approvalsRejected = ${r.approvalsRejected}`,
    `- weekly-report-data:medianTimeToApproveMinutes = ${r.medianTimeToApproveMinutes ?? 'null (no manual approvals decided this week)'}`,
    `- weekly-report-data:hoursSaved = ${r.hoursSaved}`,
    `- weekly-report-data:pendingReviewCount = ${r.lookAhead.pendingReviewCount}`,
    r.isEmpty
      ? 'NOTE: this window had zero drafts and zero decisions — write the honest quiet-week report.'
      : '',
    '',
    'SAVED-TIME LEDGER ROWS (id | action | minutes | when):',
    ledger || '(none this week)',
    '',
    'APPROVAL LOG (id | status | title | timestamps):',
    approvals || '(none this week)',
    '',
    'WORKFLOWS THAT FIRED:',
    r.workflowsFired.map((w) => `- ${w.label}: ${w.count}`).join('\n') ||
      '(none this week)',
    '',
    'INCIDENTS TO REPORT (must all appear in watches):',
    input.incidents.map((i) => `- ${i}`).join('\n') || '(none this week)',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** Build the completion request. `correction` carries schema-validation
 *  issues on a retry — it lands in the UNCACHED suffix so the two big
 *  blocks above it stay a byte-stable cache prefix. */
export function buildWeeklyNarrativeRequest(
  input: WeeklyNarrativeInput,
  correction?: string[],
): LlmCompletionRequest {
  const blocks: LlmContentBlock[] = [
    { type: 'text', text: profileBlock(input.profile), cacheable: true },
    { type: 'text', text: weekDataBlock(input), cacheable: true },
    {
      type: 'text',
      text: correction?.length
        ? `Your previous attempt failed validation:\n- ${correction.join('\n- ')}\nProduce the corrected JSON object now.`
        : `Write ${input.profile.partnerName}'s report for the week labeled "${input.report.weekLabel}". JSON only.`,
    },
  ];
  return {
    system: WEEKLY_NARRATIVE_SYSTEM,
    cacheSystem: true,
    messages: [{ role: 'user', content: blocks }],
    // No model pin: the routing provider picks the tier
    // (lib/llm/routing-provider.ts), same as every other skill.
    maxTokens: 1400,
    temperature: 0.4,
    responseFormat: 'json',
    meta: {
      skill: 'weekly-report-narrative',
      workspaceId: input.profile.workspaceId,
    },
  };
}

// ── Generation loop: one call + one corrective retry ───────────────────────

/** Generate and validate the weekly report narrative. One corrective retry
 *  on schema failure (the correction rides the uncached suffix); after
 *  that, fail loudly — a Friday with no narrative falls back to the
 *  deterministic email, never to an unvalidated one. */
export async function generateWeeklyNarrative(
  provider: LlmProvider,
  input: WeeklyNarrativeInput,
): Promise<LlmResult<WeeklyReport>> {
  let issues: string[] | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await provider.complete(
      buildWeeklyNarrativeRequest(input, issues),
    );
    if (!res.ok) return res;
    let raw: unknown;
    try {
      raw = JSON.parse(res.value.text);
    } catch {
      issues = ['response was not parseable JSON'];
      continue;
    }
    const parsed = parseWeeklyReport(raw);
    if (parsed.ok) return { ok: true, value: parsed.report };
    issues = parsed.issues;
  }
  return llmError(
    'MALFORMED_RESPONSE',
    `weekly narrative failed schema validation after retry: ${(issues ?? []).join('; ')}`,
  );
}
