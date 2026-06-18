/**
 * app/(product)/app/workspace/[id]/usage/connections/page.tsx
 *
 * Connection costs — the cost-attribution dashboard for the BYO ↔ we-bring
 * split. For every connection it answers the only billing question that
 * matters: who pays, and how much?
 *
 *   You bring (BYO)        → "You're paying directly" (no agentplain charge)
 *   We bring, included      → "Included" (we absorb it; usage shown for trust)
 *   We bring, pass-through  → "Pass-through" (metered onto your invoice at cost)
 *
 * Real LLM cost flows in through the existing usage path (`LlmUsageRecord` →
 * getWorkspaceUsageReport) so the Anthropic "included" row shows what we
 * actually absorbed this period. Services without a per-customer meter yet
 * (Twilio voice, ElevenLabs, Resend) read through the NullWeBringUsageMeter and
 * honestly show "no usage recorded yet" rather than a fabricated number.
 */

import { ApEyebrow, ApPaperCard, ApRootedEmptyState } from '@/components/ui/ap';
import { requireWorkspaceMember } from '@/lib/auth';
import { verticalSlugFromEnum } from '@/lib/auth/vertical-enum';
import { withRls } from '@/lib/db';
import {
  entryAppliesToVertical,
  entrySourcing,
  listIntegrations,
} from '@/lib/integrations/marketplace';
import { connectionStateFor } from '@/lib/integrations/byo';
import { NullWeBringUsageMeter } from '@/lib/integrations/wb';
import type { UsageMeterReading } from '@/lib/integrations/wb';
import {
  buildCostAttribution,
  totalAbsorbedMicroCents,
  totalCustomerChargeMicroCents,
  type AttributionRow,
} from '@/lib/integrations/cost-attribution';
import { getWorkspaceUsageReport } from '@/lib/billing/usage/aggregate';
import { formatMicroCentsAsUsd } from '@/lib/billing/usage/pricing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PageProps {
  params: Promise<{ id: string }>;
}

const numberFmt = new Intl.NumberFormat('en-US');

export default async function ConnectionCostsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ['BROKER_OWNER']);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [credentials, workspaceRow, llmReport] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.integrationCredential.findMany({
        where: { workspaceId },
        select: {
          provider: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          lastRefreshedAt: true,
          accountEmail: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { vertical: true },
      }),
    ),
    withRls(ctx, (tx) =>
      getWorkspaceUsageReport(tx, { workspaceId, periodStart: null }),
    ),
  ]);

  const verticalSlug = verticalSlugFromEnum(workspaceRow.vertical);
  const now = new Date();

  // Which BYO connectors are live (have a healthy credential)?
  const activeProviders = new Set(
    credentials
      .filter((c) => {
        const state = connectionStateFor(
          {
            provider: c.provider,
            accountEmail: c.accountEmail,
            status: c.status,
            expiresAt: c.expiresAt,
            createdAt: c.createdAt,
            lastRefreshedAt: c.lastRefreshedAt,
          },
          now,
        );
        return state === 'connected' || state === 'expiring';
      })
      .map((c) => c.provider),
  );
  const connectedByo = listIntegrations().filter(
    (e) =>
      entrySourcing(e) === 'byo' &&
      entryAppliesToVertical(e, verticalSlug) &&
      e.providerKey !== null &&
      activeProviders.has(e.providerKey),
  );

  // We-bring readings: the real Anthropic spend we absorbed (from LlmUsageRecord)
  // plus whatever the meter has for the not-yet-instrumented services (none, by
  // the honest Null default — surfaced as "no usage recorded yet").
  const meter = new NullWeBringUsageMeter();
  const meteredReadings = await meter.read(workspaceId, null, now);
  const llm = llmReport.last30Days;
  const anthropicReading: UsageMeterReading = {
    serviceId: 'anthropic-llm',
    unit: 'tokens',
    quantity:
      llm.inputTokens +
      llm.outputTokens +
      llm.cacheCreationTokens +
      llm.cacheReadTokens,
    costMicroCents: llm.costMicroCents,
    eventCount: llm.callCount,
    periodStart: null,
    periodEnd: now,
  };
  const weBringReadings: UsageMeterReading[] = [
    anthropicReading,
    ...meteredReadings,
  ];

  const rows = buildCostAttribution({ connectedByo, weBringReadings });
  const byoRows = rows.filter((r) => r.sourcing === 'byo');
  const weBringRows = rows.filter((r) => r.sourcing === 'we-bring');
  const customerCharge = totalCustomerChargeMicroCents(rows);
  const absorbed = totalAbsorbedMicroCents(rows);

  const nothingToShow = byoRows.length === 0 && llm.callCount === 0;

  return (
    <div>
      <ApEyebrow className="mb-3">connection costs</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">Who pays for each connection.</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Last 30 days. Tools you bring are billed by your own vendor — never by
        us. The services we bring are either included in your plan or passed
        through at our cost. Nothing here is marked up unless we tell you.
      </p>

      {nothingToShow ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="silo"
            reality="No connection costs to show yet."
            change="Once you connect a tool and your fleet starts working, this page breaks down exactly who pays for what — your vendors, what we include, and anything passed through at cost."
          />
        </div>
      ) : (
        <>
          <section className="mt-8">
            <ApPaperCard eyebrow="this period" title="What lands where.">
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <Metric
                  eyebrow="on your invoice"
                  value={formatMicroCentsAsUsd(customerCharge)}
                  sub="pass-through usage (Twilio, when live), at our cost"
                />
                <Metric
                  eyebrow="we absorbed for you"
                  value={formatMicroCentsAsUsd(absorbed)}
                  sub="included reasoning + services you never pay for"
                />
              </div>
            </ApPaperCard>
          </section>

          <section className="mt-10">
            <ApEyebrow className="mb-3">you bring · you pay directly</ApEyebrow>
            {byoRows.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-mute">
                No tools connected yet. When you connect Gmail, your CRM, or
                QuickBooks, they show here — billed by your own vendor, $0 from us.
              </p>
            ) : (
              <CostTable rows={byoRows} kind="byo" />
            )}
          </section>

          <section className="mt-10">
            <ApEyebrow className="mb-3">we bring</ApEyebrow>
            <CostTable rows={weBringRows} kind="we-bring" />
          </section>
        </>
      )}

      <p className="mt-10 border-t border-rule pt-6 max-w-2xl text-[13px] leading-relaxed text-mute">
        Services we run for you that don&apos;t have a per-customer meter yet
        show &ldquo;no usage recorded yet&rdquo; until that metering lands — we
        won&apos;t guess a number. See the full split on the{' '}
        <a
          href={`/app/workspace/${workspaceId}/connections/sourcing`}
          className="text-ink underline underline-offset-4 hover:opacity-80"
        >
          what you bring vs what we bring
        </a>{' '}
        page.
      </p>
    </div>
  );
}

