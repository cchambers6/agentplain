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
import { isIntegrationConfigured } from "@/lib/integrations/config-status";
import { DisconnectButton } from "./DisconnectButton";
import { TestConnectionButton } from "./TestConnectionButton";
import { ApiKeyConnectForm } from "./ApiKeyConnectForm";

/** Wave-4 — map of `entry.id` → the POST endpoint that validates +
 *  persists an API-key credential. Each entry here MUST exist as a
 *  Next route under `app/api/integrations/<id>/connect/route.ts`. */
const API_KEY_CONNECT_URL: Record<string, string> = {
  "follow-up-boss": "/api/integrations/follow-up-boss/connect",
  sierra: "/api/integrations/sierra/connect",
  boldtrail: "/api/integrations/boldtrail/connect",
};

/** Help text shown under each connector's API-key form. The value tells
 *  the operator where in the provider's UI to find their key. */
const API_KEY_HELP_TEXT: Record<string, string> = {
  "follow-up-boss":
    "Paste your key from Follow Up Boss → My Profile → API Key. Your service partner validates it with FUB before saving.",
  sierra:
    "Paste your key from Sierra Interactive → Settings → API Access. Your service partner validates it with Sierra before saving.",
  boldtrail:
    "Paste your key from BoldTrail → Settings → API. Your service partner validates it with BoldTrail before saving.",
};

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
  // Same honesty seam the marketplace tiles + onboarding gate on: when the
  // provider's OAuth credentials aren't wired in this environment, the
  // connect CTA would dead-end at the start route's not-configured redirect,
  // so we show the service-partnership state instead of a live-looking button.
  const isConfigured = isIntegrationConfigured(entry);

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

      {!isComingSoon && !isConnected && isConfigured && entry.connectMode !== "api-key" && (
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

      {!isComingSoon && !isConnected && isConfigured && entry.connectMode === "api-key" &&
        API_KEY_CONNECT_URL[entry.id] && (
          <div className="mt-8">
            <ApRootedEmptyState
              motif="lone-tree"
              reality={`Not connected yet.`}
              change={`Paste your ${entry.name} API key below to connect. Your service partner validates it with ${entry.name} before saving anything to your workspace.`}
            />
            <ApiKeyConnectForm
              workspaceId={workspaceId}
              integrationName={entry.name}
              connectUrl={API_KEY_CONNECT_URL[entry.id]}
              successRedirectUrl={`/app/workspace/${workspaceId}/integrations/${entry.id}`}
              helpText={API_KEY_HELP_TEXT[entry.id]}
            />
          </div>
        )}

      {!isComingSoon && !isConnected && !isConfigured && (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="lone-tree"
            reality={`${entry.name} isn't open for self-connect yet.`}
            change={`Your service partner wires it with you on the welcome call — nothing in your workspace blocks while it's pending.`}
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
