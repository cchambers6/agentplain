/**
 * lib/skills/ria-client-update-draft/skill.ts
 *
 * Drafts a single quarterly household update for an RIA practice.
 *
 * Hard rules (per Advisers Act § 206 + Rule 206(4)-1 + Rule 204A-1, and
 * `lib/skills/prompts/ria.ts` `draftToneGuidance`):
 *   - never state an investment recommendation or market call
 *   - never claim past performance as predictive of future returns
 *   - never render specific dollar amounts — defer to {{advisor: ...}}
 *   - always include the Form ADV / Part 2A pointer + custody-rule note
 *   - sign with the advisor of record's name and the firm's regulatory
 *     boilerplate via merge fields the advisor edits before sending
 *
 * Per `project_no_outbound_architecture.md`: draft only. The advisor's
 * email client sends.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_PERSIST_THRESHOLD,
  type AdvisorNote,
  type ClientHousehold,
  type ClientUpdateDraft,
  type PortfolioSnapshot,
  type RiaClientUpdateInput,
  type RiaClientUpdateOutput,
} from './types';

export async function runSkill(
  input: RiaClientUpdateInput,
): Promise<SkillResult<RiaClientUpdateOutput>> {
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;
  const householdRes = await input.fetcher.fetchHousehold({
    workspaceId: input.workspaceId,
    householdId: input.householdId,
  });
  if (!householdRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `household fetch failed: ${householdRes.error.message}`,
      householdRes.error.code,
    );
  }
  const snapshotRes = await input.fetcher.fetchSnapshot({
    workspaceId: input.workspaceId,
    householdId: input.householdId,
    periodLabel: input.periodLabel,
  });
  if (!snapshotRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `snapshot fetch failed: ${snapshotRes.error.message}`,
      snapshotRes.error.code,
    );
  }
  const notesRes = await input.fetcher.fetchAdvisorNotes({
    workspaceId: input.workspaceId,
    householdId: input.householdId,
    periodLabel: input.periodLabel,
  });
  if (!notesRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `notes fetch failed: ${notesRes.error.message}`,
      notesRes.error.code,
    );
  }

  const draft = renderClientUpdate({
    household: householdRes.value,
    snapshot: snapshotRes.value,
    notes: notesRes.value,
  });

  if (input.persister && draft.confidence >= persistThreshold) {
    const persistRes = await input.persister.persistDraft({
      workspaceId: input.workspaceId,
      threadId: `household-${input.householdId}-${input.periodLabel}-update`,
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

  return skillOk({
    householdId: input.householdId,
    periodLabel: input.periodLabel,
    noteCount: notesRes.value.length,
    draft,
  });
}

function renderClientUpdate(args: {
  household: ClientHousehold;
  snapshot: PortfolioSnapshot;
  notes: AdvisorNote[];
}): ClientUpdateDraft {
  const { household, snapshot, notes } = args;
  const firstName = household.primaryContact.name.split(/\s+/)[0] || household.displayName;
  const subject = `${household.periodLabel} update — ${household.displayName}`;

  const blocks: string[] = [];
  blocks.push(`Dear ${firstName},`);
  blocks.push('');
  blocks.push(
    `Below is your ${household.periodLabel} update. Performance figures, ` +
      'account balances, and any forward-looking discussion belong with the ' +
      'advisor — those land below in {{advisor: ...}} merge fields for review ' +
      'before this goes out.',
  );
  blocks.push('');

  // Activity highlights — derived from the snapshot booleans, never numbers.
  const activity: string[] = [];
  if (snapshot.reviewedThisPeriod) {
    activity.push('We met for the planning review this period.');
  }
  if (snapshot.rebalanced) {
    activity.push(
      'Your portfolio was rebalanced this period to keep allocations within ' +
        'the target ranges in your IPS.',
    );
  }
  if (snapshot.hadContributions) {
    activity.push(
      'Contribution activity was recorded this period — {{advisor: confirm ' +
        'contribution detail}}.',
    );
  }
  if (snapshot.hadDistributions) {
    activity.push(
      'Distribution activity was recorded this period — {{advisor: confirm ' +
        'distribution detail}}.',
    );
  }
  if (activity.length === 0) {
    activity.push(
      'No portfolio activity was recorded this period. {{advisor: note any ' +
        'non-portfolio touchpoints}}.',
    );
  }
  blocks.push('Activity this period:');
  for (const a of activity) blocks.push(`  - ${a}`);
  blocks.push('');

  if (notes.length > 0) {
    blocks.push('Notes from your advisor:');
    for (const n of notes) blocks.push(`  - ${n.label} — ${n.detail}`);
    blocks.push('');
  }

  // Performance + forward-looking copy — always merge fields, never numbers.
  blocks.push('Performance + outlook:');
  blocks.push(
    `  {{advisor: ${household.periodLabel} performance recap — keep verbal, ` +
      'no forward-looking statements without the standard caveats}}',
  );
  blocks.push('');

  // Required regulatory pointers — Form ADV + custody-rule disclosures.
  blocks.push(
    'A reminder that our current Form ADV Part 2A is available on request ' +
      'or via {{advisor: Form ADV link}}. Statements for your account come ' +
      'directly from {{advisor: qualified custodian name}}; if you have not ' +
      'received them, please let us know so we can resend on the custodian ' +
      'side.',
  );
  blocks.push('');
  blocks.push(`Best regards,`);
  blocks.push(household.advisor.name);
  blocks.push('{{advisor: firm name + IA disclosures footer}}');

  // Confidence: a routine quarter (no contributions / distributions, with
  // an advisor note attached) is the high-confidence path. Any
  // distribution / contribution flag drops it so the advisor re-reads
  // before sending.
  const flaggedActivity = snapshot.hadContributions || snapshot.hadDistributions;
  const confidence = flaggedActivity ? 0.6 : notes.length > 0 ? 0.78 : 0.68;

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    toEmails: [household.primaryContact.email],
    ccEmails: household.copyContacts.map((c) => c.email),
    subject,
    body: blocks.join('\n'),
    tone: 'formal',
    confidence,
    persisted: false,
  };
}
