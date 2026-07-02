import type { Metadata } from "next";
import Link from "next/link";
import { alternatesFor } from "@/lib/seo/metadata";
import { PlainoScene } from "@/components/ui/ap";

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
          {/* Shared legal-page motif — Plaino guarding a strongbox. Placeholder
              today; one-line swap when the real asset lands. */}
          <PlainoScene name="legal" className="mb-5 h-auto w-16" />
          <p className="eyebrow mb-3">Terms of service</p>
          <h1 className="mt-2 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.04]">
            The agreement between us.
          </h1>
          <p className="dateline mt-6">Last updated: June 17, 2026</p>
          <p className="mt-8 max-w-prose text-lg leading-relaxed text-ink-soft md:text-xl">
            By using agentplain you agree to these
            terms and to our{" "}
            <Link className="underline text-clay" href="/aup">
              acceptable use policy
            </Link>
            . Plain language, no surprises. Questions:{" "}
            <a className="underline text-clay" href="mailto:hello@agentplain.com">
              hello@agentplain.com
            </a>
            .
          </p>
        </div>
      </section>

      <Section title="What we provide" label="§ 01">
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

      <Section title="Payment + cancellation" label="§ 02">
        <p>
          Subscription tiers are billed per seat, monthly in advance, via the
          payment method on file. Regular and Partner include a free trial — 7
          days by default, 14 days for the CPA and Law verticals; your card is
          captured at signup and the first charge occurs when the trial ends
          unless you cancel. A 14-day money-back guarantee applies from the
          date of first charge.
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

      <Section title="Your data is yours" label="§ 03">
        <p>
          You own every input you provide and every output the fleet drafts on
          your behalf — including your clients&rsquo; information that flows
          through your connected systems. We hold it to deliver the service; we
          do not acquire any ownership of it. You can export a full copy or
          delete all of it at any time from the{" "}
          <span className="font-medium">Your data</span> page inside your
          workspace.
        </p>
        <p>
          <strong>No training, no feedback loop.</strong> We do not train,
          fine-tune, or improve any model on your data. We do not feed your
          chats with Plaino or the records your connectors expose into any
          training pipeline, our own or a provider&rsquo;s. Our AI model
          provider&rsquo;s commercial API does not train on inputs or outputs by
          default. We do not pool data across customers and do not resell or
          share your data, except with the named subprocessors needed to operate
          the service (listed in our{" "}
          <Link className="underline text-clay" href="/privacy">
            privacy policy
          </Link>
          ).
        </p>
        <p>
          <strong>Data residency.</strong> Your workspace data is stored in a
          managed Postgres database in the United States, encrypted at rest
          (AES-256-GCM) and in transit. We will not move your data to another
          region, or change this commitment, without notifying you first. We do
          not currently offer EU data residency or self-hosting; we will not
          claim either until we can actually deliver it.
        </p>
        <p>
          You can export your workspace and close your account at any time from
          inside the product. Closure triggers a 7-day soft-delete window;
          after that, your data is hard-deleted from our primary database.
          Encrypted backups roll off within 30 days.
        </p>
      </Section>

      <Section title="Our intellectual property" label="§ 04">
        <p>
          The agentplain platform — its codebase, the vertical playbook logic,
          the system prompts and skill definitions, the curated knowledge
          corpora, the insight library, the orchestration runtime, and the
          Plaino persona and brand — is our intellectual property and the
          product of substantial investment. Your subscription grants you the
          right to <em>use</em> the service, not the right to copy how it works.
        </p>
        <p>You agree not to:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            reverse-engineer, decompile, or attempt to derive our system
            prompts, skill definitions, model weights, or internal
            architecture;
          </li>
          <li>
            use automated prompts or any other means to extract Plaino&rsquo;s
            internal logic, instructions, or orchestration behaviour through the
            chat interface;
          </li>
          <li>
            recreate agentplain&rsquo;s orchestration model, or copy our vertical
            knowledge curation, inside a competing product or service; or
          </li>
          <li>
            scrape or bulk-harvest our marketplace, knowledge corpora, or
            product copy.
          </li>
        </ul>
        <p>
          These restrictions are detailed in our{" "}
          <Link className="underline text-clay" href="/aup">
            acceptable use policy
          </Link>
          , which forms part of these terms.
        </p>
      </Section>

      <Section title="What we are not responsible for" label="§ 05">
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

      <Section title="Acceptable use" label="§ 06">
        <p>
          You agree not to use agentplain to send unsolicited commercial
          communications in violation of CAN-SPAM, TCPA, GDPR, or any other
          applicable law; to misrepresent yourself or your firm to recipients
          of drafts; or to attempt to extract another customer&rsquo;s data via
          the knowledge substrate or workspace. Our full{" "}
          <Link className="underline text-clay" href="/aup">
            acceptable use policy
          </Link>{" "}
          lists the prohibited uses in detail and forms part of these terms.
        </p>
        <p>
          <strong>Rate limits.</strong> Your account operates within
          per-account rate limits on requests, chat volume, connector reads, and
          model usage. They are sized for genuine business use; engineering
          traffic to find or exceed them is a violation.
        </p>
        <p>
          You agree to maintain your own licensure, insurance, and regulatory
          posture in your vertical and to keep the workspace configuration
          (default hours, compliance gates, escalation rules) accurate to the
          way your firm actually operates.
        </p>
      </Section>

      <Section title="Suspension + termination for violations" label="§ 07">
        <p>
          We monitor access patterns for abuse and policy violations. When our
          systems detect a likely violation of these terms or the acceptable use
          policy, we may <strong>soft-suspend</strong> the account — the
          workspace drops to read-only — and email the account owner with the
          reason and a review window during which you can appeal. Your data
          stays intact and exportable throughout.
        </p>
        <p>
          If a violation is confirmed, we may suspend or terminate the account.
          Even then, your data is preserved per the retention terms above and
          remains exportable on request. We aim to be proportionate — an
          accidental first trip of a rule gets a notice, not a ban — but
          deliberate or repeated abuse (prompt extraction, scraping, capacity
          reselling, trial farming, reverse engineering) may result in immediate
          termination.
        </p>
      </Section>

      <Section title="Changes to these terms" label="§ 08">
        <p>
          Material changes are announced by email to your workspace owner at
          least 30 days before they take effect. Continued use after the
          effective date constitutes acceptance. If you disagree with a change,
          cancel from the billing page before it takes effect.
        </p>
      </Section>

      <Section title="Governing law" label="§ 09">
        <p>
          These terms are governed by the laws of the State of Georgia, United
          States, without regard to conflict-of-law provisions. Any dispute
          arising under these terms is resolved exclusively in the state or
          federal courts located in Fulton County, Georgia.
        </p>
        <p className="font-mono text-[12px] text-mute">
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

// Legal-page section. The eyebrow used to repeat `title` verbatim (eyebrow and
// h2 rendered the same string) — a redundant double-heading. The page-category
// label ("Terms of service") already lives in the hero eyebrow, so each section
// heading is now a single, clear h2. Pass `eyebrow` only when a section
// genuinely wants a distinct category label above its title. (Wave A3, 2026-06-11.)
function Section({
  title,
  eyebrow,
  label,
  children,
}: {
  title: string;
  eyebrow?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule">
      <div className="container-wide py-16 md:py-20">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        {label && <p className="figure-caption mb-2">{label}</p>}
        <h2 className="max-w-prose font-display text-2xl leading-snug text-ink md:text-3xl">
          {title}
        </h2>
        <div className="mt-6 max-w-prose space-y-5 text-base leading-relaxed text-ink-soft md:text-lg">
          {children}
        </div>
      </div>
    </section>
  );
}
