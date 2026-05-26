// /operator/workspaces — operator surface for browsing every workspace and
// applying a tier override. Tier override is the operator's escape valve
// when (a) a Max engagement signs and a workspace needs the MAX flag
// without going through Stripe Checkout (Max has no Stripe Product per
// the 2026-05-15 amendment to `project_stripe_both_surfaces.md`), or
// (b) a Partner customer's named-service-partner hours need to revert to
// Regular outside the customer-driven downgrade flow.
//
// The override updates Workspace.verticalTier AND the Subscription.tier
// row when one exists, lands an AuditLog entry, and revalidates the page.
// Stripe is NOT touched here — billing-state changes to a live Stripe
// subscription go through `changePlanAction` (customer-side) or are
// reconciled by the webhook handler. For MAX overrides this is by design:
// the workspace flag is the durable record, and any associated invoice is
// raised out-of-band through manual invoicing.
//
// RLS: layout enforces `isOperator`; defense-in-depth check below.

import Link from "next/link";
import { redirect } from "next/navigation";
import { withSystemContext } from "@/lib/db/rls";
import { requireUser } from "@/lib/auth/server";
import {
  TIER_ORDER,
  tierDisplayName,
  tierFromVerticalTier,
  type TierName,
} from "@/lib/pricing/tiers";
import { overrideWorkspaceTierAction } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  searchParams: Promise<{
    flash?: string | string[];
    workspaceId?: string | string[];
    to?: string | string[];
  }>;
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function OperatorWorkspacesPage(props: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }
  const params = await props.searchParams;
  const flash = pickFirst(params.flash);
  const flashWorkspaceId = pickFirst(params.workspaceId);
  const flashTo = pickFirst(params.to);

  // Workspace + Subscription are both RLS-policied + FORCE'd via force_rls.
  // Operator surface needs to enumerate every workspace — wrap in
  // withSystemContext so the policy's is_operator='true' branch resolves to
  // TRUE; otherwise findMany returns zero rows under FORCE.
  const workspaces = await withSystemContext((tx) =>
    tx.workspace.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        vertical: true,
        verticalTier: true,
        stripeSubscriptionId: true,
        billingMode: true,
        subscription: {
          select: {
            tier: true,
            seats: true,
            seatBand: true,
            status: true,
            stripeSubscriptionId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  return (
    <div className="container-wide py-12">
      <p className="eyebrow mb-3">Operator · workspaces</p>
      <h1 className="font-display text-3xl text-ink">Workspaces.</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Every workspace and its current tier. The override below flips
        Workspace.verticalTier and the Subscription row (when one exists)
        and writes an AuditLog entry. Stripe state is not touched — for
        Stripe changes use the customer-side billing page or Stripe&rsquo;s
        own dashboard.
      </p>

      {flash === "ok" && flashWorkspaceId && flashTo ? (
        <div className="mt-6 border border-rule bg-paper-deep p-4 text-[14px] text-ink">
          Set workspace <code className="font-mono">{flashWorkspaceId}</code>{" "}
          to tier <strong>{flashTo.toUpperCase()}</strong>. AuditLog row
          recorded.
        </div>
      ) : null}

      <table className="mt-8 w-full border border-rule bg-paper text-left text-[14px]">
        <thead>
          <tr className="border-b border-rule bg-paper-deep text-[11px] font-mono uppercase tracking-eyebrow text-mute">
            <th className="px-4 py-3">Workspace</th>
            <th className="px-4 py-3">Vertical</th>
            <th className="px-4 py-3">Tier</th>
            <th className="px-4 py-3">Subscription</th>
            <th className="px-4 py-3">Override</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((w) => {
            const tier = tierFromVerticalTier(w.verticalTier);
            return (
              <tr
                key={w.id}
                className="border-b border-rule last:border-b-0 align-top"
              >
                <td className="px-4 py-3">
                  <p className="font-display text-[15px] leading-tight text-ink">
                    {w.name}
                  </p>
                  <p className="mt-1 font-mono text-[11px] uppercase text-mute">
                    {w.slug}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-mute">
                    {w.id}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono text-[12px] uppercase text-ink-soft">
                  {w.vertical.toLowerCase().replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3">
                  <p className="font-display text-[15px] text-ink">
                    {tierDisplayName(tier)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] uppercase text-mute">
                    enum: {w.verticalTier}
                  </p>
                </td>
                <td className="px-4 py-3 text-[12px] text-ink-soft">
                  {w.subscription ? (
                    <>
                      <p className="font-mono text-[12px] uppercase">
                        {w.subscription.status}
                      </p>
                      <p className="mt-1">
                        {w.subscription.seats} seat
                        {w.subscription.seats === 1 ? "" : "s"} ·{" "}
                        {tierDisplayName(
                          tierFromVerticalTier(w.subscription.tier),
                        )}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-mute">
                        {w.subscription.stripeSubscriptionId}
                      </p>
                    </>
                  ) : (
                    <span className="text-mute">— none</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <OverrideForm
                    workspaceId={w.id}
                    currentTier={tier}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-6 max-w-2xl text-[12px] leading-relaxed text-mute">
        Tier override is operator-only. It does not call Stripe — when a
        live Stripe Subscription exists, run a follow-up reconciliation
        from the Stripe dashboard or trigger the customer-side change
        flow at <code>/app/workspace/[id]/settings/billing</code>.
      </p>

      <div className="mt-8 flex gap-4">
        <Link
          href="/operator/inquiries"
          className="text-[13px] text-ink underline"
        >
          → triage inquiries
        </Link>
        <Link
          href="/operator/integrations"
          className="text-[13px] text-ink underline"
        >
          → integrations
        </Link>
      </div>
    </div>
  );
}

function OverrideForm({
  workspaceId,
  currentTier,
}: {
  workspaceId: string;
  currentTier: TierName;
}) {
  return (
    <form
      action={overrideWorkspaceTierAction}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <label className="flex flex-col gap-1 text-[11px]">
        <span className="font-mono uppercase tracking-eyebrow text-[11px] text-mute">
          Set tier
        </span>
        <select
          name="tier"
          defaultValue={currentTier}
          className="border border-rule bg-paper px-2 py-1 text-[12px] text-ink"
        >
          {TIER_ORDER.map((t) => (
            <option key={t} value={t}>
              {tierDisplayName(t)} ({t})
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="border border-rule bg-paper-deep px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-ink hover:bg-paper"
      >
        Apply
      </button>
    </form>
  );
}
