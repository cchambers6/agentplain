/**
 * lib/skills/skill-scorecard.ts
 *
 * Per-skill activity rollup the discipline detail page renders into a
 * scorecard section. Reads from WorkApprovalQueueItem + (when
 * available) WorkspaceSkillInstallation + WorkspaceMemoryEntry, joins
 * by the skill's agentSlug (which matches the skill slug 1:1 for every
 * skill that owns its own prisma-approval-sink — chain-driven drafts
 * stay attributed to the chain agent and are not double-counted here).
 *
 * Per `feedback_no_silent_vendor_lock.md`: this module reads from
 * Prisma directly because that is the persistence boundary it owns.
 * Skills that produce approval rows do not change.
 *
 * Per the wave-5 honesty bar: empty/uninstalled skills get an
 * EXPLICITLY ROOTED state on the card — we do not render a "0 drafts
 * / 0% accepted" placeholder that reads like a hollow score.
 *
 * Honesty note: agentplain does not currently persist a SkillRun
 * audit table — the JSONL log under agent-state/skill-runs/ stays
 * write-only at the operator level. The scorecard derives "did this
 * skill fire" from "did the skill write to /approvals". That is
 * accurate for the draft-producing skills here; it under-counts the
 * pure-triage paths (lead-triage on a cold lead writes nothing).
 * The card surface explicitly says "drafts in last 7 days" rather
 * than "fires" to keep the language honest.
 */

import type { PrismaClient, WorkApprovalStatus } from '@prisma/client';

export interface SkillScorecard {
  skillSlug: string;
  /** Total approval-row count for this skill in the last 7 days. */
  draftsLast7d: number;
  /** Of the rows decided in the last 7 days, the fraction that landed
   *  in APPROVED / AUTO_APPROVED. null when no rows were decided. */
  acceptanceRate7d: number | null;
  /** Most-recent approval row's `proposedAt`, ISO. null when nothing
   *  has ever fired for this skill in this workspace. */
  lastFireIso: string | null;
  /** Install state. */
  installState: 'installed' | 'uninstalled' | 'never-installed';
  /** Count of FEEDBACK rules with scope=general OR scope matching the
   *  skill's discipline. */
  feedbackRuleCount: number;
}

export interface BuildScorecardArgs {
  /** Anything Prisma-shaped that walks `workApprovalQueueItem`,
   *  `workspaceSkillInstallation`, `workspaceMemoryEntry`. Pass an RLS
   *  tx from a server component. */
  tx: Pick<
    PrismaClient,
    'workApprovalQueueItem' | 'workspaceSkillInstallation' | 'workspaceMemoryEntry'
  >;
  workspaceId: string;
  skillSlug: string;
  /** Discipline the skill belongs to — used to filter FEEDBACK rules
   *  to the scopes this skill actually reads (always `general`, plus
   *  the discipline's own scope when one exists, e.g. `finance`). */
  disciplineId: string;
  /** Optional fixed clock for tests. */
  now?: Date;
}

const MS_PER_DAY = 86_400_000;

/**
 * Map a discipline id to the PREFERENCE_SCOPE_IDS members the skills
 * inside that discipline read at fire time. Keeping this here rather
 * than in skill-mapping.ts because it's a presentation concern (the
 * scorecard wants to count "rules the skill would honor"), not a
 * runtime gating concern.
 */
const DISCIPLINE_SCOPES: Record<string, string[]> = {
  operations: ['inbox-triage', 'email-draft', 'scheduling'],
  'customer-success': ['customer-comms', 'email-draft'],
  'sales-enablement': ['email-draft', 'customer-comms'],
  marketing: ['email-draft', 'customer-comms'],
  legal: ['legal-flagging'],
  finance: ['finance', 'reporting'],
  analytics: ['reporting'],
  research: [],
};

function scopesForDiscipline(disciplineId: string): string[] {
  return DISCIPLINE_SCOPES[disciplineId] ?? [];
}

export async function buildSkillScorecard(
  args: BuildScorecardArgs,
): Promise<SkillScorecard> {
  const now = args.now ?? new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);

  const [rows7d, latest, installation, feedbackRows] = await Promise.all([
    args.tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        agentSlug: args.skillSlug,
        proposedAt: { gte: sevenDaysAgo },
      },
      select: { status: true, decidedAt: true },
    }),
    args.tx.workApprovalQueueItem.findFirst({
      where: { workspaceId: args.workspaceId, agentSlug: args.skillSlug },
      orderBy: { proposedAt: 'desc' },
      select: { proposedAt: true },
    }),
    args.tx.workspaceSkillInstallation.findUnique({
      where: {
        workspaceId_skillSlug: {
          workspaceId: args.workspaceId,
          skillSlug: args.skillSlug,
        },
      },
      select: { disabledAt: true },
    }),
    // FEEDBACK rules tagged with `pref:<scope>` titles (the convention
    // /talk's preference-memory writer uses) for any of the scopes
    // this skill reads. We count rows; the renderer surfaces this as
    // "X customer rules apply to this skill."
    args.tx.workspaceMemoryEntry.findMany({
      where: {
        workspaceId: args.workspaceId,
        kind: 'FEEDBACK',
        title: {
          in: [
            'pref:general',
            ...scopesForDiscipline(args.disciplineId).map((s) => `pref:${s}`),
          ],
        },
      },
      select: { id: true },
    }),
  ]);

  const draftsLast7d = rows7d.length;
  const decided = rows7d.filter((r) => r.decidedAt !== null);
  const accepted = decided.filter(
    (r) =>
      r.status === ('APPROVED' as WorkApprovalStatus) ||
      r.status === ('AUTO_APPROVED' as WorkApprovalStatus),
  ).length;
  const acceptanceRate7d = decided.length > 0 ? accepted / decided.length : null;

  const installState: SkillScorecard['installState'] = !installation
    ? 'never-installed'
    : installation.disabledAt === null
      ? 'installed'
      : 'uninstalled';

  return {
    skillSlug: args.skillSlug,
    draftsLast7d,
    acceptanceRate7d,
    lastFireIso: latest?.proposedAt.toISOString() ?? null,
    installState,
    feedbackRuleCount: feedbackRows.length,
  };
}
