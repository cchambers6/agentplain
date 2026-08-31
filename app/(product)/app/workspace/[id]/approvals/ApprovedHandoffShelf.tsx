import type { WorkApprovalKind } from "@prisma/client";
import { ApEyebrow } from "@/components/ui/ap";
import { buildApprovalArtifact } from "@/lib/approvals/artifact";
import { friendlyTitle } from "@/lib/approvals/presentation";
import { ApprovalHandoff } from "./ApprovalHandoff";
import { formatRelativeTime } from "./ApprovalCard";
import type { RenderedApproval } from "./renderApprovalPayload";

// ── The artifact has to survive the approval ─────────────────────────────
//
// /approvals queries PENDING only. That is right for a decision queue and
// wrong for a work product: the moment the customer said yes, the row left
// the page and took the drafted text with it. They approved a letter and
// then had nothing to paste.
//
// This shelf is the fix. The page also reads back the items decided APPROVED
// inside a short window and renders each one's artifact with the same handoff
// control the pending card carries. Approving moves an item from "decide this"
// to "take this" — it never makes the work disappear.
//
// DB-free and presentational: the page does the reading, this renders it, and
// tests/customer-approvals.test.tsx exercises it without a database.

/** How far back the shelf reaches. Long enough that an approve is never a
 *  one-way door, short enough that the queue page does not become an archive. */
export const HANDOFF_WINDOW_HOURS = 24;
export const HANDOFF_SHELF_LIMIT = 10;

export interface ApprovedHandoffRow {
  id: string;
  kind: string;
  decidedAtIso: string;
  rendered: RenderedApproval;
}

export function ApprovedHandoffShelf({ rows }: { rows: ApprovedHandoffRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section
      className="mt-10 border-t border-rule pt-6"
      aria-label="Approved and ready to hand off"
    >
      <ApEyebrow>approved — ready to hand off</ApEyebrow>
      <h2 className="mt-2 font-display text-xl text-ink">
        What you said yes to, still in reach.
      </h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
        Approving decides it; it does not make it vanish. Everything you cleared
        in the last {HANDOFF_WINDOW_HOURS} hours is here with its text intact —
        copy it, download it, or open it in your own mail app. Your system is
        still what sends.
      </p>

      <ul className="mt-5 space-y-3">
        {rows.map((r) => {
          const artifact = buildApprovalArtifact(r.kind as WorkApprovalKind, r.rendered);
          return (
            <li key={r.id} className="border border-rule bg-paper-deep px-4 py-3">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                approved {formatRelativeTime(r.decidedAtIso)}
              </p>
              <p className="mt-1 max-w-prose text-[15px] leading-relaxed text-ink">
                {friendlyTitle(r.rendered)}
              </p>
              <div className="mt-3">
                <ApprovalHandoff artifact={artifact} compact />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
