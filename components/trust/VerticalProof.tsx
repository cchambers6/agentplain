import Section from "@/components/Section";
import TestimonialBlock from "./TestimonialBlock";
import CaseStudyGrid from "./CaseStudyCard";
import OutcomeBand from "./OutcomeBand";
import {
  caseStudiesFor,
  outcomesFor,
  testimonialsFor,
  partnersFor,
  PARTNER_CTA_HREF,
} from "@/lib/trust/proof";

// Per-vertical proof section. Renders only the proof relevant to this
// vertical (registry selectors in lib/trust/proof.ts). While every registry
// is empty for the vertical, it renders ONE compact honest band instead of
// stacking three empty blocks — an empty section earns one statement, not
// three (feedback_everything_tells_a_story).
//
// Wired as a single self-contained line in app/(marketing)/[vertical]/page.tsx
// so it lights up per vertical the moment proof lands, with no page edits.

export function VerticalProof({
  slug,
  verticalName,
}: {
  slug: string;
  verticalName: string;
}) {
  const testimonials = testimonialsFor(slug);
  const studies = caseStudiesFor(slug);
  const outcomes = outcomesFor(slug);
  const partners = partnersFor(slug);
  const hasAny =
    testimonials.length + studies.length + outcomes.length + partners.length > 0;

  if (!hasAny) {
    return (
      <Section eyebrow="Proof for this vertical">
        <div className="border border-rule bg-paper p-7 md:p-8">
          <p className="max-w-prose text-[15px] leading-relaxed text-ink">
            No {verticalName.toLowerCase()} results published yet. The first
            design partner in each vertical becomes its first case study:
            measured from their workspace&apos;s saved-time ledger, quoted with
            their permission.
          </p>
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-mute">
            We publish real numbers from real workspaces, and nothing before
            that.
          </p>
          <a
            href={PARTNER_CTA_HREF}
            className="mt-5 inline-flex items-center gap-2 text-ink underline"
          >
            Become the founding partner for {verticalName.toLowerCase()}{" "}
            <span aria-hidden>→</span>
          </a>
        </div>
      </Section>
    );
  }

  return (
    <Section
      eyebrow="Proof for this vertical"
      title={`Results from ${verticalName.toLowerCase()} workspaces.`}
    >
      <div>
        {outcomes.length > 0 ? <OutcomeBand items={outcomes} /> : null}
        {testimonials.length > 0 ? (
          <div className="mt-px">
            <TestimonialBlock items={testimonials} />
          </div>
        ) : null}
        {studies.length > 0 ? (
          <div className="mt-px">
            <CaseStudyGrid items={studies} />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

export default VerticalProof;
