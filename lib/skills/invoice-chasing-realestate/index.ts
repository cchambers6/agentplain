/**
 * lib/skills/invoice-chasing-realestate/index.ts
 *
 * Public surface for the invoice-chasing real-estate skill. Callers
 * import from this file; the internals (skill.ts, types.ts, json-fetcher.ts)
 * are organized for readability but are not the supported entrypoint.
 *
 * Catalog entry lives in `lib/skills/registry.ts` under the same slug.
 */

export { runSkill } from './skill';
export { JsonInvoiceFetcher } from './json-fetcher';
export {
  QuickBooksInvoiceFetcher,
  QUICKBOOKS_NOT_CONNECTED_MESSAGE,
} from './quickbooks-fetcher';
export type {
  ContactRecord,
  FollowUpTier,
  InvoiceChasingDraft,
  InvoiceChasingInput,
  InvoiceChasingOutput,
  InvoiceFetcher,
  InvoiceFollowUp,
  InvoiceRecord,
  SkipReason,
} from './types';
export { bucketTier, DEFAULT_FIRM_MAX_DAYS, DEFAULT_WARM_MAX_DAYS } from './types';
