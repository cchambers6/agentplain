/**
 * lib/skills/month-end-close-cpa/index.ts
 *
 * Public surface for the CPA month-end-close skill. Callers import from
 * this file; the internals (skill.ts, types.ts, json-fetcher.ts) are
 * organized for readability but are not the supported entrypoint.
 *
 * Catalog entry lives in `lib/skills/registry.ts` under the same slug.
 */

export { runSkill } from './skill';
export { JsonCloseFetcher } from './json-fetcher';
export {
  QuickBooksCloseFetcher,
  QUICKBOOKS_NOT_CONNECTED_MESSAGE,
} from './quickbooks-fetcher';
export type {
  ChaseEmailDraft,
  ChecklistCategory,
  ChecklistItem,
  ChecklistItemStatus,
  ClientEngagement,
  ClientStatusUpdate,
  CloseFetcher,
  ContactPerson,
  DocStatus,
  EngagementScope,
  MonthEndCloseInput,
  MonthEndCloseOutput,
  ProposedReminder,
  ReceivedDoc,
} from './types';
export {
  DEFAULT_LATE_AFTER_DAYS,
  DEFAULT_REMINDER_IN_DAYS,
  statusFor,
} from './types';
