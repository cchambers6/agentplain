/**
 * lib/provenance/types.ts
 *
 * THE WRITE DOOR for record provenance.
 *
 * Every durable record of a provenance-bearing type carries a block that
 * answers, without guessing: where did this come from, who wrote it, how
 * sure are we, and has a human vouched for it? That question used to be
 * answerable only by reading the calling code — which means it was not
 * answerable at all once the row was six weeks old.
 *
 * Per feedback_no_guesses_no_estimates: we cite the artifact or we say
 * nothing. A record with no traceable source is a guess wearing a row id.
 * This module makes that structurally impossible for the four record
 * types below: `assertProvenance` is called INSIDE each write door, so a
 * write without a valid block throws rather than silently landing.
 * Convention would have decayed; a thrown error does not.
 *
 * Per feedback_no_quick_fixes: the enforcement is the schema, not a
 * lint rule and not a code-review habit. Adding a new write path that
 * skips the door is a type error at the call site and (for approvals) a
 * failing repo-scan test in CI.
 *
 * Per feedback_customer_vocab_not_engineer: NOTHING in this file is
 * customer-facing copy. The strings here ('agent-inference', 'skill-run',
 * 'provenance' itself) are engineer labels and must never reach a
 * customer surface. `lib/provenance/describe.ts` is the only sanctioned
 * translation layer — it turns a block into plain language like
 * "you told Plaino this in chat".
 *
 * Per feedback_cold_start_safe_agents: the block is durable state written
 * with the row. Nothing here caches or depends on in-process context, so
 * a cold agent reading a row six months later gets the same answer.
 */

import { z } from 'zod';

/**
 * How the fact entered the system. This is the WHAT-HAPPENED axis —
 * deliberately concrete, because "where did this come from" is only
 * useful if the answer names a real intake path we can point a customer
 * at. Adding a value here is a deliberate act: every new source type
 * needs a customer-vocab translation in describe.ts.
 *
 *   customer-chat    the customer said it, in their own words, in chat
 *   customer-edit    the customer typed it into a record directly
 *   operator-entry   a human on the workspace's team keyed it in
 *   webhook          a connected tool pushed it to us
 *   crm-import       pulled from the workspace's connected CRM
 *   csv-upload       came off a file the workspace handed us
 *   agent-inference  an agent concluded it — nobody said it outright
 *   skill-run        produced by a skill doing its job (drafts, digests)
 *   system           written by platform machinery (seeds, backfills)
 */
export const PROVENANCE_SOURCE_TYPES = [
  'customer-chat',
  'customer-edit',
  'operator-entry',
  'webhook',
  'crm-import',
  'csv-upload',
  'agent-inference',
  'skill-run',
  'system',
] as const;

export type ProvenanceSourceType = (typeof PROVENANCE_SOURCE_TYPES)[number];

/**
 * WHO the fact belongs to — the trust axis, coarser than sourceType on
 * purpose. When a customer asks "did I tell you that, or did you make it
 * up?", this is the field that answers in one word.
 *
 *   customer         the customer asserted it
 *   agent            an agent concluded it
 *   derived          computed from other records (a credit, a rollup)
 *   source-material  lifted from a document/feed the workspace supplied
 */
export const PROVENANCE_ORIGINS = [
  'customer',
  'agent',
  'derived',
  'source-material',
] as const;

export type ProvenanceOrigin = (typeof PROVENANCE_ORIGINS)[number];

/**
 * The record types whose write doors enforce provenance today. This is a
 * closed list on purpose — `assertProvenance` cross-checks the block
 * against the door it is standing in, so a memory-entry block can never
 * be handed to the approvals writer by a copy-paste.
 */
export const PROVENANCE_RECORD_TYPES = [
  'memory-entry',
  'approval-item',
  'saved-time',
  'lead',
] as const;

export type ProvenanceRecordType = (typeof PROVENANCE_RECORD_TYPES)[number];

/** sha256 hex — 64 lowercase hex chars, or null when the source material
 *  isn't hashable at write time (a live webhook body we didn't retain, a
 *  conversation still in flight). Null is honest; a fabricated hash is
 *  not. */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * The block itself. `.strictObject` (not a plain object) because an
 * unexpected key means the caller thinks this schema is something it
 * isn't — better to fail at the door than to store a field nothing reads.
 */
