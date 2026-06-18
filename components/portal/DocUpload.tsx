"use client";

import { useRef, useState } from "react";

/**
 * Client-side document upload. POSTs the file as multipart/form-data to the
 * portal upload route, which stores it, virus-scans it, and records it. The
 * UI is honest about the scan: a freshly uploaded file is "received — being
 * checked", and only appears in the document list once it's scanned clean
 * (fail-closed). No download link is ever rendered for an unscanned file.
 */
export function DocUpload({ slug, caseId }: { slug: string; caseId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus("error");
      setMessage("Choose a file first.");
      return;
    }
    setStatus("uploading");
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("caseId", caseId);
      const res = await fetch(`/api/portal/${encodeURIComponent(slug)}/upload`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { ok: boolean; scanStatus?: string; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error ?? "Upload failed. Please try again.");
        return;
      }
      setStatus("done");
      setMessage(
        data.scanStatus === "CLEAN"
          ? "Uploaded — your document is ready."
          : "Received — we're checking your document and it'll appear here once it clears.",
      );
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setStatus("error");
      setMessage("Upload failed. Please check your connection and try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        name="file"
        className="block w-full text-sm text-ink-soft file:mr-3 file:border-0 file:px-3 file:py-2 file:text-sm file:text-white"
        style={
          {
            ["--file-bg" as string]: "var(--portal-accent, #B65D3A)",
          } as React.CSSProperties
        }
      />
      <button
        type="submit"
        disabled={status === "uploading"}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--portal-accent, #B65D3A)" }}
      >
        {status === "uploading" ? "Uploading…" : "Upload document"}
      </button>
      {message ? (
        <p
          className={`text-[13px] ${status === "error" ? "text-flag" : "text-moss"}`}
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
