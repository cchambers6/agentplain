// Wave-2 briefings generator.
//
// Composes a per-workspace morning briefing from the last 24h of
// activity (approvals, chats, instructions, learned notes), encrypts
// the body with the v1 envelope, and persists a `WorkspaceBriefing`
// row. The cron at `lib/inngest/functions/briefings-generator-sweep.ts`
// drives one call per active workspace per weekday at ~09:00 ET.
//
// Per `project_no_outbound_architecture.md`: the generator READS state
// and WRITES one row. The notification email is a separate concern in
// `email.ts`.
//
// Per `feedback_no_silent_vendor_lock`: every LLM call goes through
// `lib/llm` — the generator never imports the Anthropic SDK.
//
// Per `feedback_cold_start_safe_agents.md`: every fire reads durable
// state — no shared in-memory cache.
//
// Per `feedback_no_quick_fixes.md` + audit §8 #5: the generator is a
// real LLM-composed briefing, not a templated count summary. Empty-
// activity workspaces still get a row (status='EMPTY') so the page
// renders an honest "nothing yesterday; here's the next loop" message.

import type { Prisma } from '@prisma/client';
import { SYSTEM_OPERATOR_CONTEXT, withSystemContext as defaultWithSystemContext } from '@/lib/db';
import { getLlmProvider } from '@/lib/llm';
import { MODEL_OPUS } from '@/lib/llm/model-tiers';
import type { LlmProvider } from '@/lib/llm/types';
import { encrypt } from '@/lib/security/encryption';
import { PrismaMemoryStore } from '@/lib/plaino/memory';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import { buildFeedbackRulesBlock } from '../feedback-rules';
import {
  buildActivitySnapshot,
  type SystemContextRunner,
} from './activity-snapshot';
import type {
  BriefingActivitySnapshot,
  BriefingSummary,
  GenerateBriefingResult,
} from './types';

const BRIEFING_FEEDBACK_SCOPES = ['reporting', 'analytics'] as const;

export interface GenerateBriefingForWorkspaceInput {
  workspaceId: string;
  /** Newest end of the briefing window. Defaults to "now". */
  now?: Date;
  /** Override for tests; live caller uses `getLlmProvider()`. */
  llm?: LlmProvider;
  /** Override for tests; live caller uses `withSystemContext`. */
  systemContext?: SystemContextRunner;
  /** Wave-3 phase 4 — workspace memory for FEEDBACK rules. Defaults to
   *  a fresh `PrismaMemoryStore`. Pass `null` to skip the read. */
  memory?: IMemoryStore | null;
}

export interface GenerateBriefingForWorkspaceResult {
  /** The `WorkspaceBriefing.id` if the row was persisted; null on
   *  PERMISSION error (RLS denies the row — surfaced for tests). */
  briefingId: string | null;
  /** Plaintext body the caller passes to the notification email
   *  rendering layer. The PERSISTED column is the encrypted ciphertext. */
  body: string;
  summary: BriefingSummary;
  forDate: string;
  status: 'READY' | 'EMPTY';
  /** True iff this call wrote a new row. False = same-day briefing
   *  already exists and was returned unchanged (idempotent retry). */
  inserted: boolean;
}

const NO_OUTBOUND_NOTE =
  'Briefings render in-product. The generator NEVER emails the customer ' +
  'on behalf of a third party; the daily notification email is product-side ' +
  '(agentplain → broker-owner inbox), same scope as the trial-warning notice. ' +
  'Per project_no_outbound_architecture.md.';

/**
 * Generate AND persist today's briefing for a single workspace. Caller
 * (the cron) iterates active workspaces and calls this once per. The
 * `@@unique([workspaceId, forDate])` guarantees retry idempotency —
 * a same-day re-run loads the existing row and returns it unchanged.
 */
