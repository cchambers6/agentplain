/**
 * lib/skills/mortgage-document-chase/skill.ts
 *
 * Drafts the borrower-facing document chase for a single mortgage loan
 * file. Reads outstanding LOS items, buckets each one against the
 * broker's per-category cadence floor, groups the chase into a SINGLE
 * batched email (never one-per-doc spam), and surfaces a phone-call
 * nudge to the LO for items the written chase isn't moving.
 *
 * Per `lib/skills/prompts/mortgage.ts` `draftToneGuidance`:
 *   - never quote a rate, APR, LTV, or DTI — defer with
 *     `{{operator: rate/APR}}`
 *   - never use promissory language; always frame as "conditional" /
 *     "subject to underwriting"
 *   - drafts go to the borrower, signed by the LO
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS only.
 * The LO's email client sends.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_LATE_AFTER_DAYS,
  DEFAULT_PERSIST_THRESHOLD,
  DEFAULT_STUCK_AFTER_DAYS,
  bucketFor,
  type BorrowerChaseDraft,
  type DocBucket,
  type DocCategory,
  type DocStatus,
  type LoNudge,
  type LoanFile,
  type MortgageDocChaseInput,
  type MortgageDocChaseOutput,
  type OutstandingDoc,
} from './types';

const MS_PER_DAY = 86_400_000;

export async function runSkill(
  input: MortgageDocChaseInput,
): Promise<SkillResult<MortgageDocChaseOutput>> {
  const now = input.now ?? new Date();
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;
  const lateAfter = input.lateAfterDays ?? DEFAULT_LATE_AFTER_DAYS;
  const stuckAfter = input.stuckAfterDays ?? DEFAULT_STUCK_AFTER_DAYS;

  const fileRes = await input.lookup.fetchFile({
    workspaceId: input.workspaceId,
    loanId: input.loanId,
  });
  if (!fileRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `loan-file fetch failed: ${fileRes.error.message}`,
      fileRes.error.code,
    );
  }
  const docsRes = await input.lookup.fetchOutstandingDocs({
    workspaceId: input.workspaceId,
    loanId: input.loanId,
  });
  if (!docsRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `outstanding-docs fetch failed: ${docsRes.error.message}`,
      docsRes.error.code,
    );
  }

  const docStatuses = bucketDocs({
    docs: docsRes.value,
    now,
    lateAfter,
    stuckAfter,
  });
  const bucketCounts: Record<DocBucket, number> = {
    fresh: 0,
    pending: 0,
    late: 0,
    stuck: 0,
  };
  for (const d of docStatuses) bucketCounts[d.bucket] += 1;

  const borrowerChase = docStatuses.length === 0
    ? null
    : renderBorrowerChase({ file: fileRes.value, docStatuses });
  const loNudge = buildLoNudge({ docStatuses, file: fileRes.value });

  if (borrowerChase && input.persister && borrowerChase.confidence >= persistThreshold) {
    const persistRes = await input.persister.persistDraft({
      workspaceId: input.workspaceId,
      threadId: `loan-${input.loanId}-doc-chase`,
      inReplyToMessageId: null,
      toEmails: borrowerChase.toEmails,
      subject: borrowerChase.subject,
      body: borrowerChase.body,
    });
    if (persistRes.ok) {
      borrowerChase.persisted = true;
      borrowerChase.providerDraftId = persistRes.value.providerDraftId;
    }
  }

  return skillOk({
    loanId: fileRes.value.loanId,
    propertyAddress: fileRes.value.propertyAddress,
    docStatuses,
    bucketCounts,
    borrowerChase,
    loNudge,
  });
}

// ── Bucketing ────────────────────────────────────────────────────────────

function bucketDocs(args: {
  docs: OutstandingDoc[];
  now: Date;
  lateAfter: number;
  stuckAfter: number;
}): DocStatus[] {
  return args.docs.map((doc) => {
    const daysOutstanding = Math.floor(
      (args.now.getTime() - doc.requestedAt.getTime()) / MS_PER_DAY,
    );
    return {
      docId: doc.id,
      label: doc.label,
      category: doc.category,
      bucket: bucketFor({ daysOutstanding, lateAfter: args.lateAfter, stuckAfter: args.stuckAfter }),
      daysOutstanding,
      conditionAttached: doc.conditionAttached,
    };
  });
}

// ── Borrower chase rendering ─────────────────────────────────────────────

function renderBorrowerChase(args: {
  file: LoanFile;
  docStatuses: DocStatus[];
}): BorrowerChaseDraft {
  const { file, docStatuses } = args;
  const anyLate = docStatuses.some((d) => d.bucket === 'late' || d.bucket === 'stuck');
  const anyCondition = docStatuses.some((d) => d.conditionAttached);
  const subject = anyLate || anyCondition
    ? `Outstanding documents for your loan — ${file.propertyAddress}`
    : `Quick document follow-up for your loan — ${file.propertyAddress}`;

  const lines: string[] = [];
  const firstName = file.borrower.name.split(/\s+/)[0] || file.borrower.name;
  lines.push(`Hi ${firstName},`);
  lines.push('');
  lines.push(
    `Following up on the ${friendlyPurpose(file.purpose)} for ${file.propertyAddress}. ` +
      `Your file is in active review — the items below are still outstanding ` +
      `from our side, and the sooner we have them the smoother we keep your ` +
      `path toward closing on ${file.estimatedClosingDate}.`,
  );
  lines.push('');

  const byCategory = groupByCategory(docStatuses);
  lines.push('Outstanding documents:');
  for (const [category, docs] of byCategory) {
    lines.push(`  ${categoryLabel(category)}:`);
    for (const d of docs) {
      const tag = d.conditionAttached
        ? ' (underwriter condition)'
        : d.bucket === 'late' || d.bucket === 'stuck'
          ? ` (${d.daysOutstanding} day${d.daysOutstanding === 1 ? '' : 's'} outstanding)`
          : '';
      lines.push(`    - ${d.label}${tag}`);
    }
  }
  lines.push('');

  if (anyCondition) {
    lines.push(
      'A few of these are tied to an underwriter condition — they are the ones ' +
        'we need first because clearing them unlocks the next milestone on your file.',
    );
    lines.push('');
  } else if (anyLate) {
    lines.push(
      'These have been on the list a few days; we want to keep your timeline ' +
        'on track so anything you can send today helps us avoid a slip later.',
    );
    lines.push('');
  } else {
    lines.push(
      'No urgency yet — sending them at your earliest convenience is enough to ' +
        'keep things moving.',
    );
    lines.push('');
  }

  // Rate / APR / payment questions always defer.
  lines.push(
    'A reminder: if you have questions about your interest rate, monthly ' +
      'payment, or program — please call rather than email. I do not quote ' +
      'rate changes in writing because pricing is conditional. Final program ' +
      'detail lands under {{operator: rate/APR}} once underwriting clears.',
  );
  lines.push('');

  // Closing protocol — wire-fraud awareness boilerplate is REQUIRED on
  // every borrower-facing draft from a mortgage file (CFPB best-practice
  // pattern). Always defer to the operator's confirmed channel.
  lines.push(
    'A reminder on wire instructions: any wiring or payoff instructions ' +
      'will come only by phone confirmation through {{operator: closing wire ' +
      'confirmation channel}} — never by email reply.',
  );
  lines.push('');
  lines.push('Thanks,');
  lines.push(file.loanOfficer.name);
  lines.push('{{operator: NMLS ID + brokerage signature}}');

  // Confidence: stuck → low (phone call needed); late/condition → mid;
  // pending/fresh → high. The persistence floor stays the LO's call.
  const confidence = docStatuses.some((d) => d.bucket === 'stuck')
    ? 0.55
    : anyCondition
      ? 0.66
      : anyLate
        ? 0.7
        : 0.78;

  const toEmails = [file.borrower.email];
  const ccEmails = file.coBorrower ? [file.coBorrower.email] : [];

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    toEmails,
    ccEmails,
    subject,
    body: lines.join('\n'),
    tone: 'formal',
    confidence,
    persisted: false,
  };
}

// ── LO nudge ─────────────────────────────────────────────────────────────

function buildLoNudge(args: { docStatuses: DocStatus[]; file: LoanFile }): LoNudge {
  const stuck = args.docStatuses.filter((d) => d.bucket === 'stuck');
  if (stuck.length === 0) {
    return {
      needed: false,
      stuckDocIds: [],
      message: 'No stuck items. The written chase is the right next step.',
    };
  }
  const labels = stuck.map((d) => d.label).slice(0, 3).join('; ');
  const tail = stuck.length > 3 ? ` (+${stuck.length - 3} more)` : '';
  return {
    needed: true,
    stuckDocIds: stuck.map((d) => d.docId),
    message:
      `Call ${args.file.borrower.name.split(/\s+/)[0]} on the ${args.file.propertyAddress} ` +
      `file — ${stuck.length} item${stuck.length === 1 ? '' : 's'} past the ` +
      `written-chase window: ${labels}${tail}. Written reminders aren't moving these.`,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function groupByCategory(docs: DocStatus[]): Array<[DocCategory, DocStatus[]]> {
  const order: DocCategory[] = [
    'identity',
    'income',
    'assets',
    'declarations',
    'property',
    'credit-letter',
  ];
  const map = new Map<DocCategory, DocStatus[]>();
  for (const d of docs) {
    const arr = map.get(d.category) ?? [];
    arr.push(d);
    map.set(d.category, arr);
  }
  const out: Array<[DocCategory, DocStatus[]]> = [];
  for (const cat of order) {
    const list = map.get(cat);
    if (list && list.length > 0) out.push([cat, list]);
  }
  return out;
}

function categoryLabel(cat: DocCategory): string {
  switch (cat) {
    case 'identity':
      return 'Identity';
    case 'income':
      return 'Income verification';
    case 'assets':
      return 'Assets';
    case 'declarations':
      return 'Declarations + disclosures';
    case 'property':
      return 'Property';
    case 'credit-letter':
      return 'Letter of explanation';
  }
}

function friendlyPurpose(p: LoanFile['purpose']): string {
  switch (p) {
    case 'purchase':
      return 'purchase loan';
    case 'refinance':
      return 'rate-and-term refinance';
    case 'cash-out-refi':
      return 'cash-out refinance';
    case 'heloc':
      return 'HELOC';
  }
}
