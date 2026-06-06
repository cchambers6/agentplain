import { ApRootedLoader } from "@/components/ui/ap";

// Data-controls loading fallback. Contextual copy — we're reading the
// workspace's closure state to render the export + close affordances.

export default function DataControlsLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your data controls…" />
    </div>
  );
}
