"use client";

/**
 * BuildiumConnectForm
 *
 * Two-field API-key connect form for Buildium. Unlike the single-key
 * `ApiKeyConnectForm` (FUB / Sierra / BoldTrail), Buildium authenticates with
 * a client-id + client-secret PAIR the customer creates under Settings → API
 * Settings. The form POSTs both to /api/integrations/buildium/connect, which
 * encrypts the secret and persists an IntegrationCredential row.
 *
 * Per `project_no_outbound_architecture.md`: this UI only persists a
 * credential — it never sends on the operator's behalf.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the connect URL is the single
 * Buildium connect route; no vendor REST call happens in this component.
 *
 * Visual conventions match ApiKeyConnectForm exactly (no new design
 * vocabulary): same eyebrow labels, same input + ApHeritageButton, same
 * encrypted-at-rest reassurance copy.
 */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApHeritageButton } from "@/components/ui/ap";

interface BuildiumConnectFormProps {
  workspaceId: string;
  /** Where to redirect after a successful connect. */
  successRedirectUrl: string;
}

const CONNECT_URL = "/api/integrations/buildium/connect";

export function BuildiumConnectForm(props: BuildiumConnectFormProps) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = clientId.trim().length >= 4 && clientSecret.trim().length >= 8;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Paste both your Buildium client ID and client secret.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(CONNECT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(
          body.detail ??
            body.error ??
            `Buildium connect failed (HTTP ${res.status}).`,
        );
        return;
      }
      router.push(props.successRedirectUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-xl">
      <label htmlFor="buildium-client-id" className="block">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          Buildium client ID
        </span>
        <input
          id="buildium-client-id"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="paste your client ID"
          className="mt-2 block w-full border border-rule bg-paper px-3 py-2 font-mono text-[14px] text-ink focus:border-ink focus:outline-none"
          disabled={busy}
        />
      </label>

      <label htmlFor="buildium-client-secret" className="mt-5 block">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          Buildium client secret
        </span>
        <input
          id="buildium-client-secret"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="paste your client secret"
          className="mt-2 block w-full border border-rule bg-paper px-3 py-2 font-mono text-[14px] text-ink focus:border-ink focus:outline-none"
          disabled={busy}
        />
      </label>

      <p className="mt-2 text-[13px] leading-relaxed text-mute">
        Create both under Buildium → Settings → API Settings. Your service
        partner reads your rent roll only — never writes back, never charges a
        tenant.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 border border-flag/40 bg-flag/5 px-4 py-3 text-sm text-ink"
        >
          {error}
        </div>
      )}

      <div className="mt-6">
        <ApHeritageButton
          type="submit"
          variant="primary"
          withArrow
          disabled={busy || !canSubmit}
        >
          {busy ? "connecting…" : "connect buildium"}
        </ApHeritageButton>
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-mute">
        Your service partner encrypts the secret at rest. agentplain never sends
        messages on your behalf — every chase lands in /approvals first.
      </p>
    </form>
  );
}
