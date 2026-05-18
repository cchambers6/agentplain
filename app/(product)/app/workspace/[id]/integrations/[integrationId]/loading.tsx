import { ApRootedLoader } from "@/components/ui/ap";

// Integration-detail loading fallback. Contextual copy — we're reading
// the credential record + OAuth scopes for a single connector.

export default function IntegrationDetailLoading() {
  return (
    <div>
      <ApRootedLoader kind="connecting" label="Reading this connection…" />
    </div>
  );
}
