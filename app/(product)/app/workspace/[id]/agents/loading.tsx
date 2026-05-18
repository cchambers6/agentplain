import { ApRootedLoader } from "@/components/ui/ap";

// Agents-page loading fallback. Contextual copy — we're counting how
// many handoffs each capability has run for this workspace.

export default function AgentsLoading() {
  return (
    <div>
      <ApRootedLoader label="Tallying your fleet's recent work…" />
    </div>
  );
}
