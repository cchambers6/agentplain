import Link from "next/link";

/**
 * Homepage card primitives — extracted from `app/(marketing)/page.tsx` so the
 * page renderer stays under the 500-line discipline bar.
 *
 * These are pure presentational components — they take typed props, they
 * render brand tokens (no hex literals), they ship no client JS (Server
 * Components). The page composes them; the cards don't know about the page.
 */

export function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow text-clay">{number}</p>
      <h3 className="mt-4 font-display text-xl leading-tight text-ink md:text-2xl">
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

export function UniqueCard({
  number,
  label,
  body,
}: {
  number: string;
  label: string;
  body: string;
}) {
  return (
    <div className="flex flex-col bg-paper p-7 md:p-8">
      <div className="flex items-baseline gap-3">
        <p className="font-mono text-[11px] tracking-eyebrow text-clay">{number}</p>
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {label}
        </p>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

// One contrast in the "why pay vs. free" block. Renders the LEFT (free
// chatbot) cell then the RIGHT (us) cell as two sibling grid cells so the
// gap-px / bg-rule hairline aligns the columns. The moss checkmark on the
// "us" side is a verified-good status signal only — never decorative.
export function ContrastRow({ free, us }: { free: string; us: string }) {
  return (
    <>
      <div className="bg-paper p-7 md:p-8">
        <p className="text-[15px] leading-relaxed text-ink-soft">{free}</p>
      </div>
      <div className="flex items-start gap-3 bg-paper p-7 md:p-8">
        <span aria-hidden className="mt-1 font-mono text-sm text-moss">
          ✓
        </span>
        <p className="text-[15px] leading-relaxed text-ink">{us}</p>
      </div>
    </>
  );
}

// Knowledge-substrate proof tile. Counts come from `SEED_COUNTS` in
// `lib/knowledge/seed-data.ts` — computed at build time from the actual
// rows the substrate loads. No invented numbers; the source is the truth.
export function KnowledgeStat({
  count,
  label,
  body,
}: {
  count: number;
  label: string;
  body: string;
}) {
  return (
    <div className="flex flex-col bg-paper p-7 md:p-8">
      <p className="font-display text-5xl leading-none text-ink md:text-6xl">
        {count.toLocaleString()}
      </p>
      <p className="mt-4 font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {label}
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

export function ProofCard({
  label,
  body,
}: {
  label: string;
  body: string;
  // `cite` is intentionally absent from the runtime props. The data files
  // still carry an internal `cite` for traceability — kept off the render
  // tree so internal memory filenames can never surface to a customer.
  cite?: string;
}) {
  return (
    <div className="flex flex-col bg-paper p-7 md:p-8">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {label}
      </p>
      <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        {body}
      </p>
    </div>
  );
}

export function Card({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow text-clay">{number}</p>
      <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
        {title}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

// Three-tier service-partnership card. Not the existing
// `components/PricingTier.tsx` because the homepage teaser needs the
// per-seat ladder rendered inside each tier — a shape the existing
// PricingTier component (single price, single cadence) doesn't model.
export function TierCard({
  name,
  tagline,
  description,
  bands,
  quotedNote,
  ctaLabel,
  ctaHref,
  ctaStyle,
  footnote,
  featured = false,
}: {
  name: string;
  tagline: string;
  description: string;
  bands?: { band: string; price: string }[];
  quotedNote?: string;
  ctaLabel: string;
  ctaHref: string;
  ctaStyle: "primary" | "secondary";
  footnote: string;
  featured?: boolean;
}) {
  const isMailto = ctaHref.startsWith("mailto:");
  const CtaTag = (isMailto ? "a" : Link) as React.ElementType;
  const ctaClass =
    ctaStyle === "primary"
      ? "btn-primary w-full justify-center"
      : "btn-secondary w-full justify-center";

  return (
    <div
      className={`flex flex-col bg-paper p-7 md:p-8 ${
        featured ? "ring-1 ring-clay" : ""
      }`}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {name}
        </p>
        {featured ? (
          <p className="font-mono text-[10px] tracking-eyebrow uppercase text-clay">
            Named partner
          </p>
        ) : null}
      </div>
      <h3 className="mt-3 font-display text-2xl leading-snug text-ink md:text-3xl">
        {tagline}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{description}</p>

      {bands ? (
        <div className="mt-6 grid gap-px overflow-hidden border border-rule bg-rule">
          {bands.map((row) => (
            <div
              key={row.band}
              className="flex items-baseline justify-between bg-paper px-3 py-2"
            >
              <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                {row.band}
              </span>
              <span className="font-display text-lg text-ink">
                {row.price}
                <span className="ml-1 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                  /seat/mo
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {quotedNote ? (
        <div className="mt-6 border border-rule bg-paper-deep px-4 py-6 text-center">
          <p className="font-display text-2xl leading-snug text-ink">{quotedNote}</p>
          <p className="mt-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            sales-led
          </p>
        </div>
      ) : null}

      <div className="mt-auto pt-6">
        <CtaTag href={ctaHref} className={ctaClass}>
          {ctaLabel}
          <span aria-hidden>→</span>
        </CtaTag>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-mute">
          {footnote}
        </p>
      </div>
    </div>
  );
}
