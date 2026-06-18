import type { Metadata } from "next";
import Link from "next/link";
import { alternatesFor } from "@/lib/seo/metadata";
import { PlainoScene } from "@/components/ui/ap";
import {
  DATA_COMMITMENTS,
  WHAT_WE_STORE,
  WHAT_WE_DONT_STORE,
  DATA_RIGHTS,
  DATA_STANCE_TAGLINE,
} from "@/lib/marketing/data-commitments";

export const metadata: Metadata = {
  title: "Your data",
  description:
    "Your data stays yours. agentplain processes what a task needs and hands you a draft — we don't hoard your inbox, CRM, or files. Exactly what we store, why, and how to take it back or delete it.",
  alternates: alternatesFor("/data"),
};

// /data — the comprehensive, customer-facing explanation of how agentplain
// treats data. Marketing-toned counterpart to the architecture-grounded
// /privacy + /security pages. Every claim is sourced from
// `lib/marketing/data-commitments.ts`, which is itself grounded in production
// architecture (see that file's header). No model vendor is named here per the
// customer-surface rule — the vendor appears only in the /privacy subprocessor
// list.

export default function DataPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <PlainoScene name="legal" className="mb-5 h-auto w-16" />
          <p className="eyebrow mb-3">Your data</p>
          <h1 className="mt-2 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.04]">
            Your data stays yours.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            {DATA_STANCE_TAGLINE} The fleet reads what a task needs, does the
            work, and hands you a draft — it doesn&rsquo;t copy your business
            onto our servers and keep it. Here&rsquo;s exactly what that means,
            in plain language.
          </p>
          <div className="mt-8 flex flex-wrap gap-4 text-[13px]">
            <Link href="/privacy" className="text-ink underline underline-offset-2">
              Privacy policy →
            </Link>
            <Link href="/security" className="text-ink underline underline-offset-2">
              Security architecture →
            </Link>
            <Link href="/dpa" className="text-ink underline underline-offset-2">
              Data Processing Agreement →
            </Link>
          </div>
        </div>
      </section>

      {/* The commitments. */}
      <Section title="The commitment, in five lines">
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {DATA_COMMITMENTS.map((c) => (
            <div key={c.key} className="flex flex-col bg-paper p-6 md:p-7">
              <p className="font-display text-lg leading-snug text-ink md:text-xl">
                {c.title}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* What we store — the honest core. */}
      <Section
        title="What we store — and why"
        intro="We don't say &ldquo;we store nothing&rdquo; — that wouldn't be true, and a vendor that claimed it would be hiding something. We store specific things for specific reasons, and here is every one of them. All of it is encrypted at rest and walled off to your workspace alone."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule">
          {WHAT_WE_STORE.map((item) => (
            <div
              key={item.what}
              className="grid gap-2 bg-paper p-5 md:grid-cols-[1fr_2fr] md:gap-6 md:p-6"
            >
              <p className="font-display text-base leading-snug text-ink md:text-lg">
                {item.what}
              </p>
              <p className="text-[14px] leading-relaxed text-ink-soft">
                {item.why}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* What we don't store. */}
      <Section
        title="What we don't store"
        intro="The flip side. These are the things a do-it-yourself stack scatters across five tools, or a data-hungry vendor would quietly keep. We don't."
      >
        <ul className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          {WHAT_WE_DONT_STORE.map((line) => (
            <li
              key={line}
              className="flex gap-3 bg-paper p-5 text-[14px] leading-relaxed text-ink-soft md:p-6"
            >
              <span aria-hidden className="mt-0.5 font-mono text-mute">
                ✗
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* How it flows. */}
      <Section
        title="How your data flows"
        intro="Every connector follows the same shape: your system in, a draft out, your queue in the middle. The data passes through the fleet in flight; what stays behind is the draft and the audit log — not a copy of your source system."
      >
        <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
          {[
            "Your connected tool (inbox, CRM, drive, books)",
            "The fleet reads what a task needs, in flight",
            "It drafts the reply, update, or report",
            "Your approvals queue — you send from your own system",
          ].map((step, i, arr) => (
            <li
              key={step}
              className="flex items-center gap-2 md:flex-1"
            >
              <span className="flex flex-1 items-center border border-rule bg-paper-deep px-4 py-3 text-[14px] leading-snug text-ink">
                {step}
              </span>
              {i < arr.length - 1 ? (
                <span aria-hidden className="font-mono text-clay">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-3xl text-[14px] leading-relaxed text-ink-soft">
          When you connect a tool, the connect screen shows you the exact
          version of this for that connector — what flows where, what we store,
          and what we don&rsquo;t — before you grant anything. The one place the
          fleet keeps a copy on purpose is documents: when you point it at a
          folder of your own playbooks, those files are ingested (encrypted,
          workspace-private) so drafts sound like you. Everything else is read
          on demand.
        </p>
      </Section>

      {/* Rights. */}
      <Section
        title="Your rights — and how to use them today"
        intro="These aren't promises for a roadmap. Each one is a control you can use right now from inside your workspace."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          {DATA_RIGHTS.map((r) => (
            <div key={r.title} className="flex flex-col bg-paper p-6 md:p-7">
              <p className="font-display text-lg leading-snug text-ink">
                {r.title}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                {r.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* For regulated firms. */}
      <Section title="For firms that need it in writing">
        <p>
          CPAs, law firms, and anyone with a confidentiality or privilege
          obligation can request a Data Processing Agreement (DPA) that puts
          these commitments — minimization, no-training, breach notification,
          deletion on request — into a signed contract.
        </p>
        <p className="text-[15px]">
          <Link href="/dpa" className="text-ink underline underline-offset-2">
            Read about the DPA and request one →
          </Link>
        </p>
      </Section>

      <Section title="The fine print lives next door">
        <p>
          This page is the plain-language version. The binding detail — the
          encryption envelope, the row-level isolation, the named subprocessors,
          the closure timeline — lives in our{" "}
          <Link className="underline text-clay" href="/privacy">
            privacy policy
          </Link>
          ,{" "}
          <Link className="underline text-clay" href="/security">
            security page
          </Link>
          , and{" "}
          <Link className="underline text-clay" href="/terms">
            terms
          </Link>
          . Questions about any of it:{" "}
          <a className="underline text-clay" href="mailto:hello@agentplain.com">
            hello@agentplain.com
          </a>
          .
        </p>
      </Section>
    </>
  );
}

// Local section primitive — mirrors the /privacy + /security legal-page shape
// (single h2, optional intro) so /data sits in the same visual family.
function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule">
      <div className="container-wide py-16 md:py-20">
        <h2 className="max-w-3xl font-display text-2xl leading-snug text-ink md:text-3xl">
          {title}
        </h2>
        {intro ? (
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-ink-soft md:text-lg">
            {intro}
          </p>
        ) : null}
        {children ? (
          <div className="mt-8 max-w-5xl space-y-5 text-base leading-relaxed text-ink-soft md:text-lg">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
