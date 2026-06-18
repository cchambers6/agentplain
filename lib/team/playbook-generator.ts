/**
 * lib/team/playbook-generator.ts
 *
 * New-hire onboarding playbook generator (item 9 of the 2026-06-17
 * strategic build). The premise: a 5–15 person shop already has working
 * patterns — who handles what, in what context, with what voice — but
 * they live in people's heads. When a new hire joins, the owner re-explains
 * it all. This analyzes the workspace's OWN history and writes the playbook
 * the new hire can read on day one.
 *
 * It is a heuristic summarizer, not an LLM call — it reads durable signal
 * (who decided which discipline's work, how the team routes, the role
 * presets for the vertical, the captured voice) and renders deterministic
 * markdown. No ANTHROPIC_API_KEY needed (per the build's "don't restore
 * prod key" constraint); a future wave can add an LLM polish pass behind
 * the existing degraded-mode seam.
 *
 * The core (`generatePlaybook`) is pure: data in, markdown out. The DB
 * wrapper gathers the inputs.
 */

import type { Role, Vertical } from '@prisma/client';
import { withRls, type RlsContext } from '@/lib/db';
import { listDisciplines, type DisciplineId } from '@/lib/disciplines';
import { roleLabel } from '@/lib/auth/roles';
import { getRolePreset, type RolePreset } from './role-presets';
import { TAG_TO_DISCIPLINE, type RoutingTag } from './routing-tags';

/** A teammate as the playbook describes them. */
export interface PlaybookMember {
  label: string;
  role: Role;
  /** Disciplines this person leads (DisciplineHead assignments). */
  leadsDisciplines: DisciplineId[];
  /** How many approval-queue items they've decided (activity weight). */
  decisionCount: number;
}

export interface PlaybookInput {
  workspaceName: string;
  partnerName: string;
  vertical: Vertical | null;
  /** The new hire's recommended seat (a preset role), if chosen. */
  newHirePreset?: RolePreset | null;
  /** Existing team, busiest first. */
  members: PlaybookMember[];
  /** Captured voice/tone note for the workspace, if any. */
  voiceSummary?: string | null;
}

function disciplineName(id: DisciplineId): string {
  return listDisciplines().find((d) => d.id === id)?.name ?? id;
}

/** Tags that route into a given discipline — for the "what reaches you". */
function tagsForDiscipline(discipline: DisciplineId): RoutingTag[] {
  return (Object.entries(TAG_TO_DISCIPLINE) as [RoutingTag, DisciplineId][])
    .filter(([, d]) => d === discipline)
    .map(([tag]) => tag);
}

/**
 * Render the onboarding playbook as markdown. Pure + deterministic.
 */
