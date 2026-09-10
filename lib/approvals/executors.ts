/**
 * lib/approvals/executors.ts
 *
 * THE APPROVED BRANCH.
 *
 * Before this module, `decideApproval` had no APPROVED branch at all: it set
 * a status, wrote an audit row, and (on reject-with-reason) captured a
 * preference signal. Approving something produced nothing. Of the 30
 * WorkApprovalKind values, exactly one (VOICE_RECORDING_CONSENT) produced any
 * effect outside agentplain's own database without further manual customer
 * work. The customer read a draft, said yes, and then retyped it by hand into
 * their own tool.
 *
 * This is the registry that gives approval an effect: executors keyed by
 * WorkApprovalKind, dispatched from every write seam that can put a row into
 * an accepted state.
 *
 * ---------------------------------------------------------------------------
 * THERE ARE THREE PRODUCTION ROUTES TO AN ACCEPTED ROW, NOT ONE.
 * ---------------------------------------------------------------------------
 * Any dispatch hung off `decideApproval` alone misses two of them:
 *
 *   1. lib/approvals/decisions.ts        -- the human path. Six entry points
 *      funnel here (web server actions, three mobile JSON routes, and
 *      batchApproveAction, which LOOPS it -- hence the idempotency rule
 *      below is not optional).
 *   2. lib/skills/persist-artifacts.ts   -- the machine path, at TWO create
 *      sites. Rows are born AUTO_APPROVED. The compliance-flag site consults
 *      only `applyApprovalThreshold`, so hooking the decision FUNCTIONS
 *      instead of the two `create` calls misses it entirely.
 *   3. lib/support/prisma-resolve-store.ts -- /operator/support. Never calls
 *      `decideApproval`, runs under the system-operator RLS grant.
 *
 * ---------------------------------------------------------------------------
 * APPROVED AND AUTO_APPROVED ARE ONE ACCEPTED CLASS.
 * ---------------------------------------------------------------------------
 * Every consumer in the repo treats them that way and so does dispatch. A
 * row that reached an accepted state by the confidence threshold is just as
 * approved, for execution purposes, as one a human clicked. `isAcceptedStatus`
 * is the single predicate; do not re-derive it with a `=== "APPROVED"`.
 *
 * ---------------------------------------------------------------------------
 * ADMISSION CRITERION -- read this before adding an executor.
 * ---------------------------------------------------------------------------
 * This registry is deliberately NOT a dumping ground for "things that would be
 * nice on approve". A kind is admitted only when ALL FIVE hold:
 *
 *   A1. DETERMINED BY THE APPROVED ROW ALONE. Everything the executor needs
 *       is on the row (kind + payload + refTable/refId). An executor must not
 *       re-derive its content from a live upstream that may have moved since
 *       the human read the card. The human approved THAT TEXT; executing
 *       different text is a forgery, however fresh.
 *
 *   A2. IDEMPOTENT UNDER A KEY DERIVED FROM THE ROW. Not from a clock, not
 *       from a run id, not from a uuid minted during the run. Executors WILL
 *       be re-run: batchApproveAction loops the human path, a reconciliation
 *       sweep may replay accepted rows, and any retry re-enters here. Running
 *       twice must converge, never duplicate. (The repo has already been bitten
 *       by this: seven skills pass an id minted DURING the run as the approval
 *       refId, and WorkApprovalQueueItem carries four @@index and zero
 *       @@unique. A stable key FIRST, then a prior-run guard -- in that order.)
 *
 *   A3. NO NEW OUTBOUND. The standing doctrine is "agents draft, a human
 *       approves, nothing sends unattended". An approval IS the human
 *       approving, so executing on approval is permitted -- but an executor
 *       must not make something SEND that does not send today. Two shapes are
 *       allowed without a flag: a write that stays inside agentplain, and the
 *       RECEIVE-shape write into a surface the workspace owner already owns.
 *       lib/skills/draft.ts states the boundary for the whole product:
 *
 *           "`users.drafts.create` is the ONLY allowed persistence call.
 *            `users.messages.send` is forbidden. The customer's system sends."
 *
 *       Anything that transmits to a THIRD PARTY needs an explicit, named,
 *       default-off flag and a separate ruling. Default-off means the executor
 *       is inert until someone deliberately turns it on.
 *
 *   A4. FAILURE IS ISOLATABLE. On the human path a failed executor must never
 *       roll back the customer's decision -- the human clicked approve and
 *       that fact is theirs, not ours to revoke because a downstream write
 *       failed. If a kind's execution genuinely must be atomic with the
 *       decision, it does NOT belong here; it belongs inside
 *       `applyApprovalDecisionTx`.
 *
 *   A5. A PRODUCER EXISTS. "A renderer exists" is NOT admission.
 *       LISTING_RECOMMENDATION, PRICING_RECOMMENDATION and RESEARCH_BRIEF all
 *       have renderers, settings UI and report math, and nothing writes them.
 *       An executor for a kind nothing produces is dead code that reads as
 *       shipped capability. Name the producing file in the executor's doc
 *       comment.
 *
 * Failing any of the five is a reason to NOT register, not a reason to weaken
 * the criterion.
 */

