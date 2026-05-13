import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'mortgage',
  audience: 'mortgage brokers and loan officers',
  tone: 'formal' as const,
  noiseSignals: [
    'Rate-aggregator newsletters (Bankrate, NerdWallet) — informational, not actionable',
    'CFPB compliance digests / NMLS renewal reminders (vendor, not noise — see vendor rules)',
    'Generic LinkedIn/recruiter messages',
    'Promotional emails from title vendors not tied to a live file',
  ],
  leadSignals: [
    'Pre-qualification request — "how much can I borrow", "what would my rate be"',
    'Realtor referral with a buyer in market',
    'Refinance inquiry naming a current rate or balance',
    'Self-employed / non-QM scenario looking for guidance',
  ],
  schedulingSignals: [
    '"Application appointment" / "loan consultation" requests',
    'Closing time coordination with title + buyer',
    'Conditional-approval review meeting',
  ],
  draftSignals: [
    'Doc-collection request — "still need your W-2 / paystub / bank statement"',
    'Rate-lock decision needing the broker\'s OK',
    'Underwriter conditions needing a borrower response',
    'IRS / tax-transcript / 4506-C clarification',
  ],
  draftToneGuidance:
    'Mortgage replies are precise + compliance-aware. Never quote a rate, APR, ' +
    'LTV, or DTI in a draft — defer to the operator with {{operator: rate/APR}}. ' +
    'Avoid promissory language ("you will qualify"). Use "conditional", "subject to underwriting", "based on the information you shared".',
  groundedIn:
    "lib/verticals/mortgage/content.ts + " +
    "project_no_outbound_architecture.md + " +
    "feedback_no_quick_fixes.md (compliance reply patterns must defer, not assert).",
};

export const mortgagePrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'Mortgage',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
