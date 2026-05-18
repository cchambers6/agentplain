import { ApRootedLoader } from "@/components/ui/ap";

// Integrations-page loading fallback. Contextual copy — we're checking
// which tools your workspace has connected.

export default function IntegrationsLoading() {
  return (
    <div>
      <ApRootedLoader kind="syncing" label="Checking your connections…" />
    </div>
  );
}
