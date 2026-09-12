import {
  ApEyebrow,
  ApHeritageButton,
  ApHeritageTable,
  ApHeritageTd,
  ApHeritageTh,
  ApPaperCard,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { withWorkspace } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { env } from "@/lib/env";
import { getWorkspaceBudgetSnapshot } from "@/lib/billing/budget";
import { recommendBudgetCapUsd } from "@/lib/billing/recommendations";
import { formatMicroCentsAsUsd } from "@/lib/billing/usage/pricing";
import {
  SEAT_BANDS,
  TIER_ORDER,
  TIER_TAGLINE,
  tierDisplayName,
  tierFromVerticalTier,
  type TierName,
} from "@/lib/pricing/tiers";
import { MONTHLY_PRICE_USD_CENTS } from "@/lib/billing/facts";
import {
  addPaymentMethodAction,
  cancelSubscriptionAction,
  changePlanAction,
  openPortalAction,
} from "./actions";
import { BudgetSummary } from "./BudgetSummary";
import { UsagePanel } from "./UsagePanel";

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

  const [subscription, invoices, recentEvents, budgetSnapshot] =
    await Promise.all([
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
      // Month-to-date token budget vs the allowance included with the plan.
      // Same RLS context as the rest of the page (BROKER_OWNER on this
      // workspace) — the snapshot's own queries are workspace-scoped.
      withRls(rls, (tx) =>
        getWorkspaceBudgetSnapshot(tx, { workspaceId }),
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
  // Read the price directly. `monthlyChargeUsdCents(tier, seats)` is a
  // deprecated shim whose tier and seat arguments are both ignored, and whose
  // `perSeatCents` and `totalCents` fields now return the SAME number.
  const monthlyCents = subscription ? MONTHLY_PRICE_USD_CENTS : null;
  const hasPaymentMethod = Boolean(subscription?.defaultPaymentMethodId);
  const currentSeats = subscription?.seats ?? 1;
  const trialDays = env.stripeTrialPeriodDays();
  const billingEnabled = env.stripeBillingEnabled();
  const checkoutEnabled = env.stripeCheckoutEnabled();

  // Advisory recommended monthly budget (MRR × 0.30, lib/billing/recommendations.ts).
  // Customer-facing copy only — nothing is enforced unless the operator sets an
  // explicit cap on this workspace. Max (quote-based) has no productized price,
  // so no recommendation.
  const monthlyRevenueUsd =
    monthlyCents !== null && tier !== "max" ? monthlyCents / 100 : null;
  const recommendedBudgetUsd =
    monthlyRevenueUsd !== null ? recommendBudgetCapUsd(monthlyRevenueUsd) : null;

  return (
    <div>
      <ApEyebrow className="mb-3">settings · billing</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Your plan and invoices.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        One flat price, monthly, month-to-month — it does not change with the
        number of people on the workspace.{" "}
        {checkoutEnabled
          ? `First ${trialDays} days on us — card collected at signup, charged only when the trial ends. Cancel before day ${trialDays} to owe nothing.`
          : `First ${trialDays} days on us — add a card any time before your trial ends and your subscription rolls over without a gap.`}
      </p>

      {flash ? (
        <div className="mt-6 border border-rule bg-paper-deep p-4 text-[14px] text-ink">
          {flash}
        </div>
      ) : null}

      {!subscription ? (
        <MissingSubscriptionState
          billingEnabled={billingEnabled}
          trialDays={trialDays}
        />
      ) : (
        <>
          {subscription.status === "TRIALING" && daysToTrialEnd !== null ? (
            <TrialBanner
              days={daysToTrialEnd}
              endsAt={subscription.trialEndsAt}
              hasPaymentMethod={hasPaymentMethod}
              workspaceId={workspaceId}
            />
          ) : null}

          {subscription.status === "PAST_DUE" ? (
            <div className="mt-6 border border-flag bg-paper p-4 text-[14px] text-ink">
              <p className="font-medium">
                Your last invoice didn&rsquo;t go through.
              </p>
              <p className="mt-2 text-ink-soft">
                Open the billing portal to update your payment method.
                Your fleet keeps running through{" "}
                {formatDate(subscription.currentPeriodEnd)}; after that,
                agents pause until billing is current.
              </p>
              <form
                action={openPortalAction.bind(null, workspaceId)}
                className="mt-3"
              >
                <ApHeritageButton variant="primary" type="submit">
                  update payment method
                </ApHeritageButton>
              </form>
            </div>
          ) : null}

          {subscription.cancelAtPeriodEnd ? (
            <div className="mt-6 border border-rule bg-paper-deep p-4 text-[14px] text-ink">
              <p>
                Cancellation scheduled for{" "}
                <strong>{formatDate(subscription.currentPeriodEnd)}</strong>.
                Your fleet stays online until then. Open the portal to
                undo.
              </p>
            </div>
          ) : null}

          <section className="mt-8">
            <ApPaperCard
              eyebrow="current plan"
              title={`agentplain ${tierDisplayName(tier)}`}
            >
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    status
                  </p>
                  <p className="mt-1 font-display text-xl text-ink">
                    {statusLabel(subscription.status)}
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    {tier === "max"
                      ? "Quote-based engagement"
                      : SEAT_BANDS[subscription.seatBand].label}
                  </p>
                </div>
                {tier === "max" ? (
                  <div className="md:col-span-2">
                    <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      engagement
                    </p>
                    <p className="mt-1 font-display text-xl text-ink">
                      Custom scope
                    </p>
                    <p className="mt-1 text-[13px] text-ink-soft">
                      Billed per your signed engagement. Invoices appear
                      below as they&rsquo;re issued.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                        seats
                      </p>
                      <p className="mt-1 font-display text-xl text-ink">
                        {subscription.seats}
                      </p>
                      {/* Seats are RECORD-KEEPING under flat pricing. This
                          line used to read `{perSeatCents}/seat/mo`, which
                          after the collapse rendered "$99/seat/mo" beside a
                          "$99" monthly total — implying seats x $99 while
                          billing $99. Both came from the same shim and were
                          the same number. */}
                      <p className="mt-1 text-[13px] text-ink-soft">
                        included — the price is the same at any team size
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                        monthly
                      </p>
                      <p className="mt-1 font-display text-xl text-ink">
                        {formatCents(MONTHLY_PRICE_USD_CENTS)}
                      </p>
                      <p className="mt-1 text-[13px] text-ink-soft">
                        Next charge {formatDate(subscription.currentPeriodEnd)}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <p className="mt-5 text-[13px] leading-relaxed text-ink-soft">
                {TIER_TAGLINE[tier]}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {tier === "max" ? (
                  <ApHeritageButton
                    variant="primary"
                    withArrow
                    href="/custom?type=max#custom-contact"
                  >
                    manage your engagement
                  </ApHeritageButton>
                ) : (
                  <>
                    <form
                      action={addPaymentMethodAction.bind(null, workspaceId)}
                    >
                      <ApHeritageButton
                        variant={hasPaymentMethod ? "secondary" : "primary"}
                        type="submit"
                      >
                        {hasPaymentMethod
                          ? "update payment method"
                          : "add payment method"}
                      </ApHeritageButton>
                    </form>
                    <form
                      action={openPortalAction.bind(null, workspaceId)}
                    >
                      <ApHeritageButton variant="secondary" type="submit">
                        view invoices + receipts
                      </ApHeritageButton>
                    </form>
                    {!subscription.cancelAtPeriodEnd ? (
                      <form
                        action={cancelSubscriptionAction.bind(
                          null,
                          workspaceId,
                        )}
                      >
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-none px-3 py-2 font-sans text-sm text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
                        >
                          cancel subscription
                        </button>
                      </form>
                    ) : null}
                  </>
                )}
              </div>
            </ApPaperCard>
          </section>

          {/* The seat adjuster was REMOVED with the flat-price collapse.
              Under one flat price, changing the seat count has no billing
              effect — a control captioned "Adjust seats on your current
              plan", sitting on the billing settings page next to a dollar
              figure, implies a price consequence that does not exist. That
              is the same class of false claim as the retired
              "30 seats at $99/seat/mo" trial email. Seats remain visible
              above as record-keeping, labelled "included — the price is the
              same at any team size". Seat management belongs on the team
              page, not the billing page. */}

          <TierPicker
            currentTier={tier}
            currentSeats={currentSeats}
            workspaceId={workspaceId}
          />

          <section className="mt-12">
            <ApEyebrow className="mb-4">invoices</ApEyebrow>
            {invoices.length === 0 ? (
              <ApRootedEmptyState
                motif="silo"
                reality="No invoices yet."
                change="Your first invoice arrives at trial end. We post a copy here and email a PDF; receipts come from Stripe."
              />
            ) : (
              <div className="overflow-x-auto">
              <ApHeritageTable aria-label="Invoices">
                <thead>
                  <tr>
                    <ApHeritageTh>issued</ApHeritageTh>
                    <ApHeritageTh>period</ApHeritageTh>
                    <ApHeritageTh align="right">amount</ApHeritageTh>
                    <ApHeritageTh>status</ApHeritageTh>
                    <ApHeritageTh>open</ApHeritageTh>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-t border-rule"
                    >
                      <ApHeritageTd>
                        <span className="font-mono text-[12px] uppercase text-mute">
                          {formatDate(inv.issuedAt)}
                        </span>
                      </ApHeritageTd>
                      <ApHeritageTd>
                        <span className="text-ink-soft">
                          {inv.periodStart && inv.periodEnd
                            ? `${formatDate(inv.periodStart)} – ${formatDate(
                                inv.periodEnd,
                              )}`
                            : "—"}
                        </span>
                      </ApHeritageTd>
                      <ApHeritageTd align="right">
                        {formatCents(inv.amountUsdCents)}
                      </ApHeritageTd>
                      <ApHeritageTd>
                        <span className="font-mono text-[12px] uppercase text-mute">
                          {inv.status}
                        </span>
                      </ApHeritageTd>
                      <ApHeritageTd>
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
                          <span className="text-mute">—</span>
                        )}
                      </ApHeritageTd>
                    </tr>
                  ))}
                </tbody>
              </ApHeritageTable>
              </div>
            )}
          </section>

          {recentEvents.length > 0 ? (
            <section className="mt-12">
              <ApEyebrow className="mb-4">recent billing events</ApEyebrow>
              <ul className="border border-rule bg-paper">
                {recentEvents.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between border-b border-rule px-5 py-3 text-[13px] last:border-b-0"
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

          {/* Monthly token activity — transparency so there's never a surprise
              overage. Shows last-30-day spend against the workspace's explicit
              cap when an operator has set one (otherwise no cap), plus the
              recommended budget for the plan as advisory copy. Hidden only when
              the snapshot can't be resolved (should not happen for a subscribed
              workspace). */}
          {budgetSnapshot ? (
            <BudgetSummary
              state={budgetSnapshot.state}
              spendUsd={formatMicroCentsAsUsd(budgetSnapshot.consumedMicroCents)}
              capUsd={budgetSnapshot.capUsdMonthly}
              percentUsed={budgetSnapshot.percentUsed}
              recommendedUsd={recommendedBudgetUsd}
            />
          ) : null}

          {/* Token + cost usage. Falls back to the 30-day window when the
              subscription has no current-period anchor (e.g. a workspace
              still on a manual invoice that hasn't been mapped). */}
          <UsagePanel
            workspaceId={workspaceId}
            rls={rls}
            periodStart={derivePeriodStart(subscription.currentPeriodEnd)}
            periodEnd={subscription.currentPeriodEnd}
          />

          <p className="mt-12 border-t border-rule pt-6 text-[13px] leading-relaxed text-mute">
            Cancel anytime. Your service partner stays on through the
            end of the current period.
          </p>
        </>
      )}
    </div>
  );
}


// ─── Tier picker (three columns) ────────────────────────────────────────────

interface TierBullets {
  bullets: string[];
}

const TIER_BULLETS: Record<TierName, TierBullets> = {
  regular: {
    bullets: [
      "Your fleet, run for you",
      "Onboarding bundled",
      "Compliance Sentinel + Buyer Inquiry Router + Showing Scheduler",
      "Weekly briefings + activity feed",
    ],
  },
  plus: {
    bullets: [
      "Everything in Regular",
      "Priority support + quarterly async check-in with your service team",
      "Priority handling on flags + drafts",
      "Service-partner check-in each week",
    ],
  },
  max: {
    bullets: [
      "Quote-based engagement",
      "Multi-state operations + compliance gates",
      "White-label deployment",
      "Dedicated team",
    ],
  },
};

function TierPicker({
  currentTier,
  currentSeats,
  workspaceId,
}: {
  currentTier: TierName;
  currentSeats: number;
  workspaceId: string;
}) {
  return (
    <section className="mt-10">
      <ApEyebrow className="mb-4">change plan</ApEyebrow>
      <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
        {TIER_ORDER.map((tier) => (
          <TierCard
            key={tier}
            tier={tier}
            isCurrent={tier === currentTier}
            currentSeats={currentSeats}
            workspaceId={workspaceId}
          />
        ))}
      </div>
    </section>
  );
}

function TierCard({
  tier,
  isCurrent,
  currentSeats,
  workspaceId,
}: {
  tier: TierName;
  isCurrent: boolean;
  currentSeats: number;
  workspaceId: string;
}) {
  const bullets = TIER_BULLETS[tier].bullets;
  const isMax = tier === "max";
  // One flat price for every self-serve plan. This read
  // `from ${formatCents(PER_SEAT_MONTHLY_USD_CENTS[tier].SEATS_50_99)}/seat`,
  // which after the flat-price collapse printed the SAME label on both plan
  // cards ("from $99/seat") — a plan comparison with no difference in it.
  const priceLabel = isMax
    ? "Quote-based"
    : `${formatCents(MONTHLY_PRICE_USD_CENTS)}/month`;

  return (
    <div className="bg-paper p-6 md:p-7">
      {isCurrent ? (
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          current plan
        </p>
      ) : (
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {tier === "regular" ? "standard service" : tier === "plus" ? "with priority support" : "custom"}
        </p>
      )}
      <p className="mt-2 font-display text-2xl leading-tight text-ink">
        agentplain {tierDisplayName(tier)}
      </p>
      <p className="mt-1 text-[13px] text-ink-soft">{priceLabel}</p>
      <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
        {TIER_TAGLINE[tier]}
      </p>
      <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-ink">
        {bullets.map((b) => (
          <li key={b} className="flex items-baseline gap-2">
            <span aria-hidden className="text-mute">—</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {isCurrent ? (
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            you&rsquo;re on this plan
          </p>
        ) : isMax ? (
          <ApHeritageButton
            variant="secondary"
            withArrow
            href="/custom?type=max#custom-contact"
          >
            talk to a partner
          </ApHeritageButton>
        ) : (
          <TierChangeForm
            tier={tier}
            currentSeats={currentSeats}
            workspaceId={workspaceId}
          />
        )}
      </div>
    </div>
  );
}

function TierChangeForm({
  tier,
  currentSeats,
  workspaceId,
}: {
  tier: TierName;
  currentSeats: number;
  workspaceId: string;
}) {
  // Per existing changePlanAction contract: downgrades from Partner to
  // Regular require `confirm=downgrade` to acknowledge losing reserved
  // hours. We surface that as a checkbox under the CTA so the action
  // doesn't silently fail.
  const isDowngradeFromPartner = tier === "regular";
  return (
    <form
      action={changePlanAction.bind(null, workspaceId)}
      className="space-y-3"
    >
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="seats" value={currentSeats} />
      {isDowngradeFromPartner ? (
        <label className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            name="confirm"
            value="downgrade"
            required
            className="mt-[3px]"
          />
          <span>
            I understand I&rsquo;ll lose priority support and the
            quarterly async check-in. (Only applies if downgrading from Partner.)
          </span>
        </label>
      ) : null}
      <ApHeritageButton variant="primary" type="submit">
        choose {tierDisplayName(tier)}
      </ApHeritageButton>
    </form>
  );
}

function TrialBanner(props: {
  days: number;
  endsAt: Date | null;
  hasPaymentMethod: boolean;
  workspaceId: string;
}) {
  const verb =
    props.days === 0
      ? "ends today"
      : `ends in ${props.days} day${props.days === 1 ? "" : "s"}`;
  return (
    <div className="mt-6 border border-ink bg-paper-deep p-5">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        trial
      </p>
      <p className="mt-1 text-[15px] text-ink">
        Your trial {verb}
        {props.endsAt ? ` (${formatDate(props.endsAt)})` : ""}.{" "}
        {props.hasPaymentMethod
          ? "Card on file — your subscription rolls over automatically."
          : "Add a card to keep your fleet running when the trial ends."}
      </p>
      {!props.hasPaymentMethod ? (
        <form
          action={addPaymentMethodAction.bind(null, props.workspaceId)}
          className="mt-3"
        >
          <ApHeritageButton variant="primary" type="submit">
            add payment method
          </ApHeritageButton>
        </form>
      ) : null}
    </div>
  );
}

function MissingSubscriptionState({
  billingEnabled,
  trialDays,
}: {
  billingEnabled: boolean;
  trialDays: number;
}) {
  // When billing isn't enabled yet (pre-launch default), there's no Stripe
  // subscription BY DESIGN — the workspace is on a free trial with no card.
  // Say that plainly instead of the "still provisioning" copy, which only
  // applies when billing IS on and the post-signup provisioning is lagging.
  if (!billingEnabled) {
    return (
      <div className="mt-8">
        <ApRootedEmptyState
          motif="lone-tree"
          reality={`You're on a free trial — no card needed.`}
          change={`Your first ${trialDays} days are on us. We'll let you know here, and by email, before anything is ever charged. Nothing to do right now.`}
        />
      </div>
    );
  }
  return (
    <div className="mt-8">
      <ApRootedEmptyState
        motif="lone-tree"
        reality="Your trial is still provisioning."
        change="Refresh in a moment. If this persists, your service partner is notified — your workspace still works without the subscription wired up."
      />
    </div>
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

// Derive the inclusive start of the current billing period from Stripe's
// `currentPeriodEnd`. Stripe bills monthly on agentplain — the previous
// anchor is exactly one month before the current one. We approximate by
// subtracting one calendar month (handles 28/29/30/31-day months by
// letting JS clamp).
function derivePeriodStart(currentPeriodEnd: Date | null): Date | null {
  if (!currentPeriodEnd) return null;
  const d = new Date(currentPeriodEnd);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d;
}
