import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApPaperCard,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { readWorkspaceClosureState, getGraceDays } from "@/lib/customer-data";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";

// Customer data-rights surface — the transparency front door.
//
// Where /settings/data is the operational control panel (export button +
// typed-confirmation close form), THIS page exists to make the ownership
// promise unmistakable: the data is the customer's, they can take it, they can
// delete it, and we never train on it. It is the in-product mirror of the
// commitments on /privacy, /terms, and /aup.
//
// Everything here reuses real infrastructure:
//   - Export   → GET /api/workspaces/[id]/export (the live export builder).
//   - Delete   → the existing GDPR-clean workspace-closure cascade under
//                /settings/data (typed-confirmation gated, grace window).
//   - Residency → stated honestly. We do NOT promise EU residency; BYO-hosting
//                is marked as not-yet-available. (Counsel review of these
//                commitments is a TODO before public exposure.)

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function DataRightsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const workspace = await withRls(ctx, (tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true, stateCode: true },
    }),
  );
  if (!workspace) return null;

  const closure = await readWorkspaceClosureState(ctx, workspaceId);
  const partner = servicePartnerForWorkspace(workspaceId);
  const graceDays = getGraceDays();
  const isClosing = closure?.closureStatus === "CLOSING";
  const isClosed = closure?.closureStatus === "CLOSED";

  return (
    <div className="space-y-12">
      <header>
        <ApEyebrow className="mb-3">your data</ApEyebrow>
        <h1 className="max-w-3xl font-display text-3xl leading-snug text-ink md:text-4xl">
          This is yours. Take it whenever you want. Delete it whenever you want.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {partner} runs the work, but everything it touches and everything it
          drafts belongs to you — your records, your client information, the
          summaries and drafts the fleet produces. You own it. You can export a
          full copy any time, and you can delete all of it. And we never use
          your data to train models.
        </p>
      </header>

      {/* The no-training commitment, stated plainly and first. */}
      <section>
        <ApEyebrow className="mb-3">our commitment</ApEyebrow>
        <ApPaperCard title="We never train models on your data.">
          <ul className="space-y-3 text-[14px] leading-relaxed text-ink-soft">
            <li>
              <strong className="text-ink">No training, no feedback loop.</strong>{" "}
              Your chats with Plaino and the records your connectors expose are
              used to do <em>your</em> work — and nothing else. We do not
              fine-tune any model on them, and we do not feed them into a
              training pipeline.
            </li>
            <li>
              <strong className="text-ink">No pooling across customers.</strong>{" "}
              Every row we hold is scoped to this one workspace. Your data is
              never mixed with another business&rsquo;s.
            </li>
            <li>
              <strong className="text-ink">
                The AI provider doesn&rsquo;t train on it either.
              </strong>{" "}
              Our AI model provider&rsquo;s commercial API does not train on
              inputs or outputs by default. The only thing attached to a request
              is a one-way scrambled workspace id for abuse detection — never
              your name, email, or business.
            </li>
          </ul>
          <p className="mt-4 text-[13px] leading-relaxed text-mute">
            Read the full commitment on our{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
              privacy policy
            </Link>
            .
          </p>
        </ApPaperCard>
      </section>

      {/* Export — wired to the real export endpoint. */}
      <section>
        <ApEyebrow className="mb-3">export</ApEyebrow>
        <ApPaperCard
          title="Download a copy of everything."
          footer={
            // Plain <a download> — the export route streams the file via
            // Content-Disposition, so the browser saves it and the page stays.
            <a
              href={`/api/workspaces/${workspaceId}/export`}
              download
              className="inline-flex items-center justify-center gap-2 rounded-none border border-ink bg-ink px-6 py-3 font-sans text-sm font-medium text-paper transition hover:bg-ink-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              download everything (JSON)
            </a>
          }
        >
          <p className="text-[14px] leading-relaxed text-ink-soft">
            One tap pulls a full copy of this workspace: every document the
            fleet has read, every draft and summary it generated, your handoff
            log, your connections, your preferences, your audit trail, and your
            billing history. It is structured JSON — open it anywhere, or move
            it into another system.
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-mute">
            <li>
              Encrypted fields are decrypted in the export — this is the
              plaintext copy of what we hold for you.
            </li>
            <li>
              Connected-system OAuth tokens are intentionally excluded — those
              belong to the provider, not to your export.
            </li>
            <li>
              No other business&rsquo;s data can appear: scoping is enforced at
              the database row level and again in the export builder.
            </li>
          </ul>
        </ApPaperCard>
      </section>

      {/* Delete — link to the GDPR-clean closure cascade. */}
      <section>
        <ApEyebrow className="mb-3">delete</ApEyebrow>
        <ApPaperCard
          title={
            isClosed
              ? "This workspace is closed — your data was purged."
              : isClosing
                ? "This workspace is winding down."
                : "Delete everything we hold for you."
          }
          footer={
            !isClosed ? (
              <Link
                href={`/app/workspace/${workspaceId}/settings/data`}
                className="inline-flex items-center justify-center gap-2 rounded-none border border-ink bg-paper px-6 py-3 font-sans text-sm font-medium text-ink transition hover:bg-paper-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                {isClosing ? "manage closure" : "delete & close workspace →"}
              </Link>
            ) : undefined
          }
        >
          {isClosed ? (
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Every customer-data row we held for you was purged
              {closure?.closedAt
                ? ` on ${new Date(closure.closedAt).toLocaleDateString()}`
                : ""}
              . Nothing tenant-specific remains.
            </p>
          ) : (
            <>
              <p className="text-[14px] leading-relaxed text-ink-soft">
                You can delete all of your data — a clean, GDPR-style erasure.
                Closing the workspace pauses the fleet immediately and schedules
                a hard purge of every workspace-scoped row after a {graceDays}
                -day grace window. The grace window means a change of heart
                isn&rsquo;t irreversible; cancel any time inside it.
              </p>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-mute">
                <li>
                  The purge removes documents, drafts, handoffs, connections,
                  preferences, chat, schedules, briefings, and memory.
                </li>
                <li>
                  We keep only what law requires: your invoices and a minimal
                  audit trail of who closed the workspace and when.
                </li>
                <li>Take an export first if you want a copy — the button above works right up to the purge.</li>
              </ul>
            </>
          )}
        </ApPaperCard>
      </section>

      {/* Residency — stated honestly, no over-promising. */}
      <section>
        <ApEyebrow className="mb-3">where your data lives</ApEyebrow>
        <ApPaperCard title="Where we store it, and how it’s protected.">
          <ApHairlineList aria-label="Storage details">
            <ApHairlineRow right="Managed Postgres (Neon)">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                storage tier
              </span>
            </ApHairlineRow>
            <ApHairlineRow right="AES-256-GCM at rest + TLS in transit">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                encryption
              </span>
            </ApHairlineRow>
            <ApHairlineRow right="United States">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                region
              </span>
            </ApHairlineRow>
            <ApHairlineRow right="Not yet available">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                bring-your-own hosting
              </span>
            </ApHairlineRow>
          </ApHairlineList>
          <p className="mt-4 text-[13px] leading-relaxed text-mute">
            Your workspace data lives in a managed US-region Postgres database,
            encrypted at rest. Self-hosting (running agentplain inside your own
            infrastructure) and region choice are on our roadmap, not available
            today — we&rsquo;ll tell you here the moment they are, rather than
            promise something we can&rsquo;t yet deliver.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-mute">
            Full detail is on our{" "}
            <Link href="/security" className="underline underline-offset-2 hover:text-ink">
              security
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
              privacy
            </Link>{" "}
            pages. Questions about your data? Reach {partner}, or email{" "}
            <a
              href="mailto:hello@agentplain.com"
              className="underline underline-offset-2 hover:text-ink"
            >
              hello@agentplain.com
            </a>
            .
          </p>
        </ApPaperCard>
      </section>
    </div>
  );
}
