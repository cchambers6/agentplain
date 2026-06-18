/**
 * lib/integrations/sourcing.ts
 *
 * The integration SOURCING split — the spine of "things customers bring"
 * vs "things we bring." Every connection agentplain offers falls into
 * exactly one of two buckets, and that bucket determines who owns the
 * account, who pays for usage, and how the cost surfaces to the customer.
 *
 *   'byo'      — Customer-Brought. The customer authorizes their OWN account
 *                (OAuth grant or pasted API key). They pay their SaaS vendor
 *                directly; agentplain charges $0 for the connection itself.
 *                Examples: Gmail, HubSpot, QuickBooks, DocuSign, Follow Up Boss.
 *                Every `MarketplaceEntry` is BYO by nature — a marketplace tile
 *                is, definitionally, a customer account we plug into.
 *
 *   'we-bring' — We-Bring. agentplain owns the vendor account and the
 *                customer never sees a vendor login. Cost is either absorbed
 *                into the subscription ('included') or metered through to the
 *                customer's invoice ('pass-through'). Examples: Anthropic,
 *                OpenAI embeddings, Vercel/Neon/Inngest infra, Resend,
 *                ElevenLabs, Twilio (pass-through), the knowledge corpora and
 *                Plaino persona we built.
 *
 * This file holds ONLY the types + a dependency-free resolver so it can be
 * imported from both the BYO and we-bring layers and the marketplace catalog
 * without import cycles. The unified catalog + classification warnings live in
 * `lib/integrations/connection-catalog.ts`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: sourcing is a first-class field on
 * the catalog, not a lookup table that can drift from it.
 */

export type IntegrationSourcing = 'byo' | 'we-bring';

/**
 * Who pays, and how the line item reads to the customer.
 *
 *   'customer-direct' — BYO only. The customer pays their own vendor bill;
 *                       agentplain bills nothing for the connection. Surfaces
 *                       as "You're paying directly."
 *   'included'        — We-bring, absorbed into the subscription tier. The
 *                       customer is never charged for usage (Anthropic on
 *                       non-Max tiers, embeddings, infra). Surfaces as
 *                       "Included." A soft fair-use cap protects against abuse.
 *   'pass-through'    — We-bring, metered onto the customer's invoice at our
 *                       cost (optionally with a markup Conner sets). Today:
 *                       Twilio voice minutes + phone numbers. Surfaces as
 *                       "Pass-through."
 */
export type CostModel = 'customer-direct' | 'included' | 'pass-through';

/** The customer-facing label for each cost model — one string, one seam. */
export const COST_MODEL_LABEL: Record<CostModel, string> = {
  'customer-direct': "You're paying directly",
  included: 'Included',
  'pass-through': 'Pass-through',
};

/** One-line plain-language explanation per cost model for tooltips/help. */
export const COST_MODEL_EXPLAINER: Record<CostModel, string> = {
  'customer-direct':
    'You bring this account and pay your own vendor bill. agentplain charges nothing for the connection.',
  included:
    'We bring this and absorb the cost into your plan. You only see usage here for transparency — it never hits your invoice.',
  'pass-through':
    'We run this on our account and pass the metered usage onto your agentplain invoice at cost.',
};

/** The label shown on a card for the sourcing bucket itself. */
export const SOURCING_LABEL: Record<IntegrationSourcing, string> = {
  byo: 'You bring',
  'we-bring': 'We bring',
};

/**
 * The cost model that necessarily follows from a BYO connection: the customer
 * always pays their own vendor, so BYO is always `customer-direct`. We-bring
 * services declare their own cost model ('included' or 'pass-through').
 */
export const BYO_COST_MODEL: CostModel = 'customer-direct';
