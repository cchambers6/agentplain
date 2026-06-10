import { ApRootedLoader } from "@/components/ui/ap";

// Autonomy loading fallback. Contextual copy — we're reading the
// workspace's per-class autonomy policy + the recent auto-executed log.

export default function AutonomyLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your autonomy settings…" />
    </div>
  );
}
