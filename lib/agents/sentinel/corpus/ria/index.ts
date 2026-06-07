import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as section206 } from "./advisers-act-fiduciary-literal";
import { rule as rule204A1 } from "./rule-204a-1-code-of-ethics-literal";
import { rule as marketingRule } from "./advertising-rule-206-4-1-literal";
import { rule as marketingTestimonials } from "./marketing-rule-testimonials-literal";
import { rule as formAdvPart2 } from "./form-adv-literal";
import { rule as custodyRule } from "./custody-rule-206-4-2-literal";
import { rule as stateRegistration } from "./state-ria-registration-literal";
import { rule as softDollar } from "./soft-dollar-section-28e-literal";
import { rule as marketingCandidates } from "./marketing-rule-candidates-literal";

export const riaCorpus: CorpusBundle = {
  verticalSlug: "ria",
  metadata,
  rules: [
    section206,
    rule204A1,
    marketingRule,
    marketingTestimonials,
    formAdvPart2,
    custodyRule,
    stateRegistration,
    softDollar,
    marketingCandidates,
  ],
};
