import { ApRootedLoader } from "@/components/ui/ap";

// Team loading fallback — reading the roster, routing, and per-member KPIs.

export default function TeamLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your team…" />
    </div>
  );
}
