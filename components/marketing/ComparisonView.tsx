import Link from "next/link";
import Section from "@/components/Section";
import { FaqList } from "@/components/FAQ";
import {
  ApClosingBand,
  ApClosingBandAction,
} from "@/components/ui/ap";
import { TRIAL_PERIOD_DAYS } from "@/lib/billing/facts";
import type { Comparison } from "@/lib/marketing/comparisons";

// Renderer for a single "agentplain vs {alternative}" page. Honest by
// construction: the alternative's genuine strengths render FIRST, then
// agentplain's, then a side-by-side table, then the honest "choose X if"
// bottom line, then the FAQ. The quotable direct answer sits high on the page
// so an answer engine can lift it.
export default function ComparisonView({ c }: { c: Comparison }) {
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

      {/* CTA — the shared grounded close. The old copy said "First month
          free", which contradicted the ratified trial policy; the trial
          length now reads from lib/billing/facts.ts so it cannot drift. */}
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
    </>
  );
}
