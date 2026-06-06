import { ApRootedLoader } from "@/components/ui/ap";

// Discipline-detail loading fallback. Contextual copy — this view builds a
// per-skill scorecard (drafts, acceptance, last-fire) across the
// discipline, so the first paint can take a beat.

export default function DisciplineDetailLoading() {
  return (
    <div>
      <ApRootedLoader label="Building this discipline's scorecard…" />
    </div>
  );
}
