import Link from "next/link";
import { requireWorkspaceMember } from "@/lib/auth";
import { withSystemContext } from "@/lib/db";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        tier: true,
        stateCode: true,
        billingMode: true,
        tierPriceUsdMonthly: true,
        createdAt: true,
      },
    }),
  );
  if (!workspace) return null;

  const memberCount = await withSystemContext((tx) =>
    tx.membership.count({
      where: { workspaceId, status: "ACTIVE" },
    }),
  );

  return (
    <div>
      <p className="eyebrow mb-3">Settings</p>
      <h1 className="font-display text-3xl text-ink">Workspace settings</h1>

      <dl className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
        <Row label="Workspace name" value={workspace.name} />
        <Row label="Slug" value={workspace.slug} />
        <Row label="Tier" value={workspace.tier} />
        <Row label="State" value={workspace.stateCode} />
        <Row label="Billing mode" value={workspace.billingMode} />
        <Row label="Active members" value={String(memberCount)} />
        <Row
          label="Created"
          value={new Date(workspace.createdAt).toLocaleString()}
        />
      </dl>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/app/workspace/${workspaceId}/settings/work-thresholds`}
          className="border border-rule bg-paper p-5 transition hover:border-ink"
        >
          <p className="eyebrow mb-2">Work thresholds</p>
          <p className="text-[15px] text-ink">
            Configure which agent decisions need explicit ratification.
          </p>
        </Link>
        <Link
          href={`/app/workspace/${workspaceId}/settings/billing`}
          className="border border-rule bg-paper p-5 transition hover:border-ink"
        >
          <p className="eyebrow mb-2">Billing</p>
          <p className="text-[15px] text-ink">
            Invoices, payment method, billing mode.
          </p>
        </Link>
      </div>

      <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-slate-soft">
        Phase 1 settings are minimal — agent enablement, tool connections,
        team management land in Phase 2 / Phase 3. Reach out to the
        agentplain operator to change anything you don't see here.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-5">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
        {label}
      </p>
      <p className="mt-1 font-display text-lg text-ink">{value}</p>
    </div>
  );
}
