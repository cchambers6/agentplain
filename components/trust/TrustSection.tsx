import Section from "@/components/Section";
import DesignPartnerGrid from "./DesignPartnerGrid";
import TestimonialBlock from "./TestimonialBlock";
import PressBar from "./PressBar";
import CaseStudyGrid from "./CaseStudyCard";
import OutcomeBand from "./OutcomeBand";
import { TESTIMONIALS, CASE_STUDIES, OUTCOME_STATS } from "@/lib/trust/proof";

// The site-wide trust section — partners, outcomes, customer words, case
// studies, coverage — composed as one hairline-continuous stack (mt-px between
// blocks, matching the ledger-exhibit stack on the home page). Each block
// reads from lib/trust/proof.ts and renders its honest empty state until real
// proof lands, so populating a registry lights this section up everywhere
// with no further wiring.
//
// The section header states the publication standard once; the blocks then
// report their own current truth.

export function TrustSection() {
  return (
    <Section
      id="proof"
      eyebrow="Proof, in public"
      title="This section fills up as the receipts land."
      intro="Partners, measured outcomes, customer words, case studies, coverage: each block below publishes when the real thing exists, and holds an honest empty state until it does. Nothing here is bought, borrowed, or invented."
    >
      <div>
        <DesignPartnerGrid />
        <div className="mt-px">
          <OutcomeBand items={OUTCOME_STATS} />
        </div>
        <div className="mt-px">
          <TestimonialBlock items={TESTIMONIALS} />
        </div>
        <div className="mt-px">
          <CaseStudyGrid items={CASE_STUDIES} />
        </div>
        <div className="mt-px">
          <PressBar />
        </div>
      </div>
    </Section>
  );
}

export default TrustSection;
