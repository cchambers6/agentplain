import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  getMarketplaceEntry,
  oauthStartPath,
  waitlistPath,
} from "@/lib/integrations/marketplace";
import { DisconnectButton } from "./DisconnectButton";
import { TestConnectionButton } from "./TestConnectionButton";

interface PageProps {
  params: Promise<{ id: string; integrationId: string }>;
  searchParams: Promise<{ tested?: string; error?: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function IntegrationSettingsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: workspaceId, integrationId } = await params;
  const flash = await searchParams;

  const entry = getMarketplaceEntry(integrationId);
  if (!entry) notFound();

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const credential =
    entry.providerKey === null
      ? null
      : await withRls(ctx, (tx) =>
          tx.integrationCredential.findFirst({
            where: {
              workspaceId,
              provider: entry.providerKey ?? undefined,
            },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              accountEmail: true,
              scopes: true,
              status: true,
              expiresAt: true,
              lastRefreshedAt: true,
              createdAt: true,
            },
          }),
        );

  const isComingSoon = entry.status === "coming-soon";
  const isConnected = credential !== null && credential.status === "ACTIVE";

  return (
    <div>
      <p className="mb-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        <Link
          href={`/app/workspace/${workspaceId}/integrations`}
          className="underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
        >
          ← back to connections
        </Link>
      </p>
      <h1 className="font-display text-3xl text-ink">{entry.name}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        {entry.description}
      </p>

      {flash.tested === "ok" && (
        <div className="mt-6 border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-ink">
          Connection healthy. Your service partner can read this account.
        </div>
      )}
      {flash.tested === "fail" && (
        <div className="mt-6 border border-flag/40 bg-flag/5 px-4 py-3 text-sm text-ink">
          Connection check failed. {flash.error ?? "Try reconnecting."}
        </div>
      )}

      {isComingSoon && (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="wheat"
            reality={`${entry.name} isn't wired up yet.`}
            change={`It's on the substrate. Join the waitlist and your service partner reaches out when ${entry.name} is ready to connect.`}
            cta={
              <ApHeritageButton
                variant="secondary"
                withArrow
                href={waitlistPath(entry)}
              >
                join the waitlist
              </ApHeritageButton>
            }
          />
        </div>
      )}

      {!isComingSoon && !isConnected && (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="lone-tree"
            reality={`Not connected yet.`}
            change={`Tap connect to start the ${entry.name} grant. Your service partner takes it from there.`}
            cta={
              <ApHeritageButton
                variant="primary"
                withArrow
                href={oauthStartPath(entry, workspaceId)}
              >
                connect {entry.name.toLowerCase()}
              </ApHeritageButton>
            }
          />
        </div>
      )}

      {isConnected && credential && (
        <>
          <ApEyebrow className="mt-8 mb-3">connection details</ApEyebrow>
          <dl className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
            <Row label="account" value={credential.accountEmail} />
            <Row label="status" value={statusLabel(credential.status)} />
            <Row
              label="connected"
              value={new Date(credential.createdAt).toLocaleString()}
            />
            <Row
              label="last refreshed"
              value={
                credential.lastRefreshedAt
                  ? new Date(credential.lastRefreshedAt).toLocaleString()
                  : "—"
              }
            />
            <Row
              label="token expires"
              value={new Date(credential.expiresAt).toLocaleString()}
            />
            <Row
              label="granted scopes"
              value={
                credential.scopes.length === 0
                  ? "—"
                  : credential.scopes.join(", ")
              }
            />
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <TestConnectionButton
              workspaceId={workspaceId}
              integrationId={entry.id}
            />
            <DisconnectButton
              workspaceId={workspaceId}
              integrationId={entry.id}
              credentialId={credential.id}
              integrationName={entry.name}
            />
          </div>

          <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-mute">
            Disconnecting removes agentplain&apos;s grant on your {entry.name}{" "}
            account. The audit trail of what your service partner read and
            drafted stays in your workspace history.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-5">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </p>
      <p className="mt-1 break-words text-[14px] text-ink">{value}</p>
    </div>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "ACTIVE":
      return "Active";
    case "EXPIRED":
      return "Expired — refresh due";
    case "REVOKED":
      return "Revoked — reconnect needed";
    case "ERROR":
      return "Error — contact your service partner";
    default:
      return s;
  }
}
