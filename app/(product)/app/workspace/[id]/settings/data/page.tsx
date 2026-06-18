import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApHeritageButton,
  ApPaperCard,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  DEFAULT_GRACE_DAYS,
  getGraceDays,
  readWorkspaceClosureState,
} from "@/lib/customer-data";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { ClosureConfirmForm } from "./ClosureConfirmForm";
import { cancelClosureAction } from "./actions";

// Customer-controlled data surface. Two affordances:
//   1. Export — a single GET against /api/workspaces/[id]/export returns
//      the full workspace artifact as a downloadable JSON file.
//   2. Close workspace — typed-confirmation gate, then the workspace
//      enters a CLOSING soft-delete state with a grace window the
//      customer can still cancel inside.
//
// Service-partnership posture (per docs/brand-and-claims.md §3): the
// customer is controlling their OWN data inside a managed product. The
// copy reflects that — "your service partner is here" — not "DIY tool".

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function DataControlsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: workspaceId } = await params;
  const search = (await searchParams) ?? {};
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const workspace = await withRls(ctx, (tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true },
    }),
  );
  if (!workspace) return null;

  const closure = await readWorkspaceClosureState(ctx, workspaceId);
  const partner = servicePartnerForWorkspace(workspaceId);
  const graceDays = getGraceDays();
  const flash = parseFlash(search.closed);

  return (
    <div className="space-y-12">
      <header>
        <ApEyebrow className="mb-3">your data</ApEyebrow>
        <h1 className="font-display text-3xl text-ink">
          Export it. Close the workspace. Always your call.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {partner} runs the work, but the data is yours. Take a full copy
          whenever you want, or close the workspace and we&rsquo;ll purge
          everything we hold for you after a {graceDays}-day grace window.
        </p>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-mute">
          <Link
            href={`/app/workspace/${workspaceId}/settings`}
            className="underline-offset-2 hover:underline"
          >
            ← back to settings
          </Link>
        </p>
      </header>

      {flash ? <FlashBanner kind={flash} /> : null}

      <WhatWeStoreSection workspaceId={workspaceId} />

      <ExportSection workspaceId={workspaceId} />

      <ClosureSection
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        closure={closure}
        partner={partner}
        graceDays={graceDays}
      />
    </div>
  );
}

// ─── What we store ──────────────────────────────────────────────────────────

