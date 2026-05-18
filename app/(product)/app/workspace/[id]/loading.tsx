import { ApRootedLoader } from "@/components/ui/ap";

// Workspace-level loading fallback. Sits inside the workspace strip so
// the chrome stays visible while the daily handoff feed + queue counts
// hydrate. Contextual copy per design language §3.6.

export default function WorkspaceLoading() {
  return (
    <div className="container-wide py-10">
      <ApRootedLoader kind="reading-queue" />
    </div>
  );
}
