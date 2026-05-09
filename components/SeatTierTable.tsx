type Tier = {
  band: string;
  monthly: number | null;
  annual: number | null;
  blurb: string;
  enterprise?: boolean;
  example?: { seats: number; monthly: string };
  highlighted?: boolean;
};

const tiers: Tier[] = [
  {
    band: "1 seat (solo)",
    monthly: 199,
    annual: 1990,
    blurb: "One realtor running their own book.",
    example: { seats: 1, monthly: "$199 / mo" },
  },
  {
    band: "2 – 9 seats",
    monthly: 169,
    annual: 1690,
    blurb: "Small team or boutique brokerage.",
    example: { seats: 5, monthly: "5 × $169 = $845 / mo" },
  },
  {
    band: "10 – 24 seats",
    monthly: 139,
    annual: 1390,
    blurb: "Most independent brokerages we work with.",
    example: { seats: 10, monthly: "10 × $139 = $1,390 / mo" },
    highlighted: true,
  },
  {
    band: "25 – 49 seats",
    monthly: 109,
    annual: 1090,
    blurb: "Multi-office brokerage.",
    example: { seats: 25, monthly: "25 × $109 = $2,725 / mo" },
  },
  {
    band: "50 – 99 seats",
    monthly: 79,
    annual: 790,
    blurb: "Regional brokerage.",
    example: { seats: 50, monthly: "50 × $79 = $3,950 / mo" },
  },
  {
    band: "100+ seats",
    monthly: null,
    annual: null,
    blurb: "Custom pricing, dedicated success lead, custom integrations, SLAs.",
    enterprise: true,
  },
];

export default function SeatTierTable() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tiers.map((t) => (
        <article
          key={t.band}
          className={`flex h-full flex-col border bg-paper p-6 ${
            t.highlighted
              ? "border-ink shadow-[6px_6px_0_0_#5F8060]"
              : "border-rule"
          }`}
        >
          <p className="eyebrow mb-3">{t.band}</p>

          {t.enterprise ? (
            <>
              <p className="font-display text-3xl text-ink">Enterprise</p>
              <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                Talk to us
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-3xl text-ink md:text-4xl">
                ${t.monthly}
                <span className="ml-1 font-sans text-sm text-slate-soft">
                  / seat / mo
                </span>
              </p>
              <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                ${t.annual} / seat / yr · annual saves 2 months
              </p>
            </>
          )}

          <p className="mt-5 text-[14px] leading-relaxed text-ink-soft">
            {t.blurb}
          </p>

          {t.example ? (
            <div className="mt-5 border-t border-rule pt-4">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                At {t.example.seats} {t.example.seats === 1 ? "seat" : "seats"}
              </p>
              <p className="mt-1 font-display text-lg text-ink">
                {t.example.monthly}
              </p>
            </div>
          ) : null}

          <div className="mt-auto pt-6">
            <a
              href={
                t.enterprise
                  ? "mailto:hello@agentplain.com?subject=agentplain%20enterprise"
                  : "mailto:hello@agentplain.com?subject=agentplain%20pricing"
              }
              className={t.highlighted ? "btn-primary w-full" : "btn-secondary w-full"}
            >
              {t.enterprise ? "Talk to us" : "Start"}
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
