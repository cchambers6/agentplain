/**
 * lib/voice/transcript-actions.ts
 *
 * Transcript → action-items pipeline. After a call completes, Twilio's
 * Conversation Intelligence runs Language Operators (Summary, Sentiment, and a
 * custom "Action Items" extractor) and POSTs the OperatorResults to
 * `/api/voice/twilio/transcript`. This module turns those results into
 * `VoiceActionItem`s and writes them into the EXISTING approvals queue
 * (`WorkApprovalQueueItem`, kind `VOICE_CALL_ACTION_ITEM`) for a human to
 * review on /approvals.
 *
 * Per `project_no_outbound_architecture.md`: every item is DRAFT-only. The
 * pipeline NEVER calls anyone back, books anything, or sends anything — it
 * proposes the follow-up; the operator (and their own systems) act on it.
 *
 * Parsing is deliberately defensive (per `feedback_cold_start_safe_agents.md`):
 * any operator may be missing from a given webhook, so each is optional and the
 * pipeline still produces a useful "someone called, please follow up" card from
 * just a summary.
 */

import type { WorkApprovalKind } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { encryptPayloadForWrite } from '@/lib/security/payload-crypto';
import type { VoiceActionItem } from './types';

const AGENT_SLUG = 'voice-transcript-actions';
const REF_TABLE = 'VoiceCall';
const DISCIPLINE = 'customer-success';
const KIND = 'VOICE_CALL_ACTION_ITEM' as WorkApprovalKind;

/** Normalized view of the intelligence results for one call. */
export interface ParsedTranscriptIntelligence {
  callSid: string;
  conversationId?: string;
  summary?: string;
  sentiment?: VoiceActionItem['sentiment'];
  intent?: string;
  /** Raw items from the custom Action-Items extraction operator. */
  rawActionItems: Array<{
    title?: string;
    summary?: string;
    priority?: string;
    callbackNumber?: string;
    nextSteps?: string[];
  }>;
}

type SentimentLabel = VoiceActionItem['sentiment'];

function normalizeSentiment(label: unknown): SentimentLabel | undefined {
  if (typeof label !== 'string') return undefined;
  const l = label.toLowerCase();
  if (l === 'positive' || l === 'negative' || l === 'neutral' || l === 'mixed') return l;
  return undefined;
}

function normalizePriority(value: unknown): VoiceActionItem['priority'] {
  const v = typeof value === 'string' ? value.toLowerCase() : '';
  if (v === 'urgent' || v === 'emergency') return 'urgent';
  if (v === 'high') return 'high';
  if (v === 'low' || v === 'routine') return 'low';
  return 'normal';
}

/**
 * Best-effort parse of a Conversation Intelligence OperatorResults webhook into
 * a normalized bundle. Tolerates either a single operator result or an array,
 * and either Twilio-authored shapes (`{text}` / `{label}`) or our custom JSON
 * action-item operator (`{result: {items: [...]}}`).
 */
