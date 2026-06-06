import { ApRootedLoader } from "@/components/ui/ap";

// Schedule-settings loading fallback. Contextual copy — we're reading the
// configured per-skill scheduling windows to render the form.

export default function ScheduleSettingsLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your scheduling windows…" />
    </div>
  );
}
