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
export {
  ParsedMessageLeadFetcher,
  toLeadRecord,
} from './parsed-message-fetcher';
export {
  PrismaLeadTriageApprovalSink,
  buildLeadTriageApprovalRow,
  LEAD_TRIAGE_AGENT_SLUG,
  LEAD_TRIAGE_REF_TABLE,
  type LeadTriageApprovalSink,
  type LeadTriageSinkArgs,
} from './prisma-approval-sink';
export { runLeadTriageForEvent } from './run-for-event';
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
