import { ApRootedLoader } from "@/components/ui/ap";

// Welcome-page loading fallback — shown while the activation draft is fetched.
export default function WelcomeLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <ApRootedLoader kind="first-load" />
    </div>
  );
}
