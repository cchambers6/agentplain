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
 *   1. Find or create ONE `Product` (lookup_key = `agentplain_flat`).
 *   2. Find or create ONE recurring `Price` (lookup_key =
 *      `agentplain_flat_monthly`) attached to it, with the flat unit
 *      amount from `MONTHLY_PRICE_USD_CENTS` in `lib/billing/facts.ts`.
 *   3. Print a summary mapping lookup_key → price id / product id so
 *      Conner can sanity-check the dashboard.
 *
 * FLAT PRICE (ratified by Conner). This script previously created 3
 * Products x 5 seat bands = 15 Prices. It now creates 1 x 1.
 *
 * IT DOES NOT ARCHIVE THE 15 RETIRED PRICES. Existing subscriptions are
 * still attached to them and Stripe keeps billing and emitting webhooks
 * against them for the life of each subscription;
 * `lib/billing/webhook-dispatch.ts` still parses their lookup keys.
 * Retiring them is a separate, deliberate migration in Stripe.
 *
 * Why lookup_keys instead of hardcoded ids:
 *   * No env-var brittleness.
 *   * Idempotent — re-run the script and existing rows are reused.
 *   * Stripe-native — the BillingProvider reads them at runtime via
 *     `prices.list({lookup_keys: [...]})`.
 *
 * Usage:
 *   # Test mode (safe rehearsal — default):
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe/setup-products.ts
 *
 *   # Live mode (Conner-gated — provisions the REAL catalog):
 *   STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/stripe/setup-products.ts --live
 *
 * Add `--dry-run` to see the planned operations without writing (works in
 * either mode and never requires --live, since it writes nothing).
 *
 * SAFETY GATE: a live secret key (`sk_live_`/`rk_live_`) is REFUSED unless
 * `--live` is passed, and `--live` is refused unless the key is actually
 * live. This makes live provisioning a single deliberate command and makes
 * it impossible to write the live catalog by accident. See
 * docs/stripe-live-catalog-runbook-2026-05-22.md.
 */

import Stripe from "stripe";
import {
  FLAT_MONTHLY_LOOKUP_KEY,
  FLAT_PRODUCT_LOOKUP_KEY,
  MONTHLY_PRICE_USD_CENTS,
  tierProductName,
} from "../../lib/pricing/tiers";
import { STRIPE_API_VERSION } from "../../lib/billing/stripe-provider";

interface RunOptions {
  dryRun: boolean;
  live: boolean;
}

type StripeKeyMode = "live" | "test" | "unknown";

/** Classify the secret key by its documented prefix. Stripe live keys are
 *  `sk_live_` / `rk_live_`; test keys are `sk_test_` / `rk_test_`. */
