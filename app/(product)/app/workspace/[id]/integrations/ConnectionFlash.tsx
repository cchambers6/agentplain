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
}

export function ConnectionFlash({
  workspaceId,
  connectedName,
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
        <ApHeritageButton
          variant="primary"
          withArrow
          href={`/app/workspace/${workspaceId}`}
        >
          back to workspace
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
