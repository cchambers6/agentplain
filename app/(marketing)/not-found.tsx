import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";

// Marketing surface 404. Catches stale links and mistyped slugs from the
// outside world. Heritage voice, single CTA back to the home page where
// every vertical and the pricing page are one click away.

export default function MarketingNotFound() {
  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <ApEyebrow className="mb-3">we couldn&rsquo;t find that</ApEyebrow>
        <ApRootedEmptyState
          motif="horizon"
          reality="That page isn't where you came looking — it may have moved, or the link drifted."
          change="The home page lists every vertical we serve and a one-click path to pricing."
          cta={
            <ApHeritageButton variant="primary" withArrow href="/">
              back to agentplain
            </ApHeritageButton>
          }
        />
      </div>
    </div>
  );
}
