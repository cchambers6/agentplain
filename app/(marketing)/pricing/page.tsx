import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import RoiCalculator from "@/components/RoiCalculator";

export const metadata: Metadata = {
  title: "Pricing — agentplain",
  description:
    "One plan, per-seat, month-to-month. $199 solo sliding to $99 at 50+ seats. First month free. Anything beyond plug-and-play, we scope as a Custom engagement.",
};

// Pricing page. Anchored to the simplified single-tier model per
// `project_stripe_both_surfaces.md` (locked 2026-05-12). The 3-column tier
// comparison was retired with the same lock — surfacing Plus/Max on a
// pricing page implied they were buyable, and they aren't.
//
// Story-arc per `feedback_everything_tells_a_story.md`:
//   1. What does this cost? → ladder + ROI calc
//   2. What ships with it?  → shared-features list
//   3. What if I need more? → /custom link
//   4. Why should I trust the number? → cited memory rules

const ladderBands = [
  { band: "Solo (1 seat)", price: "$199" },
  { band: "2–9 seats", price: "$179" },
  { band: "10–24 seats", price: "$149" },
  { band: "25–49 seats", price: "$119" },
  { band: "50–99 seats", price: "$99" },
];

const shipped = [
  "First month free, every seat band",
  "Month-to-month — cancel any time",
  "Human review on every customer-facing output",
  "Liability for licensed activities stays with you",
  "Weekly outcome digest",
  "No data resold; no client list retained as training data",
  "You own the work product",
  "Vertical-aware compliance corpus per vertical",
];

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Pricing</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            One plan.
            <br />
            <span className="text-clay">
              Affordable access to enterprise-grade tools.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Per seat. Month-to-month. First month is free across every band.
            Card on file at sign-up; month 1 = $0; month 2 onward at your
            seat band&apos;s rate.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/app/sign-up" className="btn-primary">
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link href="#roi" className="btn-secondary">
              Run the ROI numbers
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      <Section eyebrow="The ladder" title="Per-seat, sliding by seat count.">
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-5">
          {ladderBands.map((row) => (
            <div key={row.band} className="bg-paper p-6">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                {row.band}
              </p>
              <p className="mt-4 font-display text-4xl leading-none text-ink">
                {row.price}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-mute">
                per seat / mo
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-3xl font-mono text-[12px] leading-relaxed text-mute">
          Source:{" "}
          <code className="text-[12px]">project_stripe_both_surfaces.md</code>{" "}
          (per-seat ladder; single-tier surfacing locked 2026-05-12).
        </p>
      </Section>

      <Section
        id="roi"
        tone="deep"
        eyebrow="ROI"
        title="The math, not the vibes."
        intro="Enter your own numbers. The calculator is pure client-side; you can audit the formula in view-source. Conservative inputs are 8–15 hr/wk on systematic ops at a $75–$150/hr productive-hour opportunity cost."
      >
        <RoiCalculator />
      </Section>

      <Section
        eyebrow="What ships with every seat"
        title="The same value loop, the same guardrails."
      >
        <ul className="grid gap-x-12 gap-y-3 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
          {shipped.map((item) => (
            <li key={item}>— {item}</li>
          ))}
        </ul>
      </Section>

      <Section
        tone="deep"
        eyebrow="Need more depth?"
        title="When Regular doesn't cover it, we build."
        intro="Bespoke compliance corpus, white-label, dedicated success, custom integration to a tool that isn't on the roadmap, 100+ seats, custom reporting. Anything beyond plug-and-play is a Custom engagement, scoped per customer."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-[2fr_1fr]">
          <div className="bg-paper p-8 md:p-10">
            <p className="eyebrow mb-3">Pricing framework</p>
            <p className="max-w-prose text-[15px] leading-relaxed text-ink-soft">
              Starts at $5K. Typical engagement $5K–$15K plus $200–$500/mo
              maintenance. Scoping call → written spec → 4–6 week build →
              handoff → ongoing maintenance. No surprise charges.
            </p>
          </div>
          <div className="bg-paper p-8 md:p-10">
            <p className="eyebrow mb-3">Get scoped</p>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Tell us what you need; we&apos;ll come back with a written
              spec and a price.
            </p>
            <Link
              href="/custom"
              className="mt-4 inline-flex items-center gap-2 text-ink underline"
            >
              Build with us →
            </Link>
          </div>
        </div>
      </Section>

      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-24 md:py-32">
          <p className="eyebrow mb-6 text-paper/60">Start where it&apos;s free</p>
          <p className="max-w-3xl font-display text-3xl leading-[1.15] md:text-5xl md:leading-[1.08]">
            First month free. Month-to-month. By the time you&apos;d pay for
            month two, the fleet has either earned its seat or it hasn&apos;t.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/custom"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              Build with us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
