import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'property-management',
  audience: 'property managers and small management companies',
  tone: 'casual' as const,
  noiseSignals: [
    'Vendor marketing emails for property-management software (AppFolio, Buildium pitches)',
    'Generic eviction-services / collections solicitation',
    'Newsletters from landlord associations',
  ],
  leadSignals: [
    'Prospective tenant inquiry on a specific unit / address',
    'Owner inquiring about management services',
    'Realtor referring an owner who wants to convert listing to rental',
  ],
  schedulingSignals: [
    'Showing request / unit tour',
    'Maintenance walk-through with vendor or owner',
    'Move-in / move-out inspection scheduling',
    'Annual rent-review meeting with owner',
  ],
  draftSignals: [
    'Tenant maintenance request needing approval routing',
    'Late-rent / payment-plan negotiation',
    'Lease renewal / rate change conversation',
    'Owner asking for a financial statement or distribution',
  ],
  draftToneGuidance:
    'Property-management replies are friendly + direct. With tenants: never ' +
    'commit to repair timelines without checking the operator — use {{operator: maintenance ETA}}. ' +
    'With owners: be plain-spoken about money; defer specific dollar amounts to the operator.',
  groundedIn:
    "lib/verticals/property-management/content.ts + " +
    "project_no_outbound_architecture.md.",
};

export const propertyManagementPrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'Property management',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
