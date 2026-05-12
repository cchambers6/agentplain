import Link from "next/link";
import { withWorkspace } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  PER_SEAT_MONTHLY_USD_CENTS,
  SEAT_BANDS,
  TIER_ORDER,
  tierFromVerticalTier,
  monthlyChargeUsdCents,
  type TierName,
} from "@/lib/pricing/tiers";
import {
  addPaymentMethodAction,
  cancelSubscriptionAction,
  changePlanAction,
  openPortalAction,
} from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const formatCents = (cents: number): string =>
  `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const daysUntil = (date: Date | null): number | null => {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

const formatDate = (date: Date | null): string => {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const statusLabel = (status: string): string =>
  ({
    TRIALING: "Trial",
    ACTIVE: "Active",
    PAST_DUE: "Past due",
    INCOMPLETE: "Setup incomplete",
    INCOMPLETE_EXPIRED: "Setup expired",
    CANCELED: "Cancelled",
    UNPAID: "Unpaid",
  })[status] ?? status;

export default async function BillingPage({ params, searchParams }: PageProps) {
  const { id: workspaceId } = await params;
  const queryParams = await searchParams;
  const { workspace, rls } = await withWorkspace(workspaceId, ["BROKER_OWNER"]);

  const [subscription, invoices, recentEvents] = await Promise.all([
    withRls(rls, (tx) =>
      tx.subscription.findUnique({ where: { workspaceId } }),
    ),
    withRls(rls, (tx) =>
      tx.workspaceInvoice.findMany({
        where: { workspaceId },
        orderBy: { issuedAt: "desc" },
        take: 12,
      }),
    ),
    withRls(rls, (tx) =>
      tx.billingEvent.findMany({
        where: { workspaceId },
        orderBy: { receivedAt: "desc" },
        take: 6,
        select: { id: true, type: true, receivedAt: true },
      }),
    ),
  ]);

  const flash = readFlash(queryParams);
  const daysToTrialEnd =
    subscription?.status === "TRIALING"
      ? daysUntil(subscription.trialEndsAt)
      : null;
  const tier: TierName = subscription
    ? tierFromVerticalTier(subscription.tier)
    : tierFromVerticalTier(workspace.verticalTier);
  const charge = subscription
    ? monthlyChargeUsdCents(tier, subscription.seats)
    : null;
  const hasPaymentMethod = Boolean(subscription?.defaultPaymentMethodId);

  return (
    <div>
      <p className="eyebrow mb-3">Settings · billing</p>
      <h1 className="font-display text-3xl text-ink">Billing.</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Per-seat, monthly, month-to-month. First 30 days are on us — no card
        required to start. Add a card any time before your trial ends and your
        subscription rolls over without a gap.
      </p>

      {flash ? (
        <div className="mt-6 border border-rule bg-paper-deep p-4 text-[14px] text-ink">
          {flash}
        </div>
      ) : null}

      {!subscription ? (
        <MissingSubscriptionState />
      ) : (
        <>
          {/* Trial banner */}
          {subscription.status === "TRIALING" && daysToTrialEnd !== null ? (
            <TrialBanner
              days={daysToTrialEnd}
              endsAt={subscription.trialEndsAt}
              hasPaymentMethod={hasPaymentMethod}
              workspaceId={workspaceId}
            />
          ) : null}

          {/* Past-due banner */}
          {subscription.status === "PAST_DUE" ? (
            <div className="mt-6 border border-flag bg-paper p-4 text-[14px] text-ink">
              <p className="font-medium">
                Your last invoice didn't go through.
              </p>
              <p className="mt-2 text-ink-soft">
                Open the customer portal to update your payment method. Your
                fleet keeps running through {formatDate(subscription.currentPeriodEnd)};
                after that, agents pause until billing is current.
              </p>
              <form action={openPortalAction.bind(null, workspaceId)} className="mt-3">
                <button type="submit" className="btn-primary inline-flex">
                  Update payment method
                </button>
              </form>
            </div>
          ) : null}

          {/* Cancellation scheduled banner */}
          {subscription.cancelAtPeriodEnd ? (
            <div className="mt-6 border border-rule bg-paper-deep p-4 text-[14px] text-ink">
              <p>
                Cancellation scheduled for{" "}
                <strong>{formatDate(subscription.currentPeriodEnd)}</strong>.
                Your fleet stays online until then. Open the portal to undo.
              </p>
            </div>
          ) : null}

          {/* Current plan card */}
          <section className="mt-8 border border-rule bg-paper p-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="eyebrow mb-2">Plan</p>
                <p className="font-display text-2xl text-ink">
                  agentplain {capitalize(tier)}
                </p>
                <p className="mt-1 text-[13px] text-ink-soft">
                  {statusLabel(subscription.status)} ·{" "}
                  {SEAT_BANDS[subscription.seatBand].label}
                </p>
              </div>
              <div>
                <p className="eyebrow mb-2">Seats</p>
                <p className="font-display text-2xl text-ink">
                  {subscription.seats}
                </p>
                <p className="mt-1 text-[13px] text-ink-soft">
                  {formatCents(charge?.perSeatCents ?? 0)}/seat/mo
                </p>
              </div>
              <div>
                <p className="eyebrow mb-2">Monthly</p>
                <p className="font-display text-2xl text-ink">
                  {formatCents(charge?.totalCents ?? 0)}
                </p>
                <p className="mt-1 text-[13px] text-ink-soft">
                  Next charge {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <form action={addPaymentMethodAction.bind(null, workspaceId)}>
                <button
                  type="submit"
                  className={
                    hasPaymentMethod
                      ? "btn-secondary inline-flex"
                      : "btn-primary inline-flex"
                  }
                >
                  {hasPaymentMethod ? "Update payment method" : "Add payment method"}
                </button>
              </form>
              <form action={openPortalAction.bind(null, workspaceId)}>
                <button type="submit" className="btn-secondary inline-flex">
                  View invoices + receipts
                </button>
              </form>
              {!subscription.cancelAtPeriodEnd ? (
                <form action={cancelSubscriptionAction.bind(null, workspaceId)}>
                  <button type="submit" className="btn-secondary inline-flex">
                    Cancel subscription
                  </button>
                </form>
              ) : null}
            </div>
          </section>

          {/* Change plan form */}
          <ChangePlanCard
            currentTier={tier}
            currentSeats={subscription.seats}
            workspaceId={workspaceId}
          />

          {/* Invoices */}
          <section className="mt-10">
            <p className="eyebrow mb-3">Recent invoices</p>
            {invoices.length === 0 ? (
              <p className="border border-rule bg-paper p-5 text-[15px] text-mute">
                None yet. First invoice arrives at trial end.
              </p>
            ) : (
              <table className="w-full border border-rule bg-paper text-left text-[14px]">
                <thead>
                  <tr className="border-b border-rule bg-paper-deep text-[11px] font-mono uppercase tracking-eyebrow text-mute">
                    <th className="px-4 py-3">Issued</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-rule last:border-b-0"
                    >
                      <td className="px-4 py-3 font-mono text-[12px] uppercase text-mute">
                        {formatDate(inv.issuedAt)}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {inv.periodStart && inv.periodEnd
                          ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-ink">
                        {formatCents(inv.amountUsdCents)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] uppercase text-mute">
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
          </section>

          {/* Recent events */}
          {recentEvents.length > 0 ? (
            <section className="mt-10">
              <p className="eyebrow mb-3">Recent billing events</p>
              <ul className="border border-rule bg-paper">
                {recentEvents.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between border-b border-rule px-4 py-3 text-[13px] last:border-b-0"
                  >
                    <span className="font-mono text-ink-soft">{e.type}</span>
                    <span className="font-mono text-[12px] text-mute">
                      {formatDate(e.receivedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function TrialBanner(props: {
  days: number;
  endsAt: Date | null;
  hasPaymentMethod: boolean;
  workspaceId: string;
}) {
  const verb = props.days === 0 ? "ends today" : `ends in ${props.days} day${props.days === 1 ? "" : "s"}`;
  return (
    <div className="mt-6 border border-ink bg-paper-deep p-5">
      <p className="eyebrow mb-1">Trial</p>
      <p className="text-[15px] text-ink">
        Your free trial {verb}
        {props.endsAt ? ` (${formatDate(props.endsAt)})` : ""}.{" "}
        {props.hasPaymentMethod
          ? "Card on file — your subscription rolls over automatically."
          : "Add a card to keep your fleet running when trial ends."}
      </p>
      {!props.hasPaymentMethod ? (
        <form
          action={addPaymentMethodAction.bind(null, props.workspaceId)}
          className="mt-3"
        >
          <button type="submit" className="btn-primary inline-flex">
            Add payment method
          </button>
        </form>
      ) : null}
    </div>
  );
}

function MissingSubscriptionState() {
  return (
    <div className="mt-8 border border-rule bg-paper p-5 text-[15px] text-mute">
      We're still provisioning your trial. Refresh in a moment. If this
      persists, check the workspace audit log or reach out — your workspace
      still works without the subscription wired up.
    </div>
  );
}

function ChangePlanCard(props: {
  currentTier: TierName;
  currentSeats: number;
  workspaceId: string;
}) {
  return (
    <section className="mt-10 border border-rule bg-paper p-6">
      <p className="eyebrow mb-2">Change plan</p>
      <p className="text-[14px] text-ink-soft">
        Picking a new tier or seat count routes you through Stripe Checkout —
        promotion codes work there. Existing trial period is preserved on
        upgrade/downgrade.
      </p>
      <form
        action={changePlanAction.bind(null, props.workspaceId)}
        className="mt-4 flex flex-wrap items-end gap-4"
      >
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-mono uppercase tracking-eyebrow text-[11px] text-mute">
            Tier
          </span>
          <select
            name="tier"
            defaultValue={props.currentTier}
            className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
          >
            {TIER_ORDER.map((t) => (
              <option key={t} value={t}>
                {capitalize(t)} · {formatCents(PER_SEAT_MONTHLY_USD_CENTS[t].SEATS_1)}/seat
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-mono uppercase tracking-eyebrow text-[11px] text-mute">
            Seats
          </span>
          <input
            type="number"
            name="seats"
            min={1}
            max={99}
            defaultValue={props.currentSeats}
            className="w-28 border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
          />
        </label>
        <button type="submit" className="btn-primary inline-flex">
          Update plan
        </button>
      </form>
      <p className="mt-3 text-[12px] text-mute">
        100+ seats route to a custom build engagement.
      </p>
    </section>
  );
}

function readFlash(
  q: Record<string, string | string[] | undefined>,
): string | null {
  const setup = pickFirst(q.setup);
  if (setup === "ok")
    return "Payment method saved. Your subscription auto-renews at trial end.";
  if (setup === "cancelled") return "Setup cancelled — no changes were saved.";
  const plan = pickFirst(q.plan);
  if (plan === "ok") return "Plan updated.";
  if (plan === "cancelled") return "Plan change cancelled.";
  const cancel = pickFirst(q.cancel);
  if (cancel === "ok")
    return "Subscription scheduled to cancel at the end of your current period.";
  if (cancel === "already-scheduled")
    return "Cancellation is already scheduled for the end of the current period.";
  return null;
}

function pickFirst(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
