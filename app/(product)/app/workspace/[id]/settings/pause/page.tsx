import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { decrypt } from "@/lib/security/encryption";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { PauseForm } from "./PauseForm";
import { DeletePauseButton } from "./DeletePauseButton";

function tryDecrypt(payload: string): string | null {
  try {
    return decrypt(payload);
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function PauseSettingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);

  // Active OR upcoming pauses — anything whose window hasn't closed yet.
  const now = new Date();
  const rows = await withRls(ctx, (tx) =>
    tx.workspacePauseConfig.findMany({
      where: { workspaceId, pausedUntil: { gt: now } },
      orderBy: { pausedFrom: "asc" },
    }),
  );

  // ISO 8601 datetime-local — strip TZ offset because <input
  // type="datetime-local"> wants `YYYY-MM-DDTHH:mm` in the user's TZ.
  // We deliberately default to UTC so the form's behavior is
  // unambiguous; advanced users can pick local-equivalent values.
  const toLocalString = (d: Date): string => d.toISOString().slice(0, 16);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-10">
      <header>
        <ApEyebrow className="mb-3">pause your fleet</ApEyebrow>
        <h1 className="font-display text-3xl text-ink">
          Vacation, PTO, or a cutover week
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          Tell {partner} to take a beat. While a pause is active, the
          fleet stops firing — no drafts, no nudges, no LLM cost — and
          auto-resumes at the end of the window. Pause the whole fleet
          or narrow it to a few disciplines.
        </p>
      </header>

      <section>
        <h2 className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          active + upcoming pauses
        </h2>
        {rows.length === 0 ? (
          <ApRootedEmptyState
            motif="horizon"
            reality="No pauses scheduled — the fleet is running."
            change="Schedule a pause below and the fleet will respect the window automatically."
          />
        ) : (
          <ApHairlineList className="mt-3" aria-label="Pauses">
            {rows.map((p) => {
              const reason = p.reasonEncrypted ? tryDecrypt(p.reasonEncrypted) : null;
              const disciplineLabel =
                p.pausedDisciplineIds.length === 0
                  ? "all disciplines"
                  : p.pausedDisciplineIds.join(", ");
              const isActive = p.pausedFrom <= now;
              return (
                <ApHairlineRow
                  key={p.id}
                  right={
                    <DeletePauseButton workspaceId={workspaceId} pauseId={p.id} />
                  }
                >
                  <div>
                    <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      {isActive ? "active now" : "upcoming"} · {disciplineLabel}
                    </p>
                    <p className="mt-1 text-[14px] text-ink">
                      {p.pausedFrom.toLocaleString()} →{" "}
                      {p.pausedUntil.toLocaleString()}
                    </p>
                    {reason ? (
                      <p className="mt-1 text-[13px] text-ink-soft">{reason}</p>
                    ) : null}
                  </div>
                </ApHairlineRow>
              );
            })}
          </ApHairlineList>
        )}
      </section>

      <section>
        <h2 className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          schedule a new pause
        </h2>
        <div className="mt-4 rounded-md border border-rule bg-paper p-5">
          <PauseForm
            workspaceId={workspaceId}
            defaultPausedFrom={toLocalString(now)}
            defaultPausedUntil={toLocalString(oneWeekFromNow)}
          />
        </div>
      </section>
    </div>
  );
}
