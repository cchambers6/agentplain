/**
 * lib/integrations/outlook-calendar-mcp/propose-times.ts
 *
 * Thin adapter over the vendor-neutral slot-proposal arithmetic in
 * `lib/integrations/scheduling/propose-times.ts` — the same module the
 * Google connector adapts, so a proposal computed against an Outlook
 * calendar follows the exact same rules as one computed against Google.
 *
 * Result-type bridge: the shared module speaks mcp-core's `McpResult`; this
 * connector speaks `OutlookCalendarMcpResult`. The two are the identical
 * discriminated-union shape and `INVALID_ARGUMENT` exists in both error
 * unions, so the cast below is a zero-cost identity cast — the same
 * convention `./with-approval.ts` uses.
 */

import {
  validateProposeTimesInput as sharedValidate,
  type ValidatedProposeTimes,
} from '@/lib/integrations/scheduling/propose-times';
import type { OutlookCalendarMcpResult } from './types';
import type { ProposeTimesInput } from './actions';

export { computeProposals, type ValidatedProposeTimes } from '@/lib/integrations/scheduling/propose-times';

export function validateProposeTimesInput(
  input: ProposeTimesInput,
): OutlookCalendarMcpResult<ValidatedProposeTimes> {
  // Identical-shape cast: McpResult<T> ≅ OutlookCalendarMcpResult<T>.
  return sharedValidate(input) as OutlookCalendarMcpResult<ValidatedProposeTimes>;
}
