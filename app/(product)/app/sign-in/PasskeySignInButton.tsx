"use client";

import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
} from "@simplewebauthn/browser";
import { useEffect, useState } from "react";
import { ApHeritageButton } from "@/components/ui/ap";

// Passkey sign-in — the "no email" path. Two ways in, both feeding the same
// verify endpoint:
//
//   1. CONDITIONAL UI (autofill). On mount, if the browser supports it, we
//      start a conditional WebAuthn ceremony. iOS Safari / Chrome then surface
//      the user's passkey directly in the sign-in field's autofill (the email
//      input carries autocomplete="… webauthn"). The user taps their passkey
//      with NO button press and NO email typed. This is the primary iOS path
//      and, critically, it does NOT depend on a button's transient user
//      activation — which is what made the old button-only flow fail on real
//      iOS Safari: an `await fetch` between the tap and navigator.credentials
//      .get() consumed the activation window, so get() threw NotAllowedError
//      and the button silently reset ("passkey doesn't work, nothing happens").
//
//   2. EXPLICIT BUTTON (modal). For browsers without conditional UI, or when
//      the user prefers to tap. Calling startAuthentication again automatically
//      aborts the pending conditional ceremony (SimpleWebAuthn manages a single
//      in-flight ceremony), so the two never collide.
//
// When the browser can't do WebAuthn at all we render nothing and the
// magic-link form stands alone — this never blocks the existing flow.

type Status = "idle" | "working" | "error";

export function PasskeySignInButton() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Verify the assertion and redirect. Shared by both entry paths.
  const completeSignIn = async (assertion: unknown): Promise<void> => {
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
  };

  // NotAllowedError = user dismissed / timed out / no eligible passkey.
  // AbortError = a newer ceremony (the button) superseded this one. Both are
  // legitimately quiet. Everything else (SecurityError on rpID/origin mismatch,
  // NotSupportedError on missing algos) is a real config bug and MUST surface —
  // silent-swallowing those is what made earlier breakage invisible.
  const isQuietCeremonyError = (err: unknown): boolean => {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name?: unknown }).name)
        : "";
    return name === "NotAllowedError" || name === "AbortError";
  };

  const fetchOptions = async (): Promise<unknown> => {
    const res = await fetch("/api/auth/passkey/authenticate/options", {
      method: "POST",
    });
    if (!res.ok) throw new Error("options");
    return res.json();
  };

  // Mount: feature-detect, then kick off the conditional (autofill) ceremony.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!browserSupportsWebAuthn()) return;
      setSupported(true);

      let autofillSupported = false;
      try {
        autofillSupported = await browserSupportsWebAuthnAutofill();
      } catch {
        autofillSupported = false;
      }
      if (cancelled || !autofillSupported) return;

      try {
        const optionsJSON = await fetchOptions();
        if (cancelled) return;
        const assertion = await startAuthentication({
          optionsJSON: optionsJSON as Parameters<
            typeof startAuthentication
          >[0]["optionsJSON"],
          useBrowserAutofill: true,
        });
        if (cancelled) return;
        await completeSignIn(assertion);
      } catch (err) {
        if (cancelled || isQuietCeremonyError(err)) return;
        // A real config error on the conditional path — surface it so the
        // failure is diagnosable rather than silent.
        setStatus("error");
        setMessage(
          "Your browser blocked the passkey request. If this keeps happening, sign in with your email instead.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supported) return null;

  // Explicit button (modal) path. Fetch fresh options so the challenge is
  // current, then open the modal. This aborts any pending conditional ceremony.
  const signIn = async () => {
    setStatus("working");
    setMessage(null);
    try {
      const optionsJSON = await fetchOptions();
      const assertion = await startAuthentication({
        optionsJSON: optionsJSON as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"],
      });
      await completeSignIn(assertion);
      // completeSignIn either redirects or sets an error message; reset the
      // working state only if we're still here (error already shown).
      setStatus((s) => (s === "working" ? "idle" : s));
    } catch (err) {
      if (isQuietCeremonyError(err)) {
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
        {status === "working"
          ? "waiting for your passkey…"
          : "sign in with a passkey"}
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
