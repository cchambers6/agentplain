import { ApRootedLoader } from "@/components/ui/ap";

// Billing-page loading fallback. Contextual copy — we're reading
// subscription state, invoices, and recent billing events.

export default function BillingLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your plan and invoices…" />
    </div>
  );
}
