import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApHeritageButton,
  ApPaperCard,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { PrismaOpsFlagStore } from "@/lib/ops/prisma-flag-store";
import { readWorkspaceAutonomySettings } from "@/lib/skills/autonomy-settings";
import type { WorkApprovalKind } from "@prisma/client";
import { saveAutonomyAction } from "./actions";
import { SettingAffects } from "../SettingAffects";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Plain-English labels for the allowlisted classes. The allowlist
 *  itself (lib/skills/bounded-execute.ts) is the source of truth for
 *  WHICH kinds appear — this map only names them for owners. */
const KIND_LABELS: Record<string, string> = {
  ADMIN_BILLING_NOTICE: "Billing-notice acknowledgements",
  ADMIN_TRIAL_ENDING: "Trial & renewal reminders",
  ADMIN_VERIFICATION_CODE: "Verification-code filing",
  FOLLOW_UP_NUDGE: "Follow-up nudges",
  CHIEF_OF_STAFF_TODO: "To-do filing",
  CHIEF_OF_STAFF_MEETING: "Meeting bookings",
};

function labelForKind(kind: WorkApprovalKind): string {
  return KIND_LABELS[kind] ?? kind;
}

/** Shape of the auto-execute audit payload written by
 *  lib/skills/persist-artifacts.ts (applyBoundedExecuteDecision). Parsed
 *  defensively — the payload is Json and older rows may differ. */
function readAuditPayload(raw: unknown): {
  kind: string | null;
  detail: string | null;
  ceilingUsd: number | null;
} {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: null, detail: null, ceilingUsd: null };
  }
  const p = raw as Record<string, unknown>;
  return {
    kind: typeof p.kind === "string" ? p.kind : null,
    detail: typeof p.detail === "string" ? p.detail : null,
    ceilingUsd:
      typeof p.ceilingUsd === "number" && Number.isFinite(p.ceilingUsd)
        ? p.ceilingUsd
        : null,
  };
}

const TRUST_WINDOW_DAYS = 14;

