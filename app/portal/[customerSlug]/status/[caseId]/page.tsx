import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal/server";
import { getClientCase } from "@/lib/portal/clients";
import {
  StatusTimeline,
  DocumentList,
} from "@/components/portal/StatusTimeline";
import { DocUpload } from "@/components/portal/DocUpload";

export const dynamic = "force-dynamic";

export default async function CaseStatusPage({
  params,
}: {
  params: Promise<{ customerSlug: string; caseId: string }>;
}) {
  const { customerSlug, caseId } = await params;
  const ctx = await getPortalContext(customerSlug);
  if (!ctx) notFound();
  // Client-only surface: require a session, else send them to the portal home
  // (which explains the invite-link flow).
  if (!ctx.signedIn) redirect(`/portal/${customerSlug}`);

  const found = await getClientCase({
    portalConfigId: ctx.brand.portalConfigId,
    clientId: ctx.signedIn.clientId,
    caseId,
  });
  if (!found) notFound();

  return (
    <div className="space-y-10">
      <Link
        href={`/portal/${customerSlug}`}
        className="text-sm text-mute underline"
      >
        ← All your work
      </Link>

      <StatusTimeline portalCase={found.case} events={found.events} />

      <section>
        <h2 className="mb-3 font-display text-lg">Documents</h2>
        <DocumentList documents={found.documents} />
        <div className="mt-5 border border-rule bg-paper-deep/40 p-4">
          <h3 className="text-sm font-medium">Share a document</h3>
          <p className="mb-3 mt-1 text-xs text-mute">
            PDFs, images, and office documents up to 25 MB. Everything you upload
            is scanned before anyone opens it.
          </p>
          <DocUpload slug={customerSlug} caseId={found.case.id} />
        </div>
      </section>

      <section>
        <Link
          href={`/portal/${customerSlug}/chat`}
          className="text-sm font-medium underline"
          style={{ color: "var(--portal-accent, #B65D3A)" }}
        >
          Have a question about this? Message {ctx.brand.brandName} →
        </Link>
      </section>
    </div>
  );
}
