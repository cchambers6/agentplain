import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'recruiting',
  audience: 'staffing agencies and recruiting firms',
  tone: 'casual' as const,
  noiseSignals: [
    'Inbound from competing staffing agencies pitching services',
    'Newsletters from ATS vendors',
    'Generic SaaS product pitches',
  ],
  leadSignals: [
    'Hiring manager asking for candidate help on a role',
    'Candidate submitting resume / applying for a posted role',
    'Referral from an existing client about a new req',
  ],
  schedulingSignals: [
    'Phone-screen or interview scheduling with candidate or client',
    'Intake call request from a new hiring manager',
    'Reference-check call coordination',
  ],
  draftSignals: [
    'Candidate asking about role status, comp range, next step',
    'Hiring manager asking about candidate pipeline',
    'Offer / contract negotiation',
  ],
  draftToneGuidance:
    'Recruiting replies are warm but quick. With candidates: be respectful of ' +
    'their time + transparent about pipeline state. Never quote a salary range ' +
    'or offer detail in a draft — defer with {{operator: comp/offer details}}. ' +
    'With hiring managers: lead with the action, not pleasantries.',
  groundedIn:
    "lib/verticals/recruiting/content.ts + " +
    "project_no_outbound_architecture.md.",
};

export const recruitingPrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'Recruiting',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
