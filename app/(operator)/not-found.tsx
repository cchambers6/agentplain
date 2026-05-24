import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";

// Operator surface 404. Same calm shape as the (product) and (marketing)
// boundaries — single CTA back to the operator landing.

export default function OperatorNotFound() {
  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <ApEyebrow className="mb-3">we couldn&rsquo;t find that</ApEyebrow>
        <ApRootedEmptyState
          motif="horizon"
          reality="That operator view isn't where you left it — the link may have moved or a workspace was renamed."
          change="Head back to the leadership board."
          cta={
            <ApHeritageButton variant="primary" withArrow href="/operator/leadership-board">
              open leadership board
            </ApHeritageButton>
          }
        />
      </div>
    </div>
  );
}
