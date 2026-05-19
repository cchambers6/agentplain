"use client";

import { useEffect } from "react";
import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { reportError } from "@/lib/observability";

// Calm error boundary for the product surface. No stack trace, no scary
// error code — service-partnership voice, one rooted motif, one retry.
// Per design language §1.5 + §3.5.

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in console so dev / observability still sees the trace.
    // Avoid leaking it into the customer-facing UI.
    // eslint-disable-next-line no-console
    console.error("[product] error boundary:", error);
    // Route to the observability adapter (Sentry in prod, noop otherwise).
    // This is the gap that let the 2026-05-17 login crash reach Conner
    // before we did — see docs/incident-log.md.
    reportError(error, {
      tags: { boundary: "product" },
      extra: error.digest ? { digest: error.digest } : undefined,
    });
  }, [error]);

  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <ApEyebrow className="mb-3">we hit a snag</ApEyebrow>
        <ApRootedEmptyState
          motif="lone-tree"
          reality="Something on our side gave way. Your data is intact and your fleet is still running."
          change="Try again — most snags clear on a second attempt. If it sticks, your service partner is already on it."
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
