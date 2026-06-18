/**
 * lib/demo/synthetic/types.ts
 *
 * The typed shapes for the per-vertical SYNTHETIC demo substrate — fake
 * clients, inbound messages, and transactions a brand-new workspace's killer
 * workflow runs against before a single real tool is connected.
 *
 * Why this exists (separate from `lib/onboarding/demo-data.ts`): that module
 * builds ONE activation draft from a single urgent record. This layer is the
 * richer, multi-entity dataset the VISIBLE killer-workflow RUNTIME plays
 * against — a story that runs step by step (lead → enriched → drafted →
 * scheduled → logged) with a saved-time counter ticking per action.
 *
 * Honesty (feedback_no_guesses_no_estimates): every party email is an
 * `@example.com` placeholder, every figure is plainly fictional, and the
 * surface that renders this always labels it sample data. Nothing here ever
 * mixes with a customer's real numbers.
 *
 * Voice (project_agentplain_mission_and_positioning): "local businesses",
 * never "SMB"; calm and concrete; Plaino is the named partner doing the work.
 *
 * PURE data + types. No I/O, no LLM, no `Date.now()` — all timestamps are
 * human-readable label strings so the demo is deterministic and reproducible.
 */

import type { Vertical } from "@prisma/client";

/** A fictional counterparty the workflow acts on — a lead, client, or tenant. */
export interface SyntheticClient {
  /** Stable slug, unique within a dataset. */
  id: string;
  name: string;
  /** Always an `@example.com` placeholder — these are demo counterparties. */
  email: string;
  /** One-line context that makes the record feel real (and drives the
   *  workflow's enrichment / qualification step copy). */
  context: string;
}

/** A fictional inbound that triggers the workflow (the "when X happens"). */
export interface SyntheticMessage {
  id: string;
  /** The client this came from (matches a `SyntheticClient.name`). */
  from: string;
  /** Human time-of-day label, e.g. "9:14pm". Deterministic — never a clock. */
  at: string;
  channel: "email" | "web-form" | "sms" | "portal" | "voicemail";
  subject: string;
  /** A short preview line of the inbound body. */
  preview: string;
}

/** A fictional money record (invoice / rent / estimate / fee). */
export interface SyntheticTransaction {
  id: string;
  /** Party name (matches a `SyntheticClient.name` where relevant). */
  party: string;
  kind: "invoice" | "rent" | "estimate" | "fee" | "statement";
  amountUsd: number;
  /** Plain status, e.g. "14 days past due", "sent, no reply". */
  status: string;
  ageDays?: number;
}

/** The full synthetic dataset for one vertical. */
export interface SyntheticDataset {
  /** `null` = the general (on-ramp / unknown-vertical) dataset. */
  vertical: Vertical | null;
  /** Plain label for where the data pretends to come from ("a sample Follow
   *  Up Boss pipeline") — surfaced so it is never mistaken for real data. */
  sourceLabel: string;
  clients: SyntheticClient[];
  messages: SyntheticMessage[];
  transactions: SyntheticTransaction[];
}