function Metric({
  eyebrow,
  value,
  sub,
}: {
  eyebrow: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {eyebrow}
      </p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-mute">{sub}</p>
    </div>
  );
}

function CostTable({
  rows,
  kind,
}: {
  rows: AttributionRow[];
  kind: 'byo' | 'we-bring';
}) {
  return (
    <div className="overflow-hidden border border-rule">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-paper-deep">
            <Th>Connection</Th>
            <Th>Who pays</Th>
            <Th>Usage</Th>
            <Th className="text-right">On your invoice</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-rule bg-paper">
              <Td>
                <span className="font-display text-[15px] text-ink">{r.name}</span>
                <span className="ml-2 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                  {r.category}
                </span>
              </Td>
              <Td>
                <span
                  className={`font-mono text-[10px] tracking-eyebrow uppercase ${
                    r.costModel === 'pass-through' ? 'text-clay' : 'text-moss'
                  }`}
                >
                  {r.costModelLabel}
                </span>
              </Td>
              <Td>{usageCell(r, kind)}</Td>
              <Td className="text-right">{invoiceCell(r)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function usageCell(r: AttributionRow, kind: 'byo' | 'we-bring'): string {
  if (kind === 'byo') return 'billed by your vendor';
  if (r.usageQuantity == null) return 'platform — included';
  if (r.usageQuantity === 0) return 'no usage recorded yet';
  const unit = r.usageUnit ? ` ${r.usageUnit}` : '';
  return `${numberFmt.format(r.usageQuantity)}${unit}`;
}

function invoiceCell(r: AttributionRow): string {
  if (r.sourcing === 'byo') return '—';
  if (r.costModel === 'included') return '$0 · included';
  // pass-through
  if (r.customerChargeMicroCents == null || r.customerChargeMicroCents === 0n) {
    return '—';
  }
  return formatMicroCentsAsUsd(r.customerChargeMicroCents);
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 font-mono text-[10px] font-normal tracking-eyebrow uppercase text-mute ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-[13px] text-ink-soft align-top ${className}`}>
      {children}
    </td>
  );
}
