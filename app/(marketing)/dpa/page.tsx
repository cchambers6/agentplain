import type { Metadata } from "next";
import Link from "next/link";
import { alternatesFor } from "@/lib/seo/metadata";
import { PlainoScene } from "@/components/ui/ap";

export const metadata: Metadata = {
  title: "Data Processing Agreement",
  description:
    "Firms with a confidentiality, privilege, or regulatory obligation can request a Data Processing Agreement (DPA) that puts agentplain's data-minimization commitments into a signed contract.",
  alternates: alternatesFor("/dpa"),
};

// /dpa — the customer-facing landing for the Data Processing Agreement. The
// binding template is held internally (docs/legal/) pending counsel review; this
// page offers it on request and sets honest expectations. No model vendor named.
// Which tiers get a DPA at no charge is a Conner decision (see
// docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md).

export default function DpaPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <PlainoScene name="legal" className="mb-5 h-auto w-16" />
          <p className="eyebrow mb-3">Data Processing Agreement</p>
          <h1 className="mt-2 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.04]">
            The commitments, in a contract you can sign.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            If your firm carries a confidentiality, privilege, or regulatory
            obligation — CPAs, law firms, RIAs, anyone handling sensitive client
            data — you can request a Data Processing Agreement that puts our
            data-minimization commitments into a signed, binding document for
            your counsel to review.
          </p>
        </div>
      </section>

      <Section title="What the DPA covers">
        <p>
          The DPA restates, as contractual obligations, the same commitments we
          describe in plain language on our{" "}
          <Link className="underline text-clay" href="/data">
            data page
          </Link>{" "}
          and in our{" "}
          <Link className="underline text-clay" href="/privacy">
            privacy policy
          </Link>
          :
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Roles.</strong> You are the data controller; agentplain is
            your data processor, acting only on your documented instructions.
          </li>
          <li>
            <strong>Purpose limitation + minimization.</strong> We process your
            data only to deliver the service to you, and we keep the minimum
            described on the data page — drafts, the audit log, the documents
            you connect, a sealed token, and your account settings.
          </li>
          <li>
            <strong>No training, no pooling, no resale.</strong> Your data is
            never used to train a model, pooled across customers, or sold.
          </li>
          <li>
            <strong>Security.</strong> Encryption at rest (AES-256-GCM) and in
            transit (TLS 1.2+), per-workspace row-level isolation, and the named
            subprocessors in our privacy policy, each bound by their own terms.
          </li>
          <li>
            <strong>Breach notification.</strong> Notice to you within the
            windows stated on our{" "}
            <Link className="underline text-clay" href="/security">
              security page
            </Link>
            .
          </li>
          <li>
            <strong>Deletion + return.</strong> Export on demand and hard
            deletion on workspace closure or written request.
          </li>
          <li>
            <strong>Sub-processing + audit.</strong> A current subprocessor list
            and a reasonable audit-cooperation clause.
          </li>
        </ul>
      </Section>

      <Section title="How to request one">
        <p>
          Email{" "}
          <a className="underline text-clay" href="mailto:hello@agentplain.com?subject=DPA%20request">
            hello@agentplain.com
          </a>{" "}
          with your firm name and vertical, or ask your service partner. We send
          our standard DPA for your counsel to review and sign. For firms whose
          obligations need bespoke terms, we scope it as part of a{" "}
          <Link className="underline text-clay" href="/custom">
            Custom engagement
          </Link>
          .
        </p>
        <p className="text-sm text-ink-soft">
          We&rsquo;re honest about scope: agentplain is not currently sold as a
          HIPAA-eligible service, and we don&rsquo;t serve healthcare in our
          ratified verticals. If your data scope falls outside what the DPA
          covers, we&rsquo;ll tell you plainly rather than sign something we
          can&rsquo;t stand behind.
        </p>
      </Section>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule">
      <div className="container-wide py-16 md:py-20">
        <h2 className="max-w-3xl font-display text-2xl leading-snug text-ink md:text-3xl">
          {title}
        </h2>
        <div className="mt-6 max-w-3xl space-y-5 text-base leading-relaxed text-ink-soft md:text-lg">
          {children}
        </div>
      </div>
    </section>
  );
}
