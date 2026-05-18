import { ApRootedLoader } from "@/components/ui/ap";

// Onboarding-page loading fallback. Contextual copy — first-load through
// the wizard.

export default function OnboardingLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <ApRootedLoader kind="first-load" />
    </div>
  );
}
