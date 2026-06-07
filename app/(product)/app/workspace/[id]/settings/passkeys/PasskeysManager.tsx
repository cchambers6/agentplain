"use client";

import {
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApHeritageButton } from "@/components/ui/ap";
import type { PasskeySummary } from "@/lib/auth";
import { removePasskeyAction } from "./actions";

interface PasskeysManagerProps {
  workspaceId: string;
  passkeys: PasskeySummary[];
}

type Status = "idle" | "working" | "error" | "added";

const formatDate = (date: Date | string): string =>
  new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export function PasskeysManager({ workspaceId, passkeys }: PasskeysManagerProps) {
  const router = useRouter();
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  const addPasskey = async () => {
    setStatus("working");
    setMessage(null);
    try {
      const optionsRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      if (!optionsRes.ok) throw new Error("options");
      const optionsJSON = await optionsRes.json();

      const attestation = await startRegistration({ optionsJSON });

      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      const result = (await verifyRes.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!verifyRes.ok || !result?.ok) {
        setStatus("error");
        setMessage(result?.error ?? "We couldn't add that passkey.");
        return;
      }
      setStatus("added");
      setMessage("Passkey added. You can sign in with it next time.");
      router.refresh();
    } catch (err) {
      // NotAllowedError = user dismissed the OS prompt / timed out. That's a
      // legitimate quiet reset. Anything else (SecurityError on rpID/origin
      // mismatch, NotSupportedError, InvalidStateError when the device is
      // already enrolled) is a real failure the user must see — swallowing it
      // is what made "I tried to add a passkey and nothing happened" invisible.
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name?: unknown }).name)
          : "";
      if (name === "NotAllowedError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setMessage(
        name === "InvalidStateError"
          ? "This device already has a passkey for your account."
          : "Your browser blocked that passkey. If this keeps happening, you can still sign in with an email link.",
      );
    }
  };

  return (
    <div className="space-y-6">
      {passkeys.length === 0 ? (
        <p className="border border-rule bg-paper-deep p-4 text-[14px] leading-relaxed text-ink-soft">
          No passkeys yet. Add one to this device for a faster sign-in — no
          email round-trip, no password to lose.
        </p>
      ) : (
        <ul className="divide-y divide-rule border border-rule">
          {passkeys.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="font-display text-base leading-tight text-ink">
                  {p.label ?? "Passkey"}
                </p>
                <p className="mt-1 text-[12px] text-mute">
                  added {formatDate(p.createdAt)}
                  {p.lastUsedAt
                    ? ` · last used ${formatDate(p.lastUsedAt)}`
                    : " · not used yet"}
                </p>
              </div>
              <form action={removePasskeyAction.bind(null, workspaceId, p.id)}>
                <button
                  type="submit"
                  className="font-mono text-[12px] uppercase tracking-eyebrow text-mute underline-offset-4 hover:text-ink hover:underline"
                >
                  remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {supported ? (
        <div className="space-y-3">
          <ApHeritageButton
            variant="primary"
            type="button"
            onClick={addPasskey}
            disabled={status === "working"}
          >
            {status === "working"
              ? "waiting for your device…"
              : "add a passkey to this device"}
          </ApHeritageButton>
          {message ? (
            <p
              className={`text-[13px] leading-relaxed ${
                status === "error" ? "text-clay" : "text-ink-soft"
              }`}
              role="status"
            >
              {message}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-mute">
          This browser doesn&rsquo;t support passkeys. You can still sign in
          with an email link.
        </p>
      )}
    </div>
  );
}
