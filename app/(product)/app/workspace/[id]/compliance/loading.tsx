import { ApRootedLoader } from "@/components/ui/ap";

// Compliance-page loading fallback. Contextual copy — Sentinel is
// pulling open flags ordered by severity and SLA.

export default function ComplianceLoading() {
  return (
    <div>
      <ApRootedLoader label="Pulling Sentinel's open flags…" />
    </div>
  );
}
