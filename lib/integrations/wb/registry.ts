/**
 * lib/integrations/wb/registry.ts
 *
 * The We-Bring service registry — the single source of truth for everything
 * agentplain owns the vendor account for. A customer never logs into any of
 * these; we run them on our account and either absorb the cost into the
 * subscription ('included') or meter it onto the customer's invoice at our
 * cost ('pass-through').
 *
 * This is the mirror image of `lib/integrations/marketplace.ts`: that catalog
 * is every Customer-Brought connection; this is every We-Bring service. The
 * BYO/we-bring split is the whole point of this module pair.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the registry describes the SERVICE
 * (what it does for the customer, how it's metered), and the vendor name
 * appears once. Swapping ElevenLabs for another TTS vendor changes the impl
 * behind the `voice-synthesis` service, not this entry's id.
 */

import type { CostModel } from '../sourcing';

/** Functional category of a we-bring service. */
export type WeBringCategory =
  | 'LLM'
  | 'Embeddings'
  | 'Email'
  | 'Voice'
  | 'Telephony'
  | 'Infrastructure'
  | 'Brand'
  | 'Knowledge'
  | 'Runtime';

export interface WeBringService {
  /** Stable slug. */
  id: string;
  /** Customer-facing display name (the SERVICE, not always the vendor). */
  name: string;
  category: WeBringCategory;
  /** One-sentence customer-facing description. */
  description: string;
  /** We-bring services are never `customer-direct`; only included or
   *  pass-through. */
  costModel: Extract<CostModel, 'included' | 'pass-through'>;
  /** The unit usage is measured in, or null for services with no per-customer
   *  meter (flat infra the whole platform shares). */
  meterUnit: string | null;
  /** Soft fair-use ceiling for an `included` service, in `meterUnit`. Null = no
   *  cap (flat infra) or pass-through (the customer pays for what they use, so
   *  there's nothing to cap). */
  fairUseCap?: number | null;
  /** For `pass-through` services: the env var holding the Stripe meter
   *  `event_name`. Resolved at the call site, never hardcoded. */
  stripeMeterEnvKey?: string;
  /** Whether per-customer usage is meterable TODAY. False for shared infra
   *  (Vercel/Neon/Inngest) and for the persona/runtime/corpora we built —
   *  real but not attributable per workspace. The dashboard shows these as
   *  "Included · platform" rather than a usage number. */
  observable: boolean;
  /** Why we made the cost-model choice — surfaced in docs + the dashboard
   *  tooltip so the split stays transparent. */
  rationale: string;
}

/**
 * Env key whose value is the Stripe meter `event_name` for Twilio voice
 * pass-through. Mirrors `STRIPE_USAGE_METER_EVENT_NAME` (the LLM meter) — one
 * string shared by the cron, the dashboard, and the billing provider.
 */
export const TWILIO_METER_EVENT_ENV_KEY = 'STRIPE_TWILIO_METER_EVENT_NAME';

