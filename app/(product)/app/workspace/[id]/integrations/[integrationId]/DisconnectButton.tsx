"use client";

import { useState, useTransition } from "react";
import { disconnectIntegrationAction } from "./actions";

interface DisconnectButtonProps {
  workspaceId: string;
  integrationId: string;
  credentialId: string;
  integrationName: string;
}

export function DisconnectButton({
  workspaceId,
  integrationId,
  credentialId,
  integrationName,
}: DisconnectButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-2 border border-flag/40 px-4 py-2 font-sans text-[13px] text-flag transition hover:border-flag hover:bg-flag/5"
      >
        Disconnect {integrationName}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-flag/40 bg-flag/5 p-4">
      <p className="text-[14px] text-ink">
        Disconnect {integrationName}? agentplain stops reading this account
        immediately. You can reconnect anytime.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="border border-ink/30 px-4 py-2 font-sans text-[13px] text-ink hover:border-ink"
        >
          Keep connected
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const form = new FormData();
            form.set("workspaceId", workspaceId);
            form.set("integrationId", integrationId);
            form.set("credentialId", credentialId);
            startTransition(async () => {
              await disconnectIntegrationAction(form);
            });
          }}
          className="border border-flag bg-flag px-4 py-2 font-sans text-[13px] text-paper transition hover:bg-flag/90 disabled:opacity-60"
        >
          {pending ? "Disconnecting…" : "Yes, disconnect"}
        </button>
      </div>
    </div>
  );
}
