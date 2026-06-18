/**
 * lib/integrations/wb/types.ts
 *
 * We-Bring usage metering — shared types. A usage EVENT is one recorded unit of
 * consumption (e.g. a 4-minute Twilio call, an embedding batch). A usage
 * READING is the aggregate for one service over a billing period. Pure data.
 */

/** One recorded unit of we-bring consumption for a workspace. */
export interface MeteredUsageEvent {
  /** The we-bring service id (see registry). */
  serviceId: string;
  /** Unit, mirrors the service's `meterUnit` ('minutes', 'tokens', …). */
  unit: string | null;
  /** Raw units consumed by this event. */
  quantity: number;
  /** What this event cost agentplain at our vendor's rate, in micro-cents
   *  (1 cent = 1_000_000 micro-cents — same scale as `LlmUsageRecord`). */
  costMicroCents: bigint;
  /** When the usage occurred (used to bucket into the right period). */
  occurredAt: Date;
}

/** The aggregate usage for one service over a period. */
export interface UsageMeterReading {
  serviceId: string;
  unit: string | null;
  /** Total raw units in the period. */
  quantity: number;
  /** Total cost to agentplain in the period, micro-cents. */
  costMicroCents: bigint;
  /** Number of events that rolled up into this reading. */
  eventCount: number;
  periodStart: Date | null;
  periodEnd: Date | null;
}

/**
 * Reads we-bring usage for a workspace over a period. Two implementations live
 * in `meter.ts`: an in-memory recorder (tests + local) and a null reader (the
 * honest production default until a per-service usage table is wired). The
 * adapter pattern keeps the dashboard decoupled from where usage is stored —
 * per `feedback_runner_portability.md`.
 */
export interface WeBringUsageMeter {
  read(
    workspaceId: string,
    periodStart: Date | null,
    periodEnd: Date | null,
  ): Promise<UsageMeterReading[]>;
}
