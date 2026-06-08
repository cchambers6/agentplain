import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` roadmap note +
// `agentplain_positioning.md` listing title/escrow as adjacent.
//
// JTBD ratified 2026-05-12 against published role workflows for 3–20-person
// title/escrow operations (ALTA Best Practices role definitions, NAILTA
// scope-of-practice for independent title shops, SoftPro/Qualia/RamQuest
// public role documentation). Four roles surfaced — Owner/managing EO,
// Escrow officer/closer, Title examiner, Post-closer/recording clerk. In
// most shops at this size the title-examiner work is performed by a
// dedicated person (or contracted to an abstractor) but is operationally
// distinct from the closer role, so it gets its own JTBD row.

export const titleEscrow: VerticalContent = {
  slug: "title-escrow",
  name: "Title & escrow",
  tier: "regular",
  missionSubject: "title and escrow agencies",

  // Fleet surfaced in-product on /agents, grounded in the title-escrow
  // JTBD tables. All seven capabilities are honestly rooting today — each
  // depends on the title production system (SoftPro / Qualia / RamQuest),
  // the county title-plant feed, or the underwriter portal. File Intake's
  // job is parsing inbound realtor/lender source documents into structured
  // file fields, not classifying email — the V1 inbox loop produces a
  // generic draft reply for inbound email today and lands it in Approvals
  // under the generic inbox triage attribution. No hollow shells.
  agentRoster: [
    {
      slug: "title-file-intake",
      name: "File Intake",
      job: "Parses realtor and lender source documents and drafts the file to confirm.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your title production system (SoftPro / Qualia / RamQuest) is connected to receive the parsed file.",
    },
    {
      slug: "title-doc-chase",
      name: "Document Chase",
      job: "Runs the doc-collection cadence per channel and escalates only when stuck.",
      runtime: "live",
      // Live via the title-escrow-closing-doc-chase skill — works on a
      // JSON-stub closing file today; binds to SoftPro / Qualia / RamQuest
      // MCPs once they ship. Title status + wire-instructions confirmation
      // always defer to {{operator: ...}} merge fields the escrow officer
      // confirms before the chase email leaves the closing coordinator's
      // outbox.
      boundSkill: "title-escrow-closing-doc-chase",
    },
    {
      slug: "title-search",
      name: "Title Search",
      job: "Drafts the chain of title from the plant feed; examiner reviews defects only.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your county title plant or DataTrace / NetROnline feed is connected.",
    },
    {
      slug: "title-closing-prep",
      name: "Closing Prep",
      job: "Drafts the closing packet against file state for the closer to review.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your underwriter portal and production-system file state are connected.",
    },
    {
      slug: "title-recording",
      name: "Recording Coordinator",
      job: "Prepares the recording package per county schema for the clerk to submit.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your county recording integration (Simplifile / CSC) is connected.",
    },
    {
      slug: "title-trust-recon",
      name: "Trust Reconciler",
      job: "Drafts the per-file trust reconciliation citing each disbursement against the CD.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your escrow trust-account ledger is connected.",
    },
    {
      slug: "title-compliance-sentinel",
      name: "Compliance Sentinel",
      job: "Runs a CFPB-aware check on every customer-facing draft before send.",
      runtime: "rooting",
      rootingNote:
        "rooting now — CFPB-aware checklist corpus is loaded; draft scoring activates after counsel review.",
    },
    {
      // Horizontal chief-of-staff capability — proposals only, no execution.
      slug: "title-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the closer's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Built for local title and escrow agencies",
    headline: "The fleet for the local title agency.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. Title-production (SoftPro /
    // RamQuest / Qualia / ResWare), underwriter-portal, county-recording, and
    // title-plant adapters live in the per-vertical integration roadmap below
    // and surface honestly there as planned, not in this present-tense hero
    // clause.
    valueProp:
      "agentplain REPLACES the file-intake and document-collection scramble, INTEGRATES with Outlook, OneDrive, Excel, and DocuSign on day one, and AUGMENTS the closer's read on every closing-day prep packet.",
    sbmSubhead:
      "The closing-file skills, agents, and memory you'd otherwise have to build yourself — built on Claude, configured by us.",
  },

  metaTitle: "for local title and escrow agencies",
  metaDescription:
    "File intake from realtor/lender channels, milestone tracking, closing-day prep, recording follow-up, and CFPB-aware comms — for the 3–20 person title shop.",

  jtbdTables: [
    {
      role: "Owner / managing escrow officer",
      draft: false,
      rows: [
        {
          job: "Know which files are at risk of missing closing",
          when: "Daily, mid-day",
          today: "Walk the office, ask the closing team",
          withAgentplain:
            "File-status board — every file with current bottleneck (title cure / lender doc / payoff / wire)",
        },
        {
          job: "Triage an underwriter requirement",
          when: "Reactive, time-sensitive",
          today: "Email forward + verbal handoff",
          withAgentplain:
            "Underwriter-requirement agent drafts the cure plan, routes to the right desk, logs the response",
        },
        {
          job: "Review CFPB-sensitive customer communications",
          when: "Pre-close",
          today: "Closer-by-closer judgment, no consistent review",
          withAgentplain:
            "Compliance agent reviews every customer-facing draft; flags before send",
        },
      ],
    },
    {
      role: "Escrow officer / closer",
      draft: false,
      rows: [
        {
          job: "Open a new file from a realtor or lender intake",
          when: "Inbound, all day",
          today: "Manual data entry from PDF and email",
          withAgentplain:
            "Intake agent parses the source documents, drafts the file in your title system for one-click confirm",
        },
        {
          job: "Chase missing documents from realtor + lender",
          when: "Continuous through the cycle",
          today: "Phone tag + reactive email",
          withAgentplain:
            "Doc-chase agent runs the cadence per channel, escalates only when stuck",
        },
        {
          job: "Prepare the closing packet",
          when: "T-2 / T-1 of every closing",
          today: "Manual checklist, hand-built packet",
          withAgentplain:
            "Closing-prep agent drafts the packet against the file state; closer reviews the exceptions",
        },
      ],
    },
    {
      role: "Title examiner",
      draft: false,
      rows: [
        {
          job: "Run the title search and assemble the chain of title",
          when: "Per file, T-7 to T-14 of every closing",
          today: "Walk the county records / title plant, transcribe the chain by hand",
          withAgentplain:
            "Title-search agent drafts the chain from the title plant feed; examiner reviews defects and exceptions only",
        },
        {
          job: "Draft the commitment with Schedule B exceptions",
          when: "Post-search, every file",
          today: "Template + manual exception transcription from chain notes",
          withAgentplain:
            "Commitment agent drafts the document with Schedule B exceptions cited to the chain entry; examiner clears the borderline calls",
        },
        {
          job: "Coordinate title-cure work on flagged exceptions",
          when: "Reactive when a defect is identified",
          today: "Phone tag + email between examiner, closer, and the prior owner / lender",
          withAgentplain:
            "Cure agent drafts the cure plan citing the defect type, drafts the lien-release request or release-of-mortgage demand, and routes to the right party",
        },
      ],
    },
    {
      role: "Post-closer / recording clerk",
      draft: false,
      rows: [
        {
          job: "Coordinate recording across counties",
          when: "Day-of / day-after close",
          today: "Per-county portal navigation by hand",
          withAgentplain:
            "Recording agent prepares the package per county schema; clerk submits and logs the return",
        },
        {
          job: "Issue the final policy to lender + owner",
          when: "Post-recording, every file",
          today: "Template + manual policy data entry from the commitment",
          withAgentplain:
            "Policy agent drafts the lender + owner policy with Schedule B exceptions carried forward from the commitment; clerk reviews the variances only",
        },
        {
          job: "Reconcile escrow trust account against the file",
          when: "Post-disbursement, every file + monthly aggregate",
          today: "Trust-account spreadsheet + bank-feed reconciliation by hand",
          withAgentplain:
            "Trust-recon agent drafts the per-file reconciliation citing each disbursement against the CD; clerk reviews exceptions",
        },
      ],
    },
  ],

  roi: {
    multiplier: "10x–20x",
    inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free",
    outputValue: "$24,000 / yr per closer in cycle-time reclamation",
    math:
      "Average closer handles 30–50 files/month. File-intake automation saves ~45 minutes/file. 40 files × 0.75 hours × $40/hr × 12 months = $14,400/yr per closer. Closing-prep automation saves another ~30 minutes/file = ~$9,600/yr — total ~$24k/yr (~$2,000/mo) per closer. Solo case: against the Regular-tier solo seat ($199/mo) = ~10x ROI. At-scale case: same per-closer value against the 50-seat-band price ($99/mo) = ~20x. Multi-closer title/escrow offices typically see the at-scale economics.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Regular tier per the 2026-05-15 three-tier ratification — Regular is the default entry path; title/escrow operations wanting named-service-partner reserved time can step up to Partner ($299→$199/seat), and high-intensity multi-state closing engagements route to Max (quote-based)). ROI band per `project_pricing_value_anchor.md` (Regular-tier value $2,900–$10,600/mo per seat). Time-per-file estimates pending primary-research validation — flagged in capability inbox. Closer compensation midpoint based on US BLS 2024 SOC 13-2072 (loan officers and related) — flagged as operator-modeled.",
    violationAvoidance:
      "Closing and settlement communications are governed by ALTA Best Practices and CFPB enforcement of RESPA — a referral-fee or unearned-fee implication carries RESPA §8 exposure ($10,000 criminal plus CFPB civil penalties reaching $1,443,275 for knowing violations, 2025 inflation-adjusted), and an ALTA pillar finding can cost the lender relationships the office runs on. The fleet drafts settlement correspondence and a closer approves before send, so a RESPA-implicating line never reaches a borrower or lender. That avoided penalty — and the kept lender relationship — is value the 10x–20x hours math doesn't price, and an auto-send tool can't guarantee it.",
  },

  claims: {
    replace: [
      "Manual file intake from realtor and lender PDFs",
      "Reactive document chase across realtor + lender channels",
      "Hand-built closing-prep packets — replaced by drafted packets",
      "Per-county recording portal navigation — drafted submissions for clerk to confirm",
    ],
    integrate: [
      "Outlook (per-closer OAuth — email + calendar)",
      "OneDrive + Excel (file substrate + trust workbooks)",
      "DocuSign (closing-day signature routing)",
    ],
    augment: [
      "Closer review on every customer-facing communication — CFPB-aware draft",
      "Title-cure planning — drafted with chain-of-title evidence cited",
      "Underwriter-requirement routing — drafts cite the requirement number, never invent",
      "Wire-fraud guard — every wire instruction draft cross-checked against verified-channel data",
    ],
  },

  integrations: {
    // Live today via OAuth — see `lib/integrations/marketplace.ts`.
    shipped: [
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    // Adapter built + tested behind the `ClosingFileFetcher` port (wave-1b,
    // `lib/integrations/qualia-mcp/`). Going live needs your Qualia API
    // credential + `QUALIA_ADAPTER_LIVE=on`.
    supported: [
      {
        name: "Qualia",
        category: "Title production",
        note: "Reads the closing file behind the closing-document chase loop. Connecting your Qualia credential turns it on.",
      },
    ],
    planned: [
      { name: "SoftPro", category: "Title production" },
      { name: "RamQuest", category: "Title production" },
      { name: "ResWare", category: "Title production" },
      { name: "Underwriter portals (top 4)", category: "Underwriter" },
      { name: "County recording portals", category: "Recording" },
    ],
    plannedWindow: "Q3 2026",
  },

  valueLoopExample: {
    scenario:
      "Closing is 9am Thursday. Wednesday 5pm a buyer's lender flags a payoff discrepancy.",
    before:
      "Pull the title file in SoftPro, find the prior payoff, re-request from the lender, draft the wire instructions update, notify the buyer's agent, the seller's agent, and the lender, then chase confirmations until 8pm. ~90 minutes.",
    after:
      "The fleet identified the discrepancy at 5:04pm, pulled the original payoff, drafted the lender re-request, drafted the agent + buyer notifications with the new figure, and queued the SoftPro update. All four messages are waiting in the closer's review queue at 5:08pm.",
    outcome:
      "The closer ships four reviewed messages before 5:30pm. Thursday's closing happens on schedule.",
  },
};
