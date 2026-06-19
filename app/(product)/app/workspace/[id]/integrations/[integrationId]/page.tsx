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
import { summarizeRetryQueueForProvider } from "@/lib/integrations/retry-queue";
import { ConnectStorageDisclosure } from "@/components/integrations/ConnectStorageDisclosure";
import { DisconnectButton } from "./DisconnectButton";
import { TestConnectionButton } from "./TestConnectionButton";
import { ApiKeyConnectForm } from "./ApiKeyConnectForm";
import { BuildiumConnectForm } from "./BuildiumConnectForm";

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

  // pfd-2 — queued/held/dead actions waiting on this integration. Lets the
  // page reassure ("3 actions are queued and will run when you reconnect") and
  // be honest when we gave up ("1 action could not be completed").
  const queue =
    entry.providerKey === null
      ? { waiting: 0, held: 0, dead: 0 }
      : await summarizeRetryQueueForProvider(
          workspaceId,
          entry.providerKey,
        ).catch(() => ({ waiting: 0, held: 0, dead: 0 }));

  const isComingSoon = entry.status === "coming-soon";
  const isConnected = credential !== null && credential.status === "ACTIVE";

  // Truthful watch-state for inbox connectors (Gmail / Outlook). "Connected"
  // for these means Plaino has READ access and a push subscription was
  // created — it does NOT mean existing mail was imported. There is no
  // backfill (lib/inngest/functions/mcp-connected-seed-inbox.ts is a wave-10
  // no-op) and no inbox surface to browse; Plaino reads on demand + as new
  // mail arrives, landing drafts in /approvals. We surface the REAL state so
  // the card never over-claims: whether the push subscription is actively
  // watching, and how much new mail has actually been handled since connect.
  const isInboxProvider =
    entry.providerKey === "GOOGLE" || entry.providerKey === "M365";
  const inboxWatch =
    isInboxProvider && isConnected
      ? await withRls(ctx, async (tx) => {
          const [sub, handled, latest] = await Promise.all([
            tx.webhookSubscription.findFirst({
              where: { workspaceId, provider: entry.providerKey ?? undefined },
              orderBy: { updatedAt: "desc" },
              select: { status: true, expiresAt: true },
            }),
            tx.webhookEvent.count({
              where: {
                workspaceId,
                processed: true,
                subscription: { provider: entry.providerKey ?? undefined },
              },
            }),
            tx.webhookEvent.findFirst({
              where: {
                workspaceId,
                subscription: { provider: entry.providerKey ?? undefined },
              },
              orderBy: { receivedAt: "desc" },
              select: { receivedAt: true },
            }),
          ]);
          return {
            watching:
              sub != null &&
              sub.status === "ACTIVE" &&
              sub.expiresAt.getTime() > Date.now(),
            handled,
            lastSeenAt: latest?.receivedAt ?? null,
          };
        }).catch(() => null)
      : null;
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

      {queue.waiting + queue.held > 0 && (
        <div className="mt-6 border border-rule bg-paper px-4 py-3 text-sm text-ink">
          {queue.waiting + queue.held === 1
            ? "1 action is queued and will run automatically when "
            : `${queue.waiting + queue.held} actions are queued and will run automatically when `}
          {entry.name} is reachable again. Nothing was lost.
        </div>
      )}
      {queue.dead > 0 && (
        <div className="mt-3 border border-flag/40 bg-flag/5 px-4 py-3 text-sm text-ink">
          {queue.dead === 1
            ? "1 action couldn't be completed"
            : `${queue.dead} actions couldn't be completed`}{" "}
          after several retries. Your service partner has been notified and will
          follow up — you don&apos;t need to do anything.
        </div>
      )}

      {isComingSoon && (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="wheat"
            reality={`${entry.name} isn't wired up yet.`}
            change={`We're finishing the wiring for ${entry.name}. Join the waitlist and your service partner reaches out the moment it's ready to connect.`}
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

      {!isComingSoon && !isConnected && isConfigured && (
        <div className="mt-8">
          <ConnectStorageDisclosure entry={entry} />
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

      {/* Buildium connects with a client-id + client-secret PAIR, so it uses a
          dedicated two-field form rather than the single-key ApiKeyConnectForm. */}
      {!isComingSoon && !isConnected && isConfigured && entry.id === "buildium" && (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="lone-tree"
            reality={`Not connected yet.`}
            change={`Paste your Buildium client ID and secret below to connect. Your service partner reads your rent roll and drafts tenant chases — you approve every one.`}
          />
          <BuildiumConnectForm
            workspaceId={workspaceId}
            successRedirectUrl={`/app/workspace/${workspaceId}/integrations/${entry.id}`}
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

          {isInboxProvider && (
            <div className="mt-6 border border-rule bg-paper p-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                what happens now
              </p>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
                {inboxWatch?.watching
                  ? `Plaino is watching ${credential.accountEmail} for new mail. `
                  : "Plaino has read access, but the live watch isn't active yet — your service partner is on it. "}
                When new mail arrives, Plaino drafts, categorizes, and queues
                what needs you. It doesn&rsquo;t import your existing inbox, and
                there&rsquo;s no inbox to browse here — everything it drafts
                waits in your{" "}
                <Link
                  href={`/app/workspace/${workspaceId}/approvals`}
                  className="underline underline-offset-4 hover:text-ink"
                >
                  queue
                </Link>{" "}
                for your go-ahead.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-mute">
                {inboxWatch && inboxWatch.handled > 0
                  ? `${inboxWatch.handled} ${
                      inboxWatch.handled === 1 ? "message" : "messages"
                    } handled so far${
                      inboxWatch.lastSeenAt
                        ? ` · last activity ${new Date(
                            inboxWatch.lastSeenAt,
                          ).toLocaleString()}`
                        : ""
                    }.`
                  : "Nothing new has landed since you connected — that's expected. Plaino works on mail that arrives from here on, not your existing inbox."}
              </p>
            </div>
          )}

          {entry.id === "buildium" && (
            <div className="mt-6 border border-rule bg-paper p-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                what happens next
              </p>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
                Plaino reads your rent roll every morning and drafts the right
                tenant chase for every delinquent unit. Watch it on your{" "}
                <Link
                  href={`/app/workspace/${workspaceId}/rent-collection`}
                  className="underline underline-offset-4 hover:text-ink"
                >
                  rent collection dashboard
                </Link>
                ; every chase waits for your approval before anything sends.
              </p>
            </div>
          )}

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
