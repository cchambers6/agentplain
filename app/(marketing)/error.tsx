"use client";

import { useEffect } from "react";
import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { reportError } from "@/lib/observability";

// Marketing surface error boundary. Visitors here are deciding whether to
// trust agentplain — the boundary keeps the brand voice (calm, rooted,
// single CTA back to the home page) rather than the brand-incoherent
// global root boundary. Per design-language §1.5: no stack, no jargon.

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[marketing] error boundary:", error);
    reportError(error, {
      tags: { boundary: "marketing" },
      extra: error.digest ? { digest: error.digest } : undefined,
    });
  }, [error]);

  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <ApEyebrow className="mb-3">we hit a snag</ApEyebrow>
        <ApRootedEmptyState
          motif="lone-tree"
          reality="A piece of this page didn't load. Nothing about agentplain is broken on your end."
          change="Try again. If it keeps failing, the home page is the quickest path back."
          cta={
            <ApHeritageButton variant="primary" type="button" onClick={reset}>
              try again
            </ApHeritageButton>
          }
        />
        {error.digest ? (
          <p className="mt-6 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            reference · {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
