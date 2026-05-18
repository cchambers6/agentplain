"use client";

import { useState } from "react";
import {
  ApHeritageButton,
  ApPaperCard,
  ApPaperSheet,
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
                Draft body
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
  return (
    <ApPaperCard
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
            Proposed slots
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