function stripeKeyMode(secret: string): StripeKeyMode {
  if (secret.startsWith("sk_live_") || secret.startsWith("rk_live_")) return "live";
  if (secret.startsWith("sk_test_") || secret.startsWith("rk_test_")) return "test";
  return "unknown";
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "STRIPE_SECRET_KEY not set. Use a test-mode key (sk_test_…) for preview/dev. " +
        "Live provisioning needs a sk_live_ key AND the explicit --live flag.",
    );
  }

  const keyMode = stripeKeyMode(secret);

  // ── Live-mode safety gate ──────────────────────────────────────────
  // A dry-run writes nothing, so it bypasses the gate (rehearse against any
  // key). For an applying run, a live key MUST be paired with --live, and
  // --live MUST be paired with a live key — so the live catalog can never be
  // written by accident, and --live can never silently hit a test account.
  if (!opts.dryRun) {
    if (keyMode === "unknown") {
      throw new Error(
        "STRIPE_SECRET_KEY is not a recognized sk_test_/sk_live_/rk_ key. " +
          "Refusing to run. Re-check the key, or add --dry-run to rehearse.",
      );
    }
    if (keyMode === "live" && !opts.live) {
      throw new Error(
        "Refusing to run against a LIVE Stripe key without --live.\n" +
          "  This would create real Products/Prices in your live account.\n" +
          "  Re-run with --live after reading docs/stripe-live-catalog-runbook-2026-05-22.md,\n" +
          "  or use an sk_test_ key (or add --dry-run) for a safe rehearsal.",
      );
    }
    if (opts.live && keyMode !== "live") {
      throw new Error(
        `--live was passed but STRIPE_SECRET_KEY is mode=${keyMode} (expected sk_live_…).\n` +
          "  Set a live secret key, or drop --live to provision the test catalog.",
      );
    }
  }

  const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION });

  console.log(
    `[setup-products] mode=${opts.dryRun ? "dry-run" : "apply"} target=${keyMode.toUpperCase()} stripe-api=${STRIPE_API_VERSION}`,
  );

  // --- Product (exactly one, flat pricing) --------------------------
  let product: Stripe.Product | null = null;
  const productName = tierProductName();
  {
    // Prefer the price→product pointer: `prices.list({lookup_keys})` uses
    // the lookup_key index which is real-time consistent, so this reliably
    // finds the existing Product even immediately after a previous run.
    // Fall back to products.search (which has async index latency) only
    // when no price exists yet (fresh account / partial run).
    const existing =
      (await findProductByExistingPrice(stripe)) ??
      (await findProductByMetadata(stripe, FLAT_PRODUCT_LOOKUP_KEY));
    if (existing) {
      const nameDrift = existing.name !== productName;
      console.log(
        `[products] reuse  flat    → ${existing.id}  (name="${existing.name}"${
          nameDrift ? ` ← drifted, expected "${productName}"` : ""
        })`,
      );
      if (nameDrift) {
        // Don't auto-rename — Stripe Product names show on Checkout +
        // invoices and live by operator discretion. Surface the drift so
        // Conner can rename manually in the dashboard if desired.
        console.log(
          `[products]   note: dashboard name does not match tierProductName(). Rename in Stripe if you want the display to match.`,
        );
      }
      product = existing;
    } else if (opts.dryRun) {
      console.log(
        `[products] create flat    → (dry-run) name="${productName}"`,
      );
    } else {
      product = await stripe.products.create({
        name: productName,
        metadata: { agentplain_lookup_key: FLAT_PRODUCT_LOOKUP_KEY },
      });
      console.log(
        `[products] create flat    → ${product.id}  (name="${product.name}")`,
      );
    }
  }

  // --- Price (exactly one, flat monthly) ----------------------------
  //
  // The 15 retired `agentplain_<tier>_<band>_monthly` Prices are LEFT
  // ALONE. Existing subscriptions bill against them; archiving them here
  // would be an unreviewed change to live customers' billing.
  {
    const key = FLAT_MONTHLY_LOOKUP_KEY;
    const unitAmount = MONTHLY_PRICE_USD_CENTS;
    const existing = await findPriceByLookupKey(stripe, key);
    let needsCreate = true;
    if (existing) {
      if (existing.unit_amount === unitAmount) {
        console.log(
          `[prices]   reuse  ${key.padEnd(28)} → ${existing.id}  ($${unitAmount / 100}/mo flat)`,
        );
        needsCreate = false;
      } else {
        // Stripe Prices are immutable — to change the amount we archive
        // the old and create a new one carrying the same lookup_key.
        // The runtime then resolves to the new id automatically.
        console.log(
          `[prices]   bump   ${key.padEnd(28)} : old=${existing.id} ($${(existing.unit_amount ?? 0) / 100}) → new $${unitAmount / 100}`,
        );
        if (!opts.dryRun) {
          await stripe.prices.update(existing.id, {
            active: false,
            lookup_key: `${key}_archived_${Date.now()}`,
          });
        }
      }
    }
    if (needsCreate) {
      if (opts.dryRun) {
        console.log(
          `[prices]   create ${key.padEnd(28)} → (dry-run) $${unitAmount / 100}/mo flat`,
        );
      } else {
        if (!product) {
          throw new Error(`Cannot create price ${key}: product not provisioned`);
        }
        const created = await stripe.prices.create({
          product: product.id,
          currency: "usd",
          unit_amount: unitAmount,
          recurring: { interval: "month" },
          lookup_key: key,
          metadata: { agentplain_pricing_model: "flat-monthly" },
          nickname: `${productName} — flat monthly`,
        });
        console.log(
          `[prices]   create ${key.padEnd(28)} → ${created.id}  ($${unitAmount / 100}/mo flat)`,
        );
      }
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
  //
  // Caveat: products.search uses an external index that updates async —
  // a Product created seconds ago may not yet be returned here. Callers
  // should try findProductByExistingPrice first.
  const search = await stripe.products.search({
    query: `metadata['agentplain_lookup_key']:'${productLookupKey}' AND active:'true'`,
    limit: 1,
  });
  return search.data[0] ?? null;
}

async function findProductByExistingPrice(
  stripe: Stripe,
): Promise<Stripe.Product | null> {
  // Use the flat Price's `product` pointer to find the Product.
  // prices.list filters via the real-time-consistent lookup_keys index,
  // so this returns the canonical Product even immediately after creation.
  const list = await stripe.prices.list({
    lookup_keys: [FLAT_MONTHLY_LOOKUP_KEY],
    active: true,
    limit: 1,
    expand: ["data.product"],
  });
  const price = list.data[0];
  if (!price) return null;
  if (typeof price.product === "string") {
    return stripe.products.retrieve(price.product);
  }
  if (price.product && !("deleted" in price.product)) {
    return price.product as Stripe.Product;
  }
  return null;
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
  return {
    dryRun: args.includes("--dry-run"),
    live: args.includes("--live"),
  };
}

main().catch((err) => {
  console.error("[setup-products] failed:", err);
  process.exit(1);
});
