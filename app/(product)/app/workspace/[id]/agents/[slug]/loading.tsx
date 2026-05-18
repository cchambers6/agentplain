import { ApRootedLoader } from "@/components/ui/ap";

// Per-agent detail loading fallback. Contextual copy — we're pulling
// pending decisions and the recent handoff trail for one capability.

export default function AgentDetailLoading() {
  return (
    <div>
      <ApRootedLoader
        kind="reading-queue"
        label="Pulling this capability's recent activity…"
      />
    </div>
  );
}