export default async function AutonomyPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  // Read the policy through the SAME resolvers the decision path uses —
  // what renders here is exactly what would fire, fresh per request.
  const settings = await readWorkspaceAutonomySettings({
    store: new PrismaOpsFlagStore(),
    workspaceId,
  });

  // Trust surface: every action auto-executed on this workspace's
  // behalf in the last 14 days, straight from the immutable audit rows
  // the allow branch writes in the same transaction as the approval.
  const since = new Date(Date.now() - TRUST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const autoExecuted = await withRls(ctx, (tx) =>
    tx.auditLog.findMany({
      where: {
        workspaceId,
        action: "work_approval.auto_executed",
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
      select: { id: true, occurredAt: true, payload: true },
    }),
  );

  return (
    <div>
      <ApEyebrow className="mb-3">settings · autonomy</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Decide what runs without you.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        A small set of reversible, low-stakes action classes can flow
        through without waiting for your click — each under a dollar
        ceiling you set. Your settings govern only this workspace.
        Anything not listed here always waits for your approval, no
        setting can change that.
      </p>
      <SettingAffects>
        Whether a matching low-stakes item is handled automatically or
        waits in /approvals for your click. Your toggle and ceiling apply
        to this workspace only; the ceiling can tighten the platform-wide
        ceiling but never exceed it. Every automatic action is recorded
        below. agentplain still never sends — your own system performs
        any downstream action.
      </SettingAffects>

      {!settings.ok ? (
        <p className="mt-8 border border-rule bg-paper p-4 text-[14px] leading-relaxed text-ink-soft">
          We couldn&rsquo;t read your autonomy settings just now. Nothing
          auto-executes while settings are unreadable — every action
          waits for your approval. Refresh to try again.
        </p>
      ) : (
        <>
          {!settings.value.masterOn ? (
            <p className="mt-6 max-w-2xl border border-rule bg-paper p-4 text-[13px] leading-relaxed text-ink-soft">
              Autonomy is not yet switched on platform-wide, so nothing
              auto-executes today regardless of these settings. Set your
              preferences now — they take effect the moment it goes live.
            </p>
          ) : null}

          <ul className="mt-8 space-y-4">
            {settings.value.classes.map((c) => {
              const prefFieldId = `autonomy-pref-${c.kind.toLowerCase()}`;
              const ceilingFieldId = `autonomy-ceiling-${c.kind.toLowerCase()}`;
              return (
                <li key={c.kind}>
                  <ApPaperCard eyebrow={c.kind} title={labelForKind(c.kind)}>
                    <p className="text-[14px] leading-relaxed text-ink-soft">
                      {c.reversibility}
                    </p>
                    <p className="mt-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      currently{" "}
                      {c.effectiveEnabled
                        ? `on · up to $${c.effectiveCeilingUsd.toFixed(2)}`
                        : "off"}{" "}
                      ({c.effectiveEnabled
                        ? c.effectiveCeilingScope
                        : c.effectiveEnabledScope}{" "}
                      setting)
                    </p>
                    <form
                      action={saveAutonomyAction}
                      className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                    >
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="kind" value={c.kind} />
                      <label
                        htmlFor={prefFieldId}
                        className="flex flex-col gap-1 text-sm"
                      >
                        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                          handle automatically
                        </span>
                        <select
                          id={prefFieldId}
                          name="preference"
                          defaultValue={c.preference}
                          className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                        >
                          <option value="inherit">platform default</option>
                          <option value="on">on for this workspace</option>
                          <option value="off">off for this workspace</option>
                        </select>
                      </label>
                      <label
                        htmlFor={ceilingFieldId}
                        className="flex flex-col gap-1 text-sm"
                      >
                        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                          my ceiling, $ (blank = platform ceiling)
                        </span>
                        <input
                          id={ceilingFieldId}
                          name="ceilingUsd"
                          type="number"
                          step="1"
                          min="1"
                          defaultValue={c.workspaceCeilingUsd ?? ""}
                          placeholder="(platform ceiling)"
                          className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                        />
                      </label>
                      <ApHeritageButton variant="secondary" type="submit">
                        save
                      </ApHeritageButton>
                    </form>
                    <p className="mt-3 text-[12px] text-ink-soft">
                      Your ceiling can only tighten the platform ceiling,
                      never exceed it. Setting it higher simply means the
                      platform ceiling applies.
                    </p>
                  </ApPaperCard>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <section className="mt-12">
        <ApEyebrow className="mb-3">
          what plaino did autonomously · last {TRUST_WINDOW_DAYS} days
        </ApEyebrow>
        {autoExecuted.length === 0 ? (
          <p className="max-w-2xl text-[14px] leading-relaxed text-ink-soft">
            Nothing yet. When an action flows through under your ceiling,
            it shows up here the moment it happens — every one carries an
            immutable audit record.
          </p>
        ) : (
          <ApHairlineList aria-label="Autonomously executed actions">
            {autoExecuted.map((row) => {
              const p = readAuditPayload(row.payload);
              return (
                <ApHairlineRow
                  key={row.id}
                  right={
                    <span className="font-mono text-[11px] text-mute">
                      {new Date(row.occurredAt).toLocaleString()}
                    </span>
                  }
                >
                  <p className="font-display text-base leading-tight text-ink">
                    {p.kind ? labelForKind(p.kind as WorkApprovalKind) : "Autonomous action"}
                    {p.ceilingUsd !== null
                      ? ` · cleared the $${p.ceilingUsd.toFixed(2)} ceiling`
                      : ""}
                  </p>
                  {p.detail ? (
                    <p className="mt-1 text-[13px] leading-relaxed text-mute">
                      {p.detail}
                    </p>
                  ) : null}
                </ApHairlineRow>
              );
            })}
          </ApHairlineList>
        )}
      </section>
    </div>
  );
}
