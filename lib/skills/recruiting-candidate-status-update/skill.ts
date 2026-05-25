/**
 * lib/skills/recruiting-candidate-status-update/skill.ts
 *
 * Drafts candidate-facing pipeline status updates for one role. Reads
 * the ATS pipeline for the role, classifies each active candidate by
 * transition since the last touch (advanced / held / rejected /
 * withdrawn / offer-extended), and drafts the warm-but-quick update.
 * Offer-extended and rejected drafts always queue for recruiter review
 * before any persistence — those touches deserve a human read.
 *
 * Per `lib/skills/prompts/recruiting.ts` `draftToneGuidance`:
 *   - warm but quick
 *   - respect candidate time + be transparent about pipeline state
 *   - never quote a salary range or offer detail — defer with
 *     `{{operator: comp/offer details}}`
 *
 * Per `project_no_outbound_architecture.md`: DRAFTS only.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_PERSIST_THRESHOLD,
  DEFAULT_STALE_AFTER_DAYS,
  transitionFrom,
  type CandidateRecord,
  type CandidateStatusDraft,
  type CandidateStatusUpdateInput,
  type CandidateStatusUpdateOutput,
  type PipelineStage,
  type RecruiterReviewQueue,
  type RoleContext,
  type StageTransition,
} from './types';

const MS_PER_DAY = 86_400_000;

export async function runSkill(
  input: CandidateStatusUpdateInput,
): Promise<SkillResult<CandidateStatusUpdateOutput>> {
  const now = input.now ?? new Date();
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;
  const staleAfterDays = input.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;

  const roleRes = await input.lookup.fetchRole({
    workspaceId: input.workspaceId,
    roleId: input.roleId,
  });
  if (!roleRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `role fetch failed: ${roleRes.error.message}`,
      roleRes.error.code,
    );
  }
  const candidatesRes = await input.lookup.fetchCandidates({
    workspaceId: input.workspaceId,
    roleId: input.roleId,
  });
  if (!candidatesRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `candidate fetch failed: ${candidatesRes.error.message}`,
      candidatesRes.error.code,
    );
  }

  const transitions: Array<{
    candidate: CandidateRecord;
    transition: StageTransition;
  }> = [];
  for (const c of candidatesRes.value) {
    const daysSinceLastTouch = Math.floor((now.getTime() - c.lastTouchAt.getTime()) / MS_PER_DAY);
    const t = transitionFrom({
      previousStage: c.previousStage,
      currentStage: c.currentStage,
      daysSinceLastTouch,
      staleAfterDays,
    });
    if (t) transitions.push({ candidate: c, transition: t });
  }

  const transitionCounts: Record<StageTransition, number> = {
    advanced: 0,
    held: 0,
    rejected: 0,
    withdrawn: 0,
    'offer-extended': 0,
  };
  for (const t of transitions) transitionCounts[t.transition] += 1;

  const drafts: CandidateStatusDraft[] = [];
  for (const t of transitions) {
    const draft = renderDraft({
      role: roleRes.value,
      candidate: t.candidate,
      transition: t.transition,
    });
    if (input.persister && draft.confidence >= persistThreshold) {
      const persistRes = await input.persister.persistDraft({
        workspaceId: input.workspaceId,
        threadId: `role-${input.roleId}-candidate-${t.candidate.candidateId}-${t.transition}`,
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
  drafts.sort((a, b) => transitionRank(b.transition) - transitionRank(a.transition) || a.candidateId.localeCompare(b.candidateId));

  const reviewQueue = buildReviewQueue(transitions);

  return skillOk({
    roleId: roleRes.value.roleId,
    roleTitle: roleRes.value.title,
    transitions: transitions.map((t) => ({
      candidateId: t.candidate.candidateId,
      transition: t.transition,
      fromStage: t.candidate.previousStage,
      toStage: t.candidate.currentStage,
    })),
    transitionCounts,
    drafts,
    reviewQueue,
  });
}

// ── Drafting ─────────────────────────────────────────────────────────────

function renderDraft(args: {
  role: RoleContext;
  candidate: CandidateRecord;
  transition: StageTransition;
}): CandidateStatusDraft {
  const { role, candidate, transition } = args;
  const firstName = candidate.candidate.name.split(/\s+/)[0] || candidate.candidate.name;
  const subject = renderSubject({ role, candidate, transition });

  const lines: string[] = [];
  lines.push(`Hi ${firstName},`);
  lines.push('');

  switch (transition) {
    case 'advanced':
      lines.push(
        `Quick update on the ${role.title} role at ${role.clientName}. The team ` +
          `wanted to take the next step — ${stageInviteCopy(candidate.currentStage)}.`,
      );
      lines.push('');
      lines.push(
        'I will follow up separately to lock the timing. If anything is shifting ' +
          'on your side in the next week or so just let me know and we can ' +
          'sequence around it.',
      );
      break;
    case 'held':
      lines.push(
        `Wanted to circle back on the ${role.title} role at ${role.clientName}. ` +
          `Nothing new from the team yet — they are working through interviews ` +
          `on their side this week. I am keeping a steady read on the loop ` +
          `and will reach out the moment there is something concrete.`,
      );
      if (role.onHold) {
        lines.push('');
        lines.push(
          'One transparency note: the role itself is on a brief hold while the ' +
            'team confirms scope. I will share the timeline as soon as it is clear.',
        );
      }
      break;
    case 'offer-extended':
      lines.push(
        `Congratulations — the team at ${role.clientName} has decided to extend ` +
          `an offer for the ${role.title} role. The detailed offer letter and ` +
          `comp package come directly from {{operator: comp/offer details}}, ` +
          `and I will walk you through it on a call before anything lands in ` +
          `your inbox.`,
      );
      lines.push('');
      lines.push(
        'Set aside 20 minutes when you can — happy to take any time that works for ' +
          'you today or tomorrow.',
      );
      break;
    case 'rejected':
      lines.push(
        `Wanted to follow up on the ${role.title} role at ${role.clientName}. ` +
          `After the team's full process, they have decided to move forward ` +
          `with another candidate for this role.`,
      );
      lines.push('');
      lines.push(
        'I know this is the part of the process that is the hardest to hear. ' +
          'You showed real strength in the loop — I would like to keep you in mind ' +
          'for the next role that fits, and I am happy to share what I picked up ' +
          'from the feedback when we talk.',
      );
      break;
    case 'withdrawn':
      lines.push(
        `Confirming I have updated the ${role.title} role at ${role.clientName} ` +
          `with your decision to step out of the process. Totally understood — ` +
          `I will close the loop on the client side today.`,
      );
      lines.push('');
      lines.push(
        'Thank you for the time you put in. When the timing is right for another ' +
          'search, please reach out — I would love to work with you again.',
      );
      break;
  }

  lines.push('');
  lines.push('Thanks,');
  lines.push(role.recruiter.name);
  lines.push('{{operator: firm signature}}');

  // Confidence: advanced + held are routine; rejected + offer-extended are
  // high-stakes and always require recruiter review before send.
  const confidence = transition === 'advanced'
    ? 0.78
    : transition === 'withdrawn'
      ? 0.7
      : transition === 'held'
        ? 0.66
        : 0.4; // offer-extended + rejected

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    candidateId: candidate.candidateId,
    transition,
    fromStage: candidate.previousStage,
    toStage: candidate.currentStage,
    toEmails: [candidate.candidate.email],
    ccEmails: [],
    subject,
    body: lines.join('\n'),
    tone: 'casual',
    confidence,
    persisted: false,
  };
}

function renderSubject(args: {
  role: RoleContext;
  candidate: CandidateRecord;
  transition: StageTransition;
}): string {
  switch (args.transition) {
    case 'advanced':
      return `Next step on the ${args.role.title} role — ${args.role.clientName}`;
    case 'held':
      return `Quick update on the ${args.role.title} role — ${args.role.clientName}`;
    case 'offer-extended':
      return `Update on the ${args.role.title} role — let's get on a quick call`;
    case 'rejected':
      return `Update on the ${args.role.title} role`;
    case 'withdrawn':
      return `Confirming you've stepped out — ${args.role.title}`;
  }
}

function stageInviteCopy(stage: PipelineStage): string {
  switch (stage) {
    case 'screened':
      return 'they would like to move you to the recruiter screen';
    case 'manager-screen':
      return 'they would like to set up the hiring-manager screen';
    case 'onsite':
      return 'they would like to schedule the onsite / panel loop';
    case 'reference-check':
      return 'they would like to begin the reference-check step';
    case 'offer-in-flight':
      return 'they are putting together an offer package for review';
    default:
      return 'the team is ready for the next step';
  }
}

// ── Recruiter review queue ───────────────────────────────────────────────

function buildReviewQueue(transitions: Array<{
  candidate: CandidateRecord;
  transition: StageTransition;
}>): RecruiterReviewQueue {
  const reviewable = transitions.filter(
    (t) => t.transition === 'offer-extended' || t.transition === 'rejected',
  );
  if (reviewable.length === 0) {
    return {
      candidateIds: [],
      message: 'No offer-extended or rejection drafts pending — recruiter review queue clear.',
    };
  }
  const offerCount = reviewable.filter((t) => t.transition === 'offer-extended').length;
  const rejectCount = reviewable.filter((t) => t.transition === 'rejected').length;
  const parts: string[] = [];
  if (offerCount > 0) parts.push(`${offerCount} offer-extended`);
  if (rejectCount > 0) parts.push(`${rejectCount} rejection`);
  return {
    candidateIds: reviewable.map((t) => t.candidate.candidateId),
    message:
      `${parts.join(' + ')} draft${reviewable.length === 1 ? '' : 's'} pending recruiter review — ` +
      'these never auto-send; please re-read before persisting.',
  };
}

function transitionRank(t: StageTransition): number {
  switch (t) {
    case 'offer-extended':
      return 5;
    case 'rejected':
      return 4;
    case 'advanced':
      return 3;
    case 'withdrawn':
      return 2;
    case 'held':
      return 1;
  }
}
