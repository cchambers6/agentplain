import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'cpa',
  audience: 'CPAs and tax practices',
  tone: 'formal' as const,
  noiseSignals: [
    'Tax-software vendor marketing (Drake, Lacerte upgrade promos not tied to a file)',
    'CPE / continuing-ed marketing',
    'Banking newsletters',
  ],
  leadSignals: [
    'Prospect asking about tax prep, bookkeeping, or advisory services',
    'Existing client referring a friend / business partner',
    'Small-business owner asking about entity selection / S-corp election',
  ],
  schedulingSignals: [
    'Tax-prep / 1040 review appointment',
    'Quarterly business review with a business client',
    'Year-end / planning meeting before year-end',
    'IRS / state notice review meeting',
  ],
  draftSignals: [
    'Client missing-document request (W-2, 1099, K-1, receipt)',
    'IRS notice — CP2000, CP504, audit notice',
    'Estimated-tax payment reminder needing client direction',
    'Question on a transaction\'s tax treatment',
  ],
  draftToneGuidance:
    'CPA replies are formal + careful. NEVER state a tax position, refund amount, ' +
    'or balance due in a draft — defer with {{operator: tax position}} or ' +
    '{{operator: refund/balance amount}}. Use phrasing like "based on the documents ' +
    'we have" / "subject to your CPA\'s review". Treat IRS notices with urgency: ' +
    'response window matters.',
  groundedIn:
    "lib/verticals/cpa/content.ts + " +
    "project_no_outbound_architecture.md + " +
    "feedback_no_quick_fixes.md (regulated profession; never state a tax position in a draft).",
};

export const cpaPrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'CPA',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
