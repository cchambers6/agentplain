import { requireWorkspaceMember } from "@/lib/auth";
import { getBriefingsProvider } from "@/lib/notion";

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

  return (
    <div>
      <p className="eyebrow mb-3">Briefings</p>
      <h1 className="font-display text-3xl text-ink">
        Two weeks of mornings.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Your chief-of-staff agent files one briefing per workday. Read them
        here — never bounce to another tool.
      </p>

      {briefings.length === 0 ? (
        <p className="mt-8 border border-rule bg-paper p-5 text-[15px] text-mute">
          No briefings yet. Your fleet files the first one after their next
          morning run.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {briefings.map((b) => (
            <li key={b.sourceId} className="border border-rule bg-paper p-5">
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-xl text-ink">{b.title}</h2>
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  {new Date(b.publishedAt).toLocaleDateString()}
                  {b.isStale ? " · stale" : ""}
                </span>
              </header>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">
                {b.body || "(empty)"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
