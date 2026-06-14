import { ApRootedLoader } from "@/components/ui/ap";

// Weekly report loading fallback. We're aggregating the week's drafts,
// approvals, and outcomes live from the workspace.

export default function WeeklyReportLoading() {
  return (
    <div>
      <ApRootedLoader label="Tallying what Plaino did for you…" />
    </div>
  );
}
