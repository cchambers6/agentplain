import { ApRootedLoader } from "@/components/ui/ap";

// Activity-feed loading fallback. Contextual copy — we're reading the
// inbox + handoff log to render the feed.

export default function ActivityLoading() {
  return (
    <div>
      <ApRootedLoader kind="reading-queue" label="Reading your inbox…" />
    </div>
  );
}
