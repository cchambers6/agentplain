/**
 * lib/agents/sentinel/counsel-signoff.ts
 *
 * pfd-5 — the per-vertical counsel sign-off gate.
 *
 * THE RISK THIS KILLS: rewrite-and-stage can generate REPLACEMENT LEGAL TEXT
 * and stage it to a customer surface. Before pfd-5 the only gate was an env
 * allow-list (`COMPLIANCE_CORPUS_COUNSEL_REVIEWED`) plus a hard-coded
 * "real-estate is baseline-live" exemption — i.e. unreviewed legal text could
 * ship the moment a slug was added to an env var, with no durable record that
 * a human lawyer ever signed off. This module makes the sign-off a DURABLE DB
 * ROW that an operator must affirmatively set after uploading the signed
 * counsel artifact. Absent that row, replacement legal text is GATED.
 *
 * ── PRECEDENCE (read this before changing anything) ──────────────────────
 * A vertical's rewrites may fire live ONLY when BOTH layers pass:
 *
 *   1. ENV KILL-SWITCH (ABOVE the rows). `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`
 *      must list the vertical. Env OFF for a vertical → GATED regardless of
 *      any DB sign-off row. This is the global "stop everything" lever ops can
 *      pull without a DB write. There is NO baseline exemption — real-estate
 *      is gated like every other vertical (pfd-5 removed the old exemption).
 *
 *   2. DB SIGN-OFF (the per-vertical durable record). A
 *      `ComplianceCounselSignoff` row must exist with
 *      `signedAt <= now() AND revokedAt IS NULL`. Missing row, NULL signedAt,
 *      FUTURE signedAt, or a non-null revokedAt → UNSIGNED → GATED.
 *
 * ── FAIL-CLOSED ──────────────────────────────────────────────────────────
 * The gate defaults to GATED on every ambiguity:
 *   - DB unreachable / store throws        → gated (we never assume signed).
 *   - No row for the vertical              → gated.
 *   - Row present but signedAt NULL/future → gated.
 *   - Row revoked                          → gated.
 *   - Unknown / unregistered vertical slug → gated.
 * The ONLY path to "live" is an affirmative, current, un-revoked sign-off row
 * AND the env flag. Silence is never consent.
 *
 * Per `feedback_cold_start_safe_agents.md`: the store is read fresh on every
 * gate evaluation — no in-process cache of sign-off state.
 * Per `feedback_runner_portability.md`: `CounselSignoffStore` is the port;
 * `PrismaCounselSignoffStore` is the production impl, `InMemoryCounselSignoffStore`
 * the test peer (two-implementation rule).
 */

import { env } from "../../env";

/** A durable counsel sign-off record for one compliance-corpus vertical. */
export interface CounselSignoff {
  verticalSlug: string;
  /** Effective sign-off time. NULL = never signed. */
  signedAt: Date | null;
  /** Revocation time. Non-null = sign-off withdrawn. */
  revokedAt: Date | null;
  artifactRef: string | null;
  signedByEmail: string | null;
  signedByUserId: string | null;
  note: string | null;
  updatedAt: Date;
}

/** Fields an operator action provides when recording a sign-off. */
export interface RecordSignoffInput {
  verticalSlug: string;
  signedAt: Date;
  artifactRef?: string | null;
  signedByEmail?: string | null;
  signedByUserId?: string | null;
  note?: string | null;
}

/**
 * Durable per-vertical counsel sign-off store. The gate reads it; the
 * operator console writes it. Port boundary per the two-implementation rule.
 */
export interface CounselSignoffStore {
  readonly name: string;
  /** Returns the sign-off row for a vertical, or null if none exists. */
  get(verticalSlug: string): Promise<CounselSignoff | null>;
  /** Lists every sign-off row (operator console coverage view). */
  list(): Promise<CounselSignoff[]>;
  /**
   * Records (or re-records) a sign-off: sets signedAt + artifact + actor and
   * CLEARS revokedAt. Upsert by verticalSlug.
   */
  record(input: RecordSignoffInput): Promise<CounselSignoff>;
  /** Revokes a vertical's sign-off: sets revokedAt = now. Idempotent. */
  revoke(
    verticalSlug: string,
    actor: { email?: string | null; userId?: string | null },
  ): Promise<CounselSignoff | null>;
}

