import { ApRootedLoader } from "@/components/ui/ap";

// Pause-settings loading fallback. Contextual copy — we're reading the
// active + upcoming pause windows to render the schedule.

export default function PauseSettingsLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your pause schedule…" />
    </div>
  );
}