export async function generateBriefingForWorkspace(
  input: GenerateBriefingForWorkspaceInput,
): Promise<GenerateBriefingForWorkspaceResult> {
  const now = input.now ?? new Date();
  const systemContext = input.systemContext ?? defaultWithSystemContext;
  const llm = input.llm ?? getLlmProvider();
  const forDate = isoYmd(now);

  // Idempotent short-circuit: existing same-day row → return as-is.
  const existing = await systemContext((tx) =>
    tx.workspaceBriefing.findUnique({
      where: {
        workspaceId_forDate: {
          workspaceId: input.workspaceId,
          forDate,
        },
      },
      select: { id: true, status: true, summary: true },
    }),
  );
  if (existing) {
    return {
      briefingId: existing.id,
      // We do NOT decrypt the existing body here — the caller is the
      // cron, which doesn't need it. The notification email runs on
      // first-write only (emailedAt guards re-send).
      body: '',
      summary: (existing.summary as unknown as BriefingSummary) ?? {
        approvalsInWindow: 0,
        pendingApprovals: 0,
        decidedInWindow: 0,
        newChatThreads: 0,
        newInstructions: 0,
        newLearnedNotes: 0,
        topApprovalKinds: [],
      },
      forDate,
      status: existing.status === 'EMPTY' ? 'EMPTY' : 'READY',
      inserted: false,
    };
  }

  const snapshot = await buildActivitySnapshot({
    workspaceId: input.workspaceId,
    now,
    systemContext,
  });

  // Read FEEDBACK rules under the reporting / analytics scopes so the
  // brief honors what the customer told /talk to remember (e.g. "don't
  // surface follow-up nudges in the briefing — I read them on the
  // approval page directly"). Best-effort.
  const memory =
    input.memory === undefined
      ? new PrismaMemoryStore(input.workspaceId, {
          ctx: SYSTEM_OPERATOR_CONTEXT,
        })
      : input.memory;
  let feedbackRulesBlock = '';
  if (memory) {
    try {
      feedbackRulesBlock = await buildFeedbackRulesBlock({
        memory,
        workspaceId: input.workspaceId,
        scopes: BRIEFING_FEEDBACK_SCOPES,
      });
    } catch {
      // best-effort
    }
  }

  const composed = await composeBriefing(snapshot, llm, feedbackRulesBlock);

  // Persist the new row. Wrapped in another systemContext call so
  // the read/compose/write windows stay short — Stripe RLS pattern.
  const briefing = await systemContext(async (tx) => {
    const row = await tx.workspaceBriefing.create({
      data: {
        workspaceId: input.workspaceId,
        forDate,
        body: encrypt(composed.body),
        summary: composed.summary as unknown as Prisma.InputJsonValue,
        status: composed.status,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        action:
          composed.status === 'EMPTY'
            ? 'briefing.generated_empty'
            : 'briefing.generated',
        targetTable: 'WorkspaceBriefing',
        targetId: row.id,
        payload: {
          forDate,
          approvalsInWindow: composed.summary.approvalsInWindow,
          pendingApprovals: composed.summary.pendingApprovals,
        } satisfies Prisma.InputJsonValue,
      },
    });
    return row;
  });

  return {
    briefingId: briefing.id,
    body: composed.body,
    summary: composed.summary,
    forDate,
    status: composed.status,
    inserted: true,
  };
}

/**
 * Stable system prompt for the briefing LLM call. The signed-in tone is
 * Plaino (calm, service-partner, never chirpy). System content is marked
 * cacheable so the daily fan-out across N workspaces re-uses the same
 * prompt cache entry — per PR #114 prompt-cache wrapper.
 */
const SYSTEM_PROMPT = [
  'You are Plaino, the workspace\'s named service partner at agentplain.',
  'Write a single morning briefing for the broker-owner. Tone: calm, ',
  'specific, never chirpy or promotional. No marketing copy. No emoji. ',
  'No bullet points more than 3 deep.',
  '',
  'Hard rules:',
  '- Ground every claim in the snapshot below. Do NOT fabricate counts, ',
  '  thread titles, or activity that is not in the snapshot.',
  '- If the snapshot is empty (all counts at 0), say so plainly in two ',
  '  sentences and stop — do not invent activity.',
  '- Never quote a customer-facing draft body verbatim; the snapshot ',
  '  only carries approval titles, never bodies.',
  '- Open with one sentence on what stood out yesterday. Then 2-4 ',
  '  short paragraphs covering: pending approvals to review, what got ',
  '  decided, the chat / instruction activity, and the new things ',
  '  the fleet learned from your edits.',
  '- Close with one sentence on what to expect today — concrete, no ' +
    'promises.',
  '',
  NO_OUTBOUND_NOTE,
].join('\n');

interface ComposedBriefing {
  body: string;
  summary: BriefingSummary;
  status: 'READY' | 'EMPTY';
}

