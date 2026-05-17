import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  listIntegrations,
  type MarketplaceEntry,
} from "@/lib/integrations/marketplace";
import {
  IntegrationTile,
  type TileStatus,
} from "@/components/marketplace/IntegrationTile";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    connected?: string;
    error?: string;
    detail?: string;
    disconnected?: string;
  }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WorkspaceIntegrationsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const flash = await searchParams;

  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  // Fetch the workspace's existing credentials. Read under the caller's RLS
  // context so a stray bug can't surface another workspace's accounts. The
  // marketplace catalog itself is non-customer data; we read it via the
  // pure listIntegrations() function.
  const credentials = await withRls(ctx, (tx) =>
    tx.integrationCredential.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        accountEmail: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  const entries = listIntegrations();
  const connectedByProvider = new Map(
    credentials
      .filter((c) => c.status === "ACTIVE")
      .map((c) => [c.provider, c]),
  );

  const tiles = entries.map((entry) => {
    const status = tileStatusFor(entry, connectedByProvider);
    const cred =
      entry.providerKey !== null
        ? connectedByProvider.get(entry.providerKey)
        : undefined;
    return { entry, status, accountLabel: cred?.accountEmail };
  });

  const connectedCount = tiles.filter((t) => t.status === "connected").length;
  const availableCount = tiles.filter((t) => t.status === "available").length;
  const comingSoonCount = tiles.filter((t) => t.status === "coming-soon").length;

  return (
    <div>
      <p className="eyebrow mb-3">Your tools</p>
      <h1 className="font-display text-3xl text-ink">
        Integrations — your service partner connects these for you.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Tap a tool to start a connection. Your service partner picks it up,
        finishes the wiring, and tells you when it&apos;s ready. Nothing leaves
        your accounts and nothing sends without your hand on it.
      </p>

      <FlashBanner flash={flash} tiles={tiles} />

      <div className="mt-6 flex items-center gap-4 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        <span>{connectedCount} connected</span>
        <span aria-hidden>·</span>
        <span>{availableCount} available</span>
        <span aria-hidden>·</span>
        <span>{comingSoonCount} coming soon</span>
      </div>

      {tiles.length === 0 ? (
        <div className="mt-8 border border-rule bg-paper p-8 text-center">
          <p className="font-display text-xl text-ink">
            Nothing here yet.
          </p>
          <p className="mt-2 text-[14px] text-ink-soft">
            Your service partner connects these for you. Tap to start.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ entry, status, accountLabel }) => (
            <IntegrationTile
              key={entry.id}
              entry={entry}
              status={status}
              workspaceId={workspaceId}
              accountLabel={accountLabel}
            />
          ))}
        </div>
      )}

      <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-mute">
        Disconnecting is one tap on the Manage screen. Connections live only
        as long as you want them to — and your service partner keeps an
        audit trail either way.
      </p>
    </div>
  );
}

function tileStatusFor(
  entry: MarketplaceEntry,
  connected: Map<string, unknown>,
): TileStatus {
  if (entry.status === "coming-soon") return "coming-soon";
  if (entry.providerKey && connected.has(entry.providerKey)) return "connected";
  return "available";
}

function FlashBanner({
  flash,
  tiles,
}: {
  flash: {
    connected?: string;
    error?: string;
    detail?: string;
    disconnected?: string;
  };
  tiles: Array<{ entry: MarketplaceEntry; status: TileStatus }>;
}) {
  if (flash.disconnected) {
    const entry = tiles.find((t) => t.entry.id === flash.disconnected)?.entry;
    return (
      <div className="mt-6 border border-rule bg-paper px-4 py-3 text-sm">
        Disconnected {entry?.name ?? flash.disconnected}. Your service partner
        was notified.
      </div>
    );
  }
  if (flash.connected) {
    const entry = tiles.find((t) => t.entry.id === flash.connected)?.entry;
    return (
      <div className="mt-6 border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-ink">
        {entry?.name ?? flash.connected} is connected. Your service partner
        starts working through your inbox next.
      </div>
    );
  }
  if (flash.error) {
    return (
      <div className="mt-6 border border-flag/40 bg-flag/5 px-4 py-3 text-sm text-ink">
        <strong className="font-mono text-xs">{flash.error}</strong>
        {flash.detail && (
          <span className="ml-2 font-mono text-xs text-mute">
            {flash.detail}
          </span>
        )}
      </div>
    );
  }
  return null;
}