export const provenanceSchema = z
  .strictObject({
    sourceType: z.enum(PROVENANCE_SOURCE_TYPES),
    origin: z.enum(PROVENANCE_ORIGINS),
    recordType: z.enum(PROVENANCE_RECORD_TYPES),
    /** `Table:id` pointer at the source artifact — 'ChatMessage:<uuid>',
     *  'WebhookEvent:<uuid>', 'SkillRun:<uuid>'. When no row exists to
     *  point at, a stable route ('/real-estate') is acceptable; an empty
     *  string is not. This is the field that makes the citation
     *  clickable. */
    sourceRef: z.string().trim().min(1).max(300),
    /** The agent/skill slug that performed the write, or 'customer' /
     *  'operator' when a human did. Answers "who put this here". */
    storedBy: z.string().trim().min(1).max(120),
    /** sha256 of the source material when we had it in hand at write
     *  time; null otherwise. Lets a later audit prove the source hasn't
     *  been swapped underneath the record. */
    sourceHash: z.string().regex(SHA256_HEX).nullable(),
    /** 0..1. How much the writer stands behind the fact. Customer
     *  assertions are 1; inferences are honestly below it. */
    confidence: z.number().min(0).max(1),
    /** True only when a human has vouched for this specific fact. */
    verified: z.boolean(),
    /** ISO-8601 UTC instant the block was stamped. */
    capturedAt: z.iso.datetime(),
  })
  .superRefine((p, ctx) => {
    // An inference is never born verified. If an agent concluded it, the
    // only honest posture at write time is "unconfirmed" — verification
    // is a later, human act. Allowing verified:true here would let a
    // guess launder itself into a fact at the moment of writing, which is
    // exactly the failure this module exists to prevent.
    if (p.sourceType === 'agent-inference') {
      if (p.origin !== 'agent' && p.origin !== 'derived') {
        ctx.addIssue({
          code: 'custom',
          path: ['origin'],
          message:
            "sourceType 'agent-inference' requires origin 'agent' or 'derived' — an inference is not the customer's assertion",
        });
      }
      if (p.verified) {
        ctx.addIssue({
          code: 'custom',
          path: ['verified'],
          message:
            "sourceType 'agent-inference' cannot be verified at write time — an inference is never born verified",
        });
      }
    }
    // The customer said it or typed it: origin must say so. Mislabeling
    // a customer assertion as agent-origin would understate our
    // confidence; mislabeling agent work as customer-origin would
    // overstate it and put words in the customer's mouth. Both are lies.
    if (p.sourceType === 'customer-chat' || p.sourceType === 'customer-edit') {
      if (p.origin !== 'customer') {
        ctx.addIssue({
          code: 'custom',
          path: ['origin'],
          message: `sourceType '${p.sourceType}' requires origin 'customer' — the customer asserted this`,
        });
      }
    }
  });

export type Provenance = z.infer<typeof provenanceSchema>;

/**
 * Thrown by `assertProvenance` when a write is attempted without a valid
 * block. A distinct class (not a bare Error) so callers that wrap writes
 * in try/catch can tell "the door rejected this" from "the database was
 * down" — the first is a code bug to fix, the second is a retry.
 */
export class ProvenanceError extends Error {
  readonly name = 'ProvenanceError';

  constructor(
    message: string,
    /** The door that rejected the write. */
    readonly recordType: ProvenanceRecordType,
  ) {
    super(message);
  }
}

export interface BuildProvenanceArgs {
  sourceType: ProvenanceSourceType;
  origin: ProvenanceOrigin;
  recordType: ProvenanceRecordType;
  sourceRef: string;
  storedBy: string;
  /** 0..1 — required, never defaulted. A silent default would be the
   *  module inventing a confidence the caller never claimed. */
  confidence: number;
  /** sha256 hex of the source material, or null (the default) when we
   *  don't have it. */
  sourceHash?: string | null;
  /** Defaults to false: nothing is verified until a human says so. */
  verified?: boolean;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

/**
 * The one sanctioned way to construct a block. Stamps `capturedAt` and
 * round-trips through the schema, so EVERY construction path in the
 * codebase is validated — including the ones that never reach a write
 * door (test fixtures, seeds). A block that exists is a block that
 * parsed.
 */
export function buildProvenance(args: BuildProvenanceArgs): Provenance {
  const candidate = {
    sourceType: args.sourceType,
    origin: args.origin,
    recordType: args.recordType,
    sourceRef: args.sourceRef,
    storedBy: args.storedBy,
    sourceHash: args.sourceHash ?? null,
    confidence: args.confidence,
    verified: args.verified ?? false,
    capturedAt: (args.now ?? new Date()).toISOString(),
  };
  const parsed = provenanceSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ProvenanceError(
      `buildProvenance: invalid provenance for ${args.recordType} — ${formatIssues(parsed.error)}`,
      args.recordType,
    );
  }
  return parsed.data;
}

/**
 * THE DOOR. Every enforced write path calls this with its own record
 * type before touching the database. Two guarantees:
 *
 *   1. The value is a structurally valid block (schema + cross-field
 *      refinements), not "an object someone hand-rolled".
 *   2. The block was built FOR this record type — a saved-time block
 *      handed to the approvals writer throws instead of persisting a
 *      mislabeled citation the UI would then render as truth.
 *
 * Throws ProvenanceError. Never returns a partially-valid block.
 */
export function assertProvenance(
  recordType: ProvenanceRecordType,
  value: unknown,
): Provenance {
  const parsed = provenanceSchema.safeParse(value);
  if (!parsed.success) {
    throw new ProvenanceError(
      `Refusing to write a ${recordType} without valid provenance — ${formatIssues(parsed.error)}`,
      recordType,
    );
  }
  if (parsed.data.recordType !== recordType) {
    throw new ProvenanceError(
      `Provenance recordType mismatch at the ${recordType} write door: block declares '${parsed.data.recordType}'`,
      recordType,
    );
  }
  return parsed.data;
}

/**
 * Read-side counterpart. Legacy rows (written before 2026-08) carry NULL
 * or unparseable JSON in the provenance column; a READ must never throw
 * over that — the customer's memory page has to render either way. Use
 * this on every read path; use `assertProvenance` on every write path.
 */
export function parseStoredProvenance(value: unknown): Provenance | null {
  if (value === null || value === undefined) return null;
  const parsed = provenanceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}
