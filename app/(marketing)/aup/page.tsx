import type { Metadata } from "next";
import Link from "next/link";
import { alternatesFor } from "@/lib/seo/metadata";
import { PlainoScene } from "@/components/ui/ap";

export const metadata: Metadata = {
  title: "Acceptable use policy",
  description:
    "What's allowed and what isn't on agentplain — rate limits, no prompt extraction, no scraping, no reselling capacity, no reverse engineering.",
  alternates: alternatesFor("/aup"),
};

// Acceptable Use Policy. Customer-facing, plain language. Companion to /terms
// (the AUP is incorporated by reference there). Counsel review is a follow-up
// before public exposure — see docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md.
// Drafted to describe behaviour we actually enforce via lib/abuse/* (detection)
// and lib/abuse/suspend.ts (consequence), so the policy and the code agree.

export default function AcceptableUsePage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          {/* Shared legal-page motif — Plaino guarding a strongbox. Placeholder
              today; one-line swap when the real asset lands. */}
          <PlainoScene name="legal" className="mb-5 h-auto w-16" />
          <p className="eyebrow mb-3">Acceptable use</p>
          <h1 className="mt-2 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.04]">
            How agentplain may, and may not, be used.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Last updated: June 17, 2026. This policy is part of our{" "}
            <Link className="underline text-clay" href="/terms">
              terms of service
            </Link>
            . It keeps the service fast, fair, and trustworthy for every local
            business that depends on it. Questions:{" "}
            <a className="underline text-clay" href="mailto:hello@agentplain.com">
              hello@agentplain.com
            </a>
            .
          </p>
        </div>
      </section>

      <Section title="The short version">
        <p>
          Use agentplain to run your business. Don&rsquo;t use it to attack the
          service, copy how it works, harvest what&rsquo;s in it, or resell it.
          The rules below spell that out. We enforce them with automated
          detection and, where needed, account suspension — always with a notice
          to you and a way to appeal first.
        </p>
      </Section>

      <Section title="Fair-use rate limits">
        <p>
          Every account operates within per-account rate limits on requests,
          chat volume, connector reads, and model usage. The limits are sized
          generously for real business use and exist to keep one account from
          degrading the service for everyone else.
        </p>
        <p>
          If you have a legitimate high-volume need, tell us — we&rsquo;ll size
          a plan for it. What&rsquo;s not allowed is engineering traffic
          specifically to find or exceed those limits (load generation, burst
          flooding, automated hammering of a single endpoint).
        </p>
      </Section>

      <Section title="No extraction of our prompts or logic">
        <p>
          You agree not to attempt to extract, reconstruct, or reverse-engineer
          agentplain&rsquo;s system prompts, skill definitions, vertical
          playbooks, insight library, or the internal orchestration logic that
          drives Plaino. This includes prompts engineered to make Plaino reveal
          its instructions verbatim, &ldquo;ignore previous instructions&rdquo;
          and jailbreak attempts, and systematic probing designed to map how the
          fleet decides and routes work.
        </p>
        <p>
          Plaino is built to do your work, not to disclose how it is built. Our
          configuration — the curated vertical knowledge, the playbook logic,
          the persona — is our intellectual property and the result of
          substantial investment.
        </p>
      </Section>

      <Section title="No scraping of our content">
        <p>
          You agree not to use automated means (headless browsers, crawlers,
          scripts, scraping services) to harvest agentplain&rsquo;s marketplace,
          knowledge corpora, product copy, or any other content from the
          marketing site or the product. Normal use of the product through its
          interface is fine; bulk automated extraction of what we&rsquo;ve
          curated is not.
        </p>
      </Section>

      <Section title="No identity probing or capacity abuse">
        <p>
          You agree not to run high-volume identity tests, credential-stuffing,
          or systematic probing against sign-in, sign-up, or any authentication
          surface; and not to flood the service with high-frequency identical
          queries intended to fingerprint, benchmark, or stress the underlying
          models rather than to do your own work.
        </p>
        <p>
          You also agree not to abuse free trials — creating accounts to consume
          trial capacity, cancelling, and repeating under new identities is a
          violation, whether done manually or with automation.
        </p>
      </Section>

      <Section title="No reselling or repackaging the service">
        <p>
          Your subscription is for your own business&rsquo;s use. You agree not
          to resell, sublicense, or repackage agentplain capacity to third
          parties; not to operate it as a service bureau on others&rsquo;
          behalf; and not to recreate agentplain&rsquo;s orchestration model or
          vertical knowledge curation inside a competing product.
        </p>
      </Section>

      <Section title="No reverse engineering of the agent">
        <p>
          You agree not to decompile, disassemble, or otherwise attempt to
          derive the source code, model weights, or internal architecture of
          agentplain or Plaino, except to the limited extent that applicable law
          expressly permits despite this restriction.
        </p>
      </Section>

      <Section title="General prohibited uses">
        <p>
          You also agree not to use agentplain to break the law in your
          vertical; to send communications that violate CAN-SPAM, the TCPA,
          GDPR, or similar laws; to misrepresent yourself to recipients of
          drafts; to attempt to access another customer&rsquo;s data; or to
          probe, scan, or test the vulnerability of our systems without our
          written authorization.
        </p>
      </Section>

      <Section title="How we enforce this">
        <p>
          We monitor access patterns for abuse — and for nothing else. (We do
          not use your activity to train models; see our{" "}
          <Link className="underline text-clay" href="/privacy">
            privacy policy
          </Link>
          .) When our systems detect a likely violation, we may soft-suspend the
          account: the workspace drops to read-only, we email the account owner
          with the reason, and a review window opens during which you can
          appeal. Your data stays intact and exportable the entire time.
        </p>
        <p>
          If a violation is confirmed, we may fully suspend the account. Even
          then your data is preserved per the retention terms in our{" "}
          <Link className="underline text-clay" href="/terms">
            terms of service
          </Link>
          , and you can still request an export. We aim to be proportionate: a
          first, accidental trip of a rule gets a notice, not a ban.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          Material changes are announced by email to your workspace owner at
          least 30 days before they take effect. The latest version always lives
          at this URL.
        </p>
        <p className="text-sm text-ink-soft">
          Contact:{" "}
          <a className="underline text-clay" href="mailto:hello@agentplain.com">
            hello@agentplain.com
          </a>
          . See also our{" "}
          <Link className="underline text-clay" href="/terms">
            terms
          </Link>
          ,{" "}
          <Link className="underline text-clay" href="/privacy">
            privacy
          </Link>
          , and{" "}
          <Link className="underline text-clay" href="/security">
            security
          </Link>{" "}
          pages.
        </p>
      </Section>
    </>
  );
}

// Legal-page section — mirrors the shared structure used on /terms and
// /privacy so the three pages read as one family.
function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule">
      <div className="container-wide py-16 md:py-20">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
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
