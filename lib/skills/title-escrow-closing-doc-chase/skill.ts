/**
 * lib/skills/title-escrow-closing-doc-chase/skill.ts
 *
 * Chases outstanding closing-file documents — one draft per responsible
 * party, batching that party's outstanding items into a single email so
 * the lender doesn't get five separate notes for one closing.
 *
 * Per `lib/skills/prompts/title-escrow.ts` `draftToneGuidance`:
 *   - never claim a title status (defer to {{operator: title status}})
 *   - never confirm a wire-instructions destination (defer to
 *     {{operator: wire confirmation}})
 *   - never commit to a recording / disbursement timeline without
 *     escrow officer confirmation
 *
 * Per `project_no_outbound_architecture.md`: DRAFTS only.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_LATE_AFTER_DAYS,
  DEFAULT_PERSIST_THRESHOLD,
  statusFor,
  type ChecklistItem,
  type ChecklistItemStatus,
  type ClosingDocChaseInput,
  type ClosingDocChaseOutput,
  type ClosingFile,
  type ClosingParty,
  type DocStatus,
  type PartyChaseDraft,
  type ReceivedDoc,
} from './types';

const MS_PER_DAY = 86_400_000;

export async function runSkill(
  input: ClosingDocChaseInput,
): Promise<SkillResult<ClosingDocChaseOutput>> {
  const now = input.now ?? new Date();
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;
  const lateAfterDays = input.lateAfterDays ?? DEFAULT_LATE_AFTER_DAYS;

  const fileRes = await input.fetcher.fetchFile({
    workspaceId: input.workspaceId,
    fileId: input.fileId,
  });
  if (!fileRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `file fetch failed: ${fileRes.error.message}`,
      fileRes.error.code,
    );
  }
  const checklistRes = await input.fetcher.fetchChecklist({
    workspaceId: input.workspaceId,
    fileId: input.fileId,
  });
  if (!checklistRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `checklist fetch failed: ${checklistRes.error.message}`,
      checklistRes.error.code,
    );
  }
  const receivedRes = await input.fetcher.fetchReceivedDocs({
    workspaceId: input.workspaceId,
    fileId: input.fileId,
  });
  if (!receivedRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `received-docs fetch failed: ${receivedRes.error.message}`,
      receivedRes.error.code,
    );
  }

  const items = bucketItems({
    checklist: checklistRes.value,
    received: receivedRes.value,
    now,
    lateAfterDays,
  });
  const bucketCounts: Record<DocStatus, number> = { received: 0, pending: 0, late: 0 };
  for (const i of items) bucketCounts[i.status] += 1;

  const drafts = buildPartyDrafts({
    file: fileRes.value,
    items: items.filter((i) => i.required && i.status !== 'received'),
  });

  for (const draft of drafts) {
    if (input.persister && draft.confidence >= persistThreshold) {
      const persistRes = await input.persister.persistDraft({
        workspaceId: input.workspaceId,
        threadId: `closing-${input.fileId}-${draft.party}-chase`,
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
  }

  const closingReady =
    items.filter((i) => i.required).every((i) => i.status === 'received');

  return skillOk({
    fileId: fileRes.value.fileId,
    propertyAddress: fileRes.value.propertyAddress,
    items,
    bucketCounts,
    drafts,
    closingReady,
  });
}

function bucketItems(args: {
  checklist: ChecklistItem[];
  received: ReceivedDoc[];
  now: Date;
  lateAfterDays: number;
}): ChecklistItemStatus[] {
  const { checklist, received, now, lateAfterDays } = args;
  const receivedBy = new Map<string, ReceivedDoc[]>();
  for (const doc of received) {
    if (!doc.satisfiesChecklistItemId) continue;
    const arr = receivedBy.get(doc.satisfiesChecklistItemId) ?? [];
    arr.push(doc);
    receivedBy.set(doc.satisfiesChecklistItemId, arr);
  }
  return checklist.map((item) => {
    const docs = receivedBy.get(item.id) ?? [];
    const hasReceipt = docs.length > 0;
    const daysPastDue = Math.floor((now.getTime() - item.dueAt.getTime()) / MS_PER_DAY);
    return {
      itemId: item.id,
      label: item.label,
      responsibleParty: item.responsibleParty,
      required: item.required,
      status: statusFor({ hasReceipt, daysPastDue, lateAfterDays }),
      daysPastDue,
    };
  });
}

function buildPartyDrafts(args: {
  file: ClosingFile;
  items: ChecklistItemStatus[];
}): PartyChaseDraft[] {
  const { file, items } = args;
  if (items.length === 0) return [];
  const byParty = new Map<ClosingParty, ChecklistItemStatus[]>();
  for (const i of items) {
    const arr = byParty.get(i.responsibleParty) ?? [];
    arr.push(i);
    byParty.set(i.responsibleParty, arr);
  }
  const drafts: PartyChaseDraft[] = [];
  for (const [party, partyItems] of byParty) {
    const contact = file.contacts.find((c) => c.role === party);
    if (!contact) continue; // skip parties with no contact on file
    drafts.push(renderPartyDraft({ file, party, contact, items: partyItems }));
  }
  // Stable order so tests are deterministic.
  drafts.sort((a, b) => a.party.localeCompare(b.party));
  return drafts;
}

function renderPartyDraft(args: {
  file: ClosingFile;
  party: ClosingParty;
  contact: { name: string; email: string };
  items: ChecklistItemStatus[];
}): PartyChaseDraft {
  const { file, party, contact, items } = args;
  const partyLabel = friendlyPartyLabel(party);
  const anyLate = items.some((i) => i.status === 'late');
  const subject = anyLate
    ? `Past-due items for the ${file.propertyAddress} closing — ${partyLabel}`
    : `Outstanding items for the ${file.propertyAddress} closing — ${partyLabel}`;

  const lines: string[] = [];
  lines.push(`Hi ${contact.name.split(/\s+/)[0]},`);
  lines.push('');
  lines.push(
    `Following up on the closing for ${file.propertyAddress} (file ${file.fileId}), ` +
      `scheduled for ${file.scheduledClosingDate}. The items below are still ` +
      `outstanding on your side of the file.`,
  );
  lines.push('');
  lines.push('Outstanding items:');
  for (const i of items) {
    const past = i.daysPastDue > 0 ? ` (${i.daysPastDue} day${i.daysPastDue === 1 ? '' : 's'} past target)` : '';
    lines.push(`  - ${i.label}${past}`);
  }
  lines.push('');
  if (anyLate) {
    lines.push(
      'A few of these are past the target receipt date — getting them across ' +
        'today keeps us on schedule for the closing.',
    );
  } else {
    lines.push(
      'No rush, but the sooner these land the smoother the closing.',
    );
  }
  lines.push('');
  lines.push(
    'For status updates on the title commitment / cure items, please direct ' +
      'questions to {{operator: title status}} — we will circle back with the ' +
      'escrow officer\'s confirmation. Wire instructions are confirmed only ' +
      'by phone to {{operator: wire confirmation}}.',
  );
  lines.push('');
  lines.push('Thanks,');
  lines.push(`${file.closingCoordinator.name}`);
  lines.push('{{operator: signature block}}');

  // Confidence: late items drop confidence so the coordinator re-reads
  // before sending — the tone matters when a closing is at risk.
  const confidence = anyLate ? 0.6 : 0.78;

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    party,
    itemIds: items.map((i) => i.itemId),
    toEmails: [contact.email],
    ccEmails: [file.closingCoordinator.email],
    subject,
    body: lines.join('\n'),
    tone: 'formal',
    confidence,
    persisted: false,
  };
}

function friendlyPartyLabel(party: ClosingParty): string {
  switch (party) {
    case 'buyer':
      return 'buyer';
    case 'seller':
      return 'seller';
    case 'lender':
      return 'lender';
    case 'buyer-attorney':
      return 'buyer\'s attorney';
    case 'seller-attorney':
      return 'seller\'s attorney';
    case 'underwriter':
      return 'underwriter';
    case 'realtor':
      return 'realtor';
  }
}
