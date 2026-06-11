import type { ReactNode } from "react";
import {
  ApPaperCard,
  PlainoStatus,
  type PlainoStatusState,
} from "@/components/ui/ap";
import { type DisciplineId } from "@/lib/disciplines";
import type { RenderedApproval } from "./renderApprovalPayload";

// DB-free presentation for one queued approval. The action controls
// (approve / edit / reject) live in `ApprovalsList.tsx` and are passed
// in via the `footer` slot — that keeps this module free of the server
// actions (and therefore the db), so every card variant is renderable
// in a unit test. See tests/customer-approvals.test.tsx.

export interface ApprovalRow {
  id: string;
  agentSlug: string;
  kind: string;
  /** Validated DisciplineId or null for legacy rows written before the
   *  discipline axis landed. NULL rows land in the "All recent" fallback. */
  discipline: DisciplineId | null;
  proposedAtIso: string;
  rendered: RenderedApproval;
}

interface ApprovalCardProps {
  row: ApprovalRow;
  /** Action controls (approve / edit / reject). Rendered in the footer. */
  footer?: ReactNode;
  /** Plaino's live status for this item. The approvals queue holds delivered
   *  drafts, so the default is "fetch" (Plaino brought work to the queue).
   *  Callers on other surfaces pass "sit" (ready), "alert" (Sentinel-blocked),
   *  or "sleep" (paused) per the two-family icon system
   *  (docs/brand/icon-families.md). */
  plainoState?: PlainoStatusState;
}

/** Map internal agent slugs to readable display labels for the customer surface.
 *  Slugs follow the pattern `<vertical>-<role>` or just `<role>-<vertical>`.
 *  Fallback: title-case the slug, strip any leading vertical prefix. */
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "realty-drafter": "Reply Drafter",
  "realty-showing-scheduler": "Showing Scheduler",
  "realty-buyer-inquiry-router": "Buyer Inquiry Router",
  "realty-listing-coordinator": "Listing Coordinator",
  "office-admin": "Office Admin",
  "follow-up-chaser-general": "Follow-up Chaser",
  "chief-of-staff-scheduler": "Chief of Staff",
  "inbox-triage-general": "Inbox Triage",
  "compliance-watch-general": "Compliance Sentinel",
  "support-handler": "Support Handler",
  "process-doc-drafter-general": "Process Doc Drafter",
  "content-calendar-drafter-general": "Content Calendar Drafter",
  "invoice-chase-general": "Invoice Chaser",
  "home-services-estimate-followup": "Estimate Follow-up",
  "law-intake-conflict-screen": "Conflict Screen",
  "analytics-weekly-pulse-general": "Analytics Pulse",
  "finance-pulse-general": "Finance Pulse",
};

function agentDisplayLabel(slug: string): string {
  if (AGENT_DISPLAY_NAMES[slug]) return AGENT_DISPLAY_NAMES[slug]!;
  // Strip leading vertical prefix (e.g. "realty-" or "general-") and title-case.
  const stripped = slug.replace(/^(realty|general|law|home-services|insurance|cpa|mortgage|real-estate|ria|property-management|recruiting|title-escrow)-/, "");
  return stripped
    .split("-")
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Map internal agent slugs to readable display labels for the customer surface.
 *  Slugs follow the pattern `<vertical>-<role>` or just `<role>-<vertical>`.
 *  Fallback: title-case the slug, strip any leading vertical prefix. */
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "realty-drafter": "Reply Drafter",
  "realty-showing-scheduler": "Showing Scheduler",
  "realty-buyer-inquiry-router": "Buyer Inquiry Router",
  "realty-listing-coordinator": "Listing Coordinator",
  "office-admin": "Office Admin",
  "follow-up-chaser-general": "Follow-up Chaser",
  "chief-of-staff-scheduler": "Chief of Staff",
  "inbox-triage-general": "Inbox Triage",
  "compliance-watch-general": "Compliance Sentinel",
  "support-handler": "Support Handler",
  "process-doc-drafter-general": "Process Doc Drafter",
  "content-calendar-drafter-general": "Content Calendar Drafter",
  "invoice-chase-general": "Invoice Chaser",
  "home-services-estimate-followup": "Estimate Follow-up",
  "law-intake-conflict-screen": "Conflict Screen",
  "analytics-weekly-pulse-general": "Analytics Pulse",
  "finance-pulse-general": "Finance Pulse",
};

function agentDisplayLabel(slug: string): string {
  if (AGENT_DISPLAY_NAMES[slug]) return AGENT_DISPLAY_NAMES[slug]!;
  // Strip leading vertical prefix (e.g. "realty-" or "general-") and title-case.
  const stripped = slug.replace(/^(realty|general|law|home-services|insurance|cpa|mortgage|real-estate|ria|property-management|recruiting|title-escrow)-/, "");
  return stripped
    .split("-")
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

export function ApprovalCard({
  row,
  footer,
  plainoState = "fetch",
}: ApprovalCardProps) {
  const { rendered } = row;
  const adminCardClass = adminBorderClass(rendered.admin?.priority);
  return (
    <ApPaperCard
      className={adminCardClass}
      eyebrow={
        <>
          {rendered.kindLabel}
          <span className="mx-2">·</span>
          {agentDisplayLabel(row.agentSlug)}
          <span className="mx-2">·</span>
          {formatRelativeTime(row.proposedAtIso)}
        </>
      }
      title={rendered.title}
    >
      {rendered.admin ? <AdminCardContent admin={rendered.admin} /> : null}

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
          Held for your review — confidence below the persist threshold, so we
          did not write to your Gmail Drafts. Approve to send it through.
        </p>
      ) : rendered.persisted === true ? (
        <p className="mt-4 text-[12px] leading-relaxed text-mute">
          Saved to your Gmail Drafts. Approve here to confirm it ships on your
          side; reject to discard the draft.
        </p>
      ) : null}

      {rendered.metaLine ? (
        <p className="mt-4 border-t border-rule pt-4 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {rendered.metaLine}
        </p>
      ) : null}

      {/* Provenance — names the agent that drafted it, the kind of work,
          and who herded it in. The source it read sits above ("In reply
          to:"). Per project_agents_work_proactively — the customer sees
          the fleet's work, not a black box. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        <PlainoStatus state={plainoState} size={16} />
        <span className="text-ink-soft">drafted by</span>
        <span className="text-ink">{agentDisplayLabel(row.agentSlug)}</span>
        <span aria-hidden>·</span>
        <span>{rendered.kindLabel}</span>
        <span aria-hidden>·</span>
        <span>herded in by Plaino</span>
      </div>

      {footer ? (
        <footer className="mt-5 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
          {footer}
        </footer>
      ) : null}
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
            sign in — we will file the incident in your activity log so you can
            address it from the originating service.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function adminBorderClass(
  priority?: "critical" | "normal" | "low",
): string {
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

export function formatRelativeTime(iso: string): string {
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
