import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";

// Root-level 404 — catches missing routes inside the app shell and API paths
// that the marketing not-found doesn't reach. Points product users back to
// sign-in; points everyone else back to the home page.

export default function RootNotFound() {
  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <ApEyebrow className="mb-3">page not found</ApEyebrow>
        <ApRootedEmptyState
          motif="horizon"
          reality="That page doesn't exist — the link may have expired or the address drifted."
          change="If you were headed to your workspace, sign in and we'll route you there."
          cta={
            <div className="flex flex-wrap gap-3">
              <ApHeritageButton variant="primary" withArrow href="/app/sign-in">
                sign in
              </ApHeritageButton>
              <ApHeritageButton variant="ghost" href="/">
                back to agentplain
              </ApHeritageButton>
            </div>
          }
        />
      </div>
    </div>
  );
}
