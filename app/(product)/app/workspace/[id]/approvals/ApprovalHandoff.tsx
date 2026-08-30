"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  artifactMailtoHref,
  renderArtifactText,
  type ApprovalArtifact,
} from "@/lib/approvals/artifact";

// The handoff control — the half of the loop that used to be missing.
//
// Approving a draft set a status and wrote an audit row, and then the customer
// retyped the draft by hand into their own tool. This is the "take it with
// you" affordance: clipboard, a .txt file, or their own mail client with the
// draft pre-filled and their finger on send.
//
// Nothing here sends. `mailto:` hands the draft to the customer's mail client
// and stops; the send is a human action in software we do not control. That is
// the no-outbound contract, not an exception to it.
//
// Kept in its own "use client" file so ApprovalCard stays presentational and
// server-renderable (tests/customer-approvals.test.tsx renders it without a DOM).

interface ApprovalHandoffProps {
  artifact: ApprovalArtifact;
  /** Compact row (list surfaces). Default is the full card treatment. */
  compact?: boolean;
}

const CONFIRM_MS = 2200;

export function ApprovalHandoff({ artifact, compact = false }: ApprovalHandoffProps) {
  const text = renderArtifactText(artifact);
  const mailto = artifactMailtoHref(artifact);

  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
    };
  }, []);

  const onCopy = useCallback(async () => {
    setFailed(false);
    const ok = await copyText(text, sourceRef.current);
    if (ok) {
      setCopied(true);
      later(() => setCopied(false), CONFIRM_MS);
    } else {
      setFailed(true);
    }
  }, [text, later]);

  const onDownload = useCallback(() => {
    setFailed(false);
    const revoke = downloadText(artifact.filename, text);
    if (!revoke) {
      setFailed(true);
      return;
    }
    setDownloaded(true);
    later(() => setDownloaded(false), CONFIRM_MS);
    // Revoke on the next turn — revoking synchronously can cancel the
    // download before the browser has taken the blob.
    later(revoke, 1000);
  }, [artifact.filename, text, later]);

  return (
    <div
      data-approval-handoff
      className={
        compact
          ? "flex flex-wrap items-center gap-2"
          : "mt-4 border-t border-rule pt-4"
      }
    >
      {compact ? null : (
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          take it with you
        </p>
      )}

      <div className={compact ? "contents" : "mt-2 flex flex-wrap items-center gap-2"}>
        {artifact.modes.includes("copy") ? (
          <button
            type="button"
            onClick={onCopy}
            aria-live="polite"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-none border border-rule bg-paper px-3 py-2 font-mono text-[11px] tracking-eyebrow uppercase text-ink transition hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay"
          >
            {copied ? "copied" : "copy"}
          </button>
        ) : null}

        {artifact.modes.includes("download") ? (
          <button
            type="button"
            onClick={onDownload}
            aria-live="polite"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-none border border-rule bg-paper px-3 py-2 font-mono text-[11px] tracking-eyebrow uppercase text-ink transition hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay"
          >
            {downloaded ? "downloaded" : "download .txt"}
          </button>
        ) : null}

        {mailto ? (
          <a
            href={mailto}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-none border border-rule bg-paper px-3 py-2 font-mono text-[11px] tracking-eyebrow uppercase text-ink transition hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay"
          >
            open in your mail app
          </a>
        ) : null}
      </div>

      {compact ? null : (
        <p className="mt-2 text-[12px] leading-relaxed text-mute">
          {mailto
            ? "Your own mail app opens with this drafted and unsent. You press send — we never do."
            : "Yours to paste into whatever you already use. Nothing leaves agentplain on its own."}
        </p>
      )}

      {failed ? (
        <p className="mt-2 text-[12px] leading-relaxed text-flag">
          That did not go through. The full text is selectable below — copy it
          by hand and nothing is lost.
        </p>
      ) : null}

      {/* The artifact text itself. Off-screen rather than absent: it is the
          selection target for the execCommand fallback when the async
          Clipboard API is unavailable or denied, and it keeps the exact text
          the customer is copying present in the markup. */}
      <textarea
        ref={sourceRef}
        readOnly
        aria-hidden
        tabIndex={-1}
        data-artifact-text
        value={text}
        className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
      />
    </div>
  );
}

/**
 * Async Clipboard API first, `document.execCommand("copy")` as the fallback
 * for browsers (and insecure contexts) where it is unavailable. Returns
 * whether the text actually made it to the clipboard — the confirmed state
 * must not claim a copy that did not happen.
 */
async function copyText(
  text: string,
  source: HTMLTextAreaElement | null,
): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied permission or insecure context — fall through to the legacy path.
  }
  return legacyCopy(text, source);
}

function legacyCopy(text: string, source: HTMLTextAreaElement | null): boolean {
  if (typeof document === "undefined") return false;
  const el = source ?? document.createElement("textarea");
  const ephemeral = el !== source;
  if (ephemeral) {
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "-9999px";
    document.body.appendChild(el);
  }
  let ok = false;
  try {
    el.select();
    el.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    if (ephemeral) el.remove();
  }
  return ok;
}

/**
 * Build the .txt as a Blob and hand it to the browser. Returns the revoker so
 * the caller can release the object URL once the download has been taken —
 * an un-revoked blob URL pins the whole artifact in memory for the life of
 * the document.
 */
function downloadText(filename: string, text: string): (() => void) | null {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return () => URL.revokeObjectURL(url);
}
