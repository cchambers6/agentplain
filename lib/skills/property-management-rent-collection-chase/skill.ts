/**
 * lib/skills/property-management-rent-collection-chase/skill.ts
 *
 * Drafts the per-tenant rent-collection chase for every delinquent
 * unit. Each unit gets exactly one draft scoped to its bucket (soft-
 * chase / formal-notice / escalation). Escalation units never get an
 * auto-persisted draft — they queue for PM review with the owner-
 * approval flag carried through.
 *
 * Per `lib/skills/prompts/property-management.ts` `draftToneGuidance`:
 *   - friendly + direct
 *   - never commit to a repair / maintenance timeline — defer with
 *     `{{operator: maintenance ETA}}`
 *   - never quote a specific dollar amount in the body
 *
 * Per `project_no_outbound_architecture.md`: DRAFTS only.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_ESCALATION_DAYS,
  DEFAULT_FORMAL_NOTICE_DAYS,
  DEFAULT_PERSIST_THRESHOLD,
  DEFAULT_SOFT_CHASE_DAYS,
  bucketFor,
  type BucketThresholds,
  type DelinquencyBucket,
  type OwnerReviewItem,
  type RentCollectionChaseInput,
  type RentCollectionChaseOutput,
  type TenantChaseDraft,
  type UnitDelinquency,
} from './types';

export async function runSkill(
  input: RentCollectionChaseInput,
): Promise<SkillResult<RentCollectionChaseOutput>> {
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;
  const thresholds: BucketThresholds = {
    softChase: input.softChaseAfterDays ?? DEFAULT_SOFT_CHASE_DAYS,
    formalNotice: input.formalNoticeAfterDays ?? DEFAULT_FORMAL_NOTICE_DAYS,
    escalation: input.escalationAfterDays ?? DEFAULT_ESCALATION_DAYS,
  };

  const unitsRes = await input.lookup.fetchDelinquentUnits({
    workspaceId: input.workspaceId,
  });
  if (!unitsRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `rent-roll fetch failed: ${unitsRes.error.message}`,
      unitsRes.error.code,
    );
  }

  const classified = unitsRes.value.map((u) => ({
    unit: u,
    bucket: bucketFor({ daysPastDue: u.daysPastDue, thresholds }),
  }));

  const bucketCounts: Record<DelinquencyBucket, number> = {
    grace: 0,
    'soft-chase': 0,
    'formal-notice': 0,
    escalation: 0,
  };
  for (const c of classified) bucketCounts[c.bucket] += 1;

  const drafts: TenantChaseDraft[] = [];
  for (const c of classified) {
    if (c.bucket === 'grace') continue;
    const draft = renderTenantChase({ unit: c.unit, bucket: c.bucket });

    // Stage the chase as a FOLLOW_UP_NUDGE approval item (PENDING). The PM
    // reviews + approves before their own mailbox sends. Sink failures are
    // non-fatal per the RentCollectionChaseInput.sink contract — a DB hiccup
    // must not drop the draft from the output.
    if (input.sink) {
      await input.sink.record({
        workspaceId: input.workspaceId,
        approval: { draft },
      });
    }

    if (input.persister && draft.confidence >= persistThreshold) {
      const persistRes = await input.persister.persistDraft({
        workspaceId: input.workspaceId,
        threadId: `lease-${c.unit.leaseId}-rent-${c.bucket}`,
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
  drafts.sort((a, b) => bucketRank(b.bucket) - bucketRank(a.bucket) || a.leaseId.localeCompare(b.leaseId));

  const ownerReview = classified
    .filter((c) => c.bucket === 'escalation')
    .map((c): OwnerReviewItem => ({
      leaseId: c.unit.leaseId,
      unitLabel: c.unit.unitLabel,
      daysPastDue: c.unit.daysPastDue,
      formalNoticeRequiresOwnerApproval: c.unit.formalNoticeRequiresOwnerApproval,
      note: c.unit.formalNoticeRequiresOwnerApproval
        ? `Unit ${c.unit.unitLabel} is ${c.unit.daysPastDue} days past due — owner approval required before a formal notice can be served.`
        : `Unit ${c.unit.unitLabel} is ${c.unit.daysPastDue} days past due — confirm jurisdiction's formal-notice path with counsel before serving.`,
    }));

  return skillOk({
    units: classified.map((c) => ({
      leaseId: c.unit.leaseId,
      bucket: c.bucket,
      daysPastDue: c.unit.daysPastDue,
    })),
    bucketCounts,
    drafts,
    ownerReview,
  });
}

// ── Drafting ─────────────────────────────────────────────────────────────

function renderTenantChase(args: {
  unit: UnitDelinquency;
  bucket: DelinquencyBucket;
}): TenantChaseDraft {
  const { unit, bucket } = args;
  const firstName = unit.primaryTenant.name.split(/\s+/)[0] || unit.primaryTenant.name;
  const subject = renderSubject({ unit, bucket });

  const lines: string[] = [];
  lines.push(`Hi ${firstName},`);
  lines.push('');

  switch (bucket) {
    case 'soft-chase':
      if (unit.paymentPlanInPlace) {
        lines.push(
          `Following up on rent for ${unit.unitLabel}. I see you have a payment ` +
            `plan in place — wanted to confirm we are still on the agreed schedule ` +
            `for the next installment.`,
        );
      } else {
        lines.push(
          `Following up on rent for ${unit.unitLabel}. We did not see this ` +
            `month's payment land yet and wanted to give you a friendly heads up ` +
            `before it crosses the next late window.`,
        );
        lines.push('');
        lines.push(
          `If something is going on that we should know about, just reply and we ` +
            `can talk through options — pay-as-you-can dates, plan setup, anything ` +
            `that keeps you in the unit and current.`,
        );
      }
      lines.push('');
      lines.push(
        'For balance and processing detail, the easiest source is your tenant ' +
          'portal. {{operator: amount due}} on our side as of this morning.',
      );
      break;
    case 'formal-notice':
      lines.push(
        `Following up again on rent for ${unit.unitLabel}. The account has now ` +
          `crossed the late-fee window — we want to keep this in friendly ` +
          `territory but the next step on our side becomes a formal notice if ` +
          `we don't hear from you this week.`,
      );
      lines.push('');
      lines.push(
        'A few practical paths:',
      );
      lines.push(`  - pay through the tenant portal (fastest to post)`);
      lines.push(`  - reply here to set up a written payment plan we both sign`);
      lines.push(`  - call us if a maintenance issue is the reason — we will ` +
        `address it on a parallel track ({{operator: maintenance ETA}})`);
      lines.push('');
      lines.push(
        'We would much rather work this out with you than file paperwork. ' +
          'Reply or call by end of week and we will pick up from there.',
      );
      break;
    case 'escalation':
      lines.push(
        `This is a serious follow-up on rent for ${unit.unitLabel}. The balance ` +
          `is now past the threshold where our office routes the account toward ` +
          `formal proceedings. We want to give you one more direct chance to ` +
          `respond before that path activates.`,
      );
      lines.push('');
      lines.push(
        'If we hear from you in the next 48 hours — reply here, call the office, ' +
          'or pay through the tenant portal — we can stop the escalation and put ' +
          'a written plan together.',
      );
      lines.push('');
      lines.push(
        '{{operator: formal-notice attachment + jurisdictional language confirmed ' +
          'by counsel}}',
      );
      break;
    case 'grace':
      break;
  }

  lines.push('');
  lines.push('Thanks,');
  lines.push(unit.propertyManager.name);
  lines.push('{{operator: management company signature + portal link}}');

  // Confidence: soft-chase is the high-confidence routine touch.
  // Formal-notice drops because the tone matters. Escalation is the
  // lowest confidence because legal language ALWAYS deserves a re-read.
  const confidence = bucket === 'soft-chase'
    ? unit.paymentPlanInPlace
      ? 0.78
      : 0.72
    : bucket === 'formal-notice'
      ? 0.6
      : 0.42;

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    leaseId: unit.leaseId,
    bucket,
    daysPastDue: unit.daysPastDue,
    outstandingBalanceUsd: unit.outstandingBalanceUsd,
    toEmails: [unit.primaryTenant.email],
    ccEmails: unit.coTenants.map((c) => c.email),
    subject,
    body: lines.join('\n'),
    tone: 'casual',
    confidence,
    persisted: false,
  };
}

function renderSubject(args: {
  unit: UnitDelinquency;
  bucket: DelinquencyBucket;
}): string {
  switch (args.bucket) {
    case 'soft-chase':
      return `Quick rent reminder — ${args.unit.unitLabel}`;
    case 'formal-notice':
      return `Important — rent past due for ${args.unit.unitLabel}`;
    case 'escalation':
      return `URGENT — rent escalation pending for ${args.unit.unitLabel}`;
    case 'grace':
      return '';
  }
}

function bucketRank(bucket: DelinquencyBucket): number {
  switch (bucket) {
    case 'escalation':
      return 3;
    case 'formal-notice':
      return 2;
    case 'soft-chase':
      return 1;
    case 'grace':
      return 0;
  }
}
