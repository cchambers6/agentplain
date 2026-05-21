import { ApEyebrow, ApMotif } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { HelpForm } from "./HelpForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function HelpPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const partner = servicePartnerForWorkspace(workspaceId);

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

      <div className="mt-8">
        <HelpForm workspaceId={workspaceId} />
      </div>
    </div>
  );
}
