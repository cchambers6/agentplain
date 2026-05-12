import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'ria',
  audience: 'registered investment advisors (RIAs) and wealth managers',
  tone: 'formal' as const,
  noiseSignals: [
    'Custodian newsletters not tied to a specific account',
    'Asset-manager marketing emails',
    'Industry-publication digests',
  ],
  leadSignals: [
    'Prospect asking about advisory services / wealth management',
    'Referral from a CPA, attorney, or existing client',
    'Inheritance / liquidity event language ("I just received...", "sold a business")',
  ],
  schedulingSignals: [
    'Quarterly portfolio review / annual review',
    'Discovery / fact-find appointment with a prospect',
    'Estate-planning meeting coordination with attorney + client',
  ],
  draftSignals: [
    'Custodian / TAMP request for missing account documents',
    'Client question about a holding, performance, or fees',
    'RMD / contribution decision-needed prompt',
    'Tax-related client question routed from CPA',
  ],
  draftToneGuidance:
    'RIA replies are formal + fiduciary-aware. NEVER recommend a specific security, ' +
    'fund, or trade in a draft — defer with {{operator: investment recommendation}}. ' +
    'Avoid performance claims. Use "subject to your IPS", "consistent with our risk profile", "we should discuss". Compliance review applies to all client-facing comms; the draft must read as compliant on its face.',
  groundedIn:
    "lib/verticals/ria/content.ts + " +
    "project_no_outbound_architecture.md + " +
    "feedback_no_quick_fixes.md (fiduciary + SEC/state Adviser-Act guardrails).",
};

export const riaPrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'RIA',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
