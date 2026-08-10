import {
  DESIGN_PARTNERS,
  TRUST_EMPTY_COPY,
  PARTNER_CTA_HREF,
  type DesignPartner,
} from "@/lib/trust/proof";

// Design-partner logo grid. Populated: a hairline grid of partner cells (logo
// when the asset has cleared, name always). Empty: the honest launching state,
// with the founding-partner CTA — the one conversion this surface owns.
//
// Server Component; renders registry data only. To light this up, add an entry
// to DESIGN_PARTNERS in lib/trust/proof.ts (admission rules documented there).

function PartnerCell({ partner }: { partner: DesignPartner }) {
  return (
    <div className="flex min-h-[7rem] flex-col items-start justify-center bg-paper p-6 md:p-7">
      {partner.logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- partner raster; next/image avoided product-wide (see Plaino.tsx)
        <img
          src={partner.logoSrc}
          alt={`${partner.name} logo`}
          className="block h-10 w-auto max-w-full object-contain"
        />
      ) : (
        <p className="font-display text-xl leading-tight text-ink">
          {partner.name}
        </p>
      )}
      <p className="mt-3 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
        {partner.since ? `Partner since ${partner.since}` : "Founding partner"}
      </p>
    </div>
  );
}

export function DesignPartnerGrid() {
  const copy = TRUST_EMPTY_COPY.partners;

  if (DESIGN_PARTNERS.length === 0) {
    return (
      <div className="border border-rule bg-paper p-7 md:p-8">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {copy.eyebrow}
        </p>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink">
          {copy.reality}
        </p>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-mute">
          {copy.change}
        </p>
        <a
          href={PARTNER_CTA_HREF}
          className="mt-5 inline-flex items-center gap-2 text-ink underline"
        >
          {copy.ctaLabel} <span aria-hidden>→</span>
        </a>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {copy.eyebrow}
      </p>
      <div className="mt-4 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
        {DESIGN_PARTNERS.map((p) => (
          <PartnerCell key={p.name} partner={p} />
        ))}
      </div>
    </div>
  );
}

export default DesignPartnerGrid;
