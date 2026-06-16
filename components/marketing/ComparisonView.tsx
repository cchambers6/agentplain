import Link from "next/link";
import Section from "@/components/Section";
import { FaqList } from "@/components/FAQ";
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

      {/* Side-by-side table */}
      <Section eyebrow="Side by side" title="Line by line.">
        <div className="overflow-hidden border border-rule">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-rule bg-paper-deep">
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

      {/* CTA */}
      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <p className="max-w-3xl font-display text-3xl leading-[1.12] md:text-4xl">
            See agentplain on your own business.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/75">
            First month free. Month-to-month. The fleet drafts; you decide.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/verticals"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              See all ten verticals
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
