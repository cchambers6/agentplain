import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";

// Workspace-scoped 404. Shown when a child route under /app/workspace/[id]
// calls notFound() — e.g. a stale integration id or agent slug. Per
// design language §1.4: calm, single CTA back to a known surface.

export default function WorkspaceNotFound() {
  return (
    <div>
      <ApEyebrow className="mb-3">we couldn&rsquo;t find that</ApEyebrow>
      <ApRootedEmptyState
        motif="horizon"
        reality="That page isn't where you left it — it may have moved, or the link drifted."
        change="Head back to your overview. If you think this page should exist, let your service partner know."
        cta={
          <ApHeritageButton variant="primary" withArrow href="/app">
            back to your workspace
          </ApHeritageButton>
        }
      />
    </div>
  );
}