import type { WorkApprovalKind, WorkApprovalStatus } from "@prisma/client";
// Type-only, therefore erased at compile time -- no lib -> app runtime edge.
// lib/approvals/artifact.ts already reaches for this same type by this same
// path; keeping one convention rather than two.
import type { RenderedApproval } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";

/** The two statuses that mean "accepted". See the header. */
const ACCEPTED_STATUSES: ReadonlySet<string> = new Set([
  "APPROVED",
  "AUTO_APPROVED",
]);

export type AcceptedApprovalStatus = "APPROVED" | "AUTO_APPROVED";

/**
 * The single accepted-class predicate. Every seam and every consumer uses
 * this rather than comparing to "APPROVED", because a `=== "APPROVED"` check
 * silently skips every row the confidence threshold accepted.
 */
export function isAcceptedStatus(
  status: WorkApprovalStatus | string | null | undefined,
): status is AcceptedApprovalStatus {
  return typeof status === "string" && ACCEPTED_STATUSES.has(status);
}

/** Which seam drove this execution. Recorded on the outcome so a failure can
 *  be traced to the surface that caused it without re-reading the audit log. */
export type ApprovalExecutionRoute =
  /** lib/approvals/decisions.ts -- a human clicked approve. */
  | "human"
  /** lib/skills/persist-artifacts.ts -- born AUTO_APPROVED by threshold. */
  | "machine"
  /** lib/support/prisma-resolve-store.ts -- /operator/support. */
  | "operator-support";

/** Everything an executor is allowed to know. Deliberately a VALUE object:
 *  no Prisma client, no transaction, no request. An executor that needs the
 *  database asks for it through `ApprovalExecutorDeps`, so the whole registry
 *  stays unit-testable without a live database. */
export interface ApprovalExecutionContext {
  workspaceId: string;
  itemId: string;
  kind: WorkApprovalKind;
  agentSlug: string;
  refTable: string;
  refId: string;
  /** Payload AFTER decryption. Executors never see ciphertext. */
  payload: Record<string, unknown>;
  /** The human the decision is attributed to. Null on the machine path --
   *  there was no human, which is exactly why that path may join the
   *  transaction (see runApprovalExecutors). */
  actorUserId: string | null;
  route: ApprovalExecutionRoute;
  status: AcceptedApprovalStatus;
}

// -- Ports -------------------------------------------------------------------
// Per feedback_no_silent_vendor_lock.md: executors see ports, never vendor
// SDKs and never Prisma. Production wiring lives in
// lib/approvals/executor-deps.ts; tests inject recording stubs. This is what
// makes "does approving actually do anything" a question a unit test can
// answer.

/**
 * Merge one RESERVED key into an approval row's payload.
 *
 * One generic method rather than one method per executor, so a third executor
 * needs no new port. The key is namespaced by its owning executor; the store
 * never interprets the value.
 *
 * MUST be idempotent: when the row already carries `fingerprint` under `key`,
 * the write is skipped and "unchanged" is returned. Implementations MUST
 * merge rather than replace -- clobbering the payload would destroy the
 * skill's own fields, which are the source the renderer reads.
 */
