/**
 * lib/approvals/dispatch.ts
 *
 * The seam adapters. `lib/approvals/executors.ts` is pure and knows only
 * ports; this is the one file that binds those ports to Prisma, to the
 * renderer under `app/`, and to `process.env`.
 *
 * TWO ENTRY POINTS, BECAUSE THE TWO PATHS MAKE OPPOSITE TRADES
 * ------------------------------------------------------------
 * `dispatchApprovalExecutors`      -- human + operator-support. Runs AFTER
 *   the decision transaction has committed, opens its own transaction for
 *   any write, and NEVER THROWS. There is a prior human act to protect: the
 *   customer clicked approve and watched it succeed. Rolling that back
 *   because a downstream write failed leaves the screen saying yes and the
 *   database saying no.
 *
 * `dispatchApprovalExecutorsForInsert` -- machine (persist-artifacts.ts).
 *   Runs BEFORE the row is inserted and returns a payload patch the caller
 *   folds into its own INSERT, so the artifact and the accepted row land in
 *   ONE statement. Stronger than joining the transaction (nothing can
 *   half-apply) and it issues no extra query, which matters because that
 *   path is driven in several suites by transaction stubs implementing
 *   `create` and nothing else.
 *
 *   It does not throw. An AUTO_APPROVED row that failed to execute would
 *   otherwise be indistinguishable from a completed one, so the failure is
 *   recorded ON THE ROW under `plainoExecutorFailure` in that same INSERT --
 *   which solves the indistinguishability directly, rather than by
 *   discarding the whole skill run over a derived, always-recomputable
 *   artifact.
 */

import type { Prisma, PrismaClient, WorkApprovalKind } from "@prisma/client";
import { withRls, type RlsContext } from "@/lib/db";
import {
  decryptPayloadForRead,
  encryptPayloadForWrite,
} from "@/lib/security/payload-crypto";
import { renderApprovalPayload } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";
import {
  runApprovalExecutors,
  type AcceptedApprovalStatus,
  type ApprovalExecutionOutcome,
  type ApprovalExecutionRoute,
  type ApprovalExecutorDeps,
  type ApprovalFlagReader,
  type ApprovalPayloadStore,
} from "./executors";
import type { AppliedApprovalDecision } from "./decisions";

/**
 * Env-flag reader. `"on"` and `"1"` and `"true"` all count; ANYTHING ELSE,
 * INCLUDING AN UNSET VARIABLE, IS OFF. Default-off is the property that
 * makes a flag a control rather than a formality, so the predicate is
 * written as an allowlist of on-values rather than a denylist of off-values.
 */
export const envFlagReader: ApprovalFlagReader = {
  isEnabled(flag: string): boolean {
    const raw = process.env[flag];
    return raw === "on" || raw === "1" || raw === "true";
  },
};

/** Merge one reserved key into a row's payload, re-encrypting on write.
 *  `tx` is supplied by the machine path (join my transaction) and omitted by
 *  the human path (open your own). */
