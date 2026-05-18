import { ApRootedLoader } from "@/components/ui/ap";

// Briefings loading fallback. Contextual copy — we're fetching the
// two-week briefing window from the Notion provider.

export default function BriefingsLoading() {
  return (
    <div>
      <ApRootedLoader label="Gathering your two weeks of mornings…" />
    </div>
  );
}