export function generatePlaybook(input: PlaybookInput): string {
  const preset = getRolePreset(input.vertical);
  const lines: string[] = [];

  lines.push(`# Welcome to ${input.workspaceName}`);
  lines.push('');
  lines.push(
    `This is your onboarding playbook — generated from how ${input.workspaceName} ` +
      `actually works, not a generic template. ${input.partnerName} keeps it current ` +
      `as the team's patterns change.`,
  );
  lines.push('');

  // --- Your role ---------------------------------------------------------
  if (input.newHirePreset) {
    const p = input.newHirePreset;
    lines.push(`## Your role: ${p.title}`);
    lines.push('');
    lines.push(p.description);
    lines.push('');
    lines.push(`- **Access level:** ${roleLabel(p.baseRole)}`);
    if (p.disciplines.length > 0) {
      lines.push(
        `- **You'll own:** ${p.disciplines.map(disciplineName).join(', ')}`,
      );
    }
    if (p.routingTags.length > 0) {
      lines.push(`- **Work that routes to you:** ${p.routingTags.join(', ')}`);
    }
    lines.push('');
  }

  // --- Who does what -----------------------------------------------------
  lines.push('## Who does what');
  lines.push('');
  if (input.members.length === 0) {
    lines.push('_No teammates on the roster yet._');
  } else {
    for (const m of input.members) {
      const leads =
        m.leadsDisciplines.length > 0
          ? ` — leads ${m.leadsDisciplines.map(disciplineName).join(', ')}`
          : '';
      const activity =
        m.decisionCount > 0
          ? ` _(handled ${m.decisionCount} item${m.decisionCount === 1 ? '' : 's'} recently)_`
          : '';
      lines.push(`- **${m.label}** · ${roleLabel(m.role)}${leads}${activity}`);
    }
  }
  lines.push('');

  // --- How work reaches you ---------------------------------------------
  lines.push('## How work reaches you');
  lines.push('');
  lines.push(
    'Work is routed automatically based on what it is and how urgent it is:',
  );
  lines.push('');
  lines.push('1. **Anything marked URGENT** goes to the owner to triage.');
  lines.push(
    '2. **Work assigned to you directly at intake** comes straight to you.',
  );
  lines.push(
    "3. **Tagged work** (e.g. BILLING, LEGAL) routes to that area's lead.",
  );
  lines.push(
    "4. **Everything else** routes to the relevant discipline's lead, " +
      'or stays open for any qualified member.',
  );
  lines.push('');
  if (input.newHirePreset && input.newHirePreset.disciplines.length > 0) {
    const youGet = input.newHirePreset.disciplines.flatMap(tagsForDiscipline);
    if (youGet.length > 0) {
      lines.push(
        `As **${input.newHirePreset.title}**, expect to see work tagged: ` +
          `${[...new Set(youGet)].join(', ')}.`,
      );
      lines.push('');
    }
  }

  // --- Voice & tone ------------------------------------------------------
  lines.push('## Voice & tone');
  lines.push('');
  if (input.voiceSummary) {
    lines.push(input.voiceSummary);
  } else {
    lines.push(
      `${input.partnerName} drafts everything customer-facing in ${input.workspaceName}'s ` +
        'voice — you review and approve before anything is sent. When you edit a draft, ' +
        'those corrections teach the voice over time. Keep it warm, plain, and direct.',
    );
  }
  lines.push('');

  // --- First week --------------------------------------------------------
  lines.push('## Your first week');
  lines.push('');
  lines.push('- [ ] Sign in and add a passkey for faster access.');
  lines.push("- [ ] Skim today's approval queue to see the kind of work that flows in.");
  lines.push('- [ ] Review the people above so you know who to hand things to.');
  if (input.newHirePreset && input.newHirePreset.disciplines.length > 0) {
    lines.push(
      `- [ ] Approve your first item in ${input.newHirePreset.disciplines
        .map(disciplineName)
        .join(' / ')}.`,
    );
  }
  lines.push('- [ ] Ask the owner anything this playbook left unclear.');
  lines.push('');

  // --- Footer ------------------------------------------------------------
  lines.push('---');
  lines.push('');
  lines.push(
    `_Generated by ${input.partnerName} from ${input.workspaceName}'s team patterns. ` +
      `Team shape based on the ${preset.label} preset._`,
  );

  return lines.join('\n');
}

/**
 * DB-backed playbook for a workspace. Gathers the roster + DisciplineHead
 * assignments + recent decision counts, optionally targets a preset role
 * for the new hire, and renders the markdown.
 *
 * Cold-start safe — every input is read fresh.
 */
export async function generatePlaybookForWorkspace(
  ctx: RlsContext,
  opts: {
    workspaceId: string;
    workspaceName: string;
    partnerName: string;
    vertical: Vertical | null;
    /** Preset key for the new hire's seat (e.g. 'bookkeeper'), optional. */
    newHirePresetKey?: string | null;
    voiceSummary?: string | null;
    windowDays?: number;
  },
): Promise<string> {
  const since = new Date(Date.now() - (opts.windowDays ?? 30) * 24 * 60 * 60 * 1000);

  const [members, heads, decisionGroups] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.membership.findMany({
        where: { workspaceId: opts.workspaceId, status: 'ACTIVE', removedAt: null },
        select: {
          userId: true,
          role: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.disciplineHead.findMany({
        where: { workspaceId: opts.workspaceId },
        select: { discipline: true, userId: true },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.workApprovalQueueItem.groupBy({
        by: ['decidedByUserId'],
        where: {
          workspaceId: opts.workspaceId,
          decidedAt: { gte: since },
          decidedByUserId: { not: null },
        },
        _count: { _all: true },
      }),
    ),
  ]);

  const leadsByUser = new Map<string, DisciplineId[]>();
  for (const h of heads) {
    const list = leadsByUser.get(h.userId) ?? [];
    list.push(h.discipline as DisciplineId);
    leadsByUser.set(h.userId, list);
  }
  const countByUser = new Map<string, number>();
  for (const g of decisionGroups) {
    if (g.decidedByUserId) countByUser.set(g.decidedByUserId, g._count._all);
  }

  const playbookMembers: PlaybookMember[] = members
    .map((m) => ({
      label: m.user.name ?? m.user.email,
      role: m.role,
      leadsDisciplines: leadsByUser.get(m.userId) ?? [],
      decisionCount: countByUser.get(m.userId) ?? 0,
    }))
    .sort((a, b) => b.decisionCount - a.decisionCount);

  const preset = getRolePreset(opts.vertical);
  const newHirePreset = opts.newHirePresetKey
    ? preset.roles.find((r) => r.key === opts.newHirePresetKey) ?? null
    : null;

  return generatePlaybook({
    workspaceName: opts.workspaceName,
    partnerName: opts.partnerName,
    vertical: opts.vertical,
    newHirePreset,
    members: playbookMembers,
    voiceSummary: opts.voiceSummary,
  });
}
