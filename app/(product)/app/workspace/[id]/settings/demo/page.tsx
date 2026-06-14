import Link from "next/link";
import { ApEyebrow, ApHeritageButton, ApPaperCard } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import {
  listDemoRecords,
  AUTO_CLEAR_REAL_RECORD_THRESHOLD,
} from "@/lib/onboarding/demo-seed";
import { clearDemoDataAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Settings → demo data. Lets the owner see exactly what sample records Plaino
 * seeded for the first-5-min experience, and remove them in one click. The set
 * also auto-clears once real customer data lands (see demo-seed), so this page
 * is the manual override, not the only path.
 */
export default async function DemoDataSettingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const records = await listDemoRecords(workspaceId);
  const partner = servicePartnerForWorkspace(workspaceId);

  return (
    <div className="mx-auto max-w-2xl">
      <ApEyebrow className="mb-3">settings · demo data</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">Sample data</h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        When you signed up, {partner} seeded a few sample records so you could
        watch your first workflow run end to end. They’re clearly marked, never
        count toward your real numbers, and clear themselves automatically once{" "}
        {partner} pulls in {AUTO_CLEAR_REAL_RECORD_THRESHOLD}+ of your real
        records. You can also remove them right now.
      </p>

      <div className="mt-8">
        {records.length === 0 ? (
          <ApPaperCard eyebrow="demo data" title="all clear" density="spacious">
            <p className="text-[15px] leading-relaxed text-ink-soft">
              No sample data here. {partner} is running on your real data now.
            </p>
            <div className="mt-5">
              <ApHeritageButton
                variant="secondary"
                withArrow
                href={`/app/workspace/${workspaceId}/settings`}
              >
                back to settings
              </ApHeritageButton>
            </div>
          </ApPaperCard>
        ) : (
          <ApPaperCard
            eyebrow={`demo data · ${records.length} sample record${records.length === 1 ? "" : "s"}`}
            title="what’s seeded"
            density="spacious"
          >
            <ul className="grid gap-px overflow-hidden border border-rule bg-rule">
              {records.map((r) => (
                <li key={r.demoId} className="bg-paper p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-base leading-tight text-ink">
                      {r.title}
                    </p>
                    {r.urgent ? (
                      <span className="border border-clay px-2 py-0.5 font-mono text-[10px] tracking-eyebrow uppercase text-clay">
                        first draft
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                    {r.summary}
                  </p>
                </li>
              ))}
            </ul>

            <form
              action={clearDemoDataAction.bind(null, workspaceId)}
              className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-6"
            >
              <button
                type="submit"
                className="inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2 font-mono text-[12px] tracking-eyebrow uppercase text-paper hover:bg-ink/90"
              >
                remove demo data
              </button>
              <Link
                href={`/app/workspace/${workspaceId}/settings`}
                className="text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
              >
                back to settings
              </Link>
            </form>
            <p className="mt-4 text-[12px] leading-relaxed text-mute">
              Removing the sample data also clears the sample draft from your
              queue if you haven’t acted on it. This can’t be undone, but{" "}
              {partner} will seed nothing new — your real workflows take over.
            </p>
          </ApPaperCard>
        )}
      </div>
    </div>
  );
}
