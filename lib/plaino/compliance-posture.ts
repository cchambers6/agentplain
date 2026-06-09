/**
 * buildCompliancePostureCard — pure, deterministic builder behind the V33
 * "compliance posture mini" card (read-only coverage + recent-flag summary).
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §4 (visual library extension).
 *
 * Purpose: show the customer WHERE sentinel coverage exists and whether any
 * flags are open — the right answer to "what is my compliance situation?".
 * READ-ONLY: this card never causes a compliance action; it links to the
 * existing compliance page.
 *
 * Per project_compliance_corpus_lives_in_sentinel.md: the canonical compliance
 * corpus is in lib/agents/sentinel/. This builder reads a coverage snapshot
 * (per-vertical coverage areas + open/recent flags from the approvals state)
 * rather than running the sentinel — it summarizes what is already known.
 *
 * PURE function. No I/O, no LLM, no migration. Cold-start safe.
 *
 * TEXT FALLBACK: same contract as V27–V34 — always additive on top of
 * the prose reply; never the only source of compliance information.
 */
import type { ComplianceArea, CompliancePostureCard } from './visual-card';

export interface BuildCompliancePostureArgs {
  workspaceId: string;
  /** agentplain vertical id, e.g. "realty", "insurance", "home-services",
   *  or "general". Determines which coverage areas are shown. */
  vertical: string;
  /** Count of compliance flags open right now (from approvals state). */
  openFlags: number;
  /** Count of compliance flags raised in the last 30 days (from approvals
   *  state or audit log). */
  recentFlags: number;
}

/** Per-vertical coverage area definitions. Each area maps to a real corpus
 *  entry in lib/agents/sentinel/corpus/. "covered: true" means the sentinel
 *  ACTIVELY scans for issues in this area; "covered: false" means the area is
 *  known but currently uncovered (correct to say "not yet" per the
 *  DECLINE_HONESTLY discipline). */
const VERTICAL_COVERAGE: Record<string, ComplianceArea[]> = {
  realty: [
    { label: 'agency disclosure requirements', covered: true },
    { label: 'fair housing language', covered: true },
    { label: 'MLS advertising rules', covered: true },
    { label: 'title escrow protocols', covered: true },
    { label: 'RESPA anti-kickback', covered: false },
  ],
  insurance: [
    { label: 'licensed producer disclosure', covered: true },
    { label: 'premium quote accuracy', covered: true },
    { label: 'state-mandated policy language', covered: true },
    { label: 'claims handling requirements', covered: false },
  ],
  'home-services': [
    { label: 'contractor license disclosure', covered: true },
    { label: 'lien waiver language', covered: true },
    { label: 'warranty representation accuracy', covered: true },
    { label: 'OSHA subcontractor language', covered: false },
  ],
  general: [
    { label: 'outbound communication accuracy', covered: true },
    { label: 'contract clause basics', covered: true },
    { label: 'industry-specific terms', covered: false },
  ],
};

/**
 * Build the V33 compliance posture card. Returns the workspace's sentinel
 * coverage map + a live count of open/recent flags. The coverage areas are
 * static per-vertical; the flag counts come from the caller's live state.
 */
export function buildCompliancePostureCard(
  args: BuildCompliancePostureArgs,
): CompliancePostureCard {
  const { workspaceId, vertical, openFlags, recentFlags } = args;
  const coverageAreas =
    VERTICAL_COVERAGE[vertical] ?? VERTICAL_COVERAGE['general'];

  return {
    type: 'compliance-posture',
    vertical,
    coverageAreas,
    recentFlags,
    openFlags,
    complianceHref: `/app/workspace/${workspaceId}/compliance`,
  };
}
