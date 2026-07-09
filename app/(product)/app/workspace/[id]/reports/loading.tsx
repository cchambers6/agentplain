import { ApRootedLoader } from "@/components/ui/ap";

// Route-level loading state for the Reports hub (audit 2026-07-02 shell
// finding F2 — the hub aggregates saved-time and activity before first
// paint). Copy per the audit's written line; hairline strip, no spinner.

export default function ReportsLoading() {
  return (
    <div className="py-10">
      <ApRootedLoader label="Tallying what Plaino did for you…" />
    </div>
  );
}
