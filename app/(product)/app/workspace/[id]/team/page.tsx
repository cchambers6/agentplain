import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApPaperCard,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { canPerform, roleLabel } from "@/lib/auth/roles";
import { withRls } from "@/lib/db";
import { listDisciplines } from "@/lib/disciplines";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { getRolePreset } from "@/lib/team/role-presets";
import { getMemberPerformance } from "@/lib/team/performance";
import {
  visibleActivityFor,
  canSeeAllActivity,
  type ActivityEntry,
} from "@/lib/team/activity";
import { MemberActivity } from "@/components/team/MemberActivity";
import { MemberPerformance } from "@/components/team/MemberPerformance";
import { InviteMemberForm } from "./InviteMemberForm";
import { MemberRoleControl } from "./MemberRoleControl";
import { GeneratePlaybookButton } from "./GeneratePlaybookButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_DAYS = 7;

export default async function TeamPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  // Every member can view this page (to see their own activity). Management
  // controls are gated per-action below.
  const member = await requireWorkspaceMember(workspaceId, [
    "BROKER_OWNER",
    "OWNER",
    "ADMIN",
    "MEMBER",
    "VIEWER",
  ]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);
  const canManage = canPerform(member.role, "roster.write");
  const seesAll = canSeeAllActivity(member.role);

  const [workspace, memberships, heads, perf, decided] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, vertical: true },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.membership.findMany({
        where: { workspaceId, status: { in: ["ACTIVE", "INVITED"] }, removedAt: null },
        select: {
          userId: true,
          role: true,
          status: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.disciplineHead.findMany({
        where: { workspaceId },
        select: { discipline: true, userId: true },
      }),
    ),
    getMemberPerformance(ctx, workspaceId, WINDOW_DAYS),
    // Recent decided items → the activity feed source.
    withRls(ctx, (tx) =>
      tx.workApprovalQueueItem.findMany({
        where: { workspaceId, decidedAt: { not: null } },
        select: {
          id: true,
          decidedByUserId: true,
          requiredApproverUserId: true,
          discipline: true,
          status: true,
          kind: true,
          agentSlug: true,
          decidedAt: true,
          decisionReason: true,
          decidedBy: { select: { name: true, email: true } },
        },
        orderBy: { decidedAt: "desc" },
        take: 60,
      }),
    ),
  ]);

  if (!workspace) return null;

  const preset = getRolePreset(workspace.vertical);
  const disciplines = listDisciplines();
  const disciplineName = (id: string) =>
    disciplines.find((d) => d.id === id)?.name ?? id;

  // Map userId → disciplines they lead.
  const leadsByUser = new Map<string, string[]>();
  for (const h of heads) {
    const list = leadsByUser.get(h.userId) ?? [];
    list.push(h.discipline);
    leadsByUser.set(h.userId, list);
  }

  // Build the activity feed, then enforce role-based visibility.
  const allActivity: ActivityEntry[] = decided.map((d) => ({
    id: d.id,
    actorUserId: d.decidedByUserId,
    actorLabel: d.decidedBy
      ? (d.decidedBy.name ?? d.decidedBy.email)
      : "Your fleet (automatic)",
    summary: `${statusVerb(d.status)} ${d.kind.toLowerCase().replace(/_/g, " ")} (${d.agentSlug})`,
    discipline: d.discipline,
    occurredAt: d.decidedAt as Date,
    assignedUserId: d.requiredApproverUserId,
  }));
  const visibleActivity = visibleActivityFor(member.role, member.userId, allActivity);

  // Performance: managers see the whole team; staff sees only their own row.
  const visiblePerf = seesAll
    ? perf
    : perf.filter((p) => p.userId === member.userId);

  const presetKeyChoices = preset.roles.map((r) => ({ key: r.key, title: r.title }));

  return (
    <div className="space-y-12">
      <header>
        <ApEyebrow className="mb-3">your team</ApEyebrow>
        <h1 className="font-display text-3xl text-ink">Team members</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          The people who run {workspace.name} alongside {partner}. Invite your
          team, set what each person can do, and see who&apos;s handling what.
        </p>
      </header>

      {/* Roster */}
      <section>
        <ApEyebrow className="mb-3">roster</ApEyebrow>
        <ApHairlineList aria-label="Team roster">
          {memberships.map((m) => {
            const leads = leadsByUser.get(m.userId) ?? [];
            const label = m.user.name ?? m.user.email;
            const isSelf = m.userId === member.userId;
            return (
              <ApHairlineRow
                key={m.userId}
                right={
                  canManage && !isSelf ? (
                    <MemberRoleControl
                      workspaceId={workspaceId}
                      userId={m.userId}
                      currentRole={m.role}
                      canManageOwner={canPerform(member.role, "roster.write.owner")}
                    />
                  ) : (
                    <span className="text-mute">{roleLabel(m.role)}</span>
                  )
                }
              >
                <div>
                  <p className="text-[14px] text-ink">
                    {label}
                    {isSelf ? (
                      <span className="ml-2 text-[12px] text-mute">(you)</span>
                    ) : null}
                    {m.status === "INVITED" ? (
                      <span className="ml-2 rounded-none border border-rule px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow text-mute">
                        invited
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">{m.user.email}</p>
                  {leads.length > 0 ? (
                    <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      leads {leads.map(disciplineName).join(", ")}
                    </p>
                  ) : null}
                </div>
              </ApHairlineRow>
            );
          })}
        </ApHairlineList>
      </section>

      {/* Invite + playbook — managers only */}
      {canManage ? (
        <section className="grid gap-8 md:grid-cols-2">
          <ApPaperCard>
            <ApEyebrow className="mb-3">invite a teammate</ApEyebrow>
            <InviteMemberForm
              workspaceId={workspaceId}
              canInviteAdmin={canPerform(member.role, "roster.write.owner")}
            />
            <p className="mt-3 text-[12px] leading-relaxed text-mute">
              They&apos;ll appear as <em>invited</em> until they accept. The
              acceptance flow (email link or SSO) is being finalized — invited
              seats grant nothing until sign-in.
            </p>
          </ApPaperCard>

          <ApPaperCard>
            <ApEyebrow className="mb-3">new-hire playbook</ApEyebrow>
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Generate an onboarding playbook from how your team actually works
              — who handles what, how work routes, and your voice. Hand it to a
              new hire on day one.
            </p>
            <div className="mt-4">
              <GeneratePlaybookButton
                workspaceId={workspaceId}
                presetChoices={presetKeyChoices}
              />
            </div>
          </ApPaperCard>
        </section>
      ) : null}

      {/* Performance KPIs */}
      <section>
        <MemberPerformance rows={visiblePerf} windowDays={WINDOW_DAYS} />
      </section>

      {/* Activity feed */}
      <section>
        <MemberActivity entries={visibleActivity} scope={seesAll ? "all" : "own"} />
      </section>

      {/* Role-preset reference for the vertical */}
      <section>
        <ApEyebrow className="mb-3">{preset.label} · suggested roles</ApEyebrow>
        <p className="mb-3 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
          {preset.summary}
        </p>
        <ApHairlineList aria-label="Suggested roles">
          {preset.roles.map((r) => (
            <ApHairlineRow
              key={r.key}
              right={<span className="text-mute">{roleLabel(r.baseRole)}</span>}
            >
              <div>
                <p className="text-[14px] text-ink">{r.title}</p>
                <p className="mt-1 text-[13px] text-ink-soft">{r.description}</p>
              </div>
            </ApHairlineRow>
          ))}
        </ApHairlineList>
      </section>
    </div>
  );
}

function statusVerb(status: string): string {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "AUTO_APPROVED":
      return "Auto-approved";
    case "REJECTED":
      return "Declined";
    case "EXPIRED":
      return "Let expire";
    default:
      return "Handled";
  }
}
