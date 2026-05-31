"use client";

/**
 * ApiKeyConnectForm
 *
 * Wave-4 — the FUB Connect UI form PR #124 deferred. Renders a small
 * inline form on the per-integration settings page for connectors whose
 * `connectMode === 'api-key'` (no OAuth). The form POSTs the key to the
 * provider-specific connect endpoint, which validates with the upstream
 * provider (FUB GET /identity for Follow Up Boss) before persisting an
 * encrypted IntegrationCredential row.
 *
 * Validation in the form is intentionally light — the server endpoint is
 * the source of truth. We surface the server's error string verbatim so
 * the operator sees what FUB returned (e.g. "Follow Up Boss rejected the
 * key. Double-check it on FUB → My Profile → API Key.").
 *
 * Per `project_no_outbound_architecture.md`: this UI does NOT send
 * messages on the operator's behalf. It only persists a credential.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the connect URL is passed in
 * by the parent page reading `lib/integrations/marketplace.ts` — the
 * URL never appears as a literal string in this file beyond the prop.
 */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApHeritageButton } from "@/components/ui/ap";

interface ApiKeyConnectFormProps {
  workspaceId: string;
  /** Display name of the connector (e.g. "Follow Up Boss"). Used in
   *  body copy + the connect button label. */
  integrationName: string;
  /** POST endpoint the form submits to. */
  connectUrl: string;
  /** Where to redirect after a successful connect — typically the
   *  per-integration settings page so the operator sees the live state. */
  successRedirectUrl: string;
  /** Short instruction text — usually "Paste it from <Provider> → My
   *  Profile → API Key" or similar. Empty string = no helper text. */
  helpText?: string;
}

export function ApiKeyConnectForm(props: ApiKeyConnectFormProps) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = apiKey.trim();
    if (trimmed.length < 10) {
      setError("API key looks too short — paste the full key.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(props.connectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          apiKey: trimmed,
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
            `${props.integrationName} rejected the request (HTTP ${res.status}).`,
        );
        return;
      }
      // Server validated + persisted. Push to the success redirect so the
      // operator sees the live connection state on the same page.
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
      <label htmlFor="api-key" className="block">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {props.integrationName} API key
        </span>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="paste your API key"
          className="mt-2 block w-full border border-rule bg-paper px-3 py-2 font-mono text-[14px] text-ink focus:border-ink focus:outline-none"
          disabled={busy}
        />
      </label>
      {props.helpText && (
        <p className="mt-2 text-[13px] leading-relaxed text-mute">
          {props.helpText}
        </p>
      )}
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
          disabled={busy || apiKey.trim().length < 10}
        >
          {busy ? "connecting…" : `connect ${props.integrationName.toLowerCase()}`}
        </ApHeritageButton>
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-mute">
        Your service partner encrypts the key at rest. agentplain never sends
        messages on your behalf — every action lands in /approvals first.
      </p>
    </form>
  );
}
