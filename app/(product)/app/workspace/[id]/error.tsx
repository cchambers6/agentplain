"use client";

import { useEffect } from "react";
import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";

// Workspace-scoped error boundary. Sits inside the workspace strip so
// the chrome stays visible when a single screen fails. Per design
// language §1.4: what failed → what we're doing → what the user can do.
// No stack, no jargon, no "Oops".

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[workspace] error boundary:", error);
  }, [error]);

  return (
    <div>
      <ApEyebrow className="mb-3">we hit a snag</ApEyebrow>
      <ApRootedEmptyState
        motif="lone-tree"
        reality="This view didn't load. The rest of your workspace is fine — your fleet is still running."
        change="Try again. If it keeps failing, your service partner is notified and will reach out."
        cta={
          <ApHeritageButton variant="primary" type="button" onClick={reset}>
            try again
          </ApHeritageButton>
        }
      />
      {error.digest ? (
        <p className="mt-4 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          reference · {error.digest}
        </p>
      ) : null}
    </div>
  );
}
