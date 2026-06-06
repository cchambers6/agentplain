import { ApRootedLoader } from "@/components/ui/ap";

// Disciplines-panel loading fallback. Contextual copy — we're reading
// activation state + connected providers to derive each card's status.

export default function DisciplinesLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your disciplines…" />
    </div>
  );
}
