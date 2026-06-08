import type { Metadata } from "next";
import Link from "next/link";
import { alternatesFor } from "@/lib/seo/metadata";
import { PlainoScene } from "@/components/ui/ap";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How agentplain collects, uses, and protects your data — encryption at rest, per-workspace isolation, no resale, no training on your data.",
  alternates: alternatesFor("/privacy"),
};

// Privacy policy. Required for Google OAuth verification + customer trust.
// Written from the architecture actually in production today. Counsel review
// is a follow-up. This page is the public-facing source of truth for what
// agentplain does with customer data.

export default function PrivacyPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          {/* Shared legal-page motif — Plaino guarding a strongbox. Placeholder
              today; one-line swap when the real asset lands. */}
          <PlainoScene name="legal" className="mb-5 h-auto w-16" />
          <p className="eyebrow mb-3">Privacy</p>
          <h1 className="mt-2 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.04]">
            What we collect, why, and how we protect it.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Last updated: June 2, 2026. This policy describes how agentplain
            ("we", "us") handles data from customers and their connected
            systems. Plain language, no surprises. If anything here is unclear,
            email{" "}
            <a className="underline text-clay" href="mailto:hello@agentplain.com">
              hello@agentplain.com
            </a>
            .
          </p>
        </div>
      </section>

      <Section title="What we collect">
        <Body>
          <p>
            agentplain is a service partnership. To do the work we promise, we
            need read access to your operating systems — email (Gmail or
            Microsoft 365), calendar, your file substrate (Google Drive or
            OneDrive), your accounting tool (QuickBooks Online), your CRM, and
            your transaction or document management system depending on
            vertical. You authorize each connection explicitly through the
            integration tile's OAuth flow.
          </p>
          <p>
            Connection scopes are the minimum needed to deliver the value loop
            (read, categorize, coordinate, schedule, draft). We never request
            send-on-your-behalf scopes on email — the fleet drafts into your
            inbox; you send from your own account.
          </p>
          <p>
            We also collect account-level data you give us directly: your name,
            business email, business name, billing details, the vertical you
            picked, and the configuration choices you make in the workspace
            (tone, default hours, scheduling preferences, skill selections).
          </p>
        </Body>
      </Section>

      <Section title="How we use it">
        <Body>
          <p>
            Every piece of data we hold is scoped to a single customer
            workspace. The fleet uses it to do the work you hired us to do:
            categorize inbound, draft replies, propose meeting times, surface
            compliance flags, generate briefings. Each draft lands in your
            approvals queue. Nothing sends outbound on your behalf — your
            existing email, calendar, and CRM execute every send from your own
            account.
          </p>
          <p>
            We use connected systems' data to train the fleet on{" "}
            <em>your</em> voice and preferences (which we store as an
            append-only feedback log in your workspace). We do not train any
            base model on your data, do not share your data with any AI model
            provider's training pipeline, and do not pool data across customers.
          </p>
        </Body>
      </Section>

      <Section title="Encryption and isolation">
        <Body>
          <p>
            Customer-facing payloads (approval queue items, handoff log
            entries, the knowledge substrate documents you connect or upload)
            are encrypted at rest using AES-256-GCM with a per-environment key.
            Production secrets are stored only in our hosting provider's
            secrets store (Vercel) and never in source control.
          </p>
          <p>
            Database rows carry a <code>workspace_id</code> column enforced by
            row-level security policies — queries are constrained at the
            database layer so a leaked query helper cannot return another
            customer's data. The same isolation extends to vector embeddings:
            every chunk in the knowledge substrate is workspace-scoped.
          </p>
          <p>
            OAuth tokens for your connected systems live encrypted alongside
            the rest of your workspace state. Token refresh happens
            server-side; tokens never leave our infrastructure.
          </p>
        </Body>
      </Section>

      <Section title="Subprocessors">
        <Body>
          <p>
            We use a small set of named subprocessors. Each is contractually
            bound by their own data-processing terms; we are responsible for
            our choice of them and for the configuration of our use.
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>Anthropic</strong> — model inference. On the no-training
              API tier; your data is not used to train models. Customer data
              passes through model context only for the duration of an
              inference call.
            </li>
            <li>
              <strong>Neon</strong> — Postgres database hosting. Encrypted at
              rest + in transit; daily backups.
            </li>
            <li>
              <strong>Vercel</strong> — application hosting + edge network.
            </li>
            <li>
              <strong>Stripe</strong> — payment processing. We never see or
              store full card numbers; Stripe holds the payment method, we
              hold a customer ID + last-four.
            </li>
            <li>
              <strong>Resend</strong> — transactional email (sign-in links,
              billing receipts, support replies).
            </li>
            <li>
              <strong>Sentry</strong> — error monitoring. PII scrubbed at the
              edge before events leave our infrastructure.
            </li>
            <li>
              <strong>Inngest</strong> — event + cron orchestration. Receives
              event payloads but not OAuth tokens or full document bodies.
            </li>
          </ul>
        </Body>
      </Section>

      <Section title="Your rights">
        <Body>
          <p>
            You can export your workspace data and close the workspace from
            inside the product at any time. Workspace closure triggers a 7-day
            soft-delete grace window during which you can restore; after that,
            customer-facing rows are hard-deleted from our primary database.
            Backups retain encrypted snapshots for an additional 30 days for
            disaster recovery; we do not restore from backups except to
            recover from a service-affecting incident, and we never read
            backup contents.
          </p>
          <p>
            If you have a deletion request that's broader than the in-product
            controls, or any other data-subject question, email{" "}
            <a className="underline text-clay" href="mailto:hello@agentplain.com">
              hello@agentplain.com
            </a>{" "}
            and we'll handle it in writing.
          </p>
        </Body>
      </Section>

      <Section title="Liability boundaries">
        <Body>
          <p>
            agentplain is not a licensed broker, lender, carrier, attorney,
            CPA, RIA, or any other regulated party in the verticals we serve.
            Liability for licensed activities — broker-of-record decisions,
            tax filings, legal advice, fiduciary recommendations, insurance
            placements — stays with you and your firm. Every customer-facing
            output is drafted, queued for your review, and sent (if at all) by
            you from your own systems.
          </p>
        </Body>
      </Section>

      <Section title="Changes to this policy">
        <Body>
          <p>
            Material changes are announced by email to your workspace owner at
            least 30 days before they take effect. The latest version always
            lives at this URL.
          </p>
          <p className="text-sm text-ink-soft">
            Contact:{" "}
            <a className="underline text-clay" href="mailto:hello@agentplain.com">
              hello@agentplain.com
            </a>
            . Or read our{" "}
            <Link className="underline text-clay" href="/terms">
              terms
            </Link>{" "}
            and{" "}
            <Link className="underline text-clay" href="/security">
              security
            </Link>{" "}
            pages.
          </p>
        </Body>
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

function Body({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
