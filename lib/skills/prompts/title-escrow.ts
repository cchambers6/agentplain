import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'title-escrow',
  audience: 'title and escrow companies',
  tone: 'formal' as const,
  noiseSignals: [
    'Underwriter newsletters not tied to a live file',
    'Realtor / lender marketing offers',
    'Generic e-recording vendor pitches',
  ],
  leadSignals: [
    'New file open request — buyer, seller, address, lender named',
    'Lender asking about availability for a closing date',
    'Realtor introducing a new transaction',
  ],
  schedulingSignals: [
    'Closing / signing appointment scheduling',
    'Pre-closing review with realtor / lender',
    'Remote online notarization (RON) session scheduling',
  ],
  draftSignals: [
    'Title-commitment exception requiring response',
    'Lender CD-revision / wire-instruction confirmation',
    'Underwriter clearance question on a curative item',
    'Seller missing-document request (survey, payoff authorization)',
  ],
  draftToneGuidance:
    'Title/escrow replies are strictly formal. NEVER quote wire instructions, ' +
    'closing figures, or payoff numbers — defer with {{operator: wire details}}. ' +
    'Always remind the counterparty to verify wire instructions by voice — wire-fraud risk is the dominant industry pattern.',
  groundedIn:
    "lib/verticals/title-escrow/content.ts + " +
    "project_no_outbound_architecture.md + " +
    "feedback_no_quick_fixes.md (wire-fraud guardrails are non-negotiable).",
};

export const titleEscrowPrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'Title and escrow',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
