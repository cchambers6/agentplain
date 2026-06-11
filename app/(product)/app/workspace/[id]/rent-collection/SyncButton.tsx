"use client";

/**
 * SyncButton — "Sync now" / "Sync 7 days of data" trigger for the
 * rent-collection dashboard + onboarding. POSTs to the buildium sync route,
 * which dispatches the chase sweep. Renders the server's plain-language
 * response (including the honest "live mode not enabled yet" state) so the
 * customer always knows what happened.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApHeritageButton } from "@/components/ui/ap";

interface SyncButtonProps {
  workspaceId: string;
  label?: string;
}

export function SyncButton({ workspaceId, label = "sync now" }: SyncButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  async function onClick() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/buildium/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (res.ok && body.ok) {
        setOk(true);
        setMsg("Sync started — chase drafts will appear in Approvals shortly.");
        // Give the sweep a moment, then refresh the dashboard counts.
        setTimeout(() => router.refresh(), 2500);
      } else {
        setOk(false);
        setMsg(body.message ?? body.error ?? `Sync failed (HTTP ${res.status}).`);
      }
    } catch (err) {
      setOk(false);
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ApHeritageButton
        type="button"
        variant="primary"
        withArrow
        onClick={onClick}
        disabled={busy}
      >
        {busy ? "syncing…" : label}
      </ApHeritageButton>
      {msg && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-[13px] leading-relaxed ${
            ok ? "text-ink-soft" : "text-ink"
          }`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
