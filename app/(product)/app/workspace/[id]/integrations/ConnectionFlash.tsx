"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApHeritageButton, ApPaperSheet } from "@/components/ui/ap";

// Pops a one-time ApPaperSheet on return from OAuth so the customer sees
// the "we're working on it" message without having to read the inline
// flash banner. Closing the sheet rewrites the URL to drop the flash
// search params (so the sheet doesn't re-fire on refresh).

interface ConnectionFlashProps {
  workspaceId: string;
  /** Marketplace entry name (e.g. "Gmail"); falls back to a generic label. */
  connectedName?: string | null;
  /** When false, the primary CTA routes back into the onboarding flow
   *  rather than the workspace overview — closes the loop where a user
   *  finished OAuth from inside onboarding step 2 and would otherwise be
   *  dumped on the workspace landing with a "continue onboarding" banner
   *  that just sends them back here. */
  onboardingComplete?: boolean;
}

export function ConnectionFlash({
  workspaceId,
  connectedName,
  onboardingComplete = true,
}: ConnectionFlashProps) {
  const router = useRouter();
  const [open, setOpen] = useState(connectedName != null);

  useEffect(() => {
    setOpen(connectedName != null);
  }, [connectedName]);

  const handleClose = () => {
    setOpen(false);
    router.replace(`/app/workspace/${workspaceId}/integrations`);
  };

  if (!connectedName) return null;

  const primaryHref = onboardingComplete
    ? `/app/workspace/${workspaceId}`
    : `/app/workspace/${workspaceId}/onboarding`;
  const primaryLabel = onboardingComplete
    ? "back to workspace"
    : "continue onboarding";

  return (
    <ApPaperSheet
      open={open}
      onClose={handleClose}
      eyebrow="connection"
      title={`${connectedName} is connected.`}
    >
      <p className="text-[15px] leading-relaxed text-ink-soft">
        We&rsquo;ll start watching your inbox in the next 5 minutes. Once
        new mail or webhooks land, your fleet drafts, categorizes, and
        queues — you decide.
      </p>
      <p className="text-[14px] leading-relaxed text-mute">
        Your service partner is notified. Disconnecting is one tap from
        this screen and pauses reads immediately.
      </p>
      <div className="flex flex-wrap gap-3">
        <ApHeritageButton variant="primary" withArrow href={primaryHref}>
          {primaryLabel}
        </ApHeritageButton>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center justify-center rounded-none px-3 py-2 font-sans text-sm text-ink underline-offset-4 hover:underline"
        >
          stay on connections
        </button>
      </div>
    </ApPaperSheet>
  );
}
