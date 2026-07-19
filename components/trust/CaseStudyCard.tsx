import Link from "next/link";

import { TRUST_EMPTY_COPY, type CaseStudy } from "@/lib/trust/proof";

// Case-study card + grid. Each card leads with the measured outcome (the
// number is the headline), then the short story, then the link to the full
// write-up. Cards render registry entries only — every entry carries written
// permission and a `source` artifact (the workspace's saved-time ledger
// export) that stays internal; see lib/trust/proof.ts.
//
// Empty: the honest state names the publication bar instead of promising
// content on a date we don't control.

export function CaseStudyCard({ study }: { study: CaseStudy }) {
  return (
    <Link
      href={study.href}
      className="group flex flex-col bg-paper p-7 transition hover:bg-paper-deep md:p-8"
    >
      <p className="font-display text-3xl leading-none text-ink md:text-4xl">
        {study.outcome}
      </p>
      <div className="mt-5 flex items-center gap-3">
        {study.logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- partner-supplied raster; next/image avoided product-wide (see Plaino.tsx)
          <img
            src={study.logoSrc}
            alt={`${study.company} logo`}
            className="block h-6 w-auto object-contain"
          />
        ) : null}
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {study.company}
        </p>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
        {study.summary}
      </p>
      <p className="mt-auto inline-flex items-center gap-2 pt-5 font-mono text-[11px] tracking-eyebrow uppercase text-mute group-hover:text-clay">
        Read the case study <span aria-hidden>→</span>
      </p>
    </Link>
  );
}

export function CaseStudyGrid({ items }: { items: CaseStudy[] }) {
  const copy = TRUST_EMPTY_COPY.caseStudies;

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
      <div className="mt-4 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <CaseStudyCard key={`${s.company}-${s.href}`} study={s} />
        ))}
      </div>
    </div>
  );
}

export default CaseStudyGrid;
