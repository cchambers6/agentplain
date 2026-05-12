import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'insurance',
  audience: 'independent insurance agencies',
  tone: 'formal' as const,
  noiseSignals: [
    'Carrier marketing — generic "new product" newsletters not tied to a live policy',
    'Recruiter outreach for producers',
    'Industry-publication digests (Insurance Journal, PropertyCasualty360)',
  ],
  leadSignals: [
    'Quote request — auto/home/umbrella/commercial line + zip/state mentioned',
    'Referral language ("you came recommended", "my agent retired")',
    'Bundled-quote request (auto + home)',
    'Business-owner asking for a BOP / GL / professional-liability quote',
  ],
  schedulingSignals: [
    'Policy-review appointment — "annual review", "go over my coverage"',
    'Claims walk-through scheduling',
    'New-policy intake / fact-find appointment',
  ],
  draftSignals: [
    'Carrier underwriter requesting missing application data',
    'Claims-side request from an adjuster',
    'Policy renewal — premium change, coverage change',
    'Endorsement request from a current insured',
  ],
  draftToneGuidance:
    'Insurance replies are formal + regulatory-aware. Never quote a premium, ' +
    'coverage limit, or binding effective date — defer with {{operator: premium}} ' +
    'or {{operator: bind/effective date}}. Avoid the words "guarantee", "definitely", "ensure". Always say "subject to underwriting" for new business.',
  groundedIn:
    "lib/verticals/insurance/content.ts + " +
    "project_no_outbound_architecture.md + " +
    "feedback_no_quick_fixes.md (regulated industry: defer + never bind in a draft).",
};

export const insurancePrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'Insurance',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
