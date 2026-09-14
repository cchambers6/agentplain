import { ApEyebrow } from "@/components/ui/ap";
import type { ApprovalArtifact } from "@/lib/approvals/artifact";
import type { ApprovalArtifactSource } from "@/lib/approvals/stored-artifact";
import { ApprovalCard, type ApprovalRow } from "./ApprovalCard";

/**
 * The accepted lane -- what the customer gets to keep.
 *
 * WHY THIS EXISTS
 * ---------------
 * Approving used to be the act that REMOVED the customer's only way to get the
 * work. The queue rendered `status: "PENDING"` and nothing else, and the card
 * carrying the copy / download / mailto handoff vanished the instant the row
 * left PENDING. The durable artifact written to replace it had no reader. So
 * the customer's reward for saying yes was an empty screen and a retype.
 *
 * This section is the reader. It renders accepted rows with the artifact that
 * was FROZEN AT APPROVAL TIME, so the handoff control outlives the decision.
 *
 * WHY IT IS A SEPARATE SECTION AND NOT MORE ROWS IN `ApprovalsList`
 * ----------------------------------------------------------------
 * `ApprovalsList` is the DECIDING surface: it owns approve / reject / edit /
 * batch-select, and every row in it is assumed actionable. Feeding accepted
 * rows into it would put approve and reject buttons under items already
 * decided, make them batch-selectable, and count them in the "needs you"
 * bucket. The accepted lane is a READING surface -- no footer, no actions,
 * nothing to click except the handoff. Keeping them apart is what stops this
 * change from leaking into the decision machinery.
 */

export interface ApprovedApprovalRow {
  row: ApprovalRow;
  /** The artifact to hand over. Stored-at-approval when one exists. */
  artifact: ApprovalArtifact;
  /** Which record `artifact` came from. Rendered, not just carried: a legacy
   *  re-derivation is a weaker record than a frozen one and the customer is
   *  told so rather than being shown both as if they were equivalent. */
  artifactSource: ApprovalArtifactSource;
  decidedAtIso: string;
}

interface ApprovedHandoffSectionProps {
  rows: ApprovedApprovalRow[];
}

export function ApprovedHandoffSection({ rows }: ApprovedHandoffSectionProps) {
  if (rows.length === 0) return null;

  return (
    <section data-approved-handoff className="mt-16">
      <ApEyebrow className="mb-3">approved — ready to send</ApEyebrow>
      <h2 className="font-display text-2xl text-ink">
        Done, and yours to take.
      </h2>
      {/* The honesty line. "Sent" and "delivered" are false today -- no
          executor reaches outside our own database -- so the copy says what
          actually happened (a decision was recorded, work was kept) and who
          does the sending (the customer, from their own account). */}
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        You approved these. agentplain did not send them — it never sends
        anything. Copy each one, download it, or open it in your own mail app
        with your finger on the button. What you see here is the text as it
        stood when you approved it, not a fresh re-draft.
      </p>

      <div className="mt-8 space-y-6">
        {rows.map((item) => (
          <div key={item.row.id}>
            <ApprovalCard
              row={item.row}
              artifact={item.artifact}
              decided
              decidedAtIso={item.decidedAtIso}
              plainoState="sit"
            />
            {item.artifactSource === "legacy-rederived" ? (
              <p
                data-legacy-artifact
                className="mt-2 font-mono text-[11px] leading-relaxed tracking-wide text-mute"
              >
                Rebuilt from the item — this one was approved before we started
                keeping a copy at the moment you said yes.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
