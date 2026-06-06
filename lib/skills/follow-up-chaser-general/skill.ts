/**
 * lib/skills/follow-up-chaser-general/skill.ts
 *
 * Cross-role follow-up chaser. Walks the operator's recent outbound
 * threads and PROPOSES a nudge draft for every thread where the
 * counterparty has been silent past `staleAfterDays`.
 *
 * Hard rules:
 *   - skill DOES NOT call `messages.send` / vendor SDKs.
 *   - drafts ALWAYS include an `{{operator: ...}}` merge field for
 *     anything the skill can't ground in the captured snippet.
 *   - threads with an existing operator-drafted follow-up (`hasOpenFollowUpDraft`)
 *     are skipped so the draft folder doesn't pile up.
 *   - threads where the counterparty already replied are skipped — the
 *     nudge is only for unanswered outbound.
 *   - per-run cap (`maxNudgesPerRun`) keeps the operator queue sane.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_FOLLOW_UP_LOOKBACK_DAYS,
  DEFAULT_MAX_NUDGES_PER_RUN,
  DEFAULT_NUDGE_TONE,
  DEFAULT_STALE_AFTER_DAYS,
  type FollowUpFetcher,
  type FollowUpInput,
  type FollowUpOutput,
  type FollowUpProposal,
  type FollowUpSnapshot,
  type NudgeTone,
  type OutboundThread,
} from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const NO_OUTBOUND_NOTE =
  'No emails sent. Every nudge is drafted with operator merge fields and ' +
  'lands in the approval queue PENDING. Per project_no_outbound_architecture.md.';

export async function runSkill(
  input: FollowUpInput,
): Promise<SkillResult<FollowUpOutput>> {
  const now = input.now ?? new Date();
  const staleAfterDays = input.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const maxNudges = input.maxNudgesPerRun ?? DEFAULT_MAX_NUDGES_PER_RUN;
  const lookbackDays = input.lookbackDays ?? DEFAULT_FOLLOW_UP_LOOKBACK_DAYS;
  const sinkThreshold = input.sinkThreshold ?? 0;
  const nudgeTone = input.nudgeTone ?? DEFAULT_NUDGE_TONE;

  const snapshotRes = await fetchSnapshot(input.fetcher, {
    workspaceId: input.workspaceId,
    asOf: now,
    lookbackDays,
  });
  if (!snapshotRes.ok) return snapshotRes;
  const snapshot = snapshotRes.value;

  const stale = filterStaleThreads({
    threads: snapshot.outbound,
    now,
    staleAfterDays,
  });
  // Oldest first — operator wants the longest-waiting at the top.
  stale.sort((a, b) => a.operatorLastSentAt.getTime() - b.operatorLastSentAt.getTime());
  const capped = stale.slice(0, maxNudges);

  const proposals: FollowUpProposal[] = capped.map((t) =>
    buildProposal({ thread: t, now, nudgeTone }),
  );

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
    threadsScanned: snapshot.outbound.length,
    proposals,
    sunk,
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

async function fetchSnapshot(
  fetcher: FollowUpFetcher,
  args: { workspaceId: string; asOf: Date; lookbackDays: number },
): Promise<SkillResult<FollowUpSnapshot>> {
  const res = await fetcher.fetchSnapshot(args);
  if (!res.ok) {
    // NOT_CONFIGURED bubbles through unchanged so the cron sweep can
    // treat it as a clean skip (workspace disconnected mid-sweep)
    // rather than counting it as a failure.
    if (res.error.code === 'NOT_CONFIGURED') {
      return skillError(
        'NOT_CONFIGURED',
        `follow-up-chaser fetcher (${fetcher.name}) reported NOT_CONFIGURED: ${res.error.message}`,
        res.error.code,
      );
    }
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `follow-up-chaser fetcher (${fetcher.name}) failed: ${res.error.message}`,
      res.error.code,
    );
  }
  return res;
}

interface FilterArgs {
  threads: OutboundThread[];
  now: Date;
  staleAfterDays: number;
}

function filterStaleThreads(args: FilterArgs): OutboundThread[] {
  const { threads, now, staleAfterDays } = args;
  const staleMs = staleAfterDays * MS_PER_DAY;
  return threads.filter((t) => {
    // Skip if operator already has a follow-up drafted for this thread.
    if (t.hasOpenFollowUpDraft) return false;
    // Skip if counterparty has replied AFTER the operator's last send.
    if (
      t.counterpartyLastRepliedAt &&
      t.counterpartyLastRepliedAt.getTime() >= t.operatorLastSentAt.getTime()
    ) {
      return false;
    }
    const stalledFor = now.getTime() - t.operatorLastSentAt.getTime();
    return stalledFor >= staleMs;
  });
}

/**
 * Tone-specific nudge wording. `professional` preserves the original
 * copy; `warm` softens it; `firm` makes the ask direct. The customer
 * picks the voice in /settings/skills → follow-up chaser. Drafts only —
 * the operator still approves before anything sends.
 */
