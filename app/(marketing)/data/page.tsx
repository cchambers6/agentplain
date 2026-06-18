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
    "Your data is yours. Plaino keeps a working memory of how your business runs so he gets better over time — but your raw data from connected tools stays in those tools. Exactly what we store, what stays in your tools, and how to export or delete it.",
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
            {DATA_STANCE_TAGLINE} Plaino keeps a working memory of how your
            business runs — so he gets better the longer you work together. But
            your raw data from connected tools stays in those tools: he reads it
            in-flight when he&rsquo;s working and never copies it onto our
            servers. Two buckets, in plain language.
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

      {/* BUCKET 1 — Plaino's working memory. The feature, not an apology. */}
      <Section
        title="Bucket 1 — what we store, so Plaino gets better"
        intro="This is Plaino's working memory of your business — the part that makes him a partner who improves instead of a tool that forgets every morning. We keep it for the life of your account, encrypted and walled off to your workspace alone. It's all yours: export it anytime, hard-deleted when you close your account."
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

      {/* BUCKET 2 — your raw data stays in your tools. */}
      <Section
        title="Bucket 2 — what we don't store, because it stays in your tools"
        intro="Your raw business data lives in the systems you already use. Plaino reads what a task needs in-flight and leaves it there — he learns the patterns from working with your tools, he doesn't hoard the records."
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
        intro="Every connector follows the same shape: your system in, a draft out, your queue in the middle. Plaino reads your records in-flight and leaves them in your tool; what stays with us is the draft, the connection token, and what he learned about how you work — not a copy of your source records."
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
          and what we don&rsquo;t — before you grant anything. The deliberate
          exception is documents: when you point Plaino at a folder of your own
          playbooks, those files become part of his memory (encrypted,
          workspace-private) so drafts sound like you and cite your own
          material. Your live records — emails, deals, ledgers — are read in the
          moment and stay in your tools.
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
          these commitments — what we store and what stays in your tools,
          no-training, breach notification, deletion on request — into a signed
          contract.
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