export function parseConversationIntelligenceWebhook(
  payload: unknown,
): ParsedTranscriptIntelligence | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;

  const callSid =
    (typeof body.callSid === 'string' && body.callSid) ||
    (typeof body.CallSid === 'string' && body.CallSid) ||
    '';
  const conversationId =
    (typeof body.conversationId === 'string' && body.conversationId) || undefined;
  if (!callSid) return null;

  const results: unknown[] = Array.isArray(body.operatorResults)
    ? body.operatorResults
    : Array.isArray(body.results)
      ? body.results
      : body.result
        ? [body.result]
        : [];

  let summary: string | undefined;
  let sentiment: SentimentLabel | undefined;
  let intent: string | undefined;
  const rawActionItems: ParsedTranscriptIntelligence['rawActionItems'] = [];

  for (const r of results) {
    if (!r || typeof r !== 'object') continue;
    const res = r as Record<string, unknown>;
    const name = String(res.name ?? res.operatorType ?? res.operator ?? '').toLowerCase();
    const value = (res.result ?? res.value ?? res) as Record<string, unknown>;

    if (name.includes('summary') || (typeof value.text === 'string' && !name)) {
      if (typeof value.text === 'string') summary = value.text;
    }
    if (name.includes('sentiment')) {
      sentiment = normalizeSentiment(value.label ?? value.text);
    }
    if (name.includes('intent')) {
      if (typeof value.label === 'string') intent = value.label;
    }
    if (name.includes('action') || Array.isArray(value.items)) {
      const items = Array.isArray(value.items) ? value.items : [];
      for (const it of items) {
        if (it && typeof it === 'object') {
          const o = it as Record<string, unknown>;
          rawActionItems.push({
            title: typeof o.title === 'string' ? o.title : undefined,
            summary: typeof o.summary === 'string' ? o.summary : undefined,
            priority: typeof o.priority === 'string' ? o.priority : undefined,
            callbackNumber: typeof o.callbackNumber === 'string' ? o.callbackNumber : undefined,
            nextSteps: Array.isArray(o.nextSteps)
              ? o.nextSteps.filter((s): s is string => typeof s === 'string')
              : undefined,
          });
        }
      }
    }
  }

  return { callSid, conversationId, summary, sentiment, intent, rawActionItems };
}

/**
 * Map parsed intelligence into reviewable action items. Always returns at least
 * one item when there's any signal — a bare summary becomes a single
 * "follow up on this call" card so no call silently produces nothing.
 */
export function extractActionItems(parsed: ParsedTranscriptIntelligence): VoiceActionItem[] {
  const items: VoiceActionItem[] = parsed.rawActionItems.map((raw) => ({
    title: raw.title?.trim() || 'Follow up on inbound call',
    summary: raw.summary?.trim() || parsed.summary?.trim() || 'A caller left a message.',
    priority: normalizePriority(raw.priority),
    intent: parsed.intent,
    sentiment: parsed.sentiment,
    callbackNumber: raw.callbackNumber,
    suggestedNextSteps: raw.nextSteps,
  }));

  if (items.length === 0 && (parsed.summary || parsed.intent)) {
    items.push({
      title: 'Follow up on inbound call',
      summary: parsed.summary?.trim() || 'A caller left a message.',
      priority: 'normal',
      intent: parsed.intent,
      sentiment: parsed.sentiment,
    });
  }
  return items;
}

/** Persistence port — the production impl writes WorkApprovalQueueItem rows. */
export interface VoiceActionPersistence {
  create(row: {
    workspaceId: string;
    refId: string;
    payload: unknown;
  }): Promise<{ id: string }>;
}

/** Default persistence: a PENDING approvals-queue row per action item. */
export const prismaVoiceActionPersistence: VoiceActionPersistence = {
  async create(row) {
    return withSystemContext((tx) =>
      tx.workApprovalQueueItem.create({
        data: {
          workspaceId: row.workspaceId,
          agentSlug: AGENT_SLUG,
          kind: KIND,
          refTable: REF_TABLE,
          refId: row.refId,
          discipline: DISCIPLINE,
          status: 'PENDING',
          payload: encryptPayloadForWrite(row.payload),
        },
        select: { id: true },
      }),
    );
  },
};

/**
 * Write a call's extracted action items into the approvals queue. Returns the
 * created row ids. Idempotency is the caller's concern (the transcript route
 * dedupes on callSid before invoking this).
 */
export async function writeVoiceActionItems(args: {
  workspaceId: string;
  parsed: ParsedTranscriptIntelligence;
  persistence?: VoiceActionPersistence;
}): Promise<{ created: string[]; items: VoiceActionItem[] }> {
  const persistence = args.persistence ?? prismaVoiceActionPersistence;
  const items = extractActionItems(args.parsed);
  const created: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const refId = `${args.parsed.callSid}:${i}`;
    const row = await persistence.create({
      workspaceId: args.workspaceId,
      refId,
      payload: {
        type: 'voice-call-action-item',
        callSid: args.parsed.callSid,
        conversationId: args.parsed.conversationId ?? null,
        ...item,
      },
    });
    created.push(row.id);
  }

  return { created, items };
}
