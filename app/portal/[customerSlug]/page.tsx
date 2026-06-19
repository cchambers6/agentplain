import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalContext } from "@/lib/portal/server";
import { listClientCases } from "@/lib/portal/clients";
import { CaseStatusBadge } from "@/components/portal/StatusTimeline";

export const dynamic = "force-dynamic";

export default async function PortalHome({
  params,
}: {
  params: Promise<{ customerSlug: string }>;
}) {
  const { customerSlug } = await params;
  const ctx = await getPortalContext(customerSlug);
  if (!ctx) notFound();

  if (!ctx.signedIn) {
    return (
      <section className="max-w-prose">
        <h1 className="font-display text-2xl">Welcome to your portal</h1>
        <p className="mt-3 text-sm text-ink-soft">
          To open your portal, use the personal link {ctx.brand.brandName} emailed
          you. Each link is unique to you and signs you in securely — no password
          to remember.
        </p>
        <p className="mt-3 text-sm text-mute">
          Didn&apos;t get a link, or has it expired? Reach out to{" "}
          {ctx.brand.brandName} and they&apos;ll send you a fresh one.
        </p>
      </section>
    );
  }

  const cases = await listClientCases({
    portalConfigId: ctx.brand.portalConfigId,
    clientId: ctx.signedIn.clientId,
  });

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl">Your work with {ctx.brand.brandName}</h1>
        <Link
          href={`/portal/${customerSlug}/chat`}
          className="text-sm font-medium underline"
          style={{ color: "var(--portal-accent, #B65D3A)" }}
        >
          Message us
        </Link>
      </div>

      {cases.length === 0 ? (
        <p className="text-sm text-mute">
          There&apos;s nothing to show here yet. {ctx.brand.brandName} will add your
          work as it gets going — and you can message them any time.
        </p>
      ) : (
        <ul className="divide-y divide-rule border border-rule">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/portal/${customerSlug}/status/${c.id}`}
                className="flex items-center gap-3 px-4 py-4 hover:bg-paper-deep"
              >
                <div>
                  <div className="text-sm font-medium text-ink">{c.title}</div>
                  <div className="text-xs text-mute">Reference {c.reference}</div>
                </div>
                <span className="ml-auto">
                  <CaseStatusBadge status={c.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
