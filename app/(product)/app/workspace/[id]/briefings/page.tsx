import {
  ApEyebrow,
  ApPaperCard,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { getBriefingsProvider } from "@/lib/notion";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BriefingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const briefings = await getBriefingsProvider().fetchBriefings({
    workspaceId,
    limit: 14,
  });

  const partner = servicePartnerForWorkspace(workspaceId);

  return (
    <div>
      <ApEyebrow className="mb-3">briefings</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Two weeks of mornings.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Your chief-of-staff agent files one briefing per workday. Read
        them here — never bounce to another tool.
      </p>

      {briefings.length === 0 ? (
        <div className="mt-8">
          <ApRootedEmptyState
            motif="horizon"
            reality={`No briefings filed yet. ${partner} writes the first one after the next morning run.`}
            change="Briefings land here at 9am ET each workday once your fleet has read enough to have something to say."
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {briefings.map((b) => (
            <li key={b.sourceId}>
              <ApPaperCard
                title={b.title}
                eyebrow={
                  <>
                    {new Date(b.publishedAt).toLocaleDateString()}
                    {b.isStale ? " · stale" : ""}
                  </>
                }
              >
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">
                  {b.body || "(empty)"}
                </p>
              </ApPaperCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
