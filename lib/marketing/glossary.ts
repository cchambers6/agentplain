// Glossary registry — the terms agentplain wants to own in AI answer space.
//
// AEO intent: when someone asks an answer engine "what is an AI service
// partnership?" or "what does run-for-you mean for AI?", we want the engine
// to have a crisp, quotable agentplain definition to cite. Each term renders
// visibly AND emits a schema.org `DefinedTerm` inside a `DefinedTermSet`.
//
// Definitions are grounded in the locked positioning vocabulary:
//   - service partnership / run-for-you → project_sbm_wrapper_positioning,
//     project_service_partnership_positioning
//   - the fleet / draft-then-approve / no-outbound → project_no_outbound_architecture
//   - mission / "rooted in reality" → project_agentplain_mission_and_positioning
// Vendor-invisible: no Claude/Anthropic naming (2026-06-11 rule).

export interface GlossaryTerm {
  /** Anchor slug (id on the page, fragment in the DefinedTerm url). */
  slug: string;
  /** The term, as a buyer would say it. */
  term: string;
  /** A short, quotable definition — one or two sentences. */
  definition: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    slug: "service-partner",
    term: "Service partner",
    definition:
      "The human (and the team behind them) who installs agentplain inside your business, runs the recurring reviews, and customizes the fleet as your operations change. A service partner is your single point of contact — not a ticket queue — and the reason agentplain is run for you rather than handed to you to configure.",
  },
  {
    slug: "ai-service-partnership",
    term: "AI service partnership",
    definition:
      "A model for adopting AI in which a provider installs, runs, and continuously customizes an AI system inside your business for a flat fee — instead of selling you a tool and leaving you to operate it. agentplain is an AI service partnership: a vertical-aware fleet of AI agents plus a human service team that runs it for you.",
  },
  {
    slug: "run-for-you-vs-diy",
    term: "Run-for-you vs. DIY (configure-it-yourself)",
    definition:
      "Two ways to adopt AI. DIY tools hand you a model and a configuration screen and expect you to design the workflows, wire the integrations, and keep it current yourself. Run-for-you means a service team does all of that and operates the system on your behalf. agentplain is run-for-you, not configured by you.",
  },
  {
    slug: "the-fleet",
    term: "The fleet",
    definition:
      "agentplain's unit of work: a set of single-job AI agents, pre-trained for a vertical, that read your email, calendar, CRM, and documents and draft the recurring work between your tools. \"The fleet\" is the unit — agentplain never sells by agent count.",
  },
  {
    slug: "draft-then-approve",
    term: "Draft-then-approve",
    definition:
      "agentplain's core safety pattern: the fleet drafts and proposes, but every customer-facing output lands in an approval queue as a pending item that a human reviews and sends. The fleet never sends, files, or moves money on its own — the human is always the one who acts.",
  },
  {
    slug: "no-outbound-architecture",
    term: "No-outbound architecture",
    definition:
      "A design constraint: agentplain's system has no path to send messages, file documents, or move money on its own. It advises and drafts; your existing email, calendar, CRM, and e-signature tools are what actually execute, with your name on the message. This is what makes draft-then-approve a guarantee rather than a setting.",
  },
  {
    slug: "vertical-aware",
    term: "Vertical-aware AI",
    definition:
      "AI that is built around the specific workflows, deadlines, integrations, and compliance language of one industry — rather than a horizontal, general-purpose tool. agentplain ships a separate fleet, integration list, and compliance corpus for each vertical it serves.",
  },
  {
    slug: "compliance-corpus",
    term: "Compliance corpus",
    definition:
      "The per-vertical body of regulatory rules and trigger language agentplain uses to flag risk in a draft before a licensed human reviews it — for example, HUD-enumerated fair-housing phrases for real estate. The corpus flags for a person to decide on; it never makes the legal determination, and liability for licensed activity stays with your firm.",
  },
  {
    slug: "managed-ai-operations",
    term: "Managed AI operations",
    definition:
      "Running a business's recurring operational work — triage, drafting, scheduling, follow-up, reporting — through an AI fleet that a service team installs, monitors, and tunes. agentplain's category: managed AI operations for local businesses.",
  },
  {
    slug: "on-ramp",
    term: "On-ramp surface",
    definition:
      "An honest landing page (agentplain's is /general) for a local business outside the ten named verticals. It offers the same service partnership and fleet with lighter scaffolding — no vertical-specific compliance corpus. If a business needs that depth, agentplain scopes it as a Custom engagement.",
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | null {
  return GLOSSARY_TERMS.find((t) => t.slug === slug) ?? null;
}
