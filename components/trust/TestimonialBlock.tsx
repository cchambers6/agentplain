import { TRUST_EMPTY_COPY, type Testimonial } from "@/lib/trust/proof";

// Testimonial block — the customer's words set as an editorial figure: display
// serif quote, hairline-ruled attribution with optional headshot. Populated
// from the registry (verbatim quotes, written permission — see
// lib/trust/proof.ts). Empty: one quiet honest band, no manufactured praise.
//
// Takes its items as a prop so a vertical page can pass `testimonialsFor(slug)`
// while the home page passes the site-wide list.

function QuoteFigure({ t }: { t: Testimonial }) {
  return (
    <figure className="m-0 flex h-full flex-col bg-paper p-7 md:p-8">
      <blockquote className="m-0 max-w-prose font-display text-xl leading-snug text-ink md:text-2xl">
        &ldquo;{t.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-4 border-t border-rule pt-5">
        {t.headshotSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- person-supplied raster; next/image avoided product-wide (see Plaino.tsx)
          <img
            src={t.headshotSrc}
            alt={`${t.name}, ${t.role} at ${t.company}`}
            className="block h-12 w-12 border border-rule object-cover"
          />
        ) : null}
        <div>
          <p className="text-[14px] leading-tight text-ink">{t.name}</p>
          <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            {t.role} · {t.company}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

export function TestimonialBlock({ items }: { items: Testimonial[] }) {
  const copy = TRUST_EMPTY_COPY.testimonial;

  if (items.length === 0) {
    return (
      <div className="border border-rule bg-paper p-7 md:p-8">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {copy.eyebrow}
        </p>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink">
          {copy.reality}
        </p>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-mute">
          {copy.change}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {copy.eyebrow}
      </p>
      <div className="mt-4 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
        {items.map((t) => (
          <QuoteFigure key={`${t.name}-${t.company}`} t={t} />
        ))}
      </div>
    </div>
  );
}

export default TestimonialBlock;
