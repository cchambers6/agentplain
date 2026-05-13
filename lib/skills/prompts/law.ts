import {
  buildCategorizePrompt,
  buildCoordinatePrompt,
  buildDraftPrompt,
  buildSchedulePrompt,
} from './shared';
import type { VerticalPromptBundle } from './index';

const inputs = {
  verticalSlug: 'law',
  audience: 'small + mid-sized law firms',
  tone: 'formal' as const,
  noiseSignals: [
    'Legal-publication newsletters (ABA Journal, Law360 digests)',
    'Practice-management software marketing',
    'CLE provider promos',
  ],
  leadSignals: [
    'Prospective client describing a legal matter and asking about representation',
    'Existing client referring a friend with a new matter',
    'Opposing counsel introducing themselves on a new matter',
  ],
  schedulingSignals: [
    'Client consult / intake call',
    'Deposition / hearing / mediation scheduling',
    'Client meeting to review a draft document or strategy',
  ],
  draftSignals: [
    'Court deadline notice — answer, motion, response',
    'Opposing-counsel meet-and-confer / discovery request',
    'Client question on case status, strategy, or next step',
    'Document-collection request from a client',
  ],
  draftToneGuidance:
    'Legal replies are strictly formal. NEVER state a legal opinion, predict an ' +
    'outcome, or commit to a position in a draft — defer with {{operator: legal opinion}}. ' +
    'Acknowledge deadlines explicitly. Use phrases like "we will need to review", "subject to further analysis". Privileged-communication context applies; do not paraphrase client confidences outside the thread context.',
  groundedIn:
    "lib/verticals/law/content.ts + " +
    "project_no_outbound_architecture.md + " +
    "feedback_no_quick_fixes.md (privileged communication + UPL guardrails).",
};

export const lawPrompts: VerticalPromptBundle = {
  verticalSlug: inputs.verticalSlug,
  verticalName: 'Law',
  categorize: buildCategorizePrompt(inputs),
  draft: buildDraftPrompt(inputs),
  schedule: buildSchedulePrompt(inputs),
  coordinate: buildCoordinatePrompt(inputs),
};
