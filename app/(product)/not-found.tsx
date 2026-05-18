import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";

// Product-surface 404. No "Oops!" No giant "404." Per design language §1.5,
// just a sentence on what's true and a way back. The CTA points at /app
// because most stray links inside the product land here from a stale
// workspace bookmark.

export default function ProductNotFound() {
  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <ApEyebrow className="mb-3">we couldn&rsquo;t find that</ApEyebrow>
        <ApRootedEmptyState
          motif="horizon"
          reality="That page isn't where you left it — it may have moved, or the link drifted."
          change="Head back to your workspace. If you think this page should exist, let your service partner know and we'll route you."
          cta={
            <ApHeritageButton variant="primary" withArrow href="/app">
              open your workspace
            </ApHeritageButton>
          }
        />
      </div>
    </div>
  );
}
