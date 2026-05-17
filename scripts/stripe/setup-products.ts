/**
 * Idempotent Stripe Products + Prices provisioner for agentplain.
 *
 * Run-anytime: the script reconciles the dashboard state against
 * `lib/pricing/tiers.ts`. Run it after a fresh Stripe account, after
 * a pricing change, or any time you suspect drift.
 *
 * What it does (per project_stripe_both_surfaces lines 47–54 +
 * feedback_no_quick_fixes — the right fix, not the cheap one):
 *
 *   1. For each tier (regular / plus / max):
 *      - Find or create the `Product` (lookup_key = `agentplain_<tier>`).
 *   2. For each (tier, seat band):
 *      - Find or create the recurring `Price` (lookup_key =
 *        `agentplain_<tier>_seats_<band>_monthly`) attached to the
 *        tier's Product, with the per-seat unit amount from
 *        `PER_SEAT_MONTHLY_USD_CENTS`.
 *   3. Print a summary mapping lookup_key → price id / product id so
 *      Conner can sanity-check the dashboard.
 *
 * Why lookup_keys instead of hardcoded ids:
 *   * No 15-env-var brittleness (or 6 env vars for the legacy
 *     3-tier × 2-cadence layout that this script supersedes).
 *   * Idempotent — re-run the script and existing rows are reused.
 *   * Stripe-native — the BillingProvider reads them at runtime via
 *     `prices.list({lookup_keys: [...]})`.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe/setup-products.ts
 *
 * Add `--dry-run` to see the planned operations without writing.
 */

import Stripe from "stripe";
import {
  PER_SEAT_MONTHLY_USD_CENTS,
  SEAT_BAND_ORDER,
  TIER_ORDER,
  lookupKeyFor,
  tierProductLookupKey,
  tierProductName,
  type TierName,
} from "../../lib/pricing/tiers";
import { STRIPE_API_VERSION } from "../../lib/billing/stripe-provider";

interface RunOptions {
  dryRun: boolean;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "STRIPE_SECRET_KEY not set. Use a test-mode key for preview/dev — never prod for setup.",
    );
  }
  const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION });

  console.log(
    `[setup-products] mode=${opts.dryRun ? "dry-run" : "apply"} stripe-api=${STRIPE_API_VERSION}`,
  );

  const productByTier = new Map<TierName, Stripe.Product>();

  // --- Products -----------------------------------------------------
  for (const tier of TIER_ORDER) {
    const productLookup = tierProductLookupKey(tier);
    const productName = tierProductName(tier);
    const existing = await findProductByMetadata(stripe, productLookup);
    if (existing) {
      const nameDrift = existing.name !== productName;
      console.log(
        `[products] reuse  ${tier.padEnd(7)} → ${existing.id}  (name="${existing.name}"${
          nameDrift ? ` ← drifted, expected "${productName}"` : ""
        })`,
      );
      if (nameDrift) {
        // Don't auto-rename — Stripe Product names show on Checkout +
        // invoices and live by operator discretion. Surface the drift so
        // Conner can rename manually in the dashboard if desired. This
        // matters for the 2026-05-15 Plus → "agentplain Partner" rename;
        // the on-disk enum stays `plus`, only the display string changed.
        console.log(
          `[products]   note: dashboard name does not match tierProductName("${tier}"). Rename in Stripe if you want the display to match.`,
        );
      }
      productByTier.set(tier, existing);
      continue;
    }
    if (opts.dryRun) {
      console.log(
        `[products] create ${tier.padEnd(7)} → (dry-run) name="${productName}"`,
      );
      continue;
    }
    const created = await stripe.products.create({
      name: productName,
      metadata: { agentplain_tier: tier, agentplain_lookup_key: productLookup },
    });
    console.log(
      `[products] create ${tier.padEnd(7)} → ${created.id}  (name="${created.name}")`,
    );
    productByTier.set(tier, created);
  }

  // --- Prices -------------------------------------------------------
  for (const tier of TIER_ORDER) {
    const product = productByTier.get(tier);
    for (const band of SEAT_BAND_ORDER) {
      const key = lookupKeyFor(tier, band);
      const unitAmount = PER_SEAT_MONTHLY_USD_CENTS[tier][band];
      const existing = await findPriceByLookupKey(stripe, key);
      if (existing) {
        if (existing.unit_amount === unitAmount) {
          console.log(
            `[prices]   reuse  ${key.padEnd(34)} → ${existing.id}  ($${unitAmount / 100}/seat/mo)`,
          );
          continue;
        }
        // Stripe Prices are immutable — to change the amount we archive
        // the old and create a new one carrying the same lookup_key.
        // The runtime then resolves to the new id automatically.
        console.log(
          `[prices]   bump   ${key.padEnd(34)} : old=${existing.id} ($${(existing.unit_amount ?? 0) / 100}) → new $${unitAmount / 100}`,
        );
        if (!opts.dryRun) {
          await stripe.prices.update(existing.id, {
            active: false,
            lookup_key: `${key}_archived_${Date.now()}`,
          });
        }
      }
      if (opts.dryRun) {
        console.log(
          `[prices]   create ${key.padEnd(34)} → (dry-run) $${unitAmount / 100}/seat/mo`,
        );
        continue;
      }
      if (!product) {
        throw new Error(
          `Cannot create price ${key}: product for tier ${tier} not provisioned`,
        );
      }
      const created = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: unitAmount,
        recurring: { interval: "month" },
        lookup_key: key,
        metadata: {
          agentplain_tier: tier,
          agentplain_seat_band: band,
        },
        nickname: `${tierProductName(tier)} — ${band.toLowerCase()}`,
      });
      console.log(
        `[prices]   create ${key.padEnd(34)} → ${created.id}  ($${unitAmount / 100}/seat/mo)`,
      );
    }
  }

  console.log("\n[setup-products] done.");
  if (opts.dryRun) {
    console.log("[setup-products] dry-run only — re-run without --dry-run to apply.");
  } else {
    console.log(
      "[setup-products] Prices are resolved at runtime by lookup_key.\n" +
        "                  No env vars to populate.",
    );
  }
}

async function findProductByMetadata(
  stripe: Stripe,
  productLookupKey: string,
): Promise<Stripe.Product | null> {
  // Stripe `products` doesn't expose lookup_keys directly, so we filter
  // by metadata via the search API. agentplain stamps a stable
  // `agentplain_lookup_key` so the script can reconcile.
  const search = await stripe.products.search({
    query: `metadata['agentplain_lookup_key']:'${productLookupKey}' AND active:'true'`,
    limit: 1,
  });
  return search.data[0] ?? null;
}

async function findPriceByLookupKey(
  stripe: Stripe,
  lookupKey: string,
): Promise<Stripe.Price | null> {
  const list = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  return list.data[0] ?? null;
}

function parseArgs(args: string[]): RunOptions {
  return { dryRun: args.includes("--dry-run") };
}

main().catch((err) => {
  console.error("[setup-products] failed:", err);
  process.exit(1);
});
