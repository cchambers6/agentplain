/**
 * lib/integrations/google-calendar-mcp/propose-times.ts
 *
 * Thin adapter over the vendor-neutral slot-proposal arithmetic in
 * `lib/integrations/scheduling/propose-times.ts`. Both server implementations
 * (`./server.ts` prod, `./test-server.ts` fixture) run their free/busy read
 * first, then hand the busy intervals to the shared module — so Google and
 * Outlook propose by the exact same rules, and the fixture server proposes
 * exactly like production does.
 *
 * Result-type bridge: the shared module speaks mcp-core's `McpResult`; this
 * connector speaks `GoogleCalendarMcpResult`. The two are the identical
 * discriminated-union shape and `INVALID_ARGUMENT` exists in both error
 * unions, so the cast below is a zero-cost identity cast — the same
 * convention `./with-approval.ts` uses.
 */

import {
  validateProposeTimesInput as sharedValidate,
  type ValidatedProposeTimes,
} from '@/lib/integrations/scheduling/propose-times';
import type { GoogleCalendarMcpResult } from './types';
import type { ProposeTimesInput } from './actions';

export { computeProposals, type ValidatedProposeTimes } from '@/lib/integrations/scheduling/propose-times';

export function validateProposeTimesInput(
  input: ProposeTimesInput,
): GoogleCalendarMcpResult<ValidatedProposeTimes> {
  // Identical-shape cast: McpResult<T> ≅ GoogleCalendarMcpResult<T>.
  return sharedValidate(input) as GoogleCalendarMcpResult<ValidatedProposeTimes>;
}
