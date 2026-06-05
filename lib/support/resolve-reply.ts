/**
 * lib/support/resolve-reply.ts
 *
 * Operator-side resolution of a support-handler reply draft. The fleet
 * already drafts a first-touch reply into the approval queue (kind=
 * SUPPORT_HANDLER_REPLY_DRAFT) when a customer submits from /help — see
 * lib/skills/support-handler + lib/inngest/functions/support-handler-on-
 * create.ts. THIS module is the human gate: an operator reviews the
 * draft at /operator/support, optionally edits it, and either:
 *
 *   - APPROVES + SENDS  → the reply goes to the customer via the injected
 *     EmailProvider, the SupportRequest closes (RESOLVED + resolvedAt +
 *     resolvedBy), the queue item flips to APPROVED, and a
 *     `support-request.resolved` event fires for analytics.
 *
 *   - REJECTS           → the draft is archived (queue item REJECTED), no
 *     email is sent, and the SupportRequest returns to OPEN for manual
 *     handling on the next pass.
 *
 * Per project_no_outbound_architecture.md: the customer NEVER receives an
 * auto-sent reply. The send happens ONLY here, inside an operator-gated
 * action — never from the Inngest draft function. The fleet drafts; a
 * human approves; the send executes on that approval. The send order is
 * deliberate: we send first, then persist RESOLVED — so a send failure
 * leaves the request un-resolved and retryable rather than silently
 * marking it closed with no reply out the door.
 *
 * Per feedback_runner_portability.md (two-implementation rule): the store,
 * email provider, and event sink are all injected ports. The production
 * bindings live in lib/support/prisma-resolve-store.ts; tests pass
 * recording fakes. This file imports neither Prisma nor Inngest nor any
 * vendor SDK.
 *
 * Per feedback_persistence_discipline.md: every terminal branch persists
 * the decision (resolved / rejected) before returning. The queue-item
 * status guard makes a double-approve a no-op (idempotent on re-fire).
 */

import type { EmailProvider } from "../email/types";

/** Event emitted after a support reply is approved + sent. Consumed by
 *  analytics surfaces (operator leadership board, etc.). No outbound
 *  side effect — purely a durable signal. */
export const SUPPORT_REQUEST_RESOLVED_EVENT =
  "agentplain/support-request.resolved";

export interface SupportRequestResolvedEventData {
  supportRequestId: string;
  workspaceId: string;
  resolvedByUserId: string;
}

export type ResolveResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: ResolveErrorCode; message: string };

export type ResolveErrorCode =
  | "NOT_FOUND"
  | "ALREADY_DECIDED"
  | "NO_RECIPIENT"
  | "EMPTY_BODY"
  | "SEND_FAILED"
  | "PERSIST_FAILED";

function ok<T>(value: T): ResolveResult<T> {
  return { ok: true, value };
}
function err(code: ResolveErrorCode, message: string): ResolveResult<never> {
  return { ok: false, code, message };
}

/** Decrypted draft + the context an operator needs to send + close out. */
export interface SupportReplyDraftContext {
  queueItemId: string;
  /** WorkApprovalStatus as a string. Only PENDING items are decidable. */
  queueItemStatus: string;
  workspaceId: string;
  supportRequestId: string;
  /** SupportRequestStatus as a string. */
  supportRequestStatus: string;
  /** Customer email the reply goes to. NULL when the submitting user was
   *  deleted (fromUser SetNull) — approve is then blocked: we never send
   *  to nobody. */
  customerEmail: string | null;
  /** Reply subject (defaults to "Re: <original>" upstream in the skill). */
  subject: string;
  /** The drafted reply body. The operator may override it via editedBody. */
  draftBody: string;
  /** Confidence tier the skill assigned ("high" | "medium" | "placeholder"). */
  confidence: string | null;
  /** How many substrate snippets the draft cited. */
  citationCount: number;
}

/** Persistence port. Production binding = PrismaSupportReplyStore. */
export interface SupportReplyStore {
  readonly name: string;
  loadDraftContext(
    queueItemId: string,
  ): Promise<SupportReplyDraftContext | null>;
  /** Atomically: queue item → APPROVED, SupportRequest → RESOLVED with
   *  resolvedAt/resolvedBy, + an audit row. */
  recordResolved(args: {
    queueItemId: string;
    workspaceId: string;
    supportRequestId: string;
    operatorUserId: string;
    sentSubject: string;
    sentBody: string;
    emailMessageId: string | null;
  }): Promise<void>;
  /** Atomically: queue item → REJECTED, SupportRequest → OPEN (unless
   *  already RESOLVED), + an audit row. No email is sent. */
  recordRejected(args: {
    queueItemId: string;
    workspaceId: string;
    supportRequestId: string;
    operatorUserId: string;
    reason: string | null;
  }): Promise<void>;
}

/** Event-sink port. Production binding = InngestSupportResolvedEventSink. */
export interface SupportResolvedEventSink {
  readonly name: string;
  emitResolved(data: SupportRequestResolvedEventData): Promise<void>;
}

