import { ApEyebrow, ApRootedLoader } from "@/components/ui/ap";

// Default product-surface loading screen. Sits behind the top-level
// (product) layout while server work runs on a fresh route. Contextual
// copy lives at lower layers — this is the first-load fallback only.
// Per design language §1.5 + §3.6.

export default function ProductLoading() {
  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <ApEyebrow className="mb-3">one moment</ApEyebrow>
        <ApRootedLoader kind="first-load" />
      </div>
    </div>
  );
}
