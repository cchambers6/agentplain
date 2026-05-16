/**
 * lib/skills/lead-triage-realestate/index.ts
 *
 * Public surface for the real-estate lead-triage skill. Callers import
 * from this file; the internals (skill.ts, types.ts, json-fetcher.ts) are
 * organized for readability but are not the supported entrypoint.
 *
 * Catalog entry lives in `lib/skills/registry.ts` under the same slug.
 */

export { runSkill, scoreLead } from './skill';
export { JsonLeadFetcher } from './json-fetcher';
export type {
  AgentRoster,
  DripCampaign,
  LeadCategory,
  LeadFetcher,
  LeadFirstTouchDraft,
  LeadRecord,
  LeadRouting,
  LeadScores,
  LeadSource,
  LeadTriageInput,
  LeadTriageOutput,
  TriagedLead,
} from './types';
export {
  categoryFor,
  DEFAULT_COLD_THRESHOLD,
  DEFAULT_HOT_THRESHOLD,
  DEFAULT_WARM_THRESHOLD,
} from './types';
