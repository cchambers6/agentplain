import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3 (roofing
// composite 34, the recommended trades pick) and §4 (trades-cluster
// analysis). "Home services" here is the broad trades category — roofing,
// HVAC, plumbing, electrical, GC remodel, landscaping. The fleet shape is
// closest to roofing because that is the analyzed Product-3 candidate.
//
// JTBD draft:true — no Phase 0 product_spec.md table. Capability-inbox flagged.

export const homeServices: VerticalContent = {
  slug: "home-services",
  name: "Home services",
  tier: "plus",

  hero: {
    eyebrow: "Recommended Product 3 · Plus tier",
    headline: "The fleet for the residential trades operation.",
    valueProp:
      "agentplain REPLACES the lead-source juggle and the insurance-supplement scramble, INTEGRATES with AccuLynx, JobNimbus, CompanyCam, EagleView, and the carrier adjuster channels, and AUGMENTS the owner's read on every estimate, supplement, and homeowner-facing reply.",
  },

  metaTitle:
    "agentplain for home services — roofing, HVAC, GC remodel, landscaping",
  metaDescription:
    "An agentic fleet for the 5–25 crew residential trades operation. Lead routing across HomeAdvisor / Angi / LSA / GBP, estimate generation from EagleView measurements, insurance-supplement drafting for storm work, project coordination, and review-and-referral cadence — coordinated across AccuLynx, JobNimbus, CompanyCam, and your insurance-claim channels.",

  jtbdTables: [
    {
      role: "Owner",
      draft: true,
      rows: [
        {
          job: "See lead-to-cash velocity across all sources",
          when: "Daily, mid-morning",
          today: "AccuLynx export + spreadsheet",
          withAgentplain:
            "Pipeline view — every lead with current bottleneck (estimate / contract / material / install / review)",
        },
        {
          job: "Sign off on insurance supplement submissions",
          when: "Continuous through storm season",
          today: "Manually drafted in Word, faxed or emailed",
          withAgentplain:
            "Supplement agent drafts the line-item rebuttal; owner signs and routes to the carrier",
        },
        {
          job: "See where the back-office is bottlenecked this week",
          when: "Weekly",
          today: "Talk to the office manager",
          withAgentplain:
            "Ops view — drafted-but-not-sent estimates, stuck supplements, unrouted leads",
        },
      ],
    },
    {
      role: "Sales rep",
      draft: true,
      rows: [
        {
          job: "Run an in-home estimate appointment",
          when: "6–10 per day during peak",
          today: "Tablet + Xactimate + paper proposal",
          withAgentplain:
            "Estimate agent runs the EagleView measurement, generates the bid in your pricing model, drafts the homeowner-facing proposal in your brand",
        },
        {
          job: "Follow up on a same-day estimate",
          when: "T+24 hours",
          today: "Calendar reminder, manual text",
          withAgentplain:
            "Follow-up agent drafts the homeowner-facing message with the proposal recap; rep sends",
        },
      ],
    },
    {
      role: "Office manager / production",
      draft: true,
      rows: [
        {
          job: "Schedule a crew + materials against a signed contract",
          when: "Continuous through season",
          today: "Whiteboard + phone calls to suppliers",
          withAgentplain:
            "Project agent sequences material order, crew window, homeowner communication, inspection scheduling",
        },
        {
          job: "Read the adjuster's scope and prepare the supplement",
          when: "Storm-season default workflow",
          today: "30–60% of back-office time at storm-heavy shops",
          withAgentplain:
            "Supplement agent reads the scope, drafts the line-item rebuttal with rebuilding-cost evidence",
        },
        {
          job: "Run review + referral cadence post-completion",
          when: "T+7 of every completed job",
          today: "Form-letter + sometimes",
          withAgentplain:
            "Reviews agent runs the cadence, drafts the NPS + Google review ask, tracks the response",
        },
      ],
    },
  ],

  roi: {
    multiplier: "14x",
    inputCost: "Plus tier · $299 per seat (solo), sliding to $199 per seat (50–99 seats) — first month free",
    outputValue: "$50,000+ / yr in supplement reclamation alone at a storm-heavy shop",
    math:
      "Per `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3: \"This single agent [insurance supplement] saves $50K+/yr at a storm-heavy shop.\" Against the solo Plus-tier seat at $299/mo ($3,588/yr) that single value stream is ~14x at one seat. Stack on cycle-time compression (estimate-to-contract velocity), reduced lead leakage across HomeAdvisor / Angi / LSA / GBP, and back-office reclamation — total is materially higher than $50k for shops doing $5–25M/yr.",
    citation:
      "Supplement-savings claim cited verbatim from `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3. Pricing per `project_stripe_both_surfaces.md` (per-seat ladder, locked 2026-05-09). ROI band per `project_pricing_value_anchor.md` (Plus-tier value $4,500–$15,000/mo per seat). Plus-tier mapping per `project_vertical_tier_mapping.md`.",
  },

  claims: {
    replace: [
      "Lead juggling across 5+ inbound sources — replaced by one queue, scored and routed",
      "Manual supplement drafting — replaced by line-item-rebuttal drafts against the adjuster scope",
      "Whiteboard project coordination — replaced by sequenced material / crew / homeowner cadence",
      "Reactive review collection — replaced by a T+7 cadence on every completed job",
    ],
    integrate: [
      "AccuLynx (CRM)",
      "JobNimbus (CRM)",
      "Roofr (CRM)",
      "CompanyCam (photo)",
      "EagleView (aerial measurement)",
      "Xactimate (insurance estimating)",
      "QuickBooks Online (accounting)",
      "Local Service Ads + Google Business Profile (lead-source feeds)",
    ],
    augment: [
      "Owner sign-off on every supplement before it leaves the office",
      "Adjuster-scope reading — drafts cite the line number, never invent scope",
      "Material-order accuracy — drafts cite the estimate, every quantity traceable",
      "Homeowner communication tone — drafts checked for brand voice + compliance posture",
    ],
  },

  integrations: {
    shipped: [],
    planned: [
      { name: "AccuLynx", category: "CRM" },
      { name: "JobNimbus", category: "CRM" },
      { name: "Roofr", category: "CRM" },
      { name: "CompanyCam", category: "Photo" },
      { name: "EagleView", category: "Aerial measurement" },
      { name: "Xactimate", category: "Insurance estimating" },
      { name: "Local Service Ads / GBP", category: "Lead source" },
      { name: "QuickBooks Online", category: "Accounting" },
    ],
    plannedWindow: "Q4 2026",
  },

  valueLoopExample: {
    scenario:
      "Hailstorm Tuesday night. The phone rings 73 times before Wednesday lunch.",
    before:
      "Triage every call, qualify the storm-damage leads, dispatch crews to the highest-margin ones, draft homeowner intake forms, scope insurance estimates, follow up on the ones still deciding. Office manager is on the phone 8 hours straight.",
    after:
      "The fleet classified every inbound by storm-zone proximity + roof age, prioritized 41 high-margin leads, drafted intake replies for each with a measurement window from EagleView, queued crew dispatch routes, and surfaced the 14 estimates that need Xactimate scoping. All ranked by close probability.",
    outcome:
      "The office manager runs a one-hour review block. Crews dispatch by 1pm. The other 39 leads get drafted follow-up the next morning — none drop.",
  },
};