export interface ApproveAndSendInput {
  queueItemId: string;
  operatorUserId: string;
  /** Operator-edited reply body. When omitted/blank the stored draft body
   *  is sent verbatim. */
  editedBody?: string;
  /** Reply-to header so customer replies thread back to the support
   *  inbox. The operator action defaults this to env.supportEmail(). */
  replyTo?: string;
  store: SupportReplyStore;
  email: EmailProvider;
  events: SupportResolvedEventSink;
}

export interface ApproveAndSendOutput {
  emailMessageId: string | null;
  sentBody: string;
  /** Customer the reply went to — surfaced in the operator notice. */
  sentTo: string;
}

export async function approveAndSendSupportReply(
  input: ApproveAndSendInput,
): Promise<ResolveResult<ApproveAndSendOutput>> {
  const ctx = await input.store.loadDraftContext(input.queueItemId);
  if (!ctx) {
    return err("NOT_FOUND", `support reply draft ${input.queueItemId} not found`);
  }
  // Idempotency: only a PENDING draft can be approved. A re-fire (double
  // click, retry) on an already-decided item is a no-op, not a re-send.
  if (ctx.queueItemStatus !== "PENDING") {
    return err(
      "ALREADY_DECIDED",
      `draft ${input.queueItemId} is already ${ctx.queueItemStatus}; not re-sending`,
    );
  }
  if (!ctx.customerEmail) {
    return err(
      "NO_RECIPIENT",
      "no customer email on the request (submitting user was removed); handle this one by hand",
    );
  }
  const body = pickBody(input.editedBody, ctx.draftBody);
  if (body.length === 0) {
    return err("EMPTY_BODY", "reply body is empty; nothing to send");
  }

  // 1. Send first. A failure here leaves the request un-resolved so the
  //    operator can retry — we never mark RESOLVED without a reply out.
  let emailMessageId: string | null = null;
  try {
    const res = await input.email.send({
      to: ctx.customerEmail,
      subject: ctx.subject,
      text: body,
      html: bodyToHtml(body),
      replyTo: input.replyTo,
      tags: {
        surface: "support-reply",
        workspace_id: ctx.workspaceId,
        support_request_id: ctx.supportRequestId,
      },
    });
    emailMessageId = res.messageId;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err("SEND_FAILED", `email send failed: ${message}`);
  }

  // 2. Persist the resolution. The reply already went out, so a persist
  //    failure is surfaced loudly (operator should reconcile) rather than
  //    swallowed.
  try {
    await input.store.recordResolved({
      queueItemId: ctx.queueItemId,
      workspaceId: ctx.workspaceId,
      supportRequestId: ctx.supportRequestId,
      operatorUserId: input.operatorUserId,
      sentSubject: ctx.subject,
      sentBody: body,
      emailMessageId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(
      "PERSIST_FAILED",
      `reply sent (id=${emailMessageId ?? "?"}) but recording RESOLVED failed: ${message}`,
    );
  }

  // 3. Fire the analytics event. Best-effort — a missing event never
  //    fails an already-sent, already-recorded resolution.
  await input.events
    .emitResolved({
      supportRequestId: ctx.supportRequestId,
      workspaceId: ctx.workspaceId,
      resolvedByUserId: input.operatorUserId,
    })
    .catch(() => {
      /* swallow — the resolution is durable; the event is advisory */
    });

  return ok({ emailMessageId, sentBody: body, sentTo: ctx.customerEmail });
}

export interface RejectInput {
  queueItemId: string;
  operatorUserId: string;
  /** Optional operator note recorded on the decision + audit row. */
  reason?: string;
  store: SupportReplyStore;
}

export async function rejectSupportReply(
  input: RejectInput,
): Promise<ResolveResult<{ supportRequestId: string }>> {
  const ctx = await input.store.loadDraftContext(input.queueItemId);
  if (!ctx) {
    return err("NOT_FOUND", `support reply draft ${input.queueItemId} not found`);
  }
  if (ctx.queueItemStatus !== "PENDING") {
    return err(
      "ALREADY_DECIDED",
      `draft ${input.queueItemId} is already ${ctx.queueItemStatus}`,
    );
  }
  try {
    await input.store.recordRejected({
      queueItemId: ctx.queueItemId,
      workspaceId: ctx.workspaceId,
      supportRequestId: ctx.supportRequestId,
      operatorUserId: input.operatorUserId,
      reason: input.reason?.trim() ? input.reason.trim() : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err("PERSIST_FAILED", `recording REJECTED failed: ${message}`);
  }
  return ok({ supportRequestId: ctx.supportRequestId });
}

function pickBody(edited: string | undefined, fallback: string): string {
  const e = (edited ?? "").trim();
  if (e.length > 0) return e;
  return (fallback ?? "").trim();
}

/** Minimal text→HTML for the reply. Paragraphs split on blank lines;
 *  single newlines become <br>. Everything is escaped — the body is
 *  operator-reviewed plain text, never trusted markup. */
export function bodyToHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 1em;white-space:pre-wrap">${escapeHtml(p).replace(
          /\n/g,
          "<br/>",
        )}</p>`,
    )
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
