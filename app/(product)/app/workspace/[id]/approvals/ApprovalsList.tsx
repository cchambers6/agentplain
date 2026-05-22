"use client";

import { useState } from "react";
import {
  ApHeritageButton,
  ApPaperCard,
  ApPaperSheet,
  PlainoAvatar,
} from "@/components/ui/ap";
import { decideApprovalAction, editApprovalDraftAction } from "./actions";
import type { RenderedApproval } from "./renderApprovalPayload";

export interface ApprovalRow {
  id: string;
  agentSlug: string;
  kind: string;
  proposedAtIso: string;
  rendered: RenderedApproval;
}

interface ApprovalsListProps {
  workspaceId: string;
  rows: ApprovalRow[];
}

export function ApprovalsList({ workspaceId, rows }: ApprovalsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = rows.find((r) => r.id === editingId) ?? null;

  return (
    <>
      <ul className="mt-8 space-y-4">
        {rows.map((row) => (
          <li key={row.id}>
            <ApprovalArticle
              row={row}
              workspaceId={workspaceId}
              onEdit={() => setEditingId(row.id)}
            />
          </li>
        ))}
      </ul>

      <ApPaperSheet
        open={editing !== null}
        onClose={() => setEditingId(null)}
        eyebrow="edit draft"
        title={
          editing?.rendered.title ??
          editing?.rendered.recipientLine ??
          editing?.rendered.kindLabel ??
          "Draft"
        }
      >
        {editing ? (
          <form
            action={async (form: FormData) => {
              await editApprovalDraftAction(form);
              setEditingId(null);
            }}
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="itemId" value={editing.id} />
            <label className="block">
              <span className="mb-2 block font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                draft body
              </span>
              <textarea
                name="body"
                defaultValue={editing.rendered.editableBody ?? ""}
                rows={14}
                className="block w-full rounded-none border border-rule bg-paper p-3 font-sans text-[15px] leading-relaxed text-ink focus:border-ink focus:outline-none"
              />
            </label>
            <p className="mt-2 text-[13px] leading-relaxed text-mute">
              Saving rewrites the drafted body. Tone, recipient, and
              threshold stay as your fleet proposed them.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
              <ApHeritageButton variant="primary" type="submit">
                save draft
              </ApHeritageButton>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="inline-flex items-center justify-center rounded-none px-3 py-2 font-sans text-sm text-ink underline-offset-4 hover:underline"
              >
                cancel
              </button>
            </div>
          </form>
        ) : null}
      </ApPaperSheet>
    </>
  );
}

interface ApprovalArticleProps {
  row: ApprovalRow;
  workspaceId: string;
  onEdit: () => void;
}

