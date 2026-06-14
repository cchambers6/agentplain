"use client";

import { useEffect } from "react";
import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { reportError } from "@/lib/observability";

// Signup-specific error boundary. This is the top of the revenue funnel — a
// prospect, not a customer, so the generic product boundary's copy ("your
// data is intact, your fleet is running") is wrong here. They have no data
// and no fleet yet. We say what failed plainly, offer a retry, and give a
// human escape hatch so a server blip never silently loses a signup. Loud
// by default per the #239 silent-fail-loud pattern: the error is reported to
// observability AND surfaced to the prospect with a way through.

export default function SignUpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[sign-up] error boundary:", error);
    reportError(error, {
      tags: { boundary: "sign-up" },
      extra: error.digest ? { digest: error.digest } : undefined,
    });
  }, [error]);

  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <ApEyebrow className="mb-3">we hit a snag getting you started</ApEyebrow>
        <ApRootedEmptyState
          motif="lone-tree"
          reality="Signup didn't load on our side — nothing about your account or card was affected, because we never got that far."
          change="Try again; most snags clear on a second attempt. If it sticks, email us and a real person will get you set up by hand."
          cta={
            <div className="flex flex-wrap gap-3">
              <ApHeritageButton variant="primary" type="button" onClick={reset}>
                try again
              </ApHeritageButton>
              <ApHeritageButton
                variant="secondary"
                href="mailto:hello@agentplain.com?subject=Trouble%20signing%20up"
              >
                email a human
              </ApHeritageButton>
            </div>
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