export interface ApprovalPayloadStore {
  writeKey(args: {
    workspaceId: string;
    itemId: string;
    key: string;
    value: unknown;
    /** Stable content fingerprint for the value under `key`. */
    fingerprint: string;
  }): Promise<"written" | "unchanged">;
}

/**
 * The RECEIVE-shape mailbox write, and the only outbound-adjacent port here.
 *
 * There is deliberately NO `send` method on this interface. That is the
 * structural enforcement of the no-outbound doctrine: a future executor
 * cannot send by accident, because the capability is not reachable from the
 * type. `users.messages.send` / `users.drafts.send` must never appear on an
 * implementation of this port.
 */
export interface MailboxDraftPort {
  readonly name: string;
  createDraft(args: {
    workspaceId: string;
    to: string[];
    subject: string;
    body: string;
    /** Caller-supplied stable key. Implementations MUST use it to avoid
     *  creating a second draft for the same approval. */
    idempotencyKey: string;
  }): Promise<{ providerDraftId: string; reused: boolean }>;
}

/** Named feature flags this registry reads. Injected rather than read off
 *  `process.env` directly so a test never has to mutate global env (which
 *  leaks across the shared test process and is how flag tests go flaky). */
export interface ApprovalFlagReader {
  isEnabled(flag: string): boolean;
}

/** Render an approval payload into the shape the artifact builder consumes.
 *  Injected because the production renderer lives under `app/`, and a
 *  lib -> app import would drag the Next.js module graph into every unit
 *  test that touches an executor. */
export type ApprovalRenderer = (
  kind: WorkApprovalKind,
  payload: unknown,
) => RenderedApproval;

export interface ApprovalExecutorDeps {
  store: ApprovalPayloadStore;
  render: ApprovalRenderer;
  flags: ApprovalFlagReader;
  /** Absent when no mailbox connector is configured for the workspace. An
   *  executor that needs it declines cleanly rather than throwing. */
  mailbox?: MailboxDraftPort;
}

// -- Outcomes ----------------------------------------------------------------

export type ApprovalExecutionStatus =
  /** The executor did its work. */
  | "executed"
  /** The executor had already done its work for this row. A2 in action. */
  | "already-done"
  /** The executor declined: flag off, port missing, or nothing to do. NOT a
   *  failure -- a skipped executor is the default state of a default-off
   *  connector and must not read as an error on a dashboard. */
  | "skipped"
  /** The executor threw. The decision still stands (A4). */
  | "failed";

export interface ApprovalExecutionOutcome {
  executor: string;
  kind: WorkApprovalKind;
  itemId: string;
  status: ApprovalExecutionStatus;
  /** Human-readable reason. Always set for "skipped" and "failed" so an
   *  operator reading a log can tell "off by design" from "broken". */
  detail?: string;
}

export interface ApprovalExecutor {
  /** Stable identifier. Appears in logs and outcomes; do not rename casually. */
  readonly name: string;
  /** The kinds this executor claims. Explicit, never a wildcard -- a wildcard
   *  is how an executor written for one kind starts running against customer
   *  prose it was never designed for. */
  readonly kinds: readonly WorkApprovalKind[];
  /**
   * Which routes this executor may run on. NOT a formality.
   *
   * AUTO_APPROVED IS NOT A HUMAN ACT. The doctrine that permits executing on
   * approval is "an approval IS the human approving" -- but a row that
   * reached an accepted state via `applyApprovalThreshold` had no human look
   * at it. Approving and auto-approving are one class for STATE purposes
   * (both are accepted, both are done, neither can be re-decided) and are NOT
   * one class for the purpose of authorizing an outbound-adjacent side
   * effect.
   *
   * So: an executor that only writes inside agentplain may claim every route.
   * An executor that touches anything a human would want to have seen first
   * must exclude "machine".
   */
  readonly routes: readonly ApprovalExecutionRoute[];
  run(
    ctx: ApprovalExecutionContext,
    deps: ApprovalExecutorDeps,
  ): Promise<ApprovalExecutionOutcome>;
}

// -- The registry ------------------------------------------------------------

import { artifactHandoffExecutor } from "./executors/artifact-handoff";
import { mailboxDraftHandoffExecutor } from "./executors/mailbox-draft-handoff";