const NUDGE_LINES: Record<NudgeTone, { first: string; second: string }> = {
  professional: {
    first:
      "Just bumping this up — wanted to make sure my last note didn't fall through the cracks.",
    second:
      "Circling back on this one — it's been a couple weeks and I want to make sure I haven't missed your reply.",
  },
  warm: {
    first:
      "Just wanted to gently float this back to the top of your inbox — no rush at all, only checking in case it slipped by.",
    second:
      "Hope you've been well! Circling back on this in case my earlier note got buried — I completely understand things get busy.",
  },
  firm: {
    first:
      "Following up on my note below — could you let me know where this stands?",
    second:
      "Checking in again on this — it's been a couple of weeks, and I'd appreciate a quick reply so I know how best to proceed.",
  },
};

function buildProposal(args: {
  thread: OutboundThread;
  now: Date;
  nudgeTone?: NudgeTone;
}): FollowUpProposal {
  const { thread, now } = args;
  const nudgeTone = args.nudgeTone ?? DEFAULT_NUDGE_TONE;
  const ageDays = Math.floor(
    (now.getTime() - thread.operatorLastSentAt.getTime()) / MS_PER_DAY,
  );
  const stage: 'first' | 'second' = ageDays >= 10 ? 'second' : 'first';
  const firstName = thread.counterpartyName?.split(/\s+/)[0] ?? null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const cleanedSubject = thread.subject.replace(/^(re:|fwd:)\s*/i, '').trim();
  const subject = `Re: ${cleanedSubject || 'Following up'}`;
  const snippet = thread.operatorLastBodySnippet
    .slice(0, 240)
    .replace(/\s+/g, ' ')
    .trim();
  const nudgeLine = NUDGE_LINES[nudgeTone][stage];
  const body = [
    greeting,
    '',
    nudgeLine,
    '',
    `For reference, my last note was: "${snippet}${thread.operatorLastBodySnippet.length > 240 ? '…' : ''}"`,
    '',
    '{{operator: any new context to add before this goes out — edit or delete this line}}',
    '',
    'Happy to provide anything else that would help. Thanks!',
    '',
    '{{operator: signature}}',
  ].join('\n');
  // Fresh stalls nudge well; very old ones (30d+) benefit less and want
  // an operator re-author. Confidence reflects that.
  const confidence = ageDays >= 21 ? 0.45 : ageDays >= 10 ? 0.62 : 0.72;
  return {
    proposalId: randomUUID(),
    kind: 'follow-up-nudge',
    status: 'PENDING',
    sourceThreadId: thread.threadId,
    ageDays,
    stage,
    toEmails: [...thread.counterpartyEmails],
    subject,
    body,
    confidence,
    reasoning:
      `Thread stale for ${ageDays}d with no counterparty reply since operator's last ` +
      `send (${stage} nudge). noOutbound: drafted, never sent.`,
  };
}

export const __testing = {
  filterStaleThreads,
  buildProposal,
};
