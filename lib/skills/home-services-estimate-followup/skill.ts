/**
 * lib/skills/home-services-estimate-followup/skill.ts
 *
 * Drafts the homeowner-facing followup nudge for every open trades
 * estimate. Each estimate gets exactly one draft scoped to where the
 * estimate sits in the cadence — fresh → soft-nudge → check-in →
 * last-call → cold. Cold estimates emit a hand-off to the rep / owner
 * with a phone-call ask, not another email.
 *
 * Per `lib/skills/prompts/home-services.ts` `draftToneGuidance`:
 *   - never quote a price — defer with `{{operator: quote/time estimate}}`
 *   - never commit to a time-on-site — defer with the same merge field
 *   - tone is plain-spoken + practical (casual)
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS only.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_CHECK_IN_DAYS,
  DEFAULT_COLD_DAYS,
  DEFAULT_LAST_CALL_DAYS,
  DEFAULT_PERSIST_THRESHOLD,
  DEFAULT_SOFT_NUDGE_DAYS,
  stageFor,
  type ColdEstimateHandoff,
  type EstimateFollowupInput,
  type EstimateFollowupOutput,
  type EstimateRecord,
  type EstimateStage,
  type HomeownerNudgeDraft,
  type StageThresholds,
} from './types';

const MS_PER_DAY = 86_400_000;

export async function runSkill(
  input: EstimateFollowupInput,
): Promise<SkillResult<EstimateFollowupOutput>> {
  const now = input.now ?? new Date();
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;
  const thresholds: StageThresholds = {
    softNudge: input.softNudgeAfterDays ?? DEFAULT_SOFT_NUDGE_DAYS,
    checkIn: input.checkInAfterDays ?? DEFAULT_CHECK_IN_DAYS,
    lastCall: input.lastCallAfterDays ?? DEFAULT_LAST_CALL_DAYS,
    cold: input.coldAfterDays ?? DEFAULT_COLD_DAYS,
  };

  const estimatesRes = await input.lookup.fetchOpenEstimates({
    workspaceId: input.workspaceId,
  });
  if (!estimatesRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `estimate fetch failed: ${estimatesRes.error.message}`,
      estimatesRes.error.code,
    );
  }

  const classified = estimatesRes.value.map((e) => {
    const daysSinceSent = Math.floor((now.getTime() - e.sentAt.getTime()) / MS_PER_DAY);
    const stage = stageFor({ daysSinceSent, thresholds });
    return { estimate: e, stage, daysSinceSent };
  });

  const stageCounts: Record<EstimateStage, number> = {
    fresh: 0,
    'soft-nudge': 0,
    'check-in': 0,
    'last-call': 0,
    cold: 0,
  };
  for (const c of classified) stageCounts[c.stage] += 1;

  const drafts: HomeownerNudgeDraft[] = [];
  for (const c of classified) {
    if (c.stage === 'cold' || c.stage === 'fresh') continue; // no draft for fresh; cold → handoff
    const draft = renderNudge({
      estimate: c.estimate,
      stage: c.stage,
      daysSinceSent: c.daysSinceSent,
    });
    if (input.persister && draft.confidence >= persistThreshold) {
      const persistRes = await input.persister.persistDraft({
        workspaceId: input.workspaceId,
        threadId: `estimate-${c.estimate.estimateId}-followup-${c.stage}`,
        inReplyToMessageId: null,
        toEmails: draft.toEmails,
        subject: draft.subject,
        body: draft.body,
      });
      if (persistRes.ok) {
        draft.persisted = true;
        draft.providerDraftId = persistRes.value.providerDraftId;
      }
    }
    drafts.push(draft);
  }

  // Stable ordering — by stage urgency then estimate id so tests are
  // deterministic.
  drafts.sort((a, b) => stageRank(b.stage) - stageRank(a.stage) || a.estimateId.localeCompare(b.estimateId));

  const coldHandoff = buildColdHandoff(classified);

  return skillOk({
    estimates: classified.map((c) => ({
      estimateId: c.estimate.estimateId,
      stage: c.stage,
      daysSinceSent: c.daysSinceSent,
      homeownerAcknowledged: c.estimate.homeownerAcknowledged,
    })),
    stageCounts,
    drafts,
    coldHandoff,
  });
}

// ── Rendering ────────────────────────────────────────────────────────────

function renderNudge(args: {
  estimate: EstimateRecord;
  stage: EstimateStage;
  daysSinceSent: number;
}): HomeownerNudgeDraft {
  const { estimate, stage, daysSinceSent } = args;
  const firstName = estimate.homeowner.name.split(/\s+/)[0] || estimate.homeowner.name;
  const tradeLabel = friendlyTradeLabel(estimate.trade);
  const subject = renderSubject({ estimate, stage });

  const lines: string[] = [];
  lines.push(`Hi ${firstName},`);
  lines.push('');

  if (estimate.homeownerAcknowledged && stage !== 'last-call') {
    lines.push(
      `Following up on the ${tradeLabel} estimate for ${estimate.serviceAddress}. ` +
        `I know you saw it land in your inbox — wanted to circle back in case ` +
        `there is anything I can clear up before you decide.`,
    );
  } else {
    lines.push(
      `Following up on the ${tradeLabel} estimate I sent over ${daysSinceSent} ` +
        `day${daysSinceSent === 1 ? '' : 's'} ago for ${estimate.serviceAddress}. ` +
        `Wanted to make sure it landed and see if anything is missing from ` +
        `your side before you decide.`,
    );
  }
  lines.push('');

  switch (stage) {
    case 'soft-nudge':
      lines.push(
        'No urgency on our end — projects move on the homeowner\'s timeline. ' +
          'If you have any questions about scope, materials, or the work plan, ' +
          'just reply here and I will get you a clear answer the same day.',
      );
      break;
    case 'check-in':
      lines.push(
        'A few quick things people often want to know at this stage:',
      );
      lines.push(`  - what's locked vs. flexible in the scope as written`);
      lines.push(`  - whether the work window fits around your week`);
      lines.push(`  - any line item you want pulled out or replaced`);
      lines.push('');
      lines.push(
        'Pricing as quoted holds — any change in price or schedule lands under ' +
          '{{operator: quote/time estimate}} after we talk. Happy to redo any ' +
          'piece you want adjusted.',
      );
      break;
    case 'last-call':
      lines.push(
        'I do not want to crowd your inbox so this will be the last note from ' +
          'me on this estimate. If the timing isn\'t right or you went a ' +
          'different direction, no problem — just let me know either way so ' +
          'I can close the loop on our side.',
      );
      lines.push('');
      lines.push(
        'If you do still want to move forward, I would re-confirm the price + ' +
          'schedule first ({{operator: quote/time estimate}}) because some ' +
          'material costs shift week-to-week.',
      );
      break;
    case 'fresh':
    case 'cold':
      // Never render: fresh and cold do not produce drafts.
      break;
  }

  if (estimate.insuranceClaim && stage !== 'fresh') {
    lines.push('');
    lines.push(
      'On the insurance side: I am happy to coordinate directly with the adjuster ' +
        'if it makes the timeline cleaner — let me know who is on the file.',
    );
  }

  lines.push('');
  lines.push(`Thanks,`);
  lines.push(estimate.rep.name);
  lines.push('{{operator: shop signature + license number}}');

  // Confidence calibration: soft-nudge is the highest-quality touch
  // (early enough to be polite); last-call is lower because tone needs
  // a careful re-read before send.
  const confidence = stage === 'soft-nudge'
    ? 0.78
    : stage === 'check-in'
      ? 0.72
      : 0.58; // last-call

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    estimateId: estimate.estimateId,
    stage,
    toEmails: [estimate.homeowner.email],
    ccEmails: [],
    subject,
    body: lines.join('\n'),
    tone: 'casual',
    confidence,
    persisted: false,
  };
}

function renderSubject(args: {
  estimate: EstimateRecord;
  stage: EstimateStage;
}): string {
  const trade = friendlyTradeLabel(args.estimate.trade);
  switch (args.stage) {
    case 'soft-nudge':
      return `Quick check-in on your ${trade} estimate — ${args.estimate.serviceAddress}`;
    case 'check-in':
      return `Anything to clarify on the ${trade} estimate? — ${args.estimate.serviceAddress}`;
    case 'last-call':
      return `Closing the loop on your ${trade} estimate — ${args.estimate.serviceAddress}`;
    case 'fresh':
    case 'cold':
      return '';
  }
}

// ── Cold-handoff ─────────────────────────────────────────────────────────

function buildColdHandoff(classified: Array<{
  estimate: EstimateRecord;
  stage: EstimateStage;
  daysSinceSent: number;
}>): ColdEstimateHandoff {
  const cold = classified.filter((c) => c.stage === 'cold');
  if (cold.length === 0) {
    return {
      needed: false,
      coldEstimateIds: [],
      message: 'No cold estimates this pass.',
    };
  }
  const examples = cold
    .slice(0, 3)
    .map((c) => `${c.estimate.homeowner.name} (${c.estimate.serviceAddress})`)
    .join('; ');
  const tail = cold.length > 3 ? ` (+${cold.length - 3} more)` : '';
  return {
    needed: true,
    coldEstimateIds: cold.map((c) => c.estimate.estimateId),
    message:
      `${cold.length} estimate${cold.length === 1 ? '' : 's'} past the email-cadence window — ` +
      `phone or close. ${examples}${tail}.`,
  };
}

function stageRank(stage: EstimateStage): number {
  switch (stage) {
    case 'cold':
      return 4;
    case 'last-call':
      return 3;
    case 'check-in':
      return 2;
    case 'soft-nudge':
      return 1;
    case 'fresh':
      return 0;
  }
}

function friendlyTradeLabel(trade: EstimateRecord['trade']): string {
  switch (trade) {
    case 'roofing':
      return 'roofing';
    case 'hvac':
      return 'HVAC';
    case 'plumbing':
      return 'plumbing';
    case 'electrical':
      return 'electrical';
    case 'general-contractor':
      return 'remodel';
  }
}
