import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPortalContext } from "@/lib/portal/server";
import { ensurePortalThread, loadVisibleMessages } from "@/lib/portal/chat";
import { PortalChatComposer } from "@/components/portal/PortalChatComposer";

export const dynamic = "force-dynamic";

export default async function PortalChatPage({
  params,
}: {
  params: Promise<{ customerSlug: string }>;
}) {
  const { customerSlug } = await params;
  const ctx = await getPortalContext(customerSlug);
  if (!ctx) notFound();
  if (!ctx.signedIn) redirect(`/portal/${customerSlug}`);

  const threadId = await ensurePortalThread({
    portalConfigId: ctx.brand.portalConfigId,
    clientId: ctx.signedIn.clientId,
    caseId: null,
  });
  const messages = await loadVisibleMessages({
    portalConfigId: ctx.brand.portalConfigId,
    threadId,
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/portal/${customerSlug}`} className="text-sm text-mute underline">
          ← All your work
        </Link>
        <h1 className="mt-3 font-display text-2xl">Message {ctx.brand.brandName}</h1>
      </div>

      <div className="space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-mute">
            No messages yet. Send the {ctx.brand.brandName} team a note below.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] px-4 py-3 text-sm ${
                m.sender === "CLIENT"
                  ? "ml-auto bg-paper-deep text-ink"
                  : "mr-auto border border-rule bg-white text-ink"
              }`}
            >
              <div className="mb-1 text-[11px] uppercase tracking-wide text-mute">
                {m.sender === "CLIENT" ? "You" : ctx.brand.brandName}
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-rule pt-6">
        <PortalChatComposer slug={customerSlug} />
        <p className="mt-3 text-xs text-mute">
          Replies are reviewed by the {ctx.brand.brandName} team before they reach
          you, so there may be a short wait.
        </p>
      </div>
    </div>
  );
}
