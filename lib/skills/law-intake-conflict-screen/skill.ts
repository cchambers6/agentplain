/**
 * lib/skills/law-intake-conflict-screen/skill.ts
 *
 * Deterministic conflict screen for a prospective-client intake at a
 * law firm. The skill compares the new matter's prospect + adverse
 * parties against the firm's existing ledger and produces:
 *
 *   1. A structured conflict report (direct / adverse / former-adverse).
 *   2. A formal internal-notice draft for the responsible attorney —
 *      with `{{operator: ...}}` merge fields for the legal conclusion
 *      so the attorney signs off before anything sends.
 *   3. On CLEAR: a deterministic engagement-letter draft surfaced as a
 *      PROCESS_DOC_DRAFT WorkApprovalQueueItem for attorney review.
 *   4. On FLAG / NEEDS-COUNSEL-REVIEW: a conflict-review card surfaced as
 *      a COMPLIANCE_FLAG WorkApprovalQueueItem with cited matches.
 *   5. Value-impact row via `sink` (hours saved = paralegal conflict
 *      screen time + engagement-letter drafting time).
 *
 * Per `lib/skills/prompts/law.ts` (formal tone, MRPC 1.1/1.6/1.18):
 *   - never assert a legal conclusion
 *   - never disclose other clients' confidential information
 *   - always route the partner / responsible attorney into the decision
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS only.
 * The customer's system sends. The `persister` writes a Gmail or Outlook
 * draft when confidence ≥ threshold. The `sink` writes WorkApprovalQueueItem
 * rows so the attorney sees the verdict card in /approvals without
 * leaving agentplain.
 *
 * Fire-gate: when `gateAllow === false` in the extended input the skill
 * returns NOT_APPLICABLE immediately, consistent with the pattern in
 * sibling skills (chief-of-staff, process-doc-drafter, etc.).
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import { renderEngagementLetter } from './engagement-letter';
import {
  DEFAULT_PERSIST_THRESHOLD,
  type ConflictHit,
  type ConflictScreenExtendedInput,
  type EngagementLetterDraft,
  type IntakeConflictScreenInput,
  type IntakeConflictScreenOutput,
  type IntakeNoticeDraft,
  type LedgerEntry,
  type ProspectiveIntake,
  type ScreenStatus,
} from './types';

/**
 * Run the conflict screen against the workspace ledger.
 *
 * Accepts either `IntakeConflictScreenInput` (base, backward-compatible)
 * or `ConflictScreenExtendedInput` (adds `sink`, `firmContext`,
 * `gateAllow`). Type union is intentional — the extended input is a
 * strict superset so existing callers compile unchanged.
 */
export async function runSkill(
  input: IntakeConflictScreenInput | ConflictScreenExtendedInput,
): Promise<SkillResult<IntakeConflictScreenOutput>> {
  // Fire-gate: honor the vacation-pause / schedule-window decision the
  // caller resolved before invoking. Consistent with the gateSkillFire
  // pattern in sibling callers (process-webhook-event, scheduler-sweep).
  const extended = input as ConflictScreenExtendedInput;
  if (extended.gateAllow === false) {
    return skillError(
      'NOT_APPLICABLE',
      `law-intake-conflict-screen skipped: fire gate denied`,
    );
  }

  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;
  const ledgerRes = await input.fetcher.fetchLedger({
    workspaceId: input.workspaceId,
  });
  if (!ledgerRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `ledger fetch failed: ${ledgerRes.error.message}`,
      ledgerRes.error.code,
    );
  }
  const ledger = ledgerRes.value;
  const conflicts = findConflicts(input.intake, ledger);
  const status = computeStatus(conflicts);
  const notice = renderAttorneyNotice({
    intake: input.intake,
    conflicts,
    status,
  });

  // Persist the attorney-notice draft (Gmail / Outlook) when above threshold.
  if (input.persister && notice.confidence >= persistThreshold) {
    const persistRes = await input.persister.persistDraft({
      workspaceId: input.workspaceId,
      threadId: `intake-${input.intake.matterId}-conflict-screen`,
      inReplyToMessageId: null,
      toEmails: notice.toEmails,
      subject: notice.subject,
      body: notice.body,
    });
    if (persistRes.ok) {
      notice.persisted = true;
      notice.providerDraftId = persistRes.value.providerDraftId;
    }
  }

  const screenOutput: IntakeConflictScreenOutput = {
    matterId: input.intake.matterId,
    prospectName: input.intake.prospectName,
    status,
    conflicts,
    attorneyNotice: notice,
  };

  // On CLEAR: render the engagement-letter draft deterministically.
  // On FLAG / NEEDS-COUNSEL: no letter — the conflict must be resolved first.
  let engagementLetter: EngagementLetterDraft | null = null;
  if (status === 'clear') {
    engagementLetter = renderEngagementLetter({
      intake: input.intake,
      matterId: input.intake.matterId,
      firmContext: extended.firmContext,
      now: input.now,
    });
  }

  // Write the verdict card (COMPLIANCE_FLAG or PROCESS_DOC_DRAFT) to the
  // approval queue via the sink. Sink failure is non-fatal — the screen
  // output is still returned to the caller; the operator can re-queue.
  if (extended.sink) {
    await extended.sink.record({
      workspaceId: input.workspaceId,
      screen: screenOutput,
      engagementLetter,
    });
  }

  return skillOk(screenOutput);
}

