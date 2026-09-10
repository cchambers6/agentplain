/**
 * lib/approvals/executors/mailbox-draft-handoff.ts
 *
 * MAILBOX_DRAFT_HANDOFF -- the connector executor, behind a default-off flag.
 *
 * On approval of a FOLLOW_UP_NUDGE, write the approved text as a DRAFT into
 * the workspace owner's own mailbox, addressed and subject-lined, one click
 * from going out. Flip one env var and it is real.
 *
 * WHY FOLLOW_UP_NUDGE, OF THE THIRTY
 * ----------------------------------
 * Two reasons, and the second is the one that decided it.
 *
 * 1. It has the most producers of any kind -- five, spanning two of the three
 *    reachable verticals plus two dark ones:
 *      lib/skills/invoice-chase-general/prisma-approval-sink.ts        (cpa)
 *      lib/skills/month-end-close-cpa/prisma-approval-persister.ts     (cpa)
 *      lib/skills/follow-up-chaser-general/prisma-approval-sink.ts     (general)
 *      lib/skills/home-services-estimate-followup/prisma-approval-sink.ts
 *      lib/skills/property-management-rent-collection-chase/prisma-approval-sink.ts
 *    A5 is satisfied five times over rather than once.
 *
 * 2. THE MONEY IS ALREADY ON THE PAYLOAD, so the value claim needs no
 *    invented conversion rate. invoice-chase-general writes `balanceUsd` and
 *    labels it, in the repo's own words, the "Value-impact field: the AR
 *    balance being chased ... the operator can point to this figure as the AR
 *    dollars Plaino influenced." An unpaid invoice is a known dollar amount
 *    attached to the very row being approved.
 *
 *    That is why this kind beat the speed-to-lead candidates
 *    (BUYER_INQUIRY_REPLY_DRAFT, LEAD_TRIAGE). Their money story requires
 *    assuming a conversion rate and a commission, i.e. inventing a number --
 *    and unsourced ROI arithmetic is a defect class this codebase has already
 *    been bitten by. Here the denominator is a fact on the row.
 *
 * WHY THIS DOES NOT BREAK THE NO-OUTBOUND DOCTRINE
 * ------------------------------------------------
 * It does not send. It performs the RECEIVE-shape write, which is the one
 * mailbox write the product has always allowed. lib/skills/draft.ts states
 * the rule for the whole system:
 *
 *     "`users.drafts.create` is the ONLY allowed persistence call.
 *      `users.messages.send` is forbidden. The customer's system sends."
 *
 * and lib/skills/lead-triage-realestate/drafts-persister.ts names the shape
 * directly: "RECEIVE-shape write -- `users.drafts.create`, never
 * `messages.send`."
 *
 * The enforcement is structural, not documentary: `MailboxDraftPort` has no
 * send method. A future executor cannot send by accident because the
 * capability is not reachable from the type.
 *
 * The draft lands in the OWNER'S OWN mailbox. Nothing reaches the debtor
 * until the owner presses send in their own mail client. Compared to today
 * -- where the owner approves in agentplain and then retypes the message into
 * Gmail by hand -- this removes the retyping, not the human.
 *
 * DEFAULT OFF, AND WHICH FLAG
 * ---------------------------
 * Gated on APPROVAL_MAILBOX_DRAFT_HANDOFF, a NEW flag introduced by this
 * change and off unless explicitly set to "on". It deliberately does NOT
 * reuse LIVE_INBOX_FETCH, BUILDIUM_ADAPTER_LIVE or FLEET_ACTIVATION_MASTER --
 * those gate other capabilities, LIVE_INBOX_FETCH is documented as blocked on
 * unverified Google OAuth consent, and widening an existing flag's meaning is
 * how a flag stops being a control. Turning this on must be a decision about
 * this behaviour and nothing else.
 *
 * With the flag off the executor returns "skipped", never "failed": a
 * default-off connector is working correctly when it does nothing, and a
 * dashboard must not read that as breakage.
 *
 * IDEMPOTENCY (A2)
 * ----------------
 * Two layers, and the row-derived key is the load-bearing one:
 *
 *   - `idempotencyKey` = "approval-draft:" + itemId. Derived from the ROW,
 *     stable across every re-run, every retry and every process. It is passed
 *     to the port, whose contract requires it to return the existing draft
 *     rather than create a second one. This is the layer that holds when the
 *     payload guard below is lost to a rollback.
 *   - A prior-run guard on the payload: once a draft exists, its provider id
 *     is recorded on the row and a re-run short-circuits without touching the
 *     connector at all.
 *
 * Stable key FIRST, then the guard. That order is not decorative -- a guard
 * without a stable key is what produced this repo's cron-interval-only dedupe
 * defect, where seven skills key an approval on an id minted during the run.
 */

import type { WorkApprovalKind } from "@prisma/client";
import type {
  ApprovalExecutionContext,
  ApprovalExecutionOutcome,
  ApprovalExecutor,
  ApprovalExecutorDeps,
} from "../executors";
import { sanitizeRecipients } from "../artifact";

