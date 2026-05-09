import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";

export const metadata: Metadata = {
  title: "Trust and security — agentplain",
  description:
    "How agentplain handles your data — workspace isolation by row-level security, encrypted secrets, audit logs on every action, human approval on customer-facing outputs, and where we are honest about what we have not yet certified.",
};

const controls = [
  {
    name: "Workspace isolation",
    body: "Every workspace's data is fenced at the database level by Postgres row-level security. Cross-workspace reads cannot happen by accident — they cannot happen by request either, except through an operator-context pathway that is itself audit-logged.",
  },
  {
    name: "Encrypted secrets at rest",
    body: "Integration credentials and webhook secrets are encrypted at rest before they ever touch our database. Decryption only happens inside the request that needs them, in memory.",
  },
  {
    name: "Per-workspace audit log",
    body: "Every agent action, every approval, every billing event writes to a per-workspace audit log. You can see what happened, when, by which agent, and what input it ran on. The log is append-only.",
  },
  {
    name: "Human approval on customer-facing outputs",
    body: "Anything that goes to a customer or counterparty gets a human approval step in week one of every engagement. Approval gates loosen only by written change.",
  },
  {
    name: "Read-only by default",
    body: "Integrations connect read-only. Write access is opt-in per integration and per agent. We will not silently upgrade scope on you.",
  },
  {
    name: "No outbound on your behalf",
    body: "Agents draft into your existing inbox and CRM. They do not send email or SMS from agentplain infrastructure. Your domain, your sender reputation, your records.",
  },
  {
    name: "Versioned agents and rollback",
    body: "Agent versions are addressable. If a new version regresses, the workspace owner can pin to the previous version while we ship a fix. No silent in-place updates of agents that have already shipped to a workspace.",
  },
  {
    name: "Customer data not used for training",
    body: "Customer data — client lists, transaction records, message bodies — is not retained as training data. We use it to do the task and return the result.",
  },
];

const honestNotes = [
  {
    name: "SOC 2",
    body: "We have not certified SOC 2 yet. The internal controls map to the criteria, but a formal report has not been issued. We will publish the audit timeline here when one is on the calendar — not before.",
  },
  {
    name: "Penetration testing",
    body: "We run internal security review on every release and will commission an external pen test before scaling beyond the design-partner cohort. Reports will be available under NDA when they exist.",
  },
  {
    name: "Subprocessors",
    body: "We rely on a small set of subprocessors — model provider, hosting, transactional email, payments. The list is short on purpose. We will publish a formal subprocessor list before onboarding the first customer outside the design-partner cohort.",
  },
  {
    name: "Compliance jurisdictions",
    body: "Realty pilots are scoped to U.S. jurisdictions today. International engagements are not in scope until we have explicit data-residency rails. We will tell you up front when a request is out of scope.",
  },
];

export default function TrustPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Trust and security</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            How we handle your data.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            The short version: customer data stays in your stack, workspaces
            are isolated by row-level security in our database, integration
            credentials are encrypted, every action is audit-logged, and
            humans approve customer-facing outputs. The longer version is on
            this page, including the parts we have not yet formally
            certified.
          </p>
        </div>
      </section>

      {/* CONTROLS */}
      <Section
        eyebrow="Controls in place today"
        title="What is built into the platform now."
        intro="These are not roadmap items. Each is implemented in the platform we are running pilots on."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          {controls.map((c) => (
            <div key={c.name} className="bg-paper p-7">
              <h3 className="font-display text-xl leading-tight text-ink md:text-2xl">
                {c.name}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* HONEST NOTES */}
      <Section
        tone="deep"
        eyebrow="What we have not yet certified"
        title="Where we are honest about state."
        intro="A startup running pilots is not the same as an audited enterprise vendor. We will not pretend otherwise. These are the items where the right answer is to publish a date when one exists, not a vague promise."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          {honestNotes.map((n) => (
            <div key={n.name} className="bg-paper p-7">
              <p className="font-mono text-[11px] tracking-eyebrow text-slate-soft">
                Honest note
              </p>
              <h3 className="mt-3 font-display text-xl leading-tight text-ink md:text-2xl">
                {n.name}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {n.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* DATA POSTURE */}
      <Section
        eyebrow="Your data posture, plainly"
        title="What we do with the data we touch."
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl text-ink">We do</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— Read what your selected agents need to do their job</li>
              <li>— Write back the result to your systems with audit logs</li>
              <li>— Encrypt integration credentials at rest</li>
              <li>— Isolate every workspace at the database level</li>
              <li>— Log every action for your review</li>
              <li>— Delete workspace data on request</li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-2xl text-ink">We do not</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— Train on your customer data</li>
              <li>— Resell client lists</li>
              <li>— Send email or SMS from our infrastructure on your behalf</li>
              <li>— Hold listings, represent buyers or sellers, or carry your license</li>
              <li>— Share workspace data across customers</li>
              <li>— Auto-upgrade integration scopes silently</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Need a deeper security review?
          </h2>
          <p className="mt-4 max-w-xl text-paper/75">
            For pilot conversations we are happy to walk through the
            architecture in detail. Email goes to a real person.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20security%20review"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Request a security review
            </a>
            <Link
              href="/platform"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              How the platform works
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