function ApprovalArticle({ row, workspaceId, onEdit }: ApprovalArticleProps) {
  const { rendered } = row;
  const canEdit = Boolean(rendered.editableBody);
  const adminCardClass = adminBorderClass(rendered.admin?.priority);
  return (
    <ApPaperCard
      className={adminCardClass}
      eyebrow={
        <>
          {rendered.kindLabel}
          <span className="mx-2">·</span>
          {row.agentSlug}
          <span className="mx-2">·</span>
          {formatRelativeTime(row.proposedAtIso)}
        </>
      }
      title={rendered.title}
    >
      {rendered.admin ? (
        <AdminCardContent admin={rendered.admin} />
      ) : null}

      {rendered.recipientLine ? (
        <p className="font-mono text-[12px] text-ink-soft">
          {rendered.recipientLine}
        </p>
      ) : null}

      {rendered.inboundSummary ? (
        <p className="mt-3 border-l-2 border-rule pl-3 text-[13px] leading-relaxed text-mute">
          In reply to: {rendered.inboundSummary}
        </p>
      ) : null}

      <div
        className={
          rendered.recipientLine || rendered.inboundSummary
            ? "mt-4 border-t border-rule pt-4"
            : ""
        }
      >
        {rendered.body.map((paragraph, idx) => (
          <p
            key={idx}
            className="mt-3 max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed text-ink first:mt-0"
          >
            {paragraph}
          </p>
        ))}
      </div>

      {rendered.proposedSlots && rendered.proposedSlots.length > 0 ? (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            proposed slots
          </p>
          <ul className="mt-2 space-y-1 text-[14px] text-ink-soft">
            {rendered.proposedSlots.map((s, i) => (
              <li key={`${s.day}-${i}`}>
                {capitalize(s.day)} {s.startLocal}–{s.endLocal}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rendered.persisted === false ? (
        <p className="mt-4 border border-rule bg-paper-deep px-3 py-2 text-[12px] leading-relaxed text-mute">
          Held for your review — confidence below the persist threshold,
          so we did not write to your Gmail Drafts. Approve to send it
          through.
        </p>
      ) : rendered.persisted === true ? (
        <p className="mt-4 text-[12px] leading-relaxed text-mute">
          Saved to your Gmail Drafts. Approve here to confirm it ships
          on your side; reject to discard the draft.
        </p>
      ) : null}

      {rendered.metaLine ? (
        <p className="mt-4 border-t border-rule pt-4 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {rendered.metaLine}
        </p>
      ) : null}

      <p className="mt-4 flex items-center gap-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        <PlainoAvatar size="xs" />
        <span>drafted by Plaino</span>
      </p>

      <footer className="mt-5 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
        <form action={decideApprovalAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="itemId" value={row.id} />
          <input type="hidden" name="decision" value="APPROVED" />
          <ApHeritageButton variant="primary" type="submit">
            approve
          </ApHeritageButton>
        </form>
        {canEdit ? (
          <ApHeritageButton
            variant="secondary"
            type="button"
            onClick={onEdit}
          >
            edit
          </ApHeritageButton>
        ) : null}
        <form action={decideApprovalAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="itemId" value={row.id} />
          <input type="hidden" name="decision" value="REJECTED" />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-none px-3 py-2 font-sans text-sm font-medium text-flag underline-offset-4 transition hover:underline"
          >
            reject
          </button>
        </form>
      </footer>
    </ApPaperCard>
  );
}

interface AdminCardContentProps {
  admin: NonNullable<RenderedApproval["admin"]>;
}

function AdminCardContent({ admin }: AdminCardContentProps) {
  return (
    <div>
      <p className="font-mono text-[12px] text-ink-soft">
        From: {admin.fromDisplay}
      </p>
      <p className="font-mono text-[12px] text-ink-soft">
        Subject: {admin.subject}
      </p>
      {admin.category === "verification-code" && admin.verificationCode ? (
        <div className="mt-4 border border-rule bg-paper-deep px-4 py-3">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            verification code
          </p>
          <p
            className="mt-1 font-mono text-3xl tracking-[0.25em] text-ink"
            aria-label={`Verification code ${admin.verificationCode}`}
          >
            {admin.verificationCode}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-mute">
            Paste this in the surface that asked for it. We do not enter the
            code anywhere on your behalf.
          </p>
        </div>
      ) : null}
      {admin.category === "password-reset" && admin.primaryUrl ? (
        <div className="mt-4 border border-rule bg-paper-deep px-4 py-3">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            reset link
          </p>
          <a
            href={admin.primaryUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center justify-center border border-ink bg-paper px-3 py-2 font-sans text-sm text-ink underline-offset-4 hover:underline"
          >
            open in your browser
          </a>
          <p className="mt-2 break-all font-mono text-[11px] text-mute">
            {admin.primaryUrl}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-mute">
            We hand you the link. You open it. If you did not request this,
            reject the card.
          </p>
        </div>
      ) : null}
      {admin.category === "email-verification" && admin.primaryUrl ? (
        <div className="mt-4 border border-rule bg-paper-deep px-4 py-3">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            verification link
          </p>
          <a
            href={admin.primaryUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center justify-center border border-ink bg-paper px-3 py-2 font-sans text-sm text-ink underline-offset-4 hover:underline"
          >
            open to confirm
          </a>
          <p className="mt-2 break-all font-mono text-[11px] text-mute">
            {admin.primaryUrl}
          </p>
        </div>
      ) : null}
      {admin.category === "trial-expiration" && admin.expiresAt ? (
        <div className="mt-4 border border-rule bg-paper-deep px-4 py-3">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            ends
          </p>
          <p className="mt-1 font-mono text-lg text-ink">
            {formatExpires(admin.expiresAt)}
          </p>
          {admin.amount ? (
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              Renewal charge: {admin.amount}
            </p>
          ) : null}
        </div>
      ) : null}
      {admin.category === "account-suspension" ? (
        <div className="mt-4 border border-flag bg-paper-deep px-4 py-3">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-flag">
            confirm this was you
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">
            Approve only if you recognize the activity. Reject if you did not
            sign in — we will file the incident in your activity log so you
            can address it from the originating service.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function adminBorderClass(priority?: "critical" | "normal" | "low"): string {
  if (priority === "critical") return "border-flag";
  if (priority === "low") return "opacity-90";
  return "";
}

function formatExpires(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString();
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
