/**
 * lib/skills/law-intake-conflict-screen/engagement-letter.ts
 *
 * Deterministic engagement-letter template. Called ONLY on a CLEAR
 * conflict-screen result. No LLM in the path — every field is either
 * directly from the intake or a `{{operator: ...}}` merge placeholder
 * so the responsible attorney fills it in before the letter goes out.
 *
 * Per `project_no_outbound_architecture.md`: this module produces a
 * DRAFT ONLY. Nothing here sends. The draft is surfaced as a
 * PROCESS_DOC_DRAFT WorkApprovalQueueItem for attorney review.
 *
 * Per `lib/skills/prompts/law.ts` (formal tone, MRPC 1.1/1.6/1.18):
 *   - No representation guarantee language without attorney sign-off.
 *   - All fee / scope / jurisdiction fields are `{{operator: ...}}`
 *     placeholders — the attorney supplies the binding terms.
 *   - The letter cites the conflict-screen verdict explicitly so the
 *     audit trail is self-contained.
 */

import { randomUUID } from 'node:crypto';
import type { EngagementLetterDraft, FirmContext, ProspectiveIntake } from './types';

export interface RenderEngagementLetterArgs {
  intake: ProspectiveIntake;
  matterId: string;
  firmContext: FirmContext | null | undefined;
  /** Clock injection for deterministic tests. */
  now?: Date;
}

/**
 * Render a plain-text engagement-letter draft from the intake data.
 * The attorney MUST review and edit all `{{operator: ...}}` fields
 * before the letter leaves the firm.
 */
export function renderEngagementLetter(
  args: RenderEngagementLetterArgs,
): EngagementLetterDraft {
  const { intake, matterId, firmContext } = args;
  const dateStr = (args.now ?? new Date()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const firmName = firmContext?.firmName ?? '{{operator: firm name}}';
  const firmAddress = firmContext?.firmAddress ?? '{{operator: firm address}}';
  const stateOfPractice =
    firmContext?.stateOfPractice ?? '{{operator: state}}';

  const lines: string[] = [];

  // Header
  lines.push(firmName);
  lines.push(firmAddress);
  lines.push('');
  lines.push(dateStr);
  lines.push('');

  // Addressee
  lines.push(`${intake.prospectName}`);
  lines.push(`${intake.prospectEmail}`);
  lines.push('');

  // Subject
  lines.push(
    `Re: Engagement Letter — ${intake.matterDescription.slice(0, 80)}${intake.matterDescription.length > 80 ? '…' : ''} (Matter ${matterId})`,
  );
  lines.push('');

  // Opening
  lines.push(`Dear ${intake.prospectName},`);
  lines.push('');
  lines.push(
    `Thank you for the opportunity to represent you in connection with the above-referenced matter. This letter confirms the terms of our engagement, subject to your review and acceptance.`,
  );
  lines.push('');

  // Scope
  lines.push('SCOPE OF REPRESENTATION');
  lines.push('');
  lines.push(
    `${firmName} will represent you in connection with: ${intake.matterDescription}`,
  );
  lines.push('');
  lines.push(
    `This representation is limited to the matter described above and does not extend to any other matters unless set forth in a separate engagement letter. {{operator: add or remove any scope limitations}}`,
  );
  lines.push('');

  // Responsible attorney
  lines.push('RESPONSIBLE ATTORNEY');
  lines.push('');
  lines.push(
    `${intake.responsibleAttorney.name} will be the attorney primarily responsible for your matter. Other members of the firm may assist from time to time. {{operator: confirm staffing}}`,
  );
  lines.push('');

  // Fees
  lines.push('FEES AND BILLING');
  lines.push('');
  lines.push(
    `Our fees for this matter will be: {{operator: fee arrangement — hourly at $__ per hour / flat fee of $__ / contingency at __% / other}}`,
  );
  lines.push('');
  lines.push(
    `{{operator: retainer terms, billing cycle, and payment instructions}}`,
  );
  lines.push('');

  // Jurisdiction
  lines.push('GOVERNING LAW');
  lines.push('');
  lines.push(
    `This engagement is governed by the laws of the State of ${stateOfPractice} and the applicable Rules of Professional Conduct.`,
  );
  lines.push('');

  // Conflict screen reference
  lines.push('CONFLICT CHECK');
  lines.push('');
  lines.push(
    `Prior to extending this engagement, ${firmName} conducted a deterministic conflict screen of our existing client and matter records. No conflicts were identified on the automated pass (matter ${matterId}). {{operator: confirm no hand-delivered or relationship-based conflicts exist that are not captured in the digital ledger}}`,
  );
  lines.push('');

  // Acceptance
  lines.push('ACCEPTANCE');
  lines.push('');
  lines.push(
    `If the foregoing terms are acceptable, please sign and return a copy of this letter. Retention of this firm constitutes your agreement to these terms.`,
  );
  lines.push('');
  lines.push('Sincerely,');
  lines.push('');
  lines.push(intake.responsibleAttorney.name);
  lines.push(firmName);
  lines.push('');
  lines.push('{{operator: add bar number and state}}');
  lines.push('');
  lines.push('ACCEPTED AND AGREED:');
  lines.push('');
  lines.push('Signature: _____________________________');
  lines.push(`Printed Name: ${intake.prospectName}`);
  lines.push('Date: __________________________________');

  return {
    draftId: randomUUID(),
    matterId,
    prospectName: intake.prospectName,
    body: lines.join('\n'),
  };
}
