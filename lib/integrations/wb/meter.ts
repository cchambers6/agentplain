/**
 * lib/integrations/wb/meter.ts
 *
 * Per-customer usage metering for we-bring services + two implementations of
 * the `WeBringUsageMeter` adapter (in-memory recorder + null reader), plus the
 * pure aggregation and the cross-workspace observability roll-up that answers
 * "which customer is burning what we-bring service."
 */

import type {
  MeteredUsageEvent,
  UsageMeterReading,
  WeBringUsageMeter,
} from './types';

/** Inclusive-start, exclusive-end period test (null bound = unbounded). */
function inPeriod(
  at: Date,
  periodStart: Date | null,
  periodEnd: Date | null,
): boolean {
  if (periodStart && at.getTime() < periodStart.getTime()) return false;
  if (periodEnd && at.getTime() >= periodEnd.getTime()) return false;
  return true;
}

/**
 * Aggregate raw events into per-service readings for a period. Pure. Events
 * outside the period are dropped; services with no events get no reading.
 */
export function aggregateUsage(
  events: readonly MeteredUsageEvent[],
  periodStart: Date | null,
  periodEnd: Date | null,
): UsageMeterReading[] {
  const byService = new Map<string, UsageMeterReading>();
  for (const e of events) {
    if (!inPeriod(e.occurredAt, periodStart, periodEnd)) continue;
    const existing = byService.get(e.serviceId);
    if (existing) {
      existing.quantity += e.quantity;
      existing.costMicroCents += e.costMicroCents;
      existing.eventCount += 1;
    } else {
      byService.set(e.serviceId, {
        serviceId: e.serviceId,
        unit: e.unit,
        quantity: e.quantity,
        costMicroCents: e.costMicroCents,
        eventCount: 1,
        periodStart,
        periodEnd,
      });
    }
  }
  return [...byService.values()].sort((a, b) =>
    a.serviceId.localeCompare(b.serviceId),
  );
}

/**
 * In-memory meter — records events per workspace, reads aggregated. Backs the
 * tests and local dev; also the shape a production meter implements when the
 * per-service usage table lands.
 */
export class InMemoryWeBringUsageMeter implements WeBringUsageMeter {
  private readonly byWorkspace = new Map<string, MeteredUsageEvent[]>();

  record(workspaceId: string, event: MeteredUsageEvent): void {
    const list = this.byWorkspace.get(workspaceId) ?? [];
    list.push(event);
    this.byWorkspace.set(workspaceId, list);
  }

  async read(
    workspaceId: string,
    periodStart: Date | null,
    periodEnd: Date | null,
  ): Promise<UsageMeterReading[]> {
    return aggregateUsage(
      this.byWorkspace.get(workspaceId) ?? [],
      periodStart,
      periodEnd,
    );
  }

  /** All workspace ids that have recorded any event — for observability. */
  workspaces(): string[] {
    return [...this.byWorkspace.keys()];
  }
}

/**
 * Null meter — always returns no usage. The HONEST production default: until a
 * per-service usage table is wired for Twilio/ElevenLabs/Resend, we show
 * "no usage recorded yet" rather than fabricating numbers. LLM + embedding
 * usage continues to surface through the existing `LlmUsageRecord` path on the
 * cost-attribution dashboard; this meter covers the not-yet-instrumented
 * services.
 */
export class NullWeBringUsageMeter implements WeBringUsageMeter {
  // Signature matches the interface (params accepted, ignored) so callers can
  // pass workspace + period uniformly regardless of which meter is wired.
  async read(
    _workspaceId: string,
    _periodStart: Date | null,
    _periodEnd: Date | null,
  ): Promise<UsageMeterReading[]> {
    return [];
  }
}

/** One workspace's consumption of one service — the observability unit. */
export interface ServiceConsumer {
  workspaceId: string;
  quantity: number;
  costMicroCents: bigint;
}

/**
 * Rank workspaces by their consumption of a single service, biggest first.
 * Feeds the operator-side "who is burning what" view. Pure.
 */
export function rankConsumers(
  readingsByWorkspace: ReadonlyArray<{
    workspaceId: string;
    readings: readonly UsageMeterReading[];
  }>,
  serviceId: string,
): ServiceConsumer[] {
  const out: ServiceConsumer[] = [];
  for (const { workspaceId, readings } of readingsByWorkspace) {
    const r = readings.find((x) => x.serviceId === serviceId);
    if (r && r.quantity > 0) {
      out.push({
        workspaceId,
        quantity: r.quantity,
        costMicroCents: r.costMicroCents,
      });
    }
  }
  return out.sort((a, b) => {
    if (b.costMicroCents !== a.costMicroCents) {
      return b.costMicroCents > a.costMicroCents ? 1 : -1;
    }
    return b.quantity - a.quantity;
  });
}
