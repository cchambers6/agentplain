/**
 * lib/skills/office-admin/index.ts
 *
 * Public surface for the office-admin skill. Callers (runner,
 * persist-artifacts, tests) import from here; the internals
 * (classifier.ts, screen.ts, signals.ts, actions.ts, prompt.ts,
 * types.ts) are organized for readability but are not the supported
 * entrypoint.
 *
 * Catalog entry lives in `lib/skills/registry.ts` under the
 * `office-admin` slug.
 */

export { classifyOfficeAdmin } from './classifier';
export type { ClassifyOfficeAdminInput } from './classifier';
export { screenForAdminSignal } from './screen';
export type { AdminScreenResult, AdminScreenSignal } from './screen';
export {
  extractAdminSignals,
  extractVerificationCode,
  extractPrimaryUrl,
  extractExpiresAt,
  extractServiceName,
  extractAmount,
} from './signals';
export {
  buildAdminApprovalPayload,
  asActionableAdminClassification,
} from './actions';
export {
  OFFICE_ADMIN_CATEGORIES,
  OFFICE_ADMIN_CATEGORY_CONFIG,
  OFFICE_ADMIN_MIN_CONFIDENCE,
  categoryToApprovalKind,
  categoryToCardTitle,
  categoryToPriority,
} from './types';
export type {
  OfficeAdminApprovalKind,
  OfficeAdminApprovalPayload,
  OfficeAdminCategory,
  OfficeAdminClassification,
  OfficeAdminPriority,
  OfficeAdminSignals,
} from './types';
export { OFFICE_ADMIN_SYSTEM_PROMPT } from './prompt';
