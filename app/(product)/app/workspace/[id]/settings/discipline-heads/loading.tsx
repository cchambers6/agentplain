import { ApRootedLoader } from "@/components/ui/ap";

// Discipline-heads loading fallback. Contextual copy — we're reading the
// current per-discipline heads + active members to render the routing.

export default function DisciplineHeadsLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your approver routing…" />
    </div>
  );
}
