/**
 * lib/integrations/wb/index.ts
 *
 * We-Bring integration framework — public surface.
 *
 * Everything agentplain owns the vendor account for: the LLM, embeddings,
 * voice, telephony, email, infra, knowledge corpora, and the Plaino runtime.
 * Cost is either absorbed ('included', protected by a fair-use soft cap) or
 * metered through to the customer at cost ('pass-through', today Twilio). This
 * framework holds the registry, the per-customer usage meter (+ two adapter
 * impls), fair-use evaluation, pass-through Stripe metering, and the
 * cross-workspace observability roll-up.
 *
 * Pages and crons import from here, not the sub-modules.
 */

export type { WeBringCategory, WeBringService } from './registry';
export {
  WE_BRING_SERVICES,
  TWILIO_METER_EVENT_ENV_KEY,
  listWeBringServices,
  getWeBringService,
  passThroughServices,
  includedServices,
} from './registry';

export type {
  MeteredUsageEvent,
  UsageMeterReading,
  WeBringUsageMeter,
} from './types';

export {
  aggregateUsage,
  InMemoryWeBringUsageMeter,
  NullWeBringUsageMeter,
  rankConsumers,
  type ServiceConsumer,
} from './meter';

export {
  FAIR_USE_APPROACHING_FRACTION,
  evaluateFairUse,
  evaluateAllFairUse,
  statusForFraction,
  type FairUseStatus,
  type FairUseVerdict,
} from './fair-use';

export {
  DEFAULT_PASS_THROUGH_MARKUP,
  withMarkupMicroCents,
  passThroughMeterEvents,
  type PassThroughOptions,
} from './passthrough';
