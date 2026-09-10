/**
 * lib/approvals/executors/artifact-handoff.ts
 *
 * ARTIFACT_HANDOFF -- the unblocked executor. No connector, no env var, no
 * network. Approving something now produces a DURABLE, RETRIEVABLE artifact
 * carrying the customer's prose and none of the card chrome.
 *
 * WHAT CHANGED VERSUS THE PARKED ATTEMPT (PR #465)
 * ------------------------------------------------
 * #465 built the same artifact but stripped card chrome with a set of
 * regexes applied to the customer's own prose. It went four audit rounds and
 * was parked with the ruling "no fourth regex tune". Its own closing
 * conclusion was the right one: chrome should be a NAMED FIELD on
 * RenderedApproval, dropped by identity.
 *
 * That is what this ships on. `RenderedApproval.chrome` now carries the five
 * pending-state sentences the renderer emits, `RenderedApproval.body` carries
 * only work product, and this executor reads `body`. There is no pattern, no
 * heuristic and no scan over customer text anywhere in the path -- so the
 * defect that parked #465 (a PORTAL_CLIENT_MESSAGE opening "Awaiting your
 * approval on the revised scope, we are holding the crew until Friday." lost
 * that paragraph out of copy, download AND mailto) is not merely fixed, it is
 * UNREPRESENTABLE. Nothing reads the customer's sentences to decide whether
 * to keep them.
 *
 * DURABLE, AND WHY IT IS STORED WHERE IT IS
 * -----------------------------------------
 * The artifact is written back onto the approval row's own payload under a
 * reserved key. Deliberately NOT a new table: there is no Artifact model,
 * adding one means a Prisma migration, and five migrations are already stuck
 * behind a failed one. An executor whose whole value is "the customer can
 * retrieve this" must not be gated on unblocking a migration wall.
 *
 * Storing it on the row also gets the semantics right. The artifact is frozen
 * at the moment of approval, so it records WHAT THE HUMAN APPROVED rather
 * than what the payload happens to render to later. A re-derivation at read
 * time would quietly change the customer's record underneath them.
 *
 * IDEMPOTENCY (A2)
 * ----------------
 * The artifact is a pure function of (kind, payload), so re-running produces
 * identical bytes -- convergent by construction, which is the strong form of
 * idempotency rather than the guarded form. On top of that the executor
 * fingerprints the artifact and skips the write when the row already carries
 * that exact fingerprint, so the common re-run (batchApproveAction looping
 * the human path across a batch containing an already-processed row) costs no
 * write. The key is derived from CONTENT -- never from a clock, a run id, or
 * a uuid minted during the run.
 *
 * PRODUCERS (A5)
 * --------------
 * Registered for every kind something in the repo actually writes. Three are
 * excluded because nothing produces them.
 */

import type { WorkApprovalKind } from "@prisma/client";
import { createHash } from "node:crypto";
import { buildApprovalArtifact } from "../artifact";
import type {
  ApprovalExecutionContext,
  ApprovalExecutionOutcome,
  ApprovalExecutor,
  ApprovalExecutorDeps,
} from "../executors";

/**
 * Which kinds get a durable artifact.
 *
 * A `Record<WorkApprovalKind, boolean>` rather than an array, because that is
 * the repo's own idiom for kind-exhaustive tables (lib/measurement/
 * value-impact.ts) and because it makes the COMPILER -- not a reviewer --
 * responsible for a 31st kind. Adding a value to the Prisma enum without a
 * decision here is a type error, so a new kind's answer is always chosen
 * rather than defaulted.
 *
 * `false` means "no producer writes this kind" and is the ONLY reason any
 * entry is false. Verified by two independent derivations: an anchored
 * `kind:` census and an unanchored token sweep. The anchored pass alone
 * produced NINE false negatives across four distinct assignment shapes
 * (`kind:`, `approvalKind:`, `const KIND = '...' as WorkApprovalKind`, and a
 * `return '...'` inside a mapping function) -- which is exactly why a count
 * of zero was treated as a prompt to check the instrument rather than as a
 * result. The two derivations agree on the three below.
 */
