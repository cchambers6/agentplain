import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";

interface PageProps {
  params: Promise<{ id: string }>;
}

const formatCents = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function BillingPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const invoices = await withRls(ctx, (tx) =>
    tx.workspaceInvoice.findMany({
      where: { workspaceId },
      orderBy: { issuedAt: "desc" },
      take: 24,
    }),
  );

  return (
    <div>
      <p className="eyebrow mb-3">Settings · billing</p>
      <h1 className="font-display text-3xl text-ink">Billing.</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Phase 1 high-touch tier is invoiced manually by the agentplain
        operator. Self-serve subscriptions and tier upgrades land in Phase 2.
        Refunds are operator-only.
      </p>

      {invoices.length === 0 ? (
        <p className="mt-8 border border-rule bg-paper p-5 text-[15px] text-slate-soft">
          No invoices yet. The first invoice arrives at the start of your
          pilot.
        </p>
      ) : (
        <table className="mt-8 w-full border border-rule bg-paper text-left text-[14px]">
          <thead>
            <tr className="border-b border-rule bg-paper-deep text-[11px] font-mono uppercase tracking-eyebrow text-slate-soft">
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Open</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-rule last:border-b-0">
                <td className="px-4 py-3 font-mono text-[12px] uppercase text-slate-soft">
                  {new Date(inv.issuedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {inv.periodStart && inv.periodEnd
                    ? `${new Date(inv.periodStart).toLocaleDateString()} – ${new Date(inv.periodEnd).toLocaleDateString()}`
                    : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-ink">
                  {formatCents(inv.amountUsdCents)}
                </td>
                <td className="px-4 py-3 font-mono text-[12px] uppercase text-slate-soft">
                  {inv.status}
                </td>
                <td className="px-4 py-3 text-[13px]">
                  {inv.hostedInvoiceUrl ? (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink underline"
                    >
                      view
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
