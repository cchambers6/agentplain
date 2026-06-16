"use client";

import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";

interface PasskeyNudgeProps {
  workspaceId: string;
  /**
   * banner — session-dismissable banner (layout / dashboard use).
   * inline — always visible, no dismiss (settings page use: the manager below handles enrollment).
   */
  variant?: "banner" | "inline";
}

export function PasskeyNudge({ workspaceId, variant = "banner" }: PasskeyNudgeProps) {
  const [visible, setVisible] = useState(false);

  const SESSION_KEY = `pk-nudge-session-${workspaceId}`;
  const NEVER_KEY = `pk-nudge-never-${workspaceId}`;

  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    if (variant === "inline") {
      setVisible(true);
      return;
    }
    try {
      if (
        window.sessionStorage.getItem(SESSION_KEY) === "1" ||
        window.localStorage.getItem(NEVER_KEY) === "1"
      ) return;
    } catch {
      // storage blocked (private mode) — show anyway.
    }
    setVisible(true);
  }, [SESSION_KEY, NEVER_KEY, variant]);

  if (!visible) return null;

  const dismiss = () => {
    try { window.sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  const neverShow = () => {
    try { window.localStorage.setItem(NEVER_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="border border-rule bg-paper-deep p-4 text-[14px] text-ink"
    >
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        faster sign-in
      </p>
      <p className="mt-1 leading-relaxed text-ink">
        {variant === "inline"
          ? "One tap to sign in — no email code, no waiting. Add a passkey below and your device fingerprint or face ID becomes your key."
          : "Sign in with one tap next time — no email codes. Your fingerprint or face ID becomes your key."}
      </p>
      {variant === "banner" ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <a
            href={`/app/workspace/${workspaceId}/settings/passkeys`}
            className="text-[13px] font-medium text-ink underline underline-offset-4 hover:text-clay"
          >
            Add a passkey →
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="text-[12px] text-mute underline-offset-4 hover:text-ink hover:underline"
          >
            not now
          </button>
          <button
            type="button"
            onClick={neverShow}
            className="text-[12px] text-mute underline-offset-4 hover:text-ink hover:underline"
          >
            don&rsquo;t show again
          </button>
        </div>
      ) : null}
    </div>
  );
}

