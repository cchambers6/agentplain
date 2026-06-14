import { ApEyebrow, ApMotif } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { getSupportRecentStatus } from "@/lib/support/recent-status";
import { HelpForm } from "./HelpForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
  // `?subject=` lets the funnel's "I'm stuck" links arrive with the step
  // already named (e.g. "Stuck connecting a tool"), so the customer doesn't
  // have to describe where they are — they just say what's wrong.
  searchParams: Promise<{ subject?: string }>;
}

export default async function HelpPage({ params, searchParams }: PageProps) {
  const { id: workspaceId } = await params;
  const sp = await searchParams;
  const defaultSubject =
    typeof sp.subject === "string" ? sp.subject.slice(0, 200) : "";
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const partner = servicePartnerForWorkspace(workspaceId);
  const recent = await getSupportRecentStatus({
    ctx: {
      userId: member.userId,
      workspaceId,
      isOperator: member.isOperator,
    },
    workspaceId,
    fromUserId: member.userId,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-ink">
        <ApMotif name="lone-tree" size={72} />
      </div>
      <ApEyebrow className="mb-3">a hand when you need one</ApEyebrow>
      <h1 className="font-display text-3xl leading-tight text-ink">
        Need a hand? Message your service partner.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        {partner} and the team are here to help — not a ticket queue, a partner
        who knows your ground. Send a note and we&rsquo;ll follow up by email.
      </p>

      {recent.state !== "none" ? (
        <RecentStatusBanner status={recent} />
      ) : null}

      <div className="mt-8">
        <HelpForm workspaceId={workspaceId} defaultSubject={defaultSubject} />
      </div>
    </div>
  );
}

function RecentStatusBanner({
  status,
}: {
  status: Awaited<ReturnType<typeof getSupportRecentStatus>>;
}) {
  if (status.state === "drafted-under-review") {
    return (
      <div className="mt-8 border border-rule bg-paper-deep p-4 text-[14px] leading-relaxed text-ink">
        <p>
          <strong>Your last note:</strong> &ldquo;{status.subject}&rdquo;
        </p>
        <p className="mt-2 text-ink-soft">
          We&rsquo;ve drafted a first response &mdash; a human at agentplain
          is reviewing it now. We&rsquo;ll follow up by email once they
          approve the reply.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-8 border border-rule bg-paper-deep p-4 text-[14px] leading-relaxed text-ink">
      <p>
        <strong>Your last note:</strong> &ldquo;{status.subject}&rdquo;
      </p>
      <p className="mt-2 text-ink-soft">
        Submitted &mdash; under review by a human. We&rsquo;ll follow up by
        email shortly.
      </p>
    </div>
  );
}
