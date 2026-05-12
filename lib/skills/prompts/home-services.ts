import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'home-services',
  audience: 'home-services trades (plumbing, HVAC, electrical, roofing)',
  tone: 'casual' as const,
  noiseSignals: [
    'Wholesaler marketing (Ferguson, HD Supply promotional emails)',
    'Generic lead-gen platform sign-up pitches',
    'Trade publication newsletters',
  ],
  leadSignals: [
    'Homeowner inquiry — address + service type (leak, no AC, panel upgrade)',
    'Property manager referral for a unit',
    'Insurance-claim-driven inquiry',
  ],
  schedulingSignals: [
    '"When can you come out", "next available", "emergency"',
    'Estimate / quote walk-through scheduling',
    'Follow-up service after a prior visit',
  ],
  draftSignals: [
    'Customer asking about price, parts availability, or warranty',
    'Customer disputing an invoice or asking for itemization',
    'Permit / inspection coordination with the city',
  ],
  draftToneGuidance:
    'Home-services replies are plain-spoken + practical. With homeowners: ' +
    'acknowledge the problem, give a clear next step. Never quote a price or ' +
    'time-on-site in a draft — defer with {{operator: quote/time estimate}}. ' +
    'Emergency-language gets a faster ETA acknowledgement and an explicit "calling you shortly" line.',
  groundedIn:
    "lib/verticals/home-services/content.ts + " +
    "project_no_outbound_architecture.md.",
};

export const homeServicesPrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'Home services',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