const HAS_PRODUCER: Record<WorkApprovalKind, boolean> = {
  COMPLIANCE_FLAG: true,
  // No writer. Renderer + settings UI + report math exist; nothing produces it.
  LISTING_RECOMMENDATION: false,
  BUYER_INQUIRY_REPLY_DRAFT: true,
  // No writer. Same shape as LISTING_RECOMMENDATION.
  PRICING_RECOMMENDATION: false,
  ADMIN_VERIFICATION_CODE: true,
  ADMIN_PASSWORD_RESET: true,
  ADMIN_TRIAL_ENDING: true,
  ADMIN_BILLING_NOTICE: true,
  ADMIN_SECURITY_ALERT: true,
  CHIEF_OF_STAFF_MEETING: true,
  CHIEF_OF_STAFF_REPLY_DRAFT: true,
  CHIEF_OF_STAFF_TODO: true,
  INBOX_TRIAGE: true,
  FOLLOW_UP_NUDGE: true,
  PROCESS_DOC_DRAFT: true,
  SUPPORT_HANDLER_REPLY_DRAFT: true,
  PLAINO_INSTRUCTION: true,
  LEAD_TRIAGE: true,
  ANALYTICS_PULSE: true,
  // No writer. lib/reports reads it; nothing ever writes it.
  RESEARCH_BRIEF: false,
  CONTENT_CALENDAR: true,
  COMPLIANCE_DIGEST: true,
  FINANCE_PULSE: true,
  ACTIVATION_DRAFT: true,
  DOCUSIGN_SEND_ENVELOPE: true,
  DOCUSIGN_VOID_ENVELOPE: true,
  CONNECTOR_WRITE_ACTION: true,
  VOICE_CALL_ACTION_ITEM: true,
  VOICE_RECORDING_CONSENT: true,
  PORTAL_CLIENT_MESSAGE: true,
};

/** The three kinds nothing produces, exported so a test can assert the
 *  exclusion is deliberate rather than an omission. */
export const KINDS_WITHOUT_PRODUCER: readonly WorkApprovalKind[] = (
  Object.keys(HAS_PRODUCER) as WorkApprovalKind[]
).filter((k) => !HAS_PRODUCER[k]);

export const ARTIFACT_HANDOFF_KINDS: readonly WorkApprovalKind[] = (
  Object.keys(HAS_PRODUCER) as WorkApprovalKind[]
).filter((k) => HAS_PRODUCER[k]);

/** Reserved payload key. Namespaced so it cannot collide with a skill's own
 *  field, and versioned so a future shape change is detectable rather than
 *  ambiguous. */
export const ARTIFACT_PAYLOAD_KEY = "plainoApprovalArtifact" as const;
export const ARTIFACT_SCHEMA_VERSION = 1 as const;

export interface StoredApprovalArtifact {
  v: typeof ARTIFACT_SCHEMA_VERSION;
  fingerprint: string;
  artifact: unknown;
}

/** Content fingerprint. Stable across runs AND across processes: the artifact
 *  is serialized with sorted keys, so identical content cannot hash
 *  differently because a field was built in a different order. */
export function fingerprintArtifact(artifact: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(artifact)))
    .digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export const artifactHandoffExecutor: ApprovalExecutor = {
  name: "ARTIFACT_HANDOFF",
  kinds: ARTIFACT_HANDOFF_KINDS,
  // Every route. This writes nothing outside agentplain and reaches no third
  // party, so an auto-approved row deserves its record exactly as much as a
  // human-approved one.
  routes: ["human", "machine", "operator-support"],

  async run(
    ctx: ApprovalExecutionContext,
    deps: ApprovalExecutorDeps,
  ): Promise<ApprovalExecutionOutcome> {
    const base = {
      executor: "ARTIFACT_HANDOFF",
      kind: ctx.kind,
      itemId: ctx.itemId,
    } as const;

    const rendered = deps.render(ctx.kind, ctx.payload);
    const artifact = buildApprovalArtifact(ctx.kind, rendered);
    const fingerprint = fingerprintArtifact(artifact);

    // Prior-run guard, in the order the repo's own dedupe lesson demands: a
    // stable key FIRST, then the guard. The key is content, so the guard is
    // exact rather than heuristic.
    const existing = ctx.payload[ARTIFACT_PAYLOAD_KEY];
    if (
      existing &&
      typeof existing === "object" &&
      (existing as StoredApprovalArtifact).fingerprint === fingerprint
    ) {
      return { ...base, status: "already-done", detail: "fingerprint matched" };
    }

    const result = await deps.store.writeKey({
      workspaceId: ctx.workspaceId,
      itemId: ctx.itemId,
      key: ARTIFACT_PAYLOAD_KEY,
      value: {
        v: ARTIFACT_SCHEMA_VERSION,
        fingerprint,
        artifact,
      } satisfies StoredApprovalArtifact,
      fingerprint,
    });

    return result === "unchanged"
      ? { ...base, status: "already-done", detail: "store reported unchanged" }
      : { ...base, status: "executed" };
  },
};
