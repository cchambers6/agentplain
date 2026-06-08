import { ApRootedLoader } from "@/components/ui/ap";

// Marketplace loading fallback. We read the skill catalog plus the
// workspace's per-skill installation rows before we can render install /
// uninstall state honestly. Contextual copy per design language §3.6 —
// what's happening, not a generic spinner.

export default function MarketplaceLoading() {
  return (
    <div>
      <ApRootedLoader kind="reading-queue" label="Reading your fleet…" />
    </div>
  );
}
