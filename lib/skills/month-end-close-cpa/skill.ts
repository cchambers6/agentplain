/**
 * lib/skills/month-end-close-cpa/skill.ts
 *
 * Vertical-specific workflow: coordinate a CPA-firm month-end close for
 * a single client engagement. The skill's job is to take the friction
 * out of the doc-chase that consumes ~25% of staff hours through tax
 * season (per `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.4) —
 *
 *   1. Identify which checklist items are received / pending / late.
 *   2. Surface uncategorized receipts the staff needs to triage.
 *   3. Draft per-recipient chase emails — batched, formal CPA tone,
 *      never asserting a tax position.
 *   4. Propose calendar reminders for the CSM (the customer's calendar
 *      system schedules; we PROPOSE — see project_no_outbound_architecture.md).
 *   5. Draft a single client-facing status update the partner-or-CSM
 *      can send when ready.
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS. The
 * `persister` parameter is a `DraftPersister` (the same port `lib/skills/
 * draft.ts` uses) — production binding writes a Gmail or Outlook draft;
 * nothing in this file ever calls `messages.send`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: QuickBooks / TaxDome / Karbon /
 * Gmail SDK calls do NOT appear in this file. The skill speaks the
 * `CloseFetcher` + `DraftPersister` ports.
 *
 * Per `feedback_no_quick_fixes.md`: the chase email is CPA-vernacular —
 * "documents needed for the [period] close", "engagement letter",
 * "schedule K-1", "1099 batch" — not generic AR or finops boilerplate.
 *
 * Per `lib/skills/prompts/cpa.ts` `draftToneGuidance`: never state a tax
 * position, refund, or balance-due number; defer numerics to operator
 * merge fields.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type DraftPersister, type SkillResult } from '../types';
import {
  type EnrichmentResult,
  renderEnrichmentLine,
  renderMissingConnectorLine,
} from './enrichment';
import {
  DEFAULT_LATE_AFTER_DAYS,
  DEFAULT_REMINDER_IN_DAYS,
  statusFor,
  type ChaseEmailDraft,
  type ChecklistItem,
  type ChecklistItemStatus,
  type ClientEngagement,
  type ClientStatusUpdate,
  type ContactPerson,
  type DocStatus,
  type MonthEndCloseInput,
  type MonthEndCloseOutput,
  type ProposedReminder,
  type ReceivedDoc,
} from './types';

const EMPTY_ENRICHMENT: EnrichmentResult = {
  taxdomePendingReceived: null,
  karbonBlockedJobs: null,
  karbonActiveWorkflows: null,
};

const DEFAULT_PERSIST_THRESHOLD = 0.5;
const MS_PER_DAY = 86_400_000;

export async function runSkill(
  input: MonthEndCloseInput,
): Promise<SkillResult<MonthEndCloseOutput>> {
  const now = input.now ?? new Date();
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;
  const lateAfterDays = input.lateAfterDays ?? DEFAULT_LATE_AFTER_DAYS;
  const reminderInDays = input.reminderInDays ?? DEFAULT_REMINDER_IN_DAYS;

  const fetchArgs = {
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    periodMonth: input.periodMonth,
  };

  const engagementRes = await input.fetcher.fetchEngagement(fetchArgs);
  if (!engagementRes.ok) {
    // Preserve NOT_CONFIGURED + NOT_APPLICABLE upstream codes — they
    // name the gap honestly (QuickBooks not connected; client not on
    // file) and the operator surface relies on the distinction.
    if (
      engagementRes.error.code === 'NOT_CONFIGURED' ||
      engagementRes.error.code === 'NOT_APPLICABLE'
    ) {
      return skillError(
        engagementRes.error.code,
        engagementRes.error.message,
        engagementRes.error.reference,
      );
    }
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `engagement fetch failed: ${engagementRes.error.message}`,
      engagementRes.error.code,
    );
  }
  const engagement = engagementRes.value;

  const checklistRes = await input.fetcher.fetchChecklist(fetchArgs);
  if (!checklistRes.ok) {
    if (
      checklistRes.error.code === 'NOT_CONFIGURED' ||
      checklistRes.error.code === 'NOT_APPLICABLE'
    ) {
      return skillError(
        checklistRes.error.code,
        checklistRes.error.message,
        checklistRes.error.reference,
      );
    }
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `checklist fetch failed: ${checklistRes.error.message}`,
      checklistRes.error.code,
    );
  }
  const checklist = checklistRes.value;

  const receivedRes = await input.fetcher.fetchReceivedDocs(fetchArgs);
  if (!receivedRes.ok) {
    if (
      receivedRes.error.code === 'NOT_CONFIGURED' ||
      receivedRes.error.code === 'NOT_APPLICABLE'
    ) {
      return skillError(
        receivedRes.error.code,
        receivedRes.error.message,
        receivedRes.error.reference,
      );
    }
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `received-docs fetch failed: ${receivedRes.error.message}`,
      receivedRes.error.code,
    );
  }
  const received = receivedRes.value;

  // ── Categorize received docs by checklist item ───────────────────────
  const receivedByItem = new Map<string, ReceivedDoc[]>();
  const uncategorized: ReceivedDoc[] = [];
  for (const doc of received) {
    if (doc.satisfiesChecklistItemId) {
      const arr = receivedByItem.get(doc.satisfiesChecklistItemId) ?? [];
      arr.push(doc);
      receivedByItem.set(doc.satisfiesChecklistItemId, arr);
    } else {
      uncategorized.push(doc);
    }
  }

  // ── Bucket checklist items into received / pending / late ────────────
  const items: ChecklistItemStatus[] = checklist.map((item) =>
    bucketItem({ item, receivedByItem, now, lateAfterDays }),
  );
  const bucketCounts: Record<DocStatus, number> = { received: 0, pending: 0, late: 0 };
  for (const i of items) bucketCounts[i.status] += 1;

  // ── CPA-MCP enrichment (best-effort) ─────────────────────────────────
  // Read TaxDome + Karbon when the caller wired an enrichment source.
  // A failure here NEVER drops the close — fall back to all-null
  // enrichment so the chase email + status update still go out.
  let enrichment: EnrichmentResult = EMPTY_ENRICHMENT;
  let missingConnectorsNote: string | null = null;
  if (input.enrichmentSource) {
    try {
      enrichment = await input.enrichmentSource.read({
        workspaceId: input.workspaceId,
        taxdomeClientId: input.taxdomeClientId ?? null,
        karbonClientId: input.karbonClientId ?? null,
      });
    } catch (err) {
      console.warn(
        `month-end-close-cpa: enrichment read failed (continuing without): ${err instanceof Error ? err.message : String(err)}`,
      );
      enrichment = EMPTY_ENRICHMENT;
    }
    // Only render the missing-connector line when the workspace tried
    // to enrich — otherwise we'd fabricate a "Connect TaxDome + Karbon"
    // nag on every close, even for workspaces with no CPA connectors
    // wired by design.
    missingConnectorsNote = renderMissingConnectorLine(enrichment);
  }
  const enrichmentLine = renderEnrichmentLine(enrichment);

  // ── Build chase emails (batched per recipient) ───────────────────────
  const itemsToChase = items.filter(
    (i) => (i.status === 'pending' || i.status === 'late') && needsChase(i, checklist),
  );
  const chaseEmails = buildChaseEmails({
    engagement,
    items: itemsToChase,
    checklist,
    now,
    enrichmentLine,
  });

  // ── Persist chase drafts ─────────────────────────────────────────────
  for (const draft of chaseEmails) {
    if (input.persister && draft.confidence >= persistThreshold) {
      await persistChaseDraft(input.persister, {
        workspaceId: input.workspaceId,
        engagement,
        draft,
      });
    }
  }

  // ── Propose reminders (one per chase email) ──────────────────────────
  const reminders: ProposedReminder[] = chaseEmails.map((d) => ({
    itemIds: d.itemIds,
    recipientEmail: d.toEmails[0],
    reminderOnLocalDate: addDaysISODate(now, reminderInDays),
    rationale: `Second-touch reminder ${reminderInDays} days after the chase. Per project_no_outbound_architecture.md the customer's calendar system schedules; we propose.`,
  }));

  // ── Build client status update ───────────────────────────────────────
  const statusUpdate = buildStatusUpdate({ engagement, items, now, enrichmentLine });
  if (input.persister && statusUpdate.confidence >= persistThreshold) {
    await persistStatusUpdate(input.persister, {
      workspaceId: input.workspaceId,
      engagement,
      draft: statusUpdate,
    });
  }

  const allRequiredReceived = items
    .filter((i) => i.required)
    .every((i) => i.status === 'received');
  const closeReady = allRequiredReceived && engagement.partnerSignoff;

  return skillOk({
    clientId: engagement.clientId,
    clientName: engagement.clientName,
    periodMonth: engagement.periodMonth,
    items,
    bucketCounts,
    uncategorizedReceipts: uncategorized.map((d) => ({
      id: d.id,
      filename: d.filename,
      source: d.source,
    })),
    chaseEmails,
    reminders,
    statusUpdate,
    closeReady,
    enrichment,
    missingConnectorsNote,
  });
}

// ── Bucketing ───────────────────────────────────────────────────────────

interface BucketArgs {
  item: ChecklistItem;
  receivedByItem: Map<string, ReceivedDoc[]>;
  now: Date;
  lateAfterDays: number;
}

function bucketItem(args: BucketArgs): ChecklistItemStatus {
  const { item, receivedByItem, now, lateAfterDays } = args;
  const docs = (receivedByItem.get(item.id) ?? []).slice().sort(
    (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime(),
  );
  const hasReceipt = docs.length > 0;
  const daysPastDue = Math.floor((now.getTime() - item.dueAt.getTime()) / MS_PER_DAY);
  const status = statusFor({ hasReceipt, daysPastDue, lateAfterDays });
  return {
    itemId: item.id,
    label: item.label,
    category: item.category,
    required: item.required,
    status,
    daysPastDue,
    receivedDocs: docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      receivedAt: d.receivedAt,
    })),
  };
}

function needsChase(status: ChecklistItemStatus, checklist: ChecklistItem[]): boolean {
  // Skip optional items — they're tracked but not chased hard. CPA tone:
  // we never harass clients about nice-to-haves.
  const item = checklist.find((c) => c.id === status.itemId);
  if (!item) return false;
  return item.required;
}

// ── Chase email rendering ───────────────────────────────────────────────

interface ChaseGroup {
  contact: ContactPerson;
  ccEmails: string[];
  itemIds: string[];
  items: ChecklistItemStatus[];
}

function buildChaseEmails(args: {
  engagement: ClientEngagement;
  items: ChecklistItemStatus[];
  checklist: ChecklistItem[];
  now: Date;
  enrichmentLine: string | null;
}): ChaseEmailDraft[] {
  const { engagement, items } = args;
  if (items.length === 0) return [];

  // Single chase email per close, batched to the primary contact + the
  // engagement's cc list. Sending one email for five line items rather
  // than five emails for one item each is the explicit CPA preference
  // (per the CSM JTBD row "Run the quarterly client check-in" / unified
  // status update).
  const groups: ChaseGroup[] = [
    {
      contact: engagement.primaryContact,
      ccEmails: engagement.ccContacts.map((c) => c.email),
      itemIds: items.map((i) => i.itemId),
      items,
    },
  ];

  return groups.map((group) =>
    renderChaseDraft({ engagement, group, enrichmentLine: args.enrichmentLine }),
  );
}

function renderChaseDraft(args: {
  engagement: ClientEngagement;
  group: ChaseGroup;
  enrichmentLine: string | null;
}): ChaseEmailDraft {
  const { engagement, group } = args;
  const periodLabel = formatPeriod(engagement.periodMonth);
  const greeting = pickGreeting(group.contact);
  const anyLate = group.items.some((i) => i.status === 'late');
  const subject = anyLate
    ? `Past-due items for the ${periodLabel} close — ${engagement.clientName}`
    : `Documents needed for the ${periodLabel} close — ${engagement.clientName}`;

  const itemLines = group.items.map((i) => {
    const past = i.daysPastDue > 0 ? ` (${i.daysPastDue} day${i.daysPastDue === 1 ? '' : 's'} past target)` : '';
    return `  - ${i.label}${past}`;
  });

  const bodyLines = [
    greeting,
    '',
    `We are working through your ${periodLabel} month-end close and the items below ` +
      'are outstanding on our checklist. Could you send these over at your earliest ' +
      'convenience so we can keep the close on schedule?',
    '',
    'Outstanding items:',
    ...itemLines,
    '',
    anyLate
      ? 'A couple of these are past the target receipt date — sending today would help ' +
        'us avoid pushing the close back.'
      : 'No rush, but the sooner these land the smoother the close.',
  ];
  if (args.enrichmentLine) {
    bodyLines.push('');
    bodyLines.push(
      `On our side, ${args.enrichmentLine} We are working through those alongside this chase.`,
    );
  }
  bodyLines.push(
    '',
    'If you have already sent any of these, please disregard — sometimes the doc ' +
      'portal lag means we are chasing something that is on its way. Reply with ' +
      'a quick note and we will reconcile on our side.',
    '',
    `Per our engagement letter for ${periodLabel}, please direct any questions about ` +
      'a tax position, refund, or balance to {{operator: tax position}} — we will ' +
      'circle back after review.',
    '',
    'Thank you,',
    '{{operator: signature}}',
  );
  const body = bodyLines.join('\n');

  // Confidence:
  //  - Late items raise the urgency but lower confidence (the CSM should
  //    re-read the tone before sending — past-due wording can damage a
  //    client relationship if mis-pitched). Per cpa.ts tone guidance.
  //  - Pending-only batch is high confidence; routine work.
  const confidence = anyLate ? 0.6 : 0.78;

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    itemIds: group.itemIds,
    toEmails: [group.contact.email],
    ccEmails: group.ccEmails,
    subject,
    body,
    tone: 'formal',
    confidence,
    persisted: false,
  };
}

// ── Status update rendering ─────────────────────────────────────────────

function buildStatusUpdate(args: {
  engagement: ClientEngagement;
  items: ChecklistItemStatus[];
  now: Date;
  enrichmentLine: string | null;
}): ClientStatusUpdate {
  const { engagement, items } = args;
  const periodLabel = formatPeriod(engagement.periodMonth);
  const received = items.filter((i) => i.status === 'received');
  const pending = items.filter((i) => i.status === 'pending');
  const late = items.filter((i) => i.status === 'late');
  const allRequiredIn = items.filter((i) => i.required).every((i) => i.status === 'received');

  const subject = allRequiredIn
    ? `${periodLabel} close — all required documents received`
    : `${periodLabel} close — status update`;

  const greeting = pickGreeting(engagement.primaryContact);

  const blocks: string[] = [greeting, ''];
  blocks.push(
    `Quick status note on your ${periodLabel} close. Here is where we stand on the ` +
      'document checklist:',
  );
  blocks.push('');
  blocks.push(`Received: ${received.length}`);
  for (const r of received.slice(0, 6)) blocks.push(`  - ${r.label}`);
  if (received.length > 6) blocks.push(`  ...and ${received.length - 6} more`);
  blocks.push('');
  blocks.push(`Pending: ${pending.length}`);
  for (const p of pending.slice(0, 6)) blocks.push(`  - ${p.label}`);
  if (pending.length > 6) blocks.push(`  ...and ${pending.length - 6} more`);
  blocks.push('');
  if (late.length > 0) {
    blocks.push(`Past-target: ${late.length}`);
    for (const l of late.slice(0, 6)) {
      blocks.push(`  - ${l.label} (${l.daysPastDue} day${l.daysPastDue === 1 ? '' : 's'} past target)`);
    }
    if (late.length > 6) blocks.push(`  ...and ${late.length - 6} more`);
    blocks.push('');
  }

  if (allRequiredIn && engagement.partnerSignoff) {
    blocks.push(
      `All required items are in and the close has been signed off on our end. ` +
        `Final reports will follow under separate cover.`,
    );
  } else if (allRequiredIn) {
    blocks.push(
      `All required items are in. The partner review is the last step on our side; ` +
        `final reports follow shortly thereafter.`,
    );
  } else {
    blocks.push(
      `We are sending a separate note on the outstanding items. Once everything is in, ` +
        `the partner review takes about {{operator: turnaround days}} business days ` +
        `before final reports go out.`,
    );
  }

  if (args.enrichmentLine) {
    blocks.push('');
    blocks.push(`In the meantime on our side: ${args.enrichmentLine}`);
  }

  blocks.push('');
  blocks.push(
    'Please direct any questions about a specific tax position, refund, or balance to ' +
      '{{operator: tax position}} — we will follow up after review.',
  );
  blocks.push('');
  blocks.push('Thank you,');
  blocks.push('{{operator: signature}}');

  // Confidence:
  //  - All-clear close is high (routine, no operator-judgment numerics).
  //  - In-flight close drops slightly because the partner-review wording
  //    is sensitive — the CSM should re-confirm the turnaround number.
  const confidence = allRequiredIn ? 0.78 : 0.62;

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    toEmails: [engagement.primaryContact.email],
    ccEmails: engagement.ccContacts.map((c) => c.email),
    subject,
    body: blocks.join('\n'),
    tone: 'formal',
    confidence,
    persisted: false,
  };
}

// ── Persistence ─────────────────────────────────────────────────────────

async function persistChaseDraft(
  persister: DraftPersister,
  args: {
    workspaceId: string;
    engagement: ClientEngagement;
    draft: ChaseEmailDraft;
  },
): Promise<void> {
  const res = await persister.persistDraft({
    workspaceId: args.workspaceId,
    threadId: `close-${args.engagement.clientId}-${args.engagement.periodMonth}-chase`,
    inReplyToMessageId: null,
    toEmails: args.draft.toEmails,
    subject: args.draft.subject,
    body: args.draft.body,
  });
  if (res.ok) {
    args.draft.persisted = true;
    args.draft.providerDraftId = res.value.providerDraftId;
  }
}

async function persistStatusUpdate(
  persister: DraftPersister,
  args: {
    workspaceId: string;
    engagement: ClientEngagement;
    draft: ClientStatusUpdate;
  },
): Promise<void> {
  const res = await persister.persistDraft({
    workspaceId: args.workspaceId,
    threadId: `close-${args.engagement.clientId}-${args.engagement.periodMonth}-status`,
    inReplyToMessageId: null,
    toEmails: args.draft.toEmails,
    subject: args.draft.subject,
    body: args.draft.body,
  });
  if (res.ok) {
    args.draft.persisted = true;
    args.draft.providerDraftId = res.value.providerDraftId;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function pickGreeting(contact: ContactPerson): string {
  const firstName = contact.name.split(/\s+/)[0] || '{{operator: first name}}';
  // Formal CPA tone — but the modern CSM uses first names with owners,
  // bookkeepers, and admins alike. Reserve "Dear" for `other` (uncertain).
  if (contact.role === 'other') return `Dear ${contact.name},`;
  return `Hi ${firstName},`;
}

function formatPeriod(periodMonth: string): string {
  // `2026-04` → `April 2026`
  const [yr, mo] = periodMonth.split('-');
  const year = Number(yr);
  const monthIdx = Number(mo) - 1;
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  if (
    !Number.isFinite(year) ||
    !Number.isInteger(monthIdx) ||
    monthIdx < 0 ||
    monthIdx > 11
  ) {
    return periodMonth;
  }
  return `${months[monthIdx]} ${year}`;
}

function addDaysISODate(base: Date, days: number): string {
  const next = new Date(base.getTime() + days * MS_PER_DAY);
  const yr = next.getUTCFullYear();
  const mo = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(next.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}
