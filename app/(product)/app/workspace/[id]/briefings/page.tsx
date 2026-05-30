import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { decrypt } from "@/lib/security/encryption";
import { muteBriefingsAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Wave-2 briefings page. Reads `WorkspaceBriefing` rows written by the
// daily generator cron (`lib/inngest/functions/briefings-generator-sweep`).
// Pre-pivot the page read from a Notion provider with no generator
// upstream — the empty-state copy promised "9am ET each workday" but
// nothing ever populated the list (audit §8 #5, 2026-05-28).
//
// Per `project_no_outbound_architecture.md`: nothing here mutates
// customer-facing state. The mute button toggles
// `WorkspacePreference.briefingsMutedAt`; the generator cron honors it.
export default async function BriefingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [briefings, pref] = await withRls(ctx, async (tx) => {
    const rows = await tx.workspaceBriefing.findMany({
      where: { workspaceId },
      orderBy: { generatedAt: "desc" },
      take: 14,
      select: {
        id: true,
        forDate: true,
        body: true,
        summary: true,
        status: true,
        generatedAt: true,
      },
    });
    const preference = await tx.workspacePreference.findUnique({
      where: { workspaceId },
      select: { briefingsMutedAt: true },
    });
    return [rows, preference] as const;
  });

  const partner = servicePartnerForWorkspace(workspaceId);
  const muted = pref?.briefingsMutedAt != null;

  const decrypted = briefings.map((b) => ({
    id: b.id,
    forDate: b.forDate,
    body: safeDecrypt(b.body),
    summary: (b.summary as Record<string, unknown>) ?? {},
    status: b.status,
    generatedAt: b.generatedAt.toISOString(),
  }));

  return (
    <div>
      <ApEyebrow className="mb-3">briefings</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Two weeks of mornings.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Your chief-of-staff agent files one briefing per workday at
        about 9 ET. Read them here — never bounce to another tool.
      </p>

      {/* Mute / unmute control */}
      <form action={muteBriefingsAction} className="mt-6">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input
          type="hidden"
          name="desired"
          value={muted ? "unmute" : "mute"}
        />
        <ApHeritageButton variant="ghost" type="submit">
          {muted
            ? "turn briefings back on"
            : "mute briefings (you can turn them back on later)"}
        </ApHeritageButton>
      </form>

      {muted ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="big-sky"
            reality={`Briefings are muted. ${partner} won't email you the morning summary until you turn them back on.`}
            change="Existing briefings stay below for reference; new ones won't generate until you unmute."
          />
        </div>
      ) : null}

      {decrypted.length === 0 ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="big-sky"
            reality={`No briefings filed yet. ${partner} writes the first one tomorrow morning around 9 ET.`}
            change="Briefings land daily Mon–Fri once your fleet has read enough to have something to say."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {decrypted.map((b) => (
            <li key={b.id}>
              <ApPaperCard
                title={b.forDate}
                eyebrow={
                  <>
                    {new Date(b.generatedAt).toLocaleDateString()}
                    {b.status === "EMPTY" ? " · quiet day" : ""}
                  </>
                }
              >
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">
                  {b.body || "(briefing body unavailable)"}
                </p>
              </ApPaperCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Decrypts the briefing body. If the value is malformed (key rotation
 * failure, mis-encrypted row), surface a flag-string instead of
 * throwing — the briefings page is page-level and a render-time throw
 * would 500 the whole route.
 */
function safeDecrypt(ciphertext: string): string {
  try {
    return decrypt(ciphertext);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return `(briefing body could not be decrypted: ${reason})`;
  }
}