export const WE_BRING_SERVICES: WeBringService[] = [
  {
    id: 'anthropic-llm',
    name: 'Claude (reasoning)',
    category: 'LLM',
    description:
      'The reasoning that drafts your replies, triages your inbox, and runs your workflows. We hold the Anthropic account; you never see an API bill.',
    costModel: 'included',
    meterUnit: 'tokens',
    // No hard cap — protected by the per-workspace token budget instead. The
    // soft ceiling is "ridiculous abuse," set high; Conner decides whether Max
    // tier ever passes Anthropic cost through (TODO).
    fairUseCap: null,
    observable: true,
    rationale:
      'Absorbed so pricing stays flat and predictable. Per-workspace token budgets already guard runaway spend; Max tier may pass through (pending Conner).',
  },
  {
    id: 'openai-embeddings',
    name: 'Search embeddings',
    category: 'Embeddings',
    description:
      'Turns your documents and emails into the vectors that power instant, grounded answers. We run the embedding model; usage is on us.',
    costModel: 'included',
    meterUnit: 'tokens',
    // Soft cap at a deliberately high number of embedding tokens per period;
    // normal corpora ingest is far below it. Trips only on pathological re-index
    // loops. Conner can revisit metering at Max tier (TODO).
    fairUseCap: 50_000_000,
    observable: true,
    rationale:
      'Cheap relative to the LLM and one-time-ish per document. Absorbed; a high soft cap catches re-index loops, not normal use.',
  },
  {
    id: 'voice-synthesis',
    name: 'Voice (text-to-speech)',
    category: 'Voice',
    description:
      'The spoken voice for any call-summary or voicemail draft, using our shared brand voices. We cover the synthesis cost.',
    costModel: 'included',
    meterUnit: 'characters',
    // ElevenLabs char count. Absorbed with a soft cap — heavy voice users get a
    // conversation about Max tier rather than a surprise bill.
    fairUseCap: 2_000_000,
    observable: true,
    rationale:
      'Absorbed using shared voices to keep onboarding zero-config. A soft character cap flags outlier usage for a tier conversation.',
  },
  {
    id: 'twilio-voice',
    name: 'Phone & voice minutes',
    category: 'Telephony',
    description:
      'Outbound and inbound call minutes and the phone numbers that carry them. We own the Twilio account; the metered usage passes through onto your invoice at cost.',
    costModel: 'pass-through',
    meterUnit: 'minutes',
    fairUseCap: null, // pass-through: you pay for what you use, nothing to cap
    stripeMeterEnvKey: TWILIO_METER_EVENT_ENV_KEY,
    observable: true,
    rationale:
      'Real per-minute carrier cost that scales with the customer, not with us. Passed through (markup model pending Conner) so heavy callers pay their own way and light callers are not subsidizing them.',
  },
  {
    id: 'transactional-email',
    name: 'System email',
    category: 'Email',
    description:
      'The notifications, digests, and approval nudges agentplain sends you. We run the sender; you can graft on your own domain for branding.',
    costModel: 'included',
    meterUnit: 'emails',
    fairUseCap: 100_000,
    observable: true,
    rationale:
      'Absorbed; volume is bounded by how much the product itself emails. Customers may attach their own sending domain at no cost.',
  },
  {
    id: 'platform-infra',
    name: 'Hosting & database',
    category: 'Infrastructure',
    description:
      'The servers, database, and background jobs that keep your workspace running. Shared platform infrastructure — entirely on us.',
    costModel: 'included',
    meterUnit: null, // shared infra, not per-customer attributable
    fairUseCap: null,
    observable: false,
    rationale:
      'Vercel + Neon + Inngest are fixed platform cost shared across all workspaces. Not meaningfully attributable per customer; fully absorbed.',
  },
  {
    id: 'knowledge-corpora',
    name: 'Compliance & vertical knowledge',
    category: 'Knowledge',
    description:
      'The cited, vertical-specific knowledge corpora we built and keep current (GA/US compliance, vertical playbooks). Part of what you buy.',
    costModel: 'included',
    meterUnit: null,
    fairUseCap: null,
    observable: false,
    rationale:
      'A built asset, not a per-use cost. Bundled into every plan — it is a core reason agentplain exists on top of Claude.',
  },
  {
    id: 'plaino-runtime',
    name: 'Plaino & the orchestration runtime',
    category: 'Runtime',
    description:
      'Plaino, the skills and agents, and the runtime that coordinates them. The configured-by-us service layer that makes the rest usable.',
    costModel: 'included',
    meterUnit: null,
    fairUseCap: null,
    observable: false,
    rationale:
      'Our own software and persona. No external vendor cost; it is the product itself.',
  },
];

/** Every we-bring service. Callers use this, not the array directly. */
export function listWeBringServices(): readonly WeBringService[] {
  return WE_BRING_SERVICES;
}

/** Resolve one we-bring service by id, or null. */
export function getWeBringService(id: string): WeBringService | null {
  return WE_BRING_SERVICES.find((s) => s.id === id) ?? null;
}

/** The pass-through services (today: Twilio). */
export function passThroughServices(): readonly WeBringService[] {
  return WE_BRING_SERVICES.filter((s) => s.costModel === 'pass-through');
}

/** The absorbed ('included') services. */
export function includedServices(): readonly WeBringService[] {
  return WE_BRING_SERVICES.filter((s) => s.costModel === 'included');
}
