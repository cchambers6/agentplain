"use client";

import { useEffect } from "react";
import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { reportError } from "@/lib/observability";

// Operator surface error boundary. Mirrors the (product) boundary in
// voice and shape so an internal operator hitting a failure sees the same
// rooted, calm UI a customer would — never the brand-incoherent
// global root boundary that ships with Next.js by default.

export default function OperatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[operator] error boundary:", error);
    reportError(error, {
      tags: { boundary: "operator" },
      extra: error.digest ? { digest: error.digest } : undefined,
    });
  }, [error]);

  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <ApEyebrow className="mb-3">operator console snag</ApEyebrow>
        <ApRootedEmptyState
          motif="lone-tree"
          reality="A console screen didn't load. Customer workspaces are unaffected — the fleet is still running."
          change="Try again. The digest below ties this view to the trace in observability."
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
