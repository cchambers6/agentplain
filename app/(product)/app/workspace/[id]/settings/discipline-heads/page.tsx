import { ApEyebrow, ApHairlineList, ApHairlineRow } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { canPerform, roleLabel } from "@/lib/auth/roles";
import { withRls } from "@/lib/db";
import { listDisciplines } from "@/lib/disciplines";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { DisciplineHeadForm } from "./DisciplineHeadForm";
import { SettingAffects } from "../SettingAffects";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function DisciplineHeadsSettingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  // Page is owner-only. The membership filter accepts both the legacy
  // BROKER_OWNER value and the wave-6 OWNER value so existing
  // workspaces are not locked out.
  const member = await requireWorkspaceMember(workspaceId, [
    "BROKER_OWNER",
    "OWNER",
  ]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);
  const canAssign = canPerform(member.role, "discipline.head.assign");

  const [heads, activeMembers] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.disciplineHead.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.membership.findMany({
        where: { workspaceId, status: "ACTIVE", removedAt: null },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ),
  ]);

  const headsByDiscipline = new Map(heads.map((h) => [h.discipline, h]));
  const disciplines = listDisciplines();

  const memberChoices = activeMembers.map((m) => ({
    id: m.userId,
    label: m.user.name ?? m.user.email,
    role: roleLabel(m.role),
  }));

  return (
    <div className="space-y-10">
      <header>
        <ApEyebrow className="mb-3">per-discipline approver routing</ApEyebrow>
        <h1 className="font-display text-3xl text-ink">
          Who approves what
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Nominate a head for any of {partner}&apos;s eight disciplines.
          When a head is assigned, every new approval-queue item in that
          discipline routes to them — no one else can act on it until
          they do. Leave a discipline unassigned to keep the default
          ({"any qualified member can approve"}).
        </p>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
          <strong>Heads up:</strong> the auto-fallback to the owner if a
          head is unavailable for too long is queued for the next wave.
          Today, if you assign a head and they go on vacation, items
          pile up until they return or you reassign. If you do not have
          a deputy, consider leaving the discipline at the default.
        </p>
        <SettingAffects>
          Who can approve new work in a discipline. Assigning a head routes
          every new approval-queue item in that discipline to that one
          person; unassigning returns it to any-qualified-member routing.
          (See <code>lib/auth/route-approval.ts</code>.)
        </SettingAffects>
      </header>

      <section>
        <h2 className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          discipline heads
        </h2>
        <ApHairlineList className="mt-3" aria-label="Discipline heads">
          {disciplines.map((d) => {
            const head = headsByDiscipline.get(d.id);
            return (
              <ApHairlineRow
                key={d.id}
                right={
                  canAssign ? (
                    <DisciplineHeadForm
                      workspaceId={workspaceId}
                      discipline={d.id}
                      currentUserId={head?.userId ?? null}
                      memberChoices={memberChoices}
                    />
                  ) : null
                }
              >
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {d.name}
                  </p>
                  <p className="mt-1 text-[14px] text-ink">
                    {head ? (
                      <>
                        Routes to{" "}
                        <span className="font-medium">
                          {head.user.name ?? head.user.email}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-soft">
                        Any qualified member can approve (default)
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">{d.description}</p>
                </div>
              </ApHairlineRow>
            );
          })}
        </ApHairlineList>
      </section>
    </div>
  );
}
