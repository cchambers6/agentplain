import { ApRootedLoader } from "@/components/ui/ap";

// Settings hub loading fallback. Contextual copy — we're reading
// workspace metadata + active membership to render the settings index.

export default function SettingsLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your workspace settings…" />
    </div>
  );
}
