import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How agentplain protects customer data — encryption at rest, workspace isolation, OAuth scope minimization, audit logs, and incident response.",
};

// Security page. Architecture-grounded — every claim here matches what's
// actually in production (encryption envelope, RLS, OAuth scope, etc.).
// Counsel review is a follow-up. Used in OAuth verification packets +
// customer trust pages.

export default function SecurityPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-3">Security</p>
          <h1 className="mt-2 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.04]">
            How we protect your data.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Last updated: June 2, 2026. Architecture-grounded — every claim
            here maps to a real piece of production code. Questions or
            incident reports:{" "}
            <a className="underline text-clay" href="mailto:hello@agentplain.com">
              hello@agentplain.com
            </a>
            .
          </p>
        </div>
      </section>

      <Section title="Encryption at rest">
        <p>
          Customer-facing payloads — approval queue items, handoff log
          entries, the knowledge substrate documents you connect or upload,
          OAuth tokens for your connected systems — are encrypted at rest using
          AES-256-GCM with a per-environment key stored only in our hosting
          provider's secrets store (Vercel). Vector embeddings are stored
          plaintext because they're not directly reversible to source text,
          but each chunk carries a workspace_id that gates retrieval.
        </p>
        <p>
          The encryption key is rotated per environment (Production, Preview,
          Development). Losing the production key would render stored OAuth
          tokens unreadable but would not expose data — we treat key
          rotation as a controlled migration, not an emergency restore.
        </p>
      </Section>

      <Section title="Encryption in transit">
        <p>
          All inbound and outbound network traffic uses TLS 1.2 or higher.
          The marketing site, the customer-facing app, the API, and every
          subprocessor connection (Anthropic, Neon, Stripe, Resend, Sentry,
          Inngest, Vercel) require TLS — non-TLS connections are rejected at
          the edge.
        </p>
      </Section>

      <Section title="Workspace isolation">
        <p>
          Every database row in our primary store carries a{" "}
          <code>workspace_id</code> column enforced by row-level security
          policies in Postgres. A query that omits the workspace filter
          returns zero rows regardless of how it's constructed — the
          database enforces tenant isolation, not the application layer.
        </p>
        <p>
          The same isolation extends to vector embeddings in the knowledge
          substrate: every retrieval call is scoped by workspace_id at the
          query level, and chunks from one workspace cannot surface in
          another's answers even if a prompt would otherwise match.
        </p>
      </Section>

      <Section title="OAuth scope minimization">
        <p>
          We request the minimum OAuth scopes needed to deliver the value
          loop. For email connections (Gmail, Microsoft 365), we ask for
          read-and-draft scopes only — we never request send-on-your-behalf
          scopes. The fleet drafts into your inbox; you send from your own
          account.
        </p>
        <p>
          For file stores (Google Drive, OneDrive), we request the narrowest
          read scope that lets the fleet ingest the folder you point us at.
          We never request write scopes for files we don't author. For
          accounting (QuickBooks Online), we request read-only scopes for
          reconciliation; we never initiate journal entries or transfers.
        </p>
        <p>
          You can revoke any OAuth grant at any time from your connected
          system's app dashboard or from inside the agentplain workspace —
          revocation takes effect immediately and the fleet ceases reading
          that source on the next cron fire.
        </p>
      </Section>

      <Section title="Audit logs">
        <p>
          Every agent action — every draft, every flag, every handoff, every
          configuration change — writes an append-only row to the workspace's
          handoff log. The log is visible to the workspace owner inside the
          product and is retained for the life of the workspace. Append-only
          means no agent and no admin can rewrite history; corrections happen
          as new rows that reference the original.
        </p>
        <p>
          Customer-facing outputs (every queued draft, every approved send,
          every rejected draft) carry full provenance — which skill drafted
          it, which connectors it pulled context from, which compliance gates
          it passed through. This is the "open feedback loop" we describe on
          the marketing site.
        </p>
      </Section>

      <Section title="Credential handling">
        <p>
          Production secrets — database connection strings, OAuth client
          secrets, the encryption key, the model API key, the Stripe key —
          live only in our hosting provider's encrypted environment store
          (Vercel). They are never committed to source control, never logged,
          and never returned in API responses or error traces.
        </p>
        <p>
          Internal access to the production environment is limited to the
          workspace owner (Conner Chambers) and is gated behind multi-factor
          authentication on the Vercel account. There is no shared admin
          account; engineering changes are deployed through Git, not through
          dashboard edits.
        </p>
      </Section>

      <Section title="Subprocessor security">
        <p>
          We use the named subprocessors listed in our{" "}
          <Link className="underline text-clay" href="/privacy">
            privacy policy
          </Link>
          . Each is selected and configured to match the security posture
          described here: TLS in transit, encryption at rest, no-training on
          customer data (Anthropic), PII scrubbing before transmission
          (Sentry).
        </p>
      </Section>

      <Section title="Incident response">
        <p>
          If we detect or are notified of a security incident affecting
          customer data, we will: (1) contain the incident within 24 hours of
          confirmed detection; (2) notify affected workspace owners by email
          within 72 hours of confirming the scope; (3) publish a post-mortem
          with root cause, timeline, and remediation steps. Notification
          windows compress for incidents we judge to warrant immediate
          disclosure regardless of investigation status.
        </p>
        <p>
          Report a suspected vulnerability or incident to{" "}
          <a className="underline text-clay" href="mailto:hello@agentplain.com">
            hello@agentplain.com
          </a>
          . We respond within one business day to vulnerability reports and
          do not pursue legal action against good-faith security research.
        </p>
      </Section>

      <Section title="Backups + disaster recovery">
        <p>
          The primary Postgres database is backed up daily with point-in-time
          recovery enabled. Backups are encrypted at rest and rolled off
          after 30 days. We do not restore from backups except to recover
          from a service-affecting incident, and we never read backup
          contents in the course of normal operations.
        </p>
        <p className="text-sm text-ink-soft">
          See also our{" "}
          <Link className="underline text-clay" href="/privacy">
            privacy policy
          </Link>{" "}
          and{" "}
          <Link className="underline text-clay" href="/terms">
            terms of service
          </Link>
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
