import { ApEyebrow, ApRootedEmptyState } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  listIntegrations,
  type MarketplaceEntry,
} from "@/lib/integrations/marketplace";
import { isIntegrationConfigured } from "@/lib/integrations/config-status";
import {
  IntegrationTile,
  type TileStatus,
} from "@/components/marketplace/IntegrationTile";
import { ConnectionFlash } from "./ConnectionFlash";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    connected?: string;
    error?: string;
    detail?: string;
    disconnected?: string;
    notice?: string;
    integration?: string;
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

  const [credentials, onboardingState] = await Promise.all([
    withRls(ctx, (tx) =>
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
    ),
    withRls(ctx, (tx) =>
      tx.onboardingState.findUnique({
        where: { workspaceId },
        select: { completedAt: true },
      }),
    ),
  ]);
  const onboardingComplete = onboardingState?.completedAt != null;

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
    return {
      entry,
      status,
      accountLabel: cred?.accountEmail,
      configured: isIntegrationConfigured(entry),
    };
  });

  const connectedCount = tiles.filter((t) => t.status === "connected").length;
  // "available" means the tile is in the marketplace and not coming-soon.
  // We split it by whether the OAuth credentials are actually wired up in
  // this environment so the header doesn't overstate self-serve capability:
  // a tile whose env vars are missing dead-ends at `oauth_not_configured`,
  // so it's accurate to label it "awaiting connection" rather than "available."
  const availableNow = tiles.filter(
    (t) => t.status === "available" && t.configured,
  ).length;
  const awaitingConnection = tiles.filter(
    (t) => t.status === "available" && !t.configured,
  ).length;
  const comingSoonCount = tiles.filter((t) => t.status === "coming-soon").length;

  const connectedEntry = flash.connected
    ? tiles.find((t) => t.entry.id === flash.connected)?.entry
    : null;

  return (
    <div>
      <ApEyebrow className="mb-3">your connections</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Bring us into the tools you already use.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Tap a tool to start a connection. Your service partner picks it
        up, finishes the wiring, and tells you when it&rsquo;s ready.
        Nothing leaves your accounts and nothing sends without your hand
        on it.
      </p>

      <InlineFlash flash={flash} tiles={tiles} />

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        <span>{connectedCount} connected</span>
        <span aria-hidden>·</span>
        <span>{availableNow} available now</span>
        {awaitingConnection > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span>{awaitingConnection} awaiting connection</span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span>{comingSoonCount} coming soon</span>
      </div>

      {tiles.length === 0 ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="silo"
            reality="Nothing in your marketplace yet."
            change="Your service partner seeds connectors here as the per-vertical fleet rolls out. Reach out and we'll move you up the list."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ entry, status, accountLabel, configured }) => (
            <IntegrationTile
              key={entry.id}
              entry={entry}
              status={status}
              workspaceId={workspaceId}
              accountLabel={accountLabel}
              configured={configured}
            />
          ))}
        </div>
      )}

      <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-mute">
        Disconnecting is one tap on the Manage screen. Connections live
        only as long as you want them to — and your service partner
        keeps an audit trail either way.
      </p>

      <ConnectionFlash
        workspaceId={workspaceId}
        connectedName={connectedEntry?.name ?? null}
        onboardingComplete={onboardingComplete}
      />
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

function InlineFlash({
  flash,
  tiles,
}: {
  flash: {
    connected?: string;
    error?: string;
    detail?: string;
    disconnected?: string;
    notice?: string;
    integration?: string;
  };
  tiles: Array<{ entry: MarketplaceEntry; status: TileStatus }>;
}) {
  if (flash.notice === "not-configured") {
    const entry = flash.integration
      ? tiles.find((t) => t.entry.id === flash.integration)?.entry
      : undefined;
    const name = entry?.name ?? "That connection";
    return (
      <div className="mt-6 border border-rule bg-paper-deep px-4 py-3 text-sm leading-relaxed text-ink">
        {name} isn&rsquo;t open for self-connect yet. Your service partner
        wires it with you on the welcome call — nothing in your workspace
        blocks while it&rsquo;s pending.
      </div>
    );
  }
  if (flash.disconnected) {
    const entry = tiles.find((t) => t.entry.id === flash.disconnected)?.entry;
    return (
      <div className="mt-6 border border-rule bg-paper px-4 py-3 text-sm">
        Disconnected {entry?.name ?? flash.disconnected}. Your service
        partner was notified.
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
  // `connected` is surfaced via the ApPaperSheet slide-over on first
  // arrival; we intentionally don't render an inline duplicate for it.
  return null;
}