/** The one flag that turns this on. New; default off. */
export const MAILBOX_DRAFT_HANDOFF_FLAG = "APPROVAL_MAILBOX_DRAFT_HANDOFF";

/** Reserved payload key recording the draft this executor created. */
export const MAILBOX_DRAFT_PAYLOAD_KEY = "plainoMailboxDraft" as const;

export interface StoredMailboxDraft {
  providerDraftId: string;
  port: string;
}

/** Row-derived, stable across runs. Never a clock, never a run id. */
export function mailboxDraftIdempotencyKey(itemId: string): string {
  return `approval-draft:${itemId}`;
}

const KINDS: readonly WorkApprovalKind[] = ["FOLLOW_UP_NUDGE"];

export const mailboxDraftHandoffExecutor: ApprovalExecutor = {
  name: "MAILBOX_DRAFT_HANDOFF",
  kinds: KINDS,
  /**
   * NOT the machine route, and this is a safety property rather than a
   * preference.
   *
   * A row that reached AUTO_APPROVED via `applyApprovalThreshold` had no
   * human look at it. The doctrine that licenses executing on approval is "an
   * approval IS the human approving" -- that licence does not extend to a
   * confidence score. Letting the machine path fire this executor would put a
   * drafted message into the owner's mailbox that no person ever read, which
   * is precisely the unattended behaviour the no-outbound rule exists to
   * prevent, one click away from a send.
   *
   * The operator-support route IS included: a human operator approved there,
   * even though the RLS identity is the system grant.
   */
  routes: ["human", "operator-support"],

  async run(
    ctx: ApprovalExecutionContext,
    deps: ApprovalExecutorDeps,
  ): Promise<ApprovalExecutionOutcome> {
    const base = {
      executor: "MAILBOX_DRAFT_HANDOFF",
      kind: ctx.kind,
      itemId: ctx.itemId,
    } as const;

    if (!deps.flags.isEnabled(MAILBOX_DRAFT_HANDOFF_FLAG)) {
      return {
        ...base,
        status: "skipped",
        detail: `${MAILBOX_DRAFT_HANDOFF_FLAG} is off`,
      };
    }

    if (!deps.mailbox) {
      return {
        ...base,
        status: "skipped",
        detail: "no mailbox connector configured for this workspace",
      };
    }

    // Prior-run guard. Cheap, and keeps a re-run from touching the connector.
    const prior = ctx.payload[MAILBOX_DRAFT_PAYLOAD_KEY];
    if (
      prior &&
      typeof prior === "object" &&
      typeof (prior as StoredMailboxDraft).providerDraftId === "string"
    ) {
      return {
        ...base,
        status: "already-done",
        detail: `draft ${(prior as StoredMailboxDraft).providerDraftId} already created`,
      };
    }

    // Read through the RENDERER, not the raw payload, for one specific
    // reason: `RenderedApproval.recipients` is the discrete, authoritative
    // addressee list, and the renderer's own doc comment explains why nothing
    // may re-derive addresses by parsing `recipientLine` -- that display
    // string also carries the SUBJECT, and on reply-draft kinds the subject
    // came from an inbound message a stranger sent. Parsing it back out lets
    // a stranger put themselves on the To: line by writing an address into
    // their subject. `sanitizeRecipients` then validates rather than trusts,
    // because this is the last stop before a real To: header.
    const rendered = deps.render(ctx.kind, ctx.payload);
    const to = sanitizeRecipients(rendered.recipients ?? []);
    if (to.length === 0) {
      return {
        ...base,
        status: "skipped",
        detail: "no valid recipient on the approved row",
      };
    }

    // The approved BODY, not a re-derivation. `editableBody` is the discrete
    // field every renderer sets exactly when it holds a real drafted message,
    // and it is the same text the customer read and edited before approving.
    // A1: execute what the human approved, not what the payload renders to
    // now.
    const body = rendered.editableBody?.trim();
    if (!body) {
      return {
        ...base,
        status: "skipped",
        detail: "approved row carries no draft body",
      };
    }

    const subject =
      typeof ctx.payload.subject === "string" && ctx.payload.subject.trim()
        ? ctx.payload.subject.trim()
        : (rendered.title?.trim() ?? "Follow-up");

    const { providerDraftId, reused } = await deps.mailbox.createDraft({
      workspaceId: ctx.workspaceId,
      to,
      subject,
      body,
      idempotencyKey: mailboxDraftIdempotencyKey(ctx.itemId),
    });

    // Record it so the next re-run short-circuits above. Best-effort: the
    // idempotency key is the layer that actually guarantees no duplicate, so
    // failing to record here degrades cost, never correctness.
    await deps.store
      .writeKey({
        workspaceId: ctx.workspaceId,
        itemId: ctx.itemId,
        key: MAILBOX_DRAFT_PAYLOAD_KEY,
        value: {
          providerDraftId,
          port: deps.mailbox.name,
        } satisfies StoredMailboxDraft,
        fingerprint: `mailbox-draft:${providerDraftId}`,
      })
      .catch(() => undefined);

    return reused
      ? { ...base, status: "already-done", detail: "port reused prior draft" }
      : { ...base, status: "executed" };
  },
};
