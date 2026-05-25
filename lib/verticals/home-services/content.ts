import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3 (roofing
// composite 34, the recommended trades pick) and §4 (trades-cluster
// analysis). "Home services" here is the broad trades category — roofing,
// HVAC, plumbing, electrical, GC remodel, landscaping. The fleet shape is
// closest to roofing because that is the most-analyzed trades candidate,
// but the JTBD coverage was extended 2026-05-12 to include same-day-trade
// roles (tech + dispatcher) so the page reads for ServiceTitan/Housecall
// Pro/Jobber shops too.
//
// Pricing: recommended at Partner tier per `project_stripe_both_surfaces.md`
// (2026-05-15 — three customer-facing tiers Regular / Partner / Max).
// Partner is the recommended starting tier for trades operations because
// storm-cycle volatility (estimate-to-supplement coordination, carrier
// adjuster channel maintenance) benefits from the 4 hrs/mo of named-
// service-partner reserved time. Schema enum stays `plus` on disk;
// `tierDisplayName("plus")` returns "Partner" so customers never see the
// on-disk identifier. Storm-cycle / supplement depth and white-label
// engagements route to Max (quote-based) or /custom (capability build).
//
// JTBD ratified 2026-05-12 against published role workflows for the 5–25-
// crew residential trades operation (ServiceTitan implementation playbook,
// Housecall Pro role docs, AccuLynx role definitions for roofing, NARI body
// of knowledge for remodel/GC).

export const homeServices: VerticalContent = {
  slug: "home-services",
  name: "Home services",
  tier: "plus",
  missionSubject: "home services contractors",

  // Fleet surfaced in-product on /agents, grounded in the home-services
  // JTBD tables. Lead Router owns the inbox loop's buyer-inquiry bucket
  // (score + route + draft first-touch). Every other agent rooting on
  // FSM / measurement / adjuster connections.
  agentRoster: [
    {
      slug: "home-services-lead-router",
      name: "Lead Router",
      job: "Scores and routes inbound leads across every source into one queue.",
      runtime: "live",
      owns: ["buyer-inquiry"],
    },
    {
      slug: "home-services-estimate",
      name: "Estimate",
      job: "Builds the bid from measurements and drafts the homeowner-facing proposal.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your measurement tool (EagleView / AccuLynx / Hover) is connected.",
    },
    {
      slug: "home-services-estimate-followup",
      name: "Estimate Followup",
      job: "Walks open estimates, drafts the right-stage homeowner nudge, and hands cold deals back to the rep for a phone call.",
      runtime: "live",
      // Live via the home-services-estimate-followup skill — works on a JSON-
      // stub FSM today; binds to AccuLynx / JobNimbus / ServiceTitan / Housecall
      // Pro / Jobber MCPs once they ship. Each open estimate gets exactly one
      // draft scoped to its cadence stage; price / schedule always defer to
      // {{operator: quote/time estimate}}; cold estimates roll up into a single
      // rep handoff with a phone-call ask.
      boundSkill: "home-services-estimate-followup",
    },
    {
      slug: "home-services-supplement",
      name: "Supplement",
      job: "Reads the adjuster scope and drafts the line-item rebuttal for owner sign-off.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once Symbility or Xactimate adjuster scopes are connected.",
    },
    {
      slug: "home-services-dispatch",
      name: "Dispatch",
      job: "Ranks same-day calls by SLA and skill match, then drafts and re-drafts the route.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your FSM (ServiceTitan / Housecall Pro / Jobber) is connected for the crew + skill matrix.",
    },
    {
      slug: "home-services-eta-updater",
      name: "ETA Updater",
      job: "Drafts homeowner updates on every job-state change for the dispatcher to send.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your FSM job-state webhooks are connected.",
    },
    {
      slug: "home-services-project-coordinator",
      name: "Project Coordinator",
      job: "Sequences material order, crew window, and inspection scheduling on a signed contract.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your project-management surface (AccuLynx / JobNimbus) and supplier connections are in place.",
    },
    {
      slug: "home-services-reviews",
      name: "Reviews",
      job: "Runs the T+7 review-and-referral cadence on every completed job.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your FSM completed-job feed is connected.",
    },
  ],

  hero: {
    eyebrow: "Built for residential trades operations",
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
      draft: false,
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
      draft: false,
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
      role: "Dispatcher",
      draft: false,
      rows: [
        {
          job: "Route same-day calls across the crew",
          when: "All day, every day",
          today: "Whiteboard + phone — re-shuffle on every cancel / no-show",
          withAgentplain:
            "Dispatch agent ranks calls by SLA + revenue band + tech-skill match, drafts the route, and re-drafts on cancels — dispatcher confirms changes",
        },
        {
          job: "Communicate ETA changes to homeowners",
          when: "Continuous through the day",
          today: "Texts hand-typed between calls",
          withAgentplain:
            "ETA agent drafts the homeowner update on every job-state change (en-route / delayed / arrived); dispatcher approves the batch",
        },
        {
          job: "Capture and dispatch after-hours emergency calls",
          when: "Nights / weekends",
          today: "On-call phone + manual call-back",
          withAgentplain:
            "Inbound agent classifies (true emergency / next-morning / quote), drafts the after-hours tech dispatch with the on-call rotation",
        },
      ],
    },
    {
      role: "Service technician",
      draft: false,
      rows: [
        {
          job: "Pull job context before arriving on-site",
          when: "Per-call, pre-arrival",
          today: "Glance at the work-order PDF; call dispatcher for missing details",
          withAgentplain:
            "Prep agent surfaces the prior-job history, equipment age, brand notes, and homeowner preferences pulled from ServiceTitan/Jobber",
        },
        {
          job: "Build the estimate / repair scope on-site",
          when: "Per-call, mid-job",
          today: "Tablet entry + flat-rate book lookup",
          withAgentplain:
            "Estimate agent drafts the line items from the diagnostic notes, applies the flat-rate catalog, and drafts the homeowner-facing proposal in plain English",
        },
        {
          job: "Capture post-job notes for the next visit",
          when: "Job wrap-up",
          today: "Typed into tablet between calls — often abbreviated or skipped",
          withAgentplain:
            "Notes agent drafts the equipment notes, parts-replaced list, and recommended follow-up window; tech reviews on the tablet",
        },
      ],
    },
    {
      role: "Office manager / production",
      draft: false,
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
    inputCost: "Partner tier · $299 per seat (solo), sliding to $199 per seat (50–99 seats) — first month free, includes 4 hrs/mo of named-service-partner time",
    outputValue: "$50,000+ / yr in supplement reclamation alone at a storm-heavy shop",
    math:
      "Per `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3: \"This single agent [insurance supplement] saves $50K+/yr at a storm-heavy shop.\" Against the solo Partner-tier seat at $299/mo ($3,588/yr) that single value stream alone is ~14x at one seat. Stack on cycle-time compression (estimate-to-contract velocity), reduced lead leakage across HomeAdvisor / Angi / LSA / GBP, and back-office reclamation — total is materially higher than $50k for shops doing $5–25M/yr. The 4 hrs/mo of named-service-partner time bundled with Partner is treated as commitment, not as ROI uplift here. White-label, multi-state ops, or 100+ seats route to Max (quote-based) or /custom (capability build).",
    citation:
      "Supplement-savings claim cited verbatim from `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3. Pricing per `project_stripe_both_surfaces.md` (Partner tier per 2026-05-15 ratification; per-seat ladder $299→$199 with 4 hrs/mo of named-service-partner time included). ROI band per `project_pricing_value_anchor.md`.",
  },

  claims: {
    replace: [
      "Lead juggling across 5+ inbound sources — replaced by one queue, scored and routed",
      "Manual supplement drafting — replaced by line-item-rebuttal drafts against the adjuster scope",
      "Whiteboard project coordination — replaced by sequenced material / crew / homeowner cadence",
      "Reactive review collection — replaced by a T+7 cadence on every completed job",
    ],
    integrate: [
      "ServiceTitan (FSM — HVAC/plumbing/electrical)",
      "Jobber (FSM — multi-trade SMB)",
      "Housecall Pro (FSM — multi-trade SMB)",
      "FieldEdge (FSM — HVAC/plumbing)",
      "AccuLynx (CRM — roofing)",
      "JobNimbus (CRM — roofing/restoration)",
      "Roofr (CRM — roofing)",
      "CompanyCam (photo)",
      "EagleView (aerial measurement — roofing)",
      "Xactimate (insurance estimating — storm/restoration)",
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
      { name: "ServiceTitan", category: "FSM (multi-trade)" },
      { name: "Jobber", category: "FSM (multi-trade SMB)" },
      { name: "Housecall Pro", category: "FSM (multi-trade SMB)" },
      { name: "FieldEdge", category: "FSM (HVAC/plumbing)" },
      { name: "AccuLynx", category: "CRM (roofing)" },
      { name: "JobNimbus", category: "CRM (roofing/restoration)" },
      { name: "Roofr", category: "CRM (roofing)" },
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
