import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import { env } from "@/lib/env";
import { PrismaOpsFlagStore } from "@/lib/ops/prisma-flag-store";
import {
  FLEET_HEALTH_LATEST_FLAG,
  FLEET_HEALTH_LAST_SUCCESS_FLAG,
  FLEET_HEALTH_SNAPSHOT_ACTION,
} from "@/lib/inngest/functions/fleet-health-check";
import { PAGE_HUMAN_AUDIT_ACTION } from "@/lib/ops/page-human";
import { resolveThresholds, type FleetHealthSnapshot } from "@/lib/ops/fleet-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOUR_MS = 60 * 60 * 1000;

function severityClasses(severity: string, breached: boolean): string {
  if (!breached) return "border-rule bg-paper";
  if (severity === "critical") return "border-red-500 bg-red-50";
  return "border-amber-500 bg-amber-50";
}

export default async function OperatorFleetHealthPage() {
  const session = await requireUser();
  if (!session.isOperator) {
    return <div className="container-wide py-12">Forbidden.</div>;
  }

  const flagStore = new PrismaOpsFlagStore();
  const [latestFlag, lastSuccessFlag] = await Promise.all([
    flagStore.get(FLEET_HEALTH_LATEST_FLAG),
    flagStore.get(FLEET_HEALTH_LAST_SUCCESS_FLAG),
  ]);

  let snapshot: FleetHealthSnapshot | null = null;
  if (latestFlag.ok && latestFlag.value) {
    try {
      snapshot = JSON.parse(latestFlag.value.value) as FleetHealthSnapshot;
    } catch {
      snapshot = null;
    }
  }

  const lastSuccessIso =
    lastSuccessFlag.ok && lastSuccessFlag.value ? lastSuccessFlag.value.value : null;
  const now = Date.now();
  const hoursSinceSuccess =
    lastSuccessIso && !Number.isNaN(new Date(lastSuccessIso).getTime())
      ? (now - new Date(lastSuccessIso).getTime()) / HOUR_MS
      : null;
  const thresholds = resolveThresholds();
  const heartbeatStale =
    hoursSinceSuccess !== null && hoursSinceSuccess > thresholds.heartbeatStaleMaxHours;

  // Recent fleet-health snapshots (trend) + recent human pages (the page feed).
  const [recentSnapshots, recentPages] = await Promise.all([
    withSystemContext((tx) =>
      tx.auditLog.findMany({
        where: { action: FLEET_HEALTH_SNAPSHOT_ACTION },
        orderBy: { occurredAt: "desc" },
        take: 10,
        select: { id: true, occurredAt: true, payload: true },
      }),
    ),
    withSystemContext((tx) =>
      tx.auditLog.findMany({
        where: { action: PAGE_HUMAN_AUDIT_ACTION },
        orderBy: { occurredAt: "desc" },
        take: 10,
        select: { id: true, occurredAt: true, payload: true },
      }),
    ),
  ]);

  const trustedHumanSet = env.fleetTrustedHumanEmails().length > 0;

  return (
    <div className="container-wide py-12 space-y-12">
      <div>
        <h1 className="text-2xl font-display">Operator · Fleet health</h1>
        <p className="mt-2 text-sm text-mute">
          The fleet&apos;s heartbeat. A daily 06:00 ET cron computes a health
          snapshot across every other pillar and pages a named human on any
          breach with a concrete recommended action — the &quot;if Conner died
          tomorrow, a human still hears about it within 24h&quot; guarantee.
          All-green weekdays send nothing; a Monday all-green digest confirms the
          pipe itself works.
        </p>
      </div>

      {!trustedHumanSet && (
        <div className="border border-amber-500 bg-amber-50 px-4 py-3 text-sm">
          <strong>Set a fallback human contact</strong> so the fleet has someone
          to call when you&apos;re unavailable. Set{" "}
          <code className="font-mono text-xs">FLEET_TRUSTED_HUMAN_EMAIL</code> to
          a monitored inbox (ideally not your personal account) so these alerts
          survive any single person. Until then, pages fall back to the first{" "}
          <code className="font-mono text-xs">OPERATOR_EMAIL_ALLOWLIST</code>{" "}
          entry and the email says so.
        </div>
      )}

      {/* Self-monitoring: a dead heartbeat is visible here even when the cron is
          failing (this line reads the last-success flag, not the live cron). */}
      <div
        className={`border px-4 py-3 text-sm ${
          heartbeatStale ? "border-red-500 bg-red-50" : "border-rule bg-paper"
        }`}
      >
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          Last successful health check
        </span>
        <div className="mt-1">
          {lastSuccessIso ? (
            <>
              <span className="font-mono text-xs">{lastSuccessIso}</span>
              {hoursSinceSuccess !== null && (
                <span className="ml-2 text-mute">
                  ({hoursSinceSuccess.toFixed(1)}h ago)
                </span>
              )}
              {heartbeatStale && (
                <span className="ml-2 font-semibold text-red-600">
                  STALE — the heartbeat itself may have stopped. Check Inngest +
                  the FLEET_HEALTH_CHECK_DISABLED gate.
                </span>
              )}
            </>
          ) : (
            <span className="text-mute">
              No successful run on record yet. The first daily run will land
              here.
            </span>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-display">Latest snapshot</h2>
        {!snapshot ? (
          <p className="text-sm text-mute">
            No snapshot yet. The cron writes the first one on its next 06:00 ET
            run, or trigger it now via the{" "}
            <code className="font-mono text-xs">
              agentplain/ops.fleet-health.requested
            </code>{" "}
            event.
          </p>
        ) : (
          <>
            <p className="text-sm text-mute">
              Computed {snapshot.computedAt} · overall severity{" "}
              <span
                className={`font-mono ${
                  snapshot.overallSeverity === "critical"
                    ? "text-red-600"
                    : snapshot.anyBreached
                      ? "text-amber-600"
                      : "text-green-700"
                }`}
              >
                {snapshot.overallSeverity}
              </span>{" "}
              · {snapshot.breaches.length} breach(es)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.metrics.map((m) => (
                <div
                  key={m.id}
                  className={`border px-4 py-3 text-sm ${severityClasses(
                    m.severity,
                    m.breached,
                  )}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{m.label}</span>
                    <span className="font-mono text-xs">
                      {m.breached ? (
                        <span
                          className={
                            m.severity === "critical"
                              ? "text-red-600"
                              : "text-amber-600"
                          }
                        >
                          {m.severity.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-green-700">OK</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-mute">
                    {m.value} {m.unit} (threshold {m.threshold})
                  </div>
                  <p className="mt-1 text-xs text-ink/80">{m.detail}</p>
                  {m.breached && m.recommendedAction && (
                    <p className="mt-2 text-xs">
                      <span className="font-semibold">→ Action:</span>{" "}
                      {m.recommendedAction}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-display">
          Recent human pages ({recentPages.length})
        </h2>
        <p className="text-sm text-mute">
          Every <code className="font-mono text-xs">ops.page_human</code> alert
          the fleet fired. The loud-fail artifact — present even when the email
          channel itself is down.
        </p>
        {recentPages.length === 0 ? (
          <p className="text-sm text-mute">No pages fired. Quiet is good.</p>
        ) : (
          <table className="w-full border border-rule text-sm">
            <thead className="bg-paper text-left font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Summary</th>
                <th className="px-3 py-2">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {recentPages.map((p) => {
                const payload = (p.payload ?? {}) as Record<string, unknown>;
                return (
                  <tr key={p.id} className="border-t border-rule">
                    <td className="px-3 py-2 font-mono text-xs">
                      {p.occurredAt.toISOString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {String(payload.severity ?? "")}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {String(payload.summary ?? "")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {payload.emailDelivered ? "yes" : "no"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-display">
          Snapshot history ({recentSnapshots.length})
        </h2>
        {recentSnapshots.length === 0 ? (
          <p className="text-sm text-mute">No snapshots recorded yet.</p>
        ) : (
          <table className="w-full border border-rule text-sm">
            <thead className="bg-paper text-left font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              <tr>
                <th className="px-3 py-2">Computed</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Breaches</th>
              </tr>
            </thead>
            <tbody>
              {recentSnapshots.map((row) => {
                const payload = (row.payload ?? {}) as Partial<FleetHealthSnapshot>;
                const breaches = Array.isArray(payload.breaches)
                  ? payload.breaches
                  : [];
                return (
                  <tr key={row.id} className="border-t border-rule">
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.occurredAt.toISOString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {String(payload.overallSeverity ?? "")}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {breaches.length === 0
                        ? "—"
                        : breaches.map((b) => b.label).join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