/**
 * Pure predicate: is THIS sign-off row currently valid? A row is "signed"
 * only when signedAt is set, in the past (or now), and not revoked.
 *
 * Exported + pure so tests pin the exact boundary conditions without a store.
 */
export function isSignoffCurrentlyValid(
  signoff: CounselSignoff | null,
  now: Date = new Date(),
): boolean {
  if (!signoff) return false; // no row → fail-closed
  if (!signoff.signedAt) return false; // never signed
  if (signoff.revokedAt) return false; // revoked
  if (signoff.signedAt.getTime() > now.getTime()) return false; // future-dated
  return true;
}

/**
 * Whether the ENV kill-switch permits this vertical. This is layer 1 — it
 * sits ABOVE the DB rows. pfd-5 removed the real-estate baseline exemption,
 * so EVERY vertical (real-estate included) must be listed in
 * `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` to clear this layer.
 */
export function envPermitsVertical(verticalSlug: string): boolean {
  return env
    .complianceCounselReviewedVerticals()
    .includes(verticalSlug.trim().toLowerCase());
}

/**
 * The full gate: BOTH the env kill-switch AND a current DB sign-off must pass.
 * Fail-closed — any store error, missing row, or ambiguity returns
 * `{ live: false }` with a reason. NEVER throws.
 *
 * @param store  the durable sign-off store (defaults to Prisma in prod via
 *               `defaultCounselGate`).
 */
export interface CounselGateResult {
  live: boolean;
  /** Machine-readable reason, surfaced to the audit log + the banner. */
  reason:
    | "live"
    | "env-killed"
    | "no-signoff-row"
    | "not-signed"
    | "revoked"
    | "future-dated"
    | "store-error"
    | "unknown-vertical";
}

export async function evaluateCounselGate(args: {
  verticalSlug: string;
  store: CounselSignoffStore;
  /** Known-vertical predicate (the corpus registry). Unknown → gated. */
  isKnownVertical?: (slug: string) => boolean;
  now?: Date;
}): Promise<CounselGateResult> {
  const slug = args.verticalSlug;
  const now = args.now ?? new Date();

  if (args.isKnownVertical && !args.isKnownVertical(slug)) {
    return { live: false, reason: "unknown-vertical" };
  }

  // Layer 1: env kill-switch sits above the rows.
  if (!envPermitsVertical(slug)) {
    return { live: false, reason: "env-killed" };
  }

  // Layer 2: durable per-vertical sign-off. Fail-closed on any store error.
  let signoff: CounselSignoff | null;
  try {
    signoff = await args.store.get(slug);
  } catch {
    return { live: false, reason: "store-error" };
  }

  if (!signoff) return { live: false, reason: "no-signoff-row" };
  if (!signoff.signedAt) return { live: false, reason: "not-signed" };
  if (signoff.revokedAt) return { live: false, reason: "revoked" };
  if (signoff.signedAt.getTime() > now.getTime()) {
    return { live: false, reason: "future-dated" };
  }
  return { live: true, reason: "live" };
}

/**
 * The shape `stageRewrites` consumes: "given a vertical, is it live for
 * rewrite generation?" Returns true ONLY when the full gate passes. Defaults
 * to fail-closed.
 */
export type CounselGateResolver = (verticalSlug: string) => Promise<boolean>;

/**
 * Banner-render condition for the customer compliance surface. The honest
 * "in counsel review" banner shows when there IS a corpus for the vertical
 * (so auto-rewrite is even applicable) but the gate has NOT cleared it to
 * draft replacement legal text. No corpus → no banner (rewrite never applies).
 */
export function shouldShowCounselGatedBanner(args: {
  hasCorpus: boolean;
  rewriteLive: boolean;
}): boolean {
  return args.hasCorpus && !args.rewriteLive;
}

/** Human-readable, calm, honest banner copy for a gated vertical. No fake
 *  ETA. Surfaced on the compliance surface when rewrites are withheld. The
 *  customer already knows their own industry, so we don't echo the slug. */
export const COUNSEL_GATED_BANNER_TEXT =
  "Compliance auto-rewrite is being reviewed by our counsel for your " +
  "industry — we'll enable it the moment it's signed off. Until then " +
  "Plaino still flags compliance issues for you; it just won't draft " +
  "replacement legal language yet.";
