import Link from "next/link";
import Section from "@/components/Section";
import { FaqList } from "@/components/FAQ";
import {
  ApClosingBand,
  ApClosingBandAction,
} from "@/components/ui/ap";
import { TRIAL_PERIOD_DAYS } from "@/lib/billing/facts";
import { BOOKING_CTA_LABEL, bookingCta } from "@/lib/marketing/booking";
import type { Comparison } from "@/lib/marketing/comparisons";

// Renderer for a single "agentplain vs {alternative}" page. Honest by
// construction: the alternative's genuine strengths render FIRST, then
// agentplain's, then a side-by-side table, then the honest "choose X if"
// bottom line, then the FAQ. The quotable direct answer sits high on the page
// so an answer engine can lift it.
//
// Named-vendor pages (the "DIY vs run-for-you" frame) add three optional
// sections — the shared pain, the vendor's specific gaps, and what
// run-for-you means — and swap the closing CTA for the intro-call booking
// link. Pages that omit those fields render exactly as before.
export default function ComparisonView({ c }: { c: Comparison }) {
  const booking = c.bookingCta ? bookingCta() : null;
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-16 pt-20 md:pb-20 md:pt-24">
          <p className="eyebrow mb-4">
            <Link href="/compare" className="text-mute hover:text-ink">
              Compare
            </Link>{" "}
            / {c.navLabel}
          </p>
          <h1 className="max-w-[52rem] font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.75rem] md:leading-[1.04]">
            {c.heroHeadline}
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
            {c.directAnswer}
          </p>
        </div>
      </section>

      {/* The shared pain — the concrete week both products exist to fix. */}
      {c.sharedPain && (
        <Section eyebrow="The shared pain" title="The week this page is about.">
          <p className="max-w-3xl text-lg leading-relaxed text-ink-soft">
            {c.sharedPain}
          </p>
        </Section>
      )}

      {/* Where each genuinely wins — alternative FIRST (honest). */}
      <Section
        tone="deep"
        eyebrow="The honest trade-off"
        title="Where each one is the right call."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              Where {c.alternative} wins
            </p>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              {c.whereAlternativeWins.map((s) => (
                <li key={s} className="flex gap-3">
                  <span aria-hidden className="text-mute">
                    —
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Where agentplain wins
            </p>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink">
              {c.whereAgentplainWins.map((s) => (
                <li key={s} className="flex gap-3">
                  <span aria-hidden className="text-clay">
                    —
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* The specific gaps — what the compared product can't do. */}
      {c.cantDo && c.cantDo.length > 0 && (
        <Section
          eyebrow="The gap"
          title={<>What {c.navLabel} can&apos;t do.</>}
        >
          <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
            {c.cantDo.map((gap) => (
              <div key={gap.title} className="bg-paper p-7 md:p-8">
                <p className="font-display text-xl leading-snug text-ink">
                  {gap.title}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  {gap.detail}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* What run-for-you means — the agentplain half of the frame. */}
      {c.runForYou && c.runForYou.length > 0 && (
        <Section
          tone="forest"
          eyebrow="The other half"
          title={<>What &ldquo;run-for-you&rdquo; means.</>}
        >
          <div className="max-w-3xl space-y-5">
            {c.runForYou.map((p) => (
              <p key={p.slice(0, 40)} className="text-lg leading-relaxed text-paper/85">
                {p}
              </p>
            ))}
          </div>
        </Section>
      )}

      {/* Side-by-side table — set as a ledger exhibit (mid-rule frame,
          paper-bright plate) so the page's one anchor is the comparison
          itself; everything around it stays quiet type on paper. */}
      <Section eyebrow="Side by side" title="Line by line.">
        <div className="overflow-x-auto border border-mid-rule bg-paper-bright">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-mid-rule">
                <th className="p-4 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                  &nbsp;
                </th>
                <th className="p-4 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                  {c.navLabel}
                </th>
                <th className="p-4 font-mono text-[11px] uppercase tracking-eyebrow text-clay">
                  agentplain
                </th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row) => (
                <tr key={row.dimension} className="border-b border-rule last:border-0">
                  <th
                    scope="row"
                    className="w-1/4 p-4 align-top font-display text-ink"
                  >
                    {row.dimension}
                  </th>
                  <td className="p-4 align-top text-ink-soft">{row.alternative}</td>
                  <td className="p-4 align-top text-ink">{row.agentplain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <div className="bg-paper p-6 md:p-7">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              Choose {c.alternative} if
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {c.chooseAlternativeIf}
            </p>
          </div>
          <div className="bg-paper p-6 md:p-7">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Choose agentplain if
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink">
              {c.chooseAgentplainIf}
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="deep" eyebrow="Questions worth asking" title="The honest version.">
        <FaqList items={c.faq} />
      </Section>

      {/* CTA — booking variant for named-vendor pages (intro call), trial
          CTA otherwise. Trial length reads from lib/billing/facts.ts so it
          cannot drift from the ratified policy. */}
      {booking ? (
        <section className="border-b border-rule bg-ink text-paper">
          <div className="container-wide py-20 md:py-24">
            <p className="max-w-3xl font-display text-3xl leading-[1.12] md:text-4xl">
              Bring your real week.
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/75">
              Twenty minutes with a person, not a demo script. We walk
              through what the fleet would draft for your shop and where you
              stay in control. If it isn&apos;t a fit, we say so.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {booking.external ? (
                <a
                  href={booking.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
                >
                  {BOOKING_CTA_LABEL}
                  <span aria-hidden>→</span>
                </a>
              ) : (
                <Link
                  href={booking.href}
                  className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
                >
                  {BOOKING_CTA_LABEL}
                  <span aria-hidden>→</span>
                </Link>
              )}
              <Link
                href="/app/sign-up"
                className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <ApClosingBand
          eyebrow={null}
          title="See agentplain on your own business."
          body={`${TRIAL_PERIOD_DAYS}-day free trial. Month-to-month. The fleet drafts; you decide.`}
          actions={
            <>
              <ApClosingBandAction href="/app/sign-up" variant="primary">
                Start free trial
              </ApClosingBandAction>
              <ApClosingBandAction href="/verticals" withArrow={false}>
                See all ten verticals
              </ApClosingBandAction>
            </>
          }
        />
      )}
    </>
  );
}
