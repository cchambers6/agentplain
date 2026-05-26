import Link from "next/link";
import { withSystemContext } from "@/lib/db/rls";
import { requireUser } from "@/lib/auth/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  searchParams: Promise<{
    connected?: string;
    error?: string;
    detail?: string;
    workspaceId?: string;
  }>;
}

export default async function OperatorIntegrationsPage(props: PageProps) {
  const session = await requireUser();
  // Layout already enforced isOperator; defense-in-depth here.
  if (!session.isOperator) {
    return <div className="container-wide py-12">Forbidden.</div>;
  }

  const params = await props.searchParams;

  // IntegrationCredential + WebhookSubscription + WebhookEvent are
  // workspace-scoped RLS. The operator dashboard reads across workspaces,
  // so each read goes through withSystemContext.
  const credentials = await withSystemContext((tx) =>
    tx.integrationCredential.findMany({
      include: {
        workspace: { select: { name: true, slug: true } },
        webhookSubscriptions: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  const recentEvents = await withSystemContext((tx) =>
    tx.webhookEvent.findMany({
      take: 10,
      orderBy: { receivedAt: "desc" },
      include: {
        subscription: {
          select: {
            provider: true,
            resource: true,
            workspaceId: true,
          },
        },
      },
    }),
  );

  // Workspaces with no credential yet — connect targets.
  const allWorkspaces = await withSystemContext((tx) =>
    tx.workspace.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "desc" },
    }),
  );
  const connectedIds = new Set(credentials.map((c) => c.workspaceId));
  const connectableWorkspaces = allWorkspaces.filter((w) => !connectedIds.has(w.id));

  const googleConfigured = Boolean(env.googleOAuthClientId() && env.googleOAuthClientSecret());

  return (
    <div className="container-wide py-12 space-y-12">
      <div>
        <h1 className="text-2xl font-display">Operator · Integrations</h1>
        <p className="mt-2 text-sm text-mute">
          Connect Gmail accounts to workspaces. Phase 1 is operator-only — Conner
          dogfoods on his own inbox before customer self-serve OAuth opens. Per
          `feedback_integration_acceptance_is_functional`: this surface ships
          plumbing; functional acceptance (read / categorize / coordinate /
          schedule / draft) lands in PR-C.
        </p>
      </div>

      {params.connected && (
        <div className="border border-rule bg-paper px-4 py-3 text-sm">
          Connected. Credential <code className="font-mono text-xs">{params.connected}</code>{" "}
          stored encrypted; Pub/Sub subscription created. Watch for the first webhook event below.
        </div>
      )}

      {params.error && (
        <div className="border border-red-500 bg-red-50 px-4 py-3 text-sm">
          <strong className="font-mono">{params.error}</strong>
          {params.detail && (
            <>
              {": "}
              <span className="font-mono text-xs">{params.detail}</span>
            </>
          )}
        </div>
      )}

      {!googleConfigured && (
        <div className="border border-amber-500 bg-amber-50 px-4 py-3 text-sm">
          <strong>Google OAuth not configured.</strong> Set{" "}
          <code className="font-mono text-xs">GOOGLE_OAUTH_CLIENT_ID</code> +{" "}
          <code className="font-mono text-xs">GOOGLE_OAUTH_CLIENT_SECRET</code> on
          this deployment. See{" "}
          <code className="font-mono text-xs">docs/operator-integrations-setup.md</code>
          .
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-display">Connect a workspace</h2>
        {connectableWorkspaces.length === 0 ? (
          <p className="text-sm text-mute">All workspaces have a Google credential.</p>
        ) : (
          <ul className="divide-y divide-rule border border-rule">
            {connectableWorkspaces.map((w) => (
              <li key={w.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm">{w.name}</div>
                  <div className="font-mono text-xs text-mute">{w.slug}</div>
                </div>
                <Link
                  href={`/api/auth/oauth/google/connect?workspaceId=${w.id}`}
                  prefetch={false}
                  className="font-mono text-xs underline"
                >
                  Connect Gmail →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-display">Connected credentials ({credentials.length})</h2>
        {credentials.length === 0 ? (
          <p className="text-sm text-mute">No credentials yet. Connect one above.</p>
        ) : (
          <table className="w-full border border-rule text-sm">
            <thead className="bg-paper text-left font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              <tr>
                <th className="px-3 py-2">Workspace</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Token expires</th>
                <th className="px-3 py-2">Subscriptions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => (
                <tr key={c.id} className="border-t border-rule">
                  <td className="px-3 py-2">
                    <div>{c.workspace.name}</div>
                    <div className="font-mono text-xs text-mute">{c.workspace.slug}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{c.provider}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.accountEmail}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.status}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {c.expiresAt.toISOString()}
                  </td>
                  <td className="px-3 py-2">
                    {c.webhookSubscriptions.length === 0 ? (
                      <span className="text-mute">none</span>
                    ) : (
                      <ul className="space-y-1">
                        {c.webhookSubscriptions.map((s) => (
                          <li key={s.id} className="font-mono text-xs">
                            {s.status} · expires {s.expiresAt.toISOString()}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-display">Recent webhook events ({recentEvents.length})</h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-mute">
            No events received yet. After connect, Gmail Push posts a notification
            within seconds of a new message landing.
          </p>
        ) : (
          <table className="w-full border border-rule text-sm">
            <thead className="bg-paper text-left font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              <tr>
                <th className="px-3 py-2">Received</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">Processed</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((e) => (
                <tr key={e.id} className="border-t border-rule">
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.receivedAt.toISOString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.subscription.provider}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.subscription.resource}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.processed ? "yes" : "no"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-red-600">
                    {e.error ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