async function composeBriefing(
  snapshot: BriefingActivitySnapshot,
  llm: LlmProvider,
  feedbackRulesBlock: string = '',
): Promise<ComposedBriefing> {
  const isEmpty =
    snapshot.summary.approvalsInWindow === 0 &&
    snapshot.summary.newChatThreads === 0 &&
    snapshot.summary.newInstructions === 0 &&
    snapshot.summary.newLearnedNotes === 0;

  if (isEmpty) {
    // Don't burn an LLM call when the snapshot has nothing — a templated
    // honest body is correct (and audited as EMPTY so the page can render
    // a distinct empty-state line).
    return {
      body: emptyBriefingBody(snapshot),
      summary: snapshot.summary,
      status: 'EMPTY',
    };
  }

  const userPrompt =
    feedbackRulesBlock.trim().length > 0
      ? `${renderSnapshotForLlm(snapshot)}\n\n${feedbackRulesBlock}`
      : renderSnapshotForLlm(snapshot);

  const completion = await llm.complete({
    system: SYSTEM_PROMPT,
    model: MODEL_OPUS,
    cacheSystem: true,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 800,
    temperature: 0.4,
    responseFormat: 'text',
    meta: {
      skill: 'briefing-generator',
      workspaceId: snapshot.workspaceId,
      sourceSurface: 'OTHER',
    },
  });

  if (!completion.ok) {
    // LLM failure: fall back to the honest templated body so the page
    // still has something to render. Status stays READY — the snapshot
    // had real activity; we just couldn't compose prose this morning.
    return {
      body: templatedBriefingBody(snapshot, completion.error.message),
      summary: snapshot.summary,
      status: 'READY',
    };
  }

  return {
    body: completion.value.text.trim(),
    summary: snapshot.summary,
    status: 'READY',
  };
}

function renderSnapshotForLlm(snapshot: BriefingActivitySnapshot): string {
  const s = snapshot.summary;
  const lines: string[] = [];
  lines.push(`Workspace: ${snapshot.workspaceName}`);
  lines.push(`Window: ${snapshot.windowFrom} → ${snapshot.windowTo}`);
  lines.push('');
  lines.push('Activity counts:');
  lines.push(`- Approvals in window: ${s.approvalsInWindow}`);
  lines.push(`- Pending approvals: ${s.pendingApprovals}`);
  lines.push(`- Decided in window: ${s.decidedInWindow}`);
  lines.push(`- New chat threads: ${s.newChatThreads}`);
  lines.push(`- New instructions queued: ${s.newInstructions}`);
  lines.push(`- New learned notes from corrections: ${s.newLearnedNotes}`);
  if (s.topApprovalKinds.length > 0) {
    lines.push('');
    lines.push('Top approval kinds:');
    for (const k of s.topApprovalKinds) {
      lines.push(`- ${k.kind}: ${k.count}`);
    }
  }
  if (snapshot.pendingHighlights.length > 0) {
    lines.push('');
    lines.push('Pending highlights (titles only):');
    for (const h of snapshot.pendingHighlights) {
      lines.push(`- [${h.kind}] ${h.title}`);
    }
  }
  return lines.join('\n');
}

function emptyBriefingBody(snapshot: BriefingActivitySnapshot): string {
  return (
    `Yesterday was quiet for ${snapshot.workspaceName} — no approvals queued, ` +
    `no chat threads opened, no fresh learned notes. The fleet is still ` +
    `running on its cadence; nothing surfaced that needs your eye this morning.`
  );
}

function templatedBriefingBody(
  snapshot: BriefingActivitySnapshot,
  reason: string,
): string {
  const s = snapshot.summary;
  return (
    `Briefing for ${snapshot.workspaceName} — ${snapshot.windowTo.slice(0, 10)}.\n\n` +
    `Plaino couldn't compose a full prose briefing this morning (${reason}); ` +
    `here are the raw counts so nothing is hidden:\n\n` +
    `- ${s.pendingApprovals} pending approvals\n` +
    `- ${s.decidedInWindow} decisions logged in the last 24h\n` +
    `- ${s.newChatThreads} new chat threads\n` +
    `- ${s.newInstructions} instructions queued\n` +
    `- ${s.newLearnedNotes} learned notes appended from your corrections\n\n` +
    `Open /approvals to review what's pending.`
  );
}

function isoYmd(d: Date): string {
  // UTC Y-M-D — matches the cron's UTC schedule. We do not localize per
  // workspace timezone (none stored yet); a future timezone-aware
  // briefings pass will pick a workspace-tz date here.
  return d.toISOString().slice(0, 10);
}

export type { GenerateBriefingResult };
export { isoYmd as __test_isoYmd };
