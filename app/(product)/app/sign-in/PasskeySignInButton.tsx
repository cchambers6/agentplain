"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";
import { ApHeritageButton } from "@/components/ui/ap";

// Passkey sign-in — an additional path that sits above the email field. When
// the browser can't do WebAuthn we render nothing and the magic-link form
// stands alone, so this never blocks the existing flow.

type Status = "idle" | "working" | "error";

export function PasskeySignInButton() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  if (!supported) return null;

  const signIn = async () => {
    setStatus("working");
    setMessage(null);
    try {
      const optionsRes = await fetch("/api/auth/passkey/authenticate/options", {
        method: "POST",
      });
      if (!optionsRes.ok) throw new Error("options");
      const optionsJSON = await optionsRes.json();

      const assertion = await startAuthentication({ optionsJSON });

      const verifyRes = await fetch("/api/auth/passkey/authenticate/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const result = (await verifyRes.json().catch(() => null)) as
        | { ok?: boolean; redirect?: string; error?: string }
        | null;

      if (!verifyRes.ok || !result?.ok) {
        setStatus("error");
        setMessage(result?.error ?? "We couldn't sign you in with that passkey.");
        return;
      }
      window.location.href = result.redirect ?? "/app";
    } catch (err) {
      // NotAllowedError covers the legitimate quiet cases — user dismissed
      // the OS prompt, timed out, or no eligible passkey was offered. Other
      // DOM errors are configuration bugs (SecurityError on rpID/origin
      // mismatch, NotSupportedError on missing algos, AbortError on a
      // programmatic abort) and MUST surface — silent-swallowing those is
      // what made the apex-rpID regression invisible.
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
        "Your browser blocked that passkey request. If this keeps happening, sign in with your email instead.",
      );
    }
  };

  return (
    <div className="space-y-4">
      <ApHeritageButton
        variant="secondary"
        type="button"
        onClick={signIn}
        disabled={status === "working"}
        className="w-full"
      >
        {status === "working" ? "waiting for your passkey…" : "sign in with a passkey"}
      </ApHeritageButton>
      {message ? (
        <p className="text-[13px] leading-relaxed text-clay" role="status">
          {message}
        </p>
      ) : null}
      <div className="flex items-center gap-3 text-[12px] uppercase tracking-eyebrow text-mute">
        <span className="h-px flex-1 bg-rule" aria-hidden />
        <span>or use email</span>
        <span className="h-px flex-1 bg-rule" aria-hidden />
      </div>
    </div>
  );
}
