import type { Metadata } from "next";
import Link from "next/link";
import { alternatesFor } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "Terms for agentplain — service-partnership scope, payment, cancellation, liability boundaries, and governing law.",
  alternates: alternatesFor("/terms"),
};

// Terms of service. Plain-language, customer-facing. Not legal advice. Counsel
// review is a follow-up. Mirrors the substantive commitments already made on
// /about, /pricing, and /privacy.

export default function TermsPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-3">Terms of service</p>
          <h1 className="mt-2 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.04]">
            The agreement between us.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Last updated: June 2, 2026. By using agentplain you agree to these
            terms. Plain language, no surprises. Questions:{" "}
            <a className="underline text-clay" href="mailto:hello@agentplain.com">
              hello@agentplain.com
            </a>
            .
          </p>
        </div>
      </section>

      <Section title="What we provide">
        <p>
          agentplain is a service partnership. We install a fleet of AI agents
          inside the workspace we host, configure it for your vertical, run
          monthly (Regular) or weekly (Partner) reviews, and customize as your
          operations shift. Quoted-scope engagements (Max, /custom) are scoped
          per customer in a separate written agreement.
        </p>
        <p>
          The fleet reads from systems you connect (email, calendar, file
          store, CRM, accounting, vertical-specific tools), categorizes
          inbound, drafts replies, proposes scheduling, surfaces compliance
          flags, and queues every customer-facing output in your approval
          queue. The fleet never sends outbound on your behalf — your existing
          tools execute every send from your own account.
        </p>
      </Section>

      <Section title="Payment + cancellation">
        <p>
          Subscription tiers are billed per seat, monthly in advance, via the
          payment method on file. First month is free across Regular and
          Partner; your card is captured at signup and charged at the start of
          your second month unless you cancel.
        </p>
        <p>
          You can cancel any time from the billing page in your workspace. We
          do not pro-rate mid-cycle refunds. Annual prepayment discounts are
          available on request and are subject to a separate written
          agreement.
        </p>
        <p>
          Failed payments enter a 7-day grace period during which the fleet
          continues operating; after grace, the workspace pauses (no new
          drafts, dashboards become read-only) until payment resumes. We
          notify the workspace owner by email at each step.
        </p>
      </Section>

      <Section title="Your data + our use of it">
        <p>
          You retain ownership of every input you provide and every output the
          fleet drafts on your behalf. Our use of your data is scoped to
          delivering the service to you and is described in our{" "}
          <Link className="underline text-clay" href="/privacy">
            privacy policy
          </Link>
          . We do not train models on your data, do not pool data across
          customers, and do not resell or share your data with third parties
          except as needed to operate the service (named subprocessors in the
          privacy policy).
        </p>
        <p>
          You can export your workspace and close your account at any time
          from inside the product. Closure triggers a 7-day soft-delete
          window; after that, your data is hard-deleted from our primary
          database. Encrypted backups roll off within 30 days.
        </p>
      </Section>

      <Section title="What we are not responsible for">
        <p>
          We are not a licensed broker, lender, carrier, attorney, CPA, RIA,
          or any other regulated party in the verticals we serve. Liability
          for licensed activities — broker-of-record decisions, tax filings,
          legal advice, fiduciary recommendations, insurance placements — stays
          with you and your firm. Every customer-facing output is drafted,
          queued for your review, and (if at all) sent by you from your own
          systems.
        </p>
        <p>
          We are not responsible for your connected systems' availability or
          for downstream effects of decisions you make based on the fleet's
          drafts. We are responsible for the accuracy of our own architecture
          claims, our compliance corpora's regulatory citations (clearly
          labeled as draft vs. counsel-reviewed inside the product), and the
          security posture described in our{" "}
          <Link className="underline text-clay" href="/security">
            security page
          </Link>
          .
        </p>
        <p>
          Aggregate liability for any claim arising under these terms is
          limited to the amount you paid us in the 12 months preceding the
          claim.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          You agree not to use agentplain to send unsolicited commercial
          communications in violation of CAN-SPAM, TCPA, GDPR, or any other
          applicable law; to misrepresent yourself or your firm to recipients
          of drafts; or to attempt to extract another customer's data via the
          knowledge substrate or workspace.
        </p>
        <p>
          You agree to maintain your own licensure, insurance, and regulatory
          posture in your vertical and to keep the workspace configuration
          (default hours, compliance gates, escalation rules) accurate to the
          way your firm actually operates.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          Material changes are announced by email to your workspace owner at
          least 30 days before they take effect. Continued use after the
          effective date constitutes acceptance. If you disagree with a change,
          cancel from the billing page before it takes effect.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These terms are governed by the laws of the State of Georgia, United
          States, without regard to conflict-of-law provisions. Any dispute
          arising under these terms is resolved exclusively in the state or
          federal courts located in Fulton County, Georgia.
        </p>
        <p className="text-sm text-ink-soft">
          Contact:{" "}
          <a className="underline text-clay" href="mailto:hello@agentplain.com">
            hello@agentplain.com
          </a>
          .
        </p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-rule">
      <div className="container-wide py-16 md:py-20">
        <p className="eyebrow mb-3">{title}</p>
        <h2 className="mt-2 max-w-3xl font-display text-2xl leading-snug text-ink md:text-3xl">
          {title}
        </h2>
        <div className="mt-6 max-w-3xl space-y-5 text-base leading-relaxed text-ink-soft md:text-lg">
          {children}
        </div>
      </div>
    </section>
  );
}