function WhatWeStoreSection({ workspaceId }: { workspaceId: string }) {
  return (
    <section>
      <ApEyebrow className="mb-3">what we store</ApEyebrow>
      <ApPaperCard
        title="See exactly what we hold about you — live, row by row."
        footer={
          <Link
            href={`/app/workspace/${workspaceId}/settings/data/storage`}
            className="inline-flex items-center justify-center gap-2 rounded-none border border-ink bg-ink px-6 py-3 font-sans text-sm font-medium text-paper transition hover:bg-ink-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            view what we store
          </Link>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          agentplain is a service layer, not a data warehouse. The storage page
          shows every category of data we keep for this workspace — with live
          counts — grouped by why we keep it, plus your chat-retention setting
          and proof that the data inside your connected systems is read
          in-flight and never stored. Clear any category with one tap.
        </p>
      </ApPaperCard>
    </section>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────

function ExportSection({ workspaceId }: { workspaceId: string }) {
  return (
    <section>
      <ApEyebrow className="mb-3">export</ApEyebrow>
      <ApPaperCard
        title="Download a copy of everything in this workspace."
        footer={
          // Plain <a> rather than a server-action button: the export route
          // streams a download via Content-Disposition. The browser
          // navigates to it, the file lands, the page stays where it was.
          <a
            href={`/api/workspaces/${workspaceId}/export`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-none border border-ink bg-ink px-6 py-3 font-sans text-sm font-medium text-paper transition hover:bg-ink-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            download export (json)
          </a>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          The export contains everything scoped to this workspace: the
          documents your fleet has read, the drafts in your queue, the
          handoff log, the integration connections, your preferences, your
          audit log, and your billing history. It is JSON — open it in any
          editor or pipe it into anything that reads JSON.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-mute">
          <li>
            Encrypted at-rest fields are decrypted in-flight for the
            export. This file is the plaintext copy of what we hold for
            you.
          </li>
          <li>
            OAuth tokens are intentionally omitted — they were never yours
            to begin with (the providers held them; we held a sealed copy).
          </li>
          <li>
            Other workspaces&rsquo; data is excluded by both row-level
            security and the export builder&rsquo;s scoping check.
          </li>
        </ul>
      </ApPaperCard>
    </section>
  );
}

// ─── Closure ──────────────────────────────────────────────────────────────

interface ClosureSectionProps {
  workspaceId: string;
  workspaceName: string;
  closure: Awaited<ReturnType<typeof readWorkspaceClosureState>>;
  partner: string;
  graceDays: number;
}

function ClosureSection({
  workspaceId,
  workspaceName,
  closure,
  partner,
  graceDays,
}: ClosureSectionProps) {
  if (closure?.closureStatus === "CLOSED") {
    return (
      <section>
        <ApEyebrow className="mb-3">workspace</ApEyebrow>
        <ApPaperCard title="This workspace is closed.">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Every piece of customer data we held for you was purged on{" "}
            {closure.closedAt
              ? new Date(closure.closedAt).toLocaleDateString()
              : "the scheduled date"}
            . Your workspace and billing rows remain so the audit + invoice
            history is queryable, but no tenant data is left.
          </p>
        </ApPaperCard>
      </section>
    );
  }

  if (closure?.closureStatus === "CLOSING") {
    const scheduled = closure.scheduledHardPurgeAt
      ? new Date(closure.scheduledHardPurgeAt)
      : null;
    return (
      <section>
        <ApEyebrow className="mb-3">workspace</ApEyebrow>
        <ApPaperCard title="This workspace is winding down.">
          <ApHairlineList>
            <ApHairlineRow
              right={
                closure.closingInitiatedAt
                  ? new Date(closure.closingInitiatedAt).toLocaleString()
                  : "—"
              }
            >
              <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                closure requested
              </span>
            </ApHairlineRow>
            <ApHairlineRow
              right={scheduled ? scheduled.toLocaleString() : "—"}
            >
              <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                hard purge scheduled
              </span>
            </ApHairlineRow>
          </ApHairlineList>

          <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
            Nothing has been deleted yet. The customer-data purge runs on
            the scheduled date, an hour at most after that point. You can
            cancel any time before then and the workspace returns to
            normal.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-mute">
            After the purge runs, every workspace-scoped row we hold —
            documents, drafts, handoffs, integrations, preferences,
            webhooks, chat, schedules, briefings, memory — is removed. The
            action is irreversible after the grace window ends. Your billing
            rows and a minimal audit trail (who closed the workspace and
            when) are kept for tax and compliance.
          </p>

          <form action={cancelClosureAction} className="mt-6">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <ApHeritageButton type="submit" variant="primary">
              cancel closure — keep this workspace
            </ApHeritageButton>
          </form>

          <p className="mt-4 text-[12px] leading-relaxed text-mute">
            Want to take one last export before it&rsquo;s gone? The
            download button above still works while the workspace is in
            this state.
          </p>
        </ApPaperCard>
      </section>
    );
  }

  return (
    <section>
      <ApEyebrow className="mb-3">workspace</ApEyebrow>
      <ApPaperCard title="Close this workspace.">
        <p className="text-[14px] leading-relaxed text-ink-soft">
          Closing tells {partner} to wind everything down. We pause the
          fleet immediately for new work, and a hard purge of every
          customer-data row we hold for you runs after a {graceDays}-day
          grace window. The grace window exists so a momentary change of
          heart doesn&rsquo;t become irreversible.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-mute">
          <li>You stay in control for the next {graceDays} days — cancel any time.</li>
          <li>
            Export your data before you close if you want a copy. The
            export keeps working while we&rsquo;re in the closing window
            too.
          </li>
          <li>
            After the {graceDays}-day window, the cascade deletes
            documents, drafts, handoffs, integrations, preferences,
            webhooks, chat, schedules, briefings, and memory. This is
            irreversible.
          </li>
          <li>
            Your billing rows (subscription + invoices) and a minimal audit
            trail — who closed the workspace and when — stay so your tax and
            compliance history is queryable. Cancel billing separately in the
            billing settings if you haven&rsquo;t already.
          </li>
        </ul>

        <ClosureConfirmForm
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      </ApPaperCard>
    </section>
  );
}

// ─── Flash ────────────────────────────────────────────────────────────────

type Flash = "initiated" | "cancelled";

function parseFlash(value: string | string[] | undefined): Flash | null {
  if (typeof value !== "string") return null;
  if (value === "initiated" || value === "cancelled") return value;
  return null;
}

function FlashBanner({ kind }: { kind: Flash }) {
  const message =
    kind === "initiated"
      ? `Closure scheduled. The cascade runs after ${DEFAULT_GRACE_DAYS} days unless you cancel.`
      : "Closure cancelled. Your workspace is back to normal.";
  return (
    <div className="border border-ink bg-paper-deep px-4 py-3">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {kind === "initiated" ? "closing" : "cancelled"}
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-ink">{message}</p>
    </div>
  );
}