// ── Conflict detection ──────────────────────────────────────────────────

function findConflicts(
  intake: ProspectiveIntake,
  ledger: LedgerEntry[],
): ConflictHit[] {
  const hits: ConflictHit[] = [];
  const prospectNorm = normalize(intake.prospectName);
  for (const entry of ledger) {
    const entryNorm = normalize(entry.clientName);
    if (!entryNorm) continue;
    if (prospectNorm && namesOverlap(prospectNorm, entryNorm)) {
      hits.push({
        severity: 'direct',
        matchedAgainst: 'prospect',
        opposingPartyText: null,
        existingClient: entry,
        normalizedMatch: entryNorm,
      });
      continue;
    }
    for (const opposing of intake.opposingParties) {
      const oppNorm = normalize(opposing);
      if (!oppNorm) continue;
      if (namesOverlap(oppNorm, entryNorm)) {
        hits.push({
          severity: entry.status === 'active' ? 'adverse' : 'former-adverse',
          matchedAgainst: 'opposing-party',
          opposingPartyText: opposing,
          existingClient: entry,
          normalizedMatch: entryNorm,
        });
      }
    }
  }
  return hits;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,;:'"`]/g, ' ')
    .replace(/\b(llc|llp|inc|corp|corporation|co|company|p\.?c\.?|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Conservative overlap check: token-set intersection ≥ 2 tokens OR an
 * exact-normalized match. Counsel red-lines borderline calls — this is
 * the deterministic floor that flags obvious matches without claiming
 * false-positive-free coverage.
 */
function namesOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const ta = new Set(a.split(/\s+/).filter((t) => t.length >= 3));
  const tb = new Set(b.split(/\s+/).filter((t) => t.length >= 3));
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared >= 2;
}

function computeStatus(conflicts: ConflictHit[]): ScreenStatus {
  if (conflicts.length === 0) return 'clear';
  const hasDirect = conflicts.some((c) => c.severity === 'direct');
  const hasActiveAdverse = conflicts.some(
    (c) => c.severity === 'adverse' && c.existingClient.status === 'active',
  );
  if (hasDirect || hasActiveAdverse) return 'needs-counsel-review';
  return 'flagged';
}

// ── Notice rendering ────────────────────────────────────────────────────

function renderAttorneyNotice(args: {
  intake: ProspectiveIntake;
  conflicts: ConflictHit[];
  status: ScreenStatus;
}): IntakeNoticeDraft {
  const { intake, conflicts, status } = args;
  const subject = (() => {
    switch (status) {
      case 'clear':
        return `Conflict screen — clear — ${intake.prospectName} (matter ${intake.matterId})`;
      case 'flagged':
        return `Conflict screen — review recommended — ${intake.prospectName} (matter ${intake.matterId})`;
      case 'needs-counsel-review':
        return `Conflict screen — counsel review REQUIRED — ${intake.prospectName} (matter ${intake.matterId})`;
    }
  })();

  const lines: string[] = [];
  lines.push(`${intake.responsibleAttorney.name},`);
  lines.push('');
  lines.push(
    `New-matter intake for ${intake.prospectName} (matter ${intake.matterId}) ` +
      `ran through the deterministic conflict screen. Result: ${status}.`,
  );
  lines.push('');
  lines.push('Intake summary:');
  lines.push(`  Prospect: ${intake.prospectName} <${intake.prospectEmail}>`);
  if (intake.opposingParties.length > 0) {
    lines.push(`  Opposing parties: ${intake.opposingParties.join('; ')}`);
  }
  lines.push(`  Matter: ${intake.matterDescription}`);
  lines.push('');
  if (conflicts.length === 0) {
    lines.push(
      'No prospect / opposing-party overlaps with the firm ledger were found ' +
        'on the deterministic pass. {{operator: confirm no hand-off conflicts ' +
        'and clear the screen}}.',
    );
  } else {
    lines.push('Potential conflicts surfaced:');
    for (const c of conflicts) {
      const sev = c.severity === 'direct'
        ? 'DIRECT'
        : c.severity === 'adverse'
          ? 'ADVERSE (active matter)'
          : 'FORMER-ADVERSE (closed matter)';
      const against = c.matchedAgainst === 'prospect'
        ? 'prospect matches an existing firm client'
        : `opposing party "${c.opposingPartyText}" matches an existing firm client`;
      lines.push(
        `  - ${sev} — ${against}: ${c.existingClient.clientName}${c.existingClient.matterLabel ? ` (${c.existingClient.matterLabel})` : ''}`,
      );
    }
    lines.push('');
    lines.push(
      'Per MRPC 1.7 / 1.18, sentinel does not state a conflict conclusion. ' +
        '{{operator: legal conclusion}} on whether the firm may take the ' +
        'representation, and {{operator: waiver-or-decline action}} for the ' +
        'follow-through with the prospect.',
    );
  }
  lines.push('');
  lines.push('— agentplain intake conflict screen');

  // Confidence: clear / flagged are routine; needs-counsel-review drops
  // confidence so the attorney explicitly reads before the draft persists.
  const confidence = status === 'clear'
    ? 0.8
    : status === 'flagged'
      ? 0.68
      : 0.5;

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    toEmails: [intake.responsibleAttorney.email],
    ccEmails: [],
    subject,
    body: lines.join('\n'),
    tone: 'formal',
    confidence,
    persisted: false,
  };
}