export function prismaPayloadStore(
  ctx: RlsContext,
  tx?: Prisma.TransactionClient,
  client?: PrismaClient,
): ApprovalPayloadStore {
  // `client` is the same injection seam PrismaSupportReplyStore carries, and
  // it is threaded through for the same reason: this is an audited write path
  // that otherwise has no way to be exercised without a live database. A
  // dispatch that ignored the caller's injected client would reach for the
  // real singleton from inside a test and fail on a missing DATABASE_URL --
  // which is survivable, because failures here are swallowed, and that is
  // exactly what makes it dangerous. The seam would look wired and be inert.
  const run = <T>(fn: (t: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
    tx ? fn(tx) : withRls(ctx, fn, client ? { client } : undefined);

  return {
    async writeKey({ workspaceId, itemId, key, value, fingerprint }) {
      return run(async (t) => {
        const row = await t.workApprovalQueueItem.findFirst({
          where: { id: itemId, workspaceId },
          select: { payload: true },
        });
        if (!row) return "unchanged";

        const decrypted = decryptPayloadForRead(row.payload);
        const existing =
          decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)
            ? (decrypted as Record<string, unknown>)
            : {};

        // Idempotency at the store, not just at the executor: a value whose
        // fingerprint already matches is not rewritten. Cheap, and it means
        // a re-run costs one read.
        const prior = existing[key];
        if (
          prior &&
          typeof prior === "object" &&
          (prior as { fingerprint?: unknown }).fingerprint === fingerprint
        ) {
          return "unchanged";
        }

        // MERGE, never replace. The skill's own fields are what the renderer
        // reads; clobbering them would empty the card.
        const next = { ...existing, [key]: value };

        // Conditional on the row still existing; the payload write is not
        // status-guarded because an artifact for an approved row stays valid
        // regardless of any later status change.
        await t.workApprovalQueueItem.updateMany({
          where: { id: itemId, workspaceId },
          data: { payload: encryptPayloadForWrite(next) },
        });
        return "written";
      });
    },
  };
}

/** Production deps. `mailbox` is intentionally absent: no mailbox port is
 *  wired yet, so MAILBOX_DRAFT_HANDOFF reports "skipped -- no mailbox
 *  connector configured" even with its flag on. See the honest-gap note in
 *  the executor. */
export function productionExecutorDeps(
  ctx: RlsContext,
  tx?: Prisma.TransactionClient,
  client?: PrismaClient,
): ApprovalExecutorDeps {
  return {
    store: prismaPayloadStore(ctx, tx, client),
    render: (kind, payload) => renderApprovalPayload(kind, payload),
    flags: envFlagReader,
  };
}

export interface DispatchArgs {
  workspaceId: string;
  itemId: string;
  applied: AppliedApprovalDecision;
  actorUserId: string | null;
  route: ApprovalExecutionRoute;
  status: AcceptedApprovalStatus;
  /** Test seam. Omitted in production. */
  deps?: ApprovalExecutorDeps;
  /** Prisma injection seam, threaded from callers that carry one. */
  client?: PrismaClient;
}

function contextFrom(args: DispatchArgs) {
  return {
    workspaceId: args.workspaceId,
    itemId: args.itemId,
    kind: args.applied.kind as WorkApprovalKind,
    agentSlug: args.applied.agentSlug,
    refTable: args.applied.refTable,
    refId: args.applied.refId,
    payload: args.applied.payload,
    actorUserId: args.actorUserId,
    route: args.route,
    status: args.status,
  };
}

/**
 * HUMAN / OPERATOR-SUPPORT path. Never throws, for any reason, including a
 * failure to even load the executor registry.
 */
export async function dispatchApprovalExecutors(
  ctx: RlsContext,
  args: DispatchArgs,
): Promise<ApprovalExecutionOutcome[]> {
  try {
    const deps = args.deps ?? productionExecutorDeps(ctx, undefined, args.client);
    return await runApprovalExecutors(contextFrom(args), deps);
  } catch (err) {
    console.warn(
      `approval executor dispatch failed (ignored): ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

/**
 * A store that WRITES NOTHING and instead collects what the executors wanted
 * written. The machine path folds the collected keys straight into the
 * INSERT it is about to perform, which makes the artifact and the accepted
 * row a single atomic statement -- stronger than joining a transaction, and
 * it adds no queries to the caller's transaction client.
 */
export function collectingPayloadStore(): ApprovalPayloadStore & {
  collected: Map<string, unknown>;
} {
  const collected = new Map<string, unknown>();
  return {
    collected,
    async writeKey({ key, value }) {
      collected.set(key, value);
      return "written";
    },
  };
}

export interface MachineDispatchResult {
  outcomes: ApprovalExecutionOutcome[];
  /** Merge these into the row's plaintext payload before encrypting + insert. */
  payloadPatch: Record<string, unknown>;
}

/**
 * MACHINE path. Computes what should be written and hands it back; the caller
 * folds it into its INSERT.
 *
 * Does not throw. An earlier revision propagated executor failure so the
 * caller's transaction would roll back, on the reasoning that an
 * AUTO_APPROVED row with no execution is indistinguishable from a completed
 * one. That reasoning was half right and the remedy was disproportionate:
 * failing the whole persist would discard the approval AND its handoff log
 * because a derived artifact could not be built -- and the artifact is a PURE
 * FUNCTION of the row, so it is always recomputable. The loss is recoverable;
 * discarding the run is not.
 *
 * The indistinguishability problem is solved directly instead: a failure is
 * recorded on the row itself under `plainoExecutorFailure`, in the same
 * INSERT. An AUTO_APPROVED row that did not execute now says so.
 */
export const EXECUTOR_FAILURE_PAYLOAD_KEY = "plainoExecutorFailure" as const;

export async function dispatchApprovalExecutorsForInsert(
  ctx: RlsContext,
  args: DispatchArgs,
): Promise<MachineDispatchResult> {
  const store = collectingPayloadStore();
  let outcomes: ApprovalExecutionOutcome[] = [];

  try {
    const deps: ApprovalExecutorDeps = args.deps ?? {
      store,
      render: (kind, payload) => renderApprovalPayload(kind, payload),
      flags: envFlagReader,
    };
    outcomes = await runApprovalExecutors(contextFrom(args), deps);
  } catch (err) {
    outcomes = [
      {
        executor: "(dispatch)",
        kind: args.applied.kind as WorkApprovalKind,
        itemId: args.itemId,
        status: "failed",
        detail: err instanceof Error ? err.message : String(err),
      },
    ];
  }

  const payloadPatch: Record<string, unknown> = Object.fromEntries(store.collected);

  const failed = outcomes.filter((o) => o.status === "failed");
  if (failed.length > 0) {
    console.warn(
      `approval executor(s) failed on the machine path (recorded, not fatal): ${failed
        .map((f) => `${f.executor}: ${f.detail ?? "unknown"}`)
        .join("; ")}`,
    );
    payloadPatch[EXECUTOR_FAILURE_PAYLOAD_KEY] = failed.map((f) => ({
      executor: f.executor,
      detail: f.detail ?? "unknown",
    }));
  }

  return { outcomes, payloadPatch };
}
