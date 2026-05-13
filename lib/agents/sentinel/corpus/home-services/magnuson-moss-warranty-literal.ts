import type { ComplianceRule } from "../../types";

/**
 * Magnuson-Moss Warranty Act — disclosure of written warranty terms.
 *
 * Applies whenever a home-services provider gives a written warranty on
 * a consumer product. Sentinel flags warranty drafts that lack the
 * required disclosure or that mislabel a limited warranty as a full
 * warranty.
 */
export const rule: ComplianceRule = {
  ruleId: "magnuson-moss-warranty-disclosure",
  title: "Magnuson-Moss Warranty Act — written warranty disclosure",
  summary:
    "Any warrantor warranting a consumer product to a consumer by means of a written warranty must fully and conspicuously disclose in simple and readily understood language the terms and conditions of such warranty, as required by FTC rules, and must clearly and conspicuously designate the warranty as 'full' or 'limited.'",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "15 USC § 2302 (Magnuson-Moss); 15 USC § 2303 (full vs. limited designation); implementing rules at 16 CFR Parts 700–703",
    url: "https://www.law.cornell.edu/uscode/text/15/2302",
    accessedAt: "2026-05-12",
  },
  literalText: `15 USC § 2302(a):
In order to improve the adequacy of information available to consumers, prevent deception, and improve competition in the marketing of consumer products, any warrantor warranting a consumer product to a consumer by means of a written warranty shall, to the extent required by rules of the Commission, fully and conspicuously disclose in simple and readily understood language the terms and conditions of such warranty. Such rules may require inclusion in the written warranty of any of the following items among others:
(1) The clear identification of the names and addresses of the warrantors.
(2) The identity of the party or parties to whom the warranty is extended.
(3) The products or parts covered.
(4) A statement of what the warrantor will do in the event of a defect, malfunction, or failure to conform with such written warranty—at whose expense—and for what period of time.
(5) A statement of what the consumer must do and expenses he must bear.
(6) Exceptions and exclusions from the terms of the warranty.
(7) The step-by-step procedure which the consumer should take in order to obtain performance of any obligation under the warranty, including the identification of any person or class of persons authorized to perform the obligations set forth in the warranty.
(8) Information respecting the availability of any informal dispute settlement procedure offered by the warrantor and a recital, where the warranty so provides, that the purchaser may be required to resort to such procedure before pursuing any legal remedies in the courts.
(9) A brief, general description of the legal remedies available to the consumer.
(10) The time at which the warrantor will perform any obligations under the warranty.
(11) The period of time within which, after notice of a defect, malfunction, or failure to conform with the warranty, the warrantor will perform any obligations under the warranty.
(12) The characteristics or properties of the products, or parts thereof, that are not covered by the warranty.
(13) The elements of the warranty in words or phrases which would not mislead a reasonable, average consumer as to the nature or scope of the warranty.

15 USC § 2303(a):
Any warrantor warranting a consumer product by means of a written warranty shall clearly and conspicuously designate such warranty in the following manner, as applicable:
(1) If the written warranty meets the Federal minimum standards for warranty set forth in section 2304 of this title, then it shall be conspicuously designated a "full (statement of duration) warranty."
(2) If the written warranty does not meet the Federal minimum standards for warranty set forth in section 2304 of this title, then it shall be conspicuously designated a "limited warranty."`,
  drafterNotes:
    "FTC implementing rules at 16 CFR Parts 700 (interpretation), 701 (disclosure), 702 (pre-sale availability), and 703 (informal dispute settlement procedures) are the operational layer — counsel: please advise whether sentinel needs a companion literal for 16 CFR § 701.3 (the specific written-warranty disclosure rule).",
};
