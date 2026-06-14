import Link from "next/link";
import { ApEyebrow, ApMotif } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { NewTicketForm } from "./NewTicketForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Open a support ticket. A first-class, tracked channel with a real number,
// an SLA, and a human — distinct from the quick Plaino chat (/support) and the
// lightweight note form (/help). This is where a customer goes when they're
// stuck and want it tracked end-to-end.
export default async function NewTicketPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const partner = servicePartnerForWorkspace(workspaceId);
  const basePath = `/app/workspace/${workspaceId}`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-ink">
        <ApMotif name="lone-tree" size={72} />
      </div>
      <ApEyebrow className="mb-3">contact support</ApEyebrow>
      <h1 className="font-display text-3xl leading-tight text-ink">
        Open a ticket — we&rsquo;ll get a human on it.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        Tell us what&rsquo;s going on. You&rsquo;ll get a ticket number, a
        clear response time, and an email the moment {partner} or a teammate
        replies. Nothing vanishes into a queue.
      </p>

      <div className="mt-8">
        <NewTicketForm workspaceId={workspaceId} basePath={basePath} />
      </div>

      <div className="mt-8 flex flex-wrap gap-5 border-t border-rule pt-5">
        <Link
          href={`${basePath}/support/tickets`}
          className="font-mono text-[12px] uppercase tracking-eyebrow text-mute underline underline-offset-4 hover:text-ink"
        >
          my tickets
        </Link>
        <Link
          href={`${basePath}/support`}
          className="font-mono text-[12px] uppercase tracking-eyebrow text-mute underline underline-offset-4 hover:text-ink"
        >
          chat with {partner} instead
        </Link>
      </div>
    </div>
  );
}
