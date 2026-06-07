import { ApRootedLoader } from "@/components/ui/ap";

// Passkeys-settings loading fallback. Contextual copy — we're reading the
// passkeys registered to your account to render the manager.

export default function PasskeysSettingsLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your sign-in & security…" />
    </div>
  );
}
