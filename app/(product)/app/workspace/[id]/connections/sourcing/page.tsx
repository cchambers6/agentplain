/**
 * app/(product)/app/workspace/[id]/connections/sourcing/page.tsx
 *
 * The connections marketplace split by the only distinction that changes who
 * pays: things YOU BRING (Customer-Brought — your account, your vendor bill)
 * vs things WE BRING (agentplain owns the account; included or pass-through).
 *
 * Two tabs, server-rendered via `?view=`. The "You bring" tab lists the BYO
 * marketplace connectors (filtered to the workspace's vertical) with live
 * connection state, each linking to the existing per-connector manage screen at
 * /integrations/<id> for the actual connect/disconnect flow — so this page is
 * the bucketed overview and never forks the connect logic. The "We bring" tab
 * lists the we-bring services with their cost model; there is nothing to
 * connect — we've enabled them for you.
 *
 * This is reached from the Connections hub ("who pays for what"). The hub stays
 * the J3 setup door; this is its honest cost-and-ownership breakdown.
 */

import Link from 'next/link';
import { ApEyebrow } from '@/components/ui/ap';
import { requireWorkspaceMember } from '@/lib/auth';
import { verticalSlugFromEnum } from '@/lib/auth/vertical-enum';
import { withRls } from '@/lib/db';
import {
  entryAppliesToVertical,
  entrySourcing,
  listIntegrations,
  type MarketplaceEntry,
} from '@/lib/integrations/marketplace';
import { listWeBringServices, type WeBringService } from '@/lib/integrations/wb';
import {
  connectionStateFor,
  CONNECTION_STATE_LABEL,
  needsAttention,
  type ByoConnectionState,
  type ByoCredentialView,
} from '@/lib/integrations/byo';
import {
  COST_MODEL_EXPLAINER,
  COST_MODEL_LABEL,
  SOURCING_LABEL,
} from '@/lib/integrations/sourcing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type View = 'you-bring' | 'we-bring';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function ConnectionsSourcingPage({
  params,
  searchParams,
}: PageProps) {
  const { id: workspaceId } = await params;
  const { view: rawView } = await searchParams;
  const view: View = rawView === 'we-bring' ? 'we-bring' : 'you-bring';

  const member = await requireWorkspaceMember(workspaceId, ['BROKER_OWNER']);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [credentials, workspaceRow] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.integrationCredential.findMany({
        where: { workspaceId },
        select: {
          provider: true,
          accountEmail: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          lastRefreshedAt: true,
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
  ]);

  const verticalSlug = verticalSlugFromEnum(workspaceRow.vertical);
  const now = new Date();

  // First credential per provider, for connection state.
  const credByProvider = new Map<string, ByoCredentialView>();
  for (const c of credentials) {
    if (!credByProvider.has(c.provider)) {
      credByProvider.set(c.provider, {
        provider: c.provider,
        accountEmail: c.accountEmail,
        status: c.status,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        lastRefreshedAt: c.lastRefreshedAt,
      });
    }
  }

  const byoEntries = listIntegrations().filter(
    (e) => entrySourcing(e) === 'byo' && entryAppliesToVertical(e, verticalSlug),
  );
  const byoCards = byoEntries.map((entry) => {
    const cred =
      entry.providerKey !== null
        ? (credByProvider.get(entry.providerKey) ?? null)
        : null;
    const state =
      entry.status === 'coming-soon'
        ? ('not-connected' as ByoConnectionState)
        : connectionStateFor(cred, now);
    return { entry, state, accountEmail: cred?.accountEmail ?? null };
  });

  const weBringServices = listWeBringServices();

  const connectedCount = byoCards.filter(
    (c) => c.state === 'connected' || c.state === 'expiring',
  ).length;
  const attentionCount = byoCards.filter((c) => needsAttention(c.state)).length;

  return (
    <div>
      <p className="mb-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        <Link
          href={`/app/workspace/${workspaceId}/connections`}
          className="underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
        >
          ← back to connections
        </Link>
      </p>
      <ApEyebrow className="mb-3">who pays for what</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        What you bring, and what we bring.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Some tools are yours — you connect your own account and pay your own
        vendor. Others we run for you on our accounts. This is the honest split,
        so you always know who pays for what.
      </p>

      <Tabs workspaceId={workspaceId} view={view} />

      {view === 'you-bring' ? (
        <section className="mt-8">
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            <span>{byoCards.length} you can bring</span>
            <span aria-hidden>·</span>
            <span>{connectedCount} connected</span>
            {attentionCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-flag">{attentionCount} need a look</span>
              </>
            ) : null}
          </div>
          <p className="mb-6 max-w-2xl text-[13px] leading-relaxed text-mute">
            You bring these. You authorize your own account and keep paying your
            own vendor — agentplain charges nothing for the connection itself.
            Tap a card to connect or manage it.
          </p>
          <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
            {byoCards.map(({ entry, state, accountEmail }) => (
              <ByoCard
                key={entry.id}
                workspaceId={workspaceId}
                entry={entry}
                state={state}
                accountEmail={accountEmail}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <p className="mb-6 max-w-2xl text-[13px] leading-relaxed text-mute">
            We bring these. We own the vendor account and you never see a login —
            nothing to set up. Most are{' '}
            <strong className="text-ink">included</strong> in your plan; a few{' '}
            <strong className="text-ink">pass through</strong> at our cost when
            they scale with how much you use them.
          </p>
          <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
            {weBringServices.map((service) => (
              <WeBringCard key={service.id} service={service} />
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-mute">
            Anything that can show on your invoice is on the{' '}
            <Link
              href={`/app/workspace/${workspaceId}/usage/connections`}
              className="text-ink underline underline-offset-4 hover:opacity-80"
            >
              connection costs
            </Link>{' '}
            page — included usage shown for transparency, pass-through priced at
            our cost.
          </p>
        </section>
      )}
    </div>
  );
}

function Tabs({ workspaceId, view }: { workspaceId: string; view: View }) {
  const base = `/app/workspace/${workspaceId}/connections/sourcing`;
  const tabClass = (active: boolean) =>
    `border-b-2 px-1 pb-2 font-mono text-[11px] tracking-eyebrow uppercase transition ${
      active
        ? 'border-ink text-ink'
        : 'border-transparent text-mute hover:text-ink-soft'
    }`;
  return (
    <div className="mt-6 flex gap-6 border-b border-rule" role="tablist">
      <Link
        href={`${base}?view=you-bring`}
        role="tab"
        aria-selected={view === 'you-bring'}
        className={tabClass(view === 'you-bring')}
      >
        You bring
      </Link>
      <Link
        href={`${base}?view=we-bring`}
        role="tab"
        aria-selected={view === 'we-bring'}
        className={tabClass(view === 'we-bring')}
      >
        We bring
      </Link>
    </div>
  );
}

function ByoCard({
  workspaceId,
  entry,
  state,
  accountEmail,
}: {
  workspaceId: string;
  entry: MarketplaceEntry;
  state: ByoConnectionState;
  accountEmail: string | null;
}) {
  const comingSoon = entry.status === 'coming-soon';
  const attention = needsAttention(state);
  const connected = state === 'connected' || state === 'expiring';
  return (
    <Link
      href={`/app/workspace/${workspaceId}/integrations/${entry.id}`}
      className="group block bg-paper p-5 transition hover:bg-paper-deep focus:outline-none focus-visible:bg-paper-deep"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            {entry.category}
          </p>
          <p className="mt-1 font-display text-[17px] text-ink">{entry.name}</p>
        </div>
        <span
          className={`shrink-0 font-mono text-[10px] tracking-eyebrow uppercase ${
            attention ? 'text-flag' : connected ? 'text-moss' : 'text-mute'
          }`}
        >
          {comingSoon ? 'Coming soon' : CONNECTION_STATE_LABEL[state]}
        </span>
      </div>
      <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">
        {entry.description}
      </p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-eyebrow uppercase text-clay">
          {SOURCING_LABEL.byo} · {COST_MODEL_LABEL['customer-direct']}
        </span>
        {accountEmail ? (
          <span className="truncate text-[11px] text-mute">{accountEmail}</span>
        ) : null}
      </div>
    </Link>
  );
}

function WeBringCard({ service }: { service: WeBringService }) {
  const passThrough = service.costModel === 'pass-through';
  return (
    <div className="block bg-paper p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            {service.category}
          </p>
          <p className="mt-1 font-display text-[17px] text-ink">{service.name}</p>
        </div>
        <span
          className={`shrink-0 font-mono text-[10px] tracking-eyebrow uppercase ${
            passThrough ? 'text-clay' : 'text-moss'
          }`}
        >
          {service.observable ? 'Enabled' : 'Built in'}
        </span>
      </div>
      <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">
        {service.description}
      </p>
      <div className="mt-4">
        <span className="font-mono text-[10px] tracking-eyebrow uppercase text-clay">
          {SOURCING_LABEL['we-bring']} · {COST_MODEL_LABEL[service.costModel]}
        </span>
        <p className="mt-2 text-[12px] leading-relaxed text-mute">
          {COST_MODEL_EXPLAINER[service.costModel]}
        </p>
      </div>
    </div>
  );
}