/**
 * Every executor, in dispatch order. Two today; each one had to pass all five
 * admission tests above and each one names its producer.
 *
 * Order matters exactly once: ARTIFACT_HANDOFF runs first, so that when a
 * later executor fails, the customer still has the durable record of what
 * they approved. The cheap always-works executor before the fallible one.
 */
export const APPROVAL_EXECUTORS: readonly ApprovalExecutor[] = [
  artifactHandoffExecutor,
  mailboxDraftHandoffExecutor,
];

/** kind -> executors, derived from the list so the two can never drift. */
const BY_KIND: ReadonlyMap<WorkApprovalKind, readonly ApprovalExecutor[]> =
  (() => {
    const map = new Map<WorkApprovalKind, ApprovalExecutor[]>();
    for (const ex of APPROVAL_EXECUTORS) {
      for (const kind of ex.kinds) {
        const list = map.get(kind);
        if (list) list.push(ex);
        else map.set(kind, [ex]);
      }
    }
    return map;
  })();

/** The executors registered for a kind. Empty is a legitimate answer -- most
 *  kinds have none, and the admission criterion is why. */
export function executorsForKind(
  kind: WorkApprovalKind,
): readonly ApprovalExecutor[] {
  return BY_KIND.get(kind) ?? [];
}

/**
 * Run every executor registered for this row.
 *
 * NEVER THROWS. That is the whole contract, and it is A4: the caller has
 * already committed the customer's decision, and no downstream failure may
 * un-commit it. A thrown executor becomes a "failed" outcome and the next
 * executor still runs -- one broken executor must not silence the others.
 *
 * The failure shape here deliberately mirrors the existing swallowing
 * try/catch at the `captureDraftRejectSignal` site in decisions.ts (warn +
 * continue) rather than inventing a second convention for the same problem.
 *
 * CALLING CONVENTION, and the one place the two paths genuinely differ:
 *
 *   HUMAN / OPERATOR-SUPPORT PATH -- call AFTER the decision transaction has
 *   committed, outside it. There is a prior human act to protect. Joining the
 *   transaction would mean a failing executor rolls back an approval the
 *   customer already watched succeed, which is a worse outcome than a missing
 *   artifact: the customer's screen said yes and the database says no.
 *
 *   MACHINE PATH (persist-artifacts.ts) -- call BEFORE the row is inserted,
 *   with a COLLECTING store, and fold what it collects into the INSERT's own
 *   payload. This is the strongest form of "joins that transaction": the
 *   artifact and the accepted row become a single INSERT, so they cannot
 *   half-apply and there is no window in which an AUTO_APPROVED row exists
 *   without its artifact.
 *
 *   It also adds no queries. That matters more than it looks: the machine
 *   path is driven with narrow transaction stubs in several suites, and an
 *   executor seam that quietly requires findFirst/updateMany on the caller's
 *   transaction client is a seam that breaks every caller that did not
 *   anticipate it.
 *
 * That asymmetry is intentional and is the reason this function does not take
 * a transaction: the store is a port, and each path supplies the
 * implementation its atomicity needs.
 */
export async function runApprovalExecutors(
  ctx: ApprovalExecutionContext,
  deps: ApprovalExecutorDeps,
): Promise<ApprovalExecutionOutcome[]> {
  const executors = executorsForKind(ctx.kind);
  const outcomes: ApprovalExecutionOutcome[] = [];

  for (const ex of executors) {
    if (!ex.routes.includes(ctx.route)) {
      outcomes.push({
        executor: ex.name,
        kind: ctx.kind,
        itemId: ctx.itemId,
        status: "skipped",
        detail: `not enabled for the "${ctx.route}" route`,
      });
      continue;
    }
    try {
      outcomes.push(await ex.run(ctx, deps));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `approval executor ${ex.name} failed for ${ctx.kind} ${ctx.itemId} (ignored): ${message}`,
      );
      outcomes.push({
        executor: ex.name,
        kind: ctx.kind,
        itemId: ctx.itemId,
        status: "failed",
        detail: message,
      });
    }
  }

  return outcomes;
}
