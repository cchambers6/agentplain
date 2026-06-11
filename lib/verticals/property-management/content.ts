import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` notes property
// management as a roadmap-fit vertical (operating-model analog to realty).
//
// JTBD ratified 2026-05-12 against published role workflows for 50–500-door
// SFR/small-portfolio property management (NARPM scope-of-practice, IREM
// CPM body of knowledge, AppFolio/Buildium public role docs). Five roles
// surfaced — Principal, Property manager, Leasing agent, Maintenance
// coordinator, Accounting clerk — because at this size most shops have a
// dedicated leasing person and a dedicated maintenance dispatcher even when
// the PM "wears every hat." Owner-relations work is folded into Principal +
// PM (both touch owners) rather than given its own row.

export const propertyManagement: VerticalContent = {
  slug: "property-management",
  name: "Property management",
  tier: "regular",
  missionSubject: "property managers and management companies",

  // Tenant Inbound owns the inbox loop's buyer-inquiry bucket (classify
  // tenant message + draft the reply). Every other agent rooting on a
  // property-mgmt platform connection (AppFolio / Buildium / Propertyware).
  agentRoster: [
    {
      slug: "pm-tenant-inbound",
      name: "Tenant Inbound",
      job: "Classifies tenant messages and drafts the first-touch reply.",
      runtime: "live",
      owns: ["buyer-inquiry"],
    },
    {
      slug: "pm-work-order",
      name: "Work-Order Router",
      job: "Routes maintenance to the right vendor by trade and zone with an access window.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your property-mgmt platform (AppFolio / Buildium / Propertyware) is connected with the vendor + zone directory.",
    },
    {
      slug: "pm-lease-renewal",
      name: "Renewal Coordinator",
      job: "Runs the 90/60/30-day renewal cadence with market-rent context attached.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your property-mgmt platform is connected for lease expirations and a market-rent feed.",
    },
    {
      slug: "pm-collections",
      name: "Collections",
      job: "Runs the late-rent cadence with tenant payment history attached.",
      runtime: "live",
      // Live via the property-management-rent-collection-chase skill — works
      // on a JSON-stub rent roll today; binds to AppFolio / Buildium /
      // Propertyware / Yardi Breeze MCPs once they ship. Buckets units by
      // grace / soft-chase / formal-notice / escalation; dollar amounts always
      // defer to {{operator: amount due}}; escalation drafts queue for PM
      // review with the owner-approval flag carried through.
      boundSkill: "property-management-rent-collection-chase",
    },
    {
      slug: "pm-owner-reporter",
      name: "Owner Reporter",
      job: "Drafts the monthly per-owner report for the principal to send.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your property-mgmt platform and accounting stack are connected.",
    },
    {
      slug: "pm-application-screening",
      name: "Application Screening",
      job: "Normalizes applications against policy and drafts the approve/deny letter.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your screening provider (TransUnion SmartMove / RentPrep) is connected.",
    },
    {
      slug: "pm-books-recon",
      name: "Books Reconciler",
      job: "Drafts the owner-draw and trust-account reconciliation for review.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your trust-account ledger is connected.",
    },
    {
      // Horizontal chief-of-staff capability — proposals only, no execution.
      slug: "pm-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the PM's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Built for small-portfolio property managers",
    headline: "The fleet for the small-portfolio property manager.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. PMS (Buildium / AppFolio /
    // Propertyware / Yardi Breeze), screening, and work-order-vendor portal
    // adapters live in the per-vertical integration roadmap below and surface
    // honestly there as planned, not in this present-tense hero clause.
    valueProp:
      "agentplain REPLACES tenant inbound triage and maintenance ticket routing, INTEGRATES with Outlook, Gmail, and QuickBooks Online on day one, and AUGMENTS the owner report cadence so landlords stop calling you for status.",
    sbmSubhead:
      "The tenant-ops and owner-reporting skills, agents, and memory you'd otherwise wire yourself",
  },

  metaTitle: "for single-family and small-portfolio property managers",
  metaDescription:
    "Tenant triage, maintenance routing, rent-collection chase, lease-renewal cadence, and owner reporting — for 50–500-door single-family property managers.",

  jtbdTables: [
    {
      role: "Principal / portfolio owner",
      draft: false,
      rows: [
        {
          job: "Know which units are at-risk this week",
          when: "Monday morning",
          today: "Walk PMs, read maintenance email",
          withAgentplain:
            "Portfolio overview — units flagged for delinquency, open work orders >7 days, lease expiry <60 days",
        },
        {
          job: "Approve a non-routine maintenance spend",
          when: "Ad hoc, urgent",
          today: "Phone calls and texts; no audit trail",
          withAgentplain:
            "Work-approval queue — request, vendor estimate, owner-policy match, one-click approve with audit trail",
        },
        {
          job: "Send the monthly owner report",
          when: "First week of every month",
          today: "Generated by accounting, edited by hand, late",
          withAgentplain:
            "Owner-reporter agent drafts per-owner; principal signs and sends from their own system",
        },
      ],
    },
    {
      role: "Property manager",
      draft: false,
      rows: [
        {
          job: "Triage tenant inbound",
          when: "All day, every day",
          today: "Phone tag, scattered email, missed weekends",
          withAgentplain:
            "Tenant-inbound agent classifies (maintenance / payment / lease question), routes, drafts the first-touch reply",
        },
        {
          job: "Coordinate a maintenance work order",
          when: "Continuous, ~10–30 active per PM",
          today: "Vendor phone tag, lost paper trail",
          withAgentplain:
            "Work-order agent routes to the right vendor by trade + zone, drafts the tenant-access window, logs vendor confirmation",
        },
        {
          job: "Run lease-renewal outreach 90/60/30 days out",
          when: "Continuous calendar",
          today: "Manual template + spreadsheet reminder",
          withAgentplain:
            "Renewal agent runs the cadence with market-rent context attached; PM signs the offer",
        },
        {
          job: "Owner-facing communication on issues that need approval",
          when: "Reactive, ~weekly per door",
          today: "Email-by-email, drafted from scratch each time",
          withAgentplain:
            "Owner-comm agent drafts the owner-facing message with policy match + cost band; PM reviews and sends",
        },
      ],
    },
    {
      role: "Leasing agent",
      draft: false,
      rows: [
        {
          job: "Respond to inquiry on a listed vacancy",
          when: "Inbound from Zillow / Apartments.com / Trulia, sub-hour expected",
          today: "Manual reply with availability + tour ask",
          withAgentplain:
            "Inquiry agent classifies intent, pulls current vacancy state, drafts the qualified-tenant questions and a self-serve tour scheduling link",
        },
        {
          job: "Screen applications against criteria",
          when: "Per applicant, sub-24-hour expected",
          today: "Pull credit + background, eyeball income docs, gut-check the file",
          withAgentplain:
            "Screening agent normalizes the application against policy (income ratio / eviction / credit floor), drafts the approve/deny letter and the reason citation",
        },
        {
          job: "Draft a lease for a new tenant",
          when: "Post-approval, time-sensitive",
          today: "AppFolio / Buildium template + manual edits for property-specific terms",
          withAgentplain:
            "Lease agent drafts the document with unit-specific terms, pet/parking/concession riders, and the state-required disclosures attached",
        },
      ],
    },
    {
      role: "Maintenance coordinator",
      draft: false,
      rows: [
        {
          job: "Dispatch vendor against open work order",
          when: "Continuous, 10–40 open per day",
          today: "Phone tree across plumbers / HVAC / electrical / handyman",
          withAgentplain:
            "Dispatch agent routes by trade + zone + vendor SLA history, drafts the dispatch with tenant-access window attached",
        },
        {
          job: "Approve vendor invoices against the work order",
          when: "Post-completion",
          today: "Eyeball invoice vs. estimate; chase mismatches by phone",
          withAgentplain:
            "Invoice agent matches invoice to the estimate, flags variance, drafts the owner-facing summary with photos from CompanyCam where attached",
        },
        {
          job: "Schedule preventative-maintenance turnovers",
          when: "Quarterly + on lease turn",
          today: "Spreadsheet of HVAC / smoke detector / pest / gutter cadences",
          withAgentplain:
            "PM agent runs the cadence, drafts the vendor dispatch, and surfaces the units missing service before the audit",
        },
      ],
    },
    {
      role: "Accounting clerk",
      draft: false,
      rows: [
        {
          job: "Chase late rent",
          when: "1st–5th of the month, then 15th",
          today: "Form-letter merge, manual phone calls",
          withAgentplain:
            "Collections agent runs the cadence with tenant payment history attached; clerk signs the escalation step",
        },
        {
          job: "Reconcile owner draws",
          when: "Monthly",
          today: "Spreadsheet of trust-account exceptions",
          withAgentplain:
            "Books agent drafts the reconciliation; clerk reviews exceptions only",
        },
      ],
    },
  ],

  roi: {
    multiplier: "15x",
    inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free",
    outputValue: "$36,000 / yr saved on PM-hour and delinquency reclamation",
    math:
      "1 PM @ $48k all-in × ~25% of day on tenant inbound and maintenance routing = $12k/yr per PM in labor reclamation. At 3 PMs that is $36k against 3 Regular-tier seats at $199/mo solo ($7,164/yr) — ~5x at three PMs, sliding to ~15x+ as a portfolio grows past 25 seats and per-seat drops to $119/mo. Delinquency-day compression of 2 days/month at $200/door in rent float × 200 doors = $80k/yr additional in worst-case operations (modeled as upside, not committed).",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Regular tier per the 2026-05-15 three-tier ratification — Regular is the default entry path; PM operations wanting named-service-partner reserved time can step up to Partner ($299→$199/seat), and high-intensity multi-state portfolios route to Max (quote-based)). ROI band per `project_pricing_value_anchor.md`. PM-hour distribution and delinquency-float math pending primary-research validation — flagged in capability inbox. Buildium/AppFolio market dynamics referenced from public segment reporting; specific savings claims are operator-modeled, not customer-attested.",
    violationAvoidance:
      "Tenant communications carry Fair Housing Act exposure (first-offense HUD civil penalty of $26,262, 2025 inflation-adjusted, 24 CFR §180.671) plus each state's landlord-tenant notice, disclosure, and timing rules — an improper eviction or entry notice is its own per-violation liability. An auto-sent tenant reply can become a fair-housing or improper-notice violation instantly; agentplain's fleet drafts the reply, the fair-housing scanner flags it, and a PM approves before it sends — keeping the per-violation penalty off the ledger. That avoided downside is real ROI the 15x hours math leaves out, and it depends on nothing going out without a human.",
  },

  claims: {
    replace: [
      "Phone-tag tenant inbound — replaced by triaged + drafted first-touch",
      "Manual maintenance vendor dispatch — replaced by trade+zone-aware routing",
      "Hand-built monthly owner reports — replaced by drafted per-owner reads",
      "Form-letter collections chase — replaced by history-aware cadence with PM in the loop",
    ],
    integrate: [
      "Outlook + Gmail (per-PM OAuth — email + calendar)",
      "OneDrive + Google Drive (working files + owner-report substrate)",
      "QuickBooks Online (trust accounting + owner reporting)",
    ],
    augment: [
      "Owner-policy matching on every work order — drafts cite the policy line, never invent",
      "Renewal pricing — drafted with comparable-rent evidence from the local feed",
      "Compliance review on tenant communications — fair housing + state-specific notice rules",
      "Trust-accounting exception triage — drafted with bank-feed evidence attached",
    ],
  },

  integrations: {
    // Live today via OAuth — see `lib/integrations/marketplace.ts`.
    shipped: [
      { name: "QuickBooks Online", category: "Accounting" },
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    // Adapter built + tested behind the `RentRollLookup` port (wave-1,
    // `lib/integrations/buildium-mcp/` — the reference adapter). Going live
    // needs your Buildium API key + `BUILDIUM_ADAPTER_LIVE=on`.
    supported: [
      {
        name: "Buildium",
        category: "PMS",
        note: "Reads the rent roll behind the rent-collection chase loop. Pasting your Buildium API key turns it on.",
      },
    ],
    planned: [
      { name: "AppFolio", category: "PMS" },
      { name: "Propertyware", category: "PMS" },
      { name: "Yardi Breeze", category: "PMS" },
      { name: "Twilio Voice (inbound triage receiver)", category: "Telephony — inbound only" },
    ],
    plannedWindow: "Q3 2026",
  },

  valueLoopExample: {
    scenario:
      "Friday 4:53pm. Tenant maintenance request — water heater leaking, unit 4B.",
    before:
      "Triage in Buildium, check the work-order history, message the vendor, message the owner, schedule the visit, follow up Monday. ~25 minutes of inbox ping-pong over the weekend.",
    after:
      "The fleet classified the request as urgent water damage, pulled unit 4B's three prior plumbing tickets, drafted the vendor dispatch message, drafted the owner notification with the likely cost band, and proposed a Saturday morning slot. Everything queued for the property manager's review.",
    outcome:
      "One review, three approvals, one Saturday visit. The manager spends the weekend on owners and tenants, not on coordination.",
  },
};
