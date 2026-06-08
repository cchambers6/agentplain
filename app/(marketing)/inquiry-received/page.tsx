import type { Metadata } from "next";
import Link from "next/link";
import { tokens } from "@/lib/brand/tokens";
import { PlainoScene } from "@/components/ui/ap";

// /inquiry-received — top-level confirmation surface for visitors who land
// here via a direct link (e.g. linked from internal docs, retry from a
// stale tab, or any external CTA that wants to fire-and-forget the form
// submit). The /custom contact form itself renders an inline ack on
// success — this page is the standalone equivalent.
//
// Per `project_no_outbound_architecture.md`: the confirmation is a UI
// surface, not an automated email. Nothing fires from here.

export const metadata: Metadata = {
  title: "Inquiry received",
  description:
    "Got it. A service partner will reach out within 1 business day.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

function isMaxFromParam(raw: unknown): boolean {
  const slug = Array.isArray(raw) ? raw[0] : raw;
  if (typeof slug !== "string") return false;
  const normalized = slug.toLowerCase().replace(/-/g, "_");
  return normalized === "max" || normalized === "max_service_engagement";
}

export default async function InquiryReceivedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isMax = isMaxFromParam(params.type);
  const title = isMax
    ? "Got it. A service partner will reach out within 1 business day."
    : "Got it. We'll come back with a written spec.";
  const body = isMax
    ? "Max-tier engagements are quote-based, so the first reply is a real human — not a drip, not an auto-form. We'll come back with a scoping window and a first read on what the engagement looks like."
    : "Expect a reply within two business days from a real human, not a drip sequence. We'll come back with a scoping call invite plus a written spec covering what we'd build, how long it'd take, and what it'd cost.";

  return (
    <section className="border-b border-rule bg-paper">
      <div className="container-wide py-24 md:py-32">
        {/* Confirmation Plaino — "received, it's in good hands." Placeholder
            today; one-line swap when the real asset lands. */}
        <PlainoScene
          name="inquiry-received"
          alt="Plaino setting your inquiry safely on the porch"
          className="mb-8 h-auto w-32"
        />
        <p className="eyebrow mb-6">Inquiry received</p>
        <p className="font-display text-base leading-snug text-clay md:text-lg">
          {tokens.tagline}
        </p>
        <h1 className="mt-6 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.75rem] md:leading-[1.05]">
          {title}
        </h1>
        <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
          {body}
        </p>
        <p className="mt-8 max-w-2xl font-mono text-[12px] leading-relaxed text-mute">
          If the window passes and you haven&apos;t heard from us, email{" "}
          <a href="mailto:hello@agentplain.com" className="underline">
            hello@agentplain.com
          </a>{" "}
          — the inquiry probably hit a spam filter.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/" className="btn-secondary">
            Back to home
          </Link>
          <Link href="/custom" className="btn-secondary">
            See /custom
          </Link>
        </div>
      </div>
    </section>
  );
}
