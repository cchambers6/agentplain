import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";

export const metadata: Metadata = {
  title: "Platform — agentplain",
  description:
    "How the agentplain platform works. Catalog agents, custom builds, integrations with the systems your team already uses, and the rails that keep human review on every customer-facing output.",
};

const capabilities = [
  {
    eyebrow: "Capability",
    title: "Catalog agents",
    body: "Each vertical has a catalog of agents pre-trained for the operational jobs that vertical actually has. Realty's catalog is what is in pilot today. Catalog agents come ready to deploy into a workspace with versioned upgrades, audit logs, and rollback.",
    bullets: [
      "Pre-trained on vertical workflows and language",
      "Scoped to one job per agent on purpose",
      "Versioned, auditable, rollback-able",
      "New agents earn their slot by running on real work first",
    ],
  },
  {
    eyebrow: "Capability",
    title: "Custom-built agents",
    body: "Catalogs cannot cover every operation. When your office has work the catalog does not handle, we build a custom agent for it during the engagement. It becomes part of your workspace, not a one-off script.",
    bullets: [
      "Scoped during the kickoff or working sessions",
      "Built by us, reviewed with you, deployed into your workspace",
      "Inherits the same review, audit, and rollback rails",
      "Available on the brokerage tier; the self-serve tier uses catalog only",
    ],
  },
  {
    eyebrow: "Capability",
    title: "Data integrations",
    body: "Agents need to read and write inside the systems where your work actually lives. We integrate adapter-by-adapter — CRMs, MLS feeds, transaction systems, file stores, internal services. The point is to make agents fit your stack, not the other way around.",
    bullets: [
      "Adapter pattern — no single-vendor lock-in",
      "Read-only by default, write access opt-in per integration",
      "Common patterns: CRM read/write, MLS export, document ingestion, internal API calls",
      "We will tell you when an integration does not exist yet and what it would take",
    ],
  },
  {
    eyebrow: "Capability",
    title: "Email and inbox integrations",
    body: "Agents draft inside the inboxes your team already runs on. We do not stand up a parallel outbound channel and we do not send on your behalf — drafts land in your existing email so the message goes out from your domain, signed by the right person, on your sender reputation.",
    bullets: [
      "Drafts into your team's existing inboxes",
      "Reads inbound mail when triage is in scope",
      "No outbound from agentplain infrastructure",
      "Approval gate on customer-facing drafts in week one",
    ],
  },
  {
    eyebrow: "Capability",
    title: "Server and workflow integrations",
    body: "When your operation depends on internal services or in-house tools, agents can call them through scoped integrations. We treat your servers like a partner system — credential-isolated, scope-limited, and audit-logged on every call.",
    bullets: [
      "Internal API calls scoped to specific endpoints",
      "Workflow automation that ties agent output back to your systems",
      "Credentials isolated per workspace, never shared across customers",
      "Every call audit-logged for review",
    ],
  },
];

const platformRails = [
  {
    name: "Human review on customer-facing outputs",
    body: "Anything a customer or counterparty sees gets a human approval step in week one. Approval gates loosen as confidence builds — never the other way around without a written change.",
  },
  {
    name: "Workspace isolation by row-level security",
    body: "Every workspace's data is fenced at the database level. Cross-workspace reads are not possible by accident or by request — they are not possible at all without an operator-context pathway that is itself audit-logged.",
  },
  {
    name: "Audit log on every action",
    body: "Every agent action, every approval, every billing event writes to a per-workspace audit log. You can see what happened, when, by which agent, and what input it ran on.",
  },
  {
    name: "Rollback as a first-class action",
    body: "Agent versions are addressable. If a new version of an agent regresses, the workspace owner can pin to the previous version while we ship a fix.",
  },
  {
    name: "Compliance posture per vertical",
    body: "Each vertical has its own compliance configuration — fair-housing language for realty, license-of-record handling, data retention windows. The platform enforces it; the vertical operator sets it.",
  },
  {
    name: "Billing that ties to outcomes, not seats",
    body: "Brokerage tier is a paid scoped engagement with an outcome report. Self-serve tier is a fixed monthly that does not bill per agent or per integration. Pricing should not punish you for using the platform.",
  },
];

export default function PlatformPage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Platform</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            An operating system for agent fleets.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            agentplain is built around five capability surfaces — a catalog of
            pre-trained agents, custom builds, data integrations, email
            integrations, and server integrations — sitting on top of platform
            rails that handle review, audit, rollback, and isolation. The point
            is to take operational work off your plate without asking your
            people to learn a new dashboard.
          </p>
        </div>
      </section>

      {/* CAPABILITIES */}
      {capabilities.map((c, idx) => (
        <Section
          key={c.title}
          tone={idx % 2 === 0 ? "deep" : "paper"}
          eyebrow={c.eyebrow}
          title={c.title}
          intro={c.body}
        >
          <ul className="grid gap-3 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
            {c.bullets.map((b) => (
              <li key={b} className="flex gap-3">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      {/* PLATFORM RAILS */}
      <Section
        eyebrow="Platform rails"
        title="The bits underneath that make the agents safe to run."
        intro="Every agent in the catalog and every custom-built agent inherits the same rails. They are the part of the platform that does not change between verticals."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {platformRails.map((r) => (
            <div key={r.name} className="bg-paper p-7">
              <h3 className="font-display text-xl leading-tight text-ink md:text-2xl">
                {r.name}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {r.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-3xl border-t border-rule pt-6">
          <Link
            href="/trust"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See trust and security in detail →
          </Link>
        </div>
      </Section>

      {/* HOW AN ENGAGEMENT FLOWS */}
      <Section
        tone="deep"
        eyebrow="How an engagement flows"
        title="Scope, build, observe, run, report."
      >
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <Step
            n="01"
            name="Scope"
            body="60-minute call. We map the operations work you want off your plate, name the catalog agents that fit, and identify any custom agents to build."
          />
          <Step
            n="02"
            name="Build"
            body="We deploy the chosen catalog agents into your workspace, wire integrations, and build any custom agents the engagement requires."
          />
          <Step
            n="03"
            name="Observe"
            body="Week one, agents run in shadow — they draft outputs but do not act. You and your team review the drafts and we tune for your house style."
          />
          <Step
            n="04"
            name="Run"
            body="Approved agents go live with human review on customer-facing outputs. Bi-weekly working sessions tighten the loop."
          />
          <Step
            n="05"
            name="Report"
            body="Day-30 outcome report. Tasks handled, leads routed, hours returned. Continuation proposal with a named monthly rate. You decide."
          />
        </ol>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Most of this is easier shown than written.
          </h2>
          <p className="mt-4 max-w-xl text-paper/75">
            If the operating model fits how your office runs, the right next
            step is a 30-minute call. Email goes to a real person.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20platform%20call"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Book a 30-minute call
            </a>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Step({ n, name, body }: { n: string; name: string; body: string }) {
  return (
    <li className="border border-rule bg-paper p-6">
      <p className="font-mono text-[11px] tracking-eyebrow text-signal">{n}</p>
      <h3 className="mt-3 font-display text-xl leading-tight text-ink">
        {name}
      </h3>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{body}</p>
    </li>
  );
}
