import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'real-estate',
  audience: 'realtors and brokerages',
  tone: 'casual' as const,
  noiseSignals: [
    'Pottery Barn / West Elm / Wayfair / Crate & Barrel promotional emails',
    'Redfin / Zillow generic neighborhood alerts (not addressed to the broker by name)',
    'Generic recruiter marker — "would love to chat about your job at..."',
    'Experian / credit-bureau alerts',
    'Newsletters from MLS vendors (vs. an actual MLS rule notice)',
  ],
  leadSignals: [
    'Buyer inquiry on a specific listing — address or MLS number mentioned',
    'Seller inquiry asking for a CMA, listing price, or representation',
    'Lender / loan officer introducing a pre-approved buyer',
    'Referral language ("a friend recommended you", "another agent referred")',
  ],
  schedulingSignals: [
    'Showing request — "can we see the property", "available for a walk-through"',
    'Listing consult — "want to talk about listing my house"',
    'Inspection / appraisal time coordination',
    'Closing day / signing appointment scheduling',
  ],
  draftSignals: [
    'Counter-offer or offer-response thread needing an action',
    'Buyer agent asking for disclosures / repair requests',
    'Title or lender asking for a missing document',
    'Direct question about price, condition, or contingencies',
  ],
  draftToneGuidance:
    'Real-estate replies are warm but transactional. Avoid sales-y language. ' +
    'Always defer numeric specifics (price counters, timelines) to the operator — ' +
    'the broker is licensed and signs the answer; the draft proposes the wording.',
  groundedIn:
    "lib/verticals/real-estate/content.ts (broker-owner + IA JTBD tables) + " +
    "project_no_outbound_architecture.md (drafts created, not sent) + " +
    "project_agentplain_mission_and_positioning.md (audience: 'realtors and brokerages').",
};

export const realEstatePrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'Real estate',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
