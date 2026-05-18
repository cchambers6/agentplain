import { ApRootedLoader } from "@/components/ui/ap";

// Work-thresholds loading fallback. Contextual copy — we're reading
// the current per-kind threshold config to render the form.

export default function WorkThresholdsLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your approval thresholds…" />
    </div>
  );
}
