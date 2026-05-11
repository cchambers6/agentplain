type PricingTierProps = {
  name: string;
  price: string;
  cadence: string;
  positioning: string;
  includes: string[];
  excludes?: string[];
  featured?: boolean;
};

export default function PricingTier({
  name,
  price,
  cadence,
  positioning,
  includes,
  excludes,
  featured = false,
}: PricingTierProps) {
  return (
    <article
      className={`flex h-full flex-col border bg-paper p-7 ${
        featured ? "border-ink shadow-[6px_6px_0_0_#5F8060]" : "border-rule"
      }`}
    >
      <div className="mb-6">
        <p className="eyebrow mb-3">{name}</p>
        <p className="font-mono text-4xl text-ink md:text-5xl">{price}</p>
        <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
          {cadence}
        </p>
      </div>

      <p className="mb-6 font-display text-xl leading-snug text-ink">
        {positioning}
      </p>

      <ul className="mb-6 space-y-3 text-[15px] leading-relaxed text-ink-soft">
        {includes.map((item) => (
          <li key={item} className="flex gap-3">
            <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {excludes && excludes.length > 0 && (
        <div className="mb-6 border-t border-rule pt-5">
          <p className="eyebrow mb-3">Not included</p>
          <ul className="space-y-2 text-sm text-slate-soft">
            {excludes.map((item) => (
              <li key={item}>— {item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-2">
        <a
          href={`mailto:hello@agentplain.com?subject=agentplain%20${encodeURIComponent(name)}%20interest`}
          className={featured ? "btn-primary w-full" : "btn-secondary w-full"}
        >
          Talk about {name}
        </a>
      </div>
    </article>
  );
}
