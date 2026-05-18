import { ApRootedLoader } from "@/components/ui/ap";

// Approvals-queue loading fallback. Contextual copy — we're pulling the
// decisions queue + agent metadata to render the list.

export default function ApprovalsLoading() {
  return (
    <div>
      <ApRootedLoader kind="reading-queue" label="Pulling the decisions queue…" />
    </div>
  );
}
