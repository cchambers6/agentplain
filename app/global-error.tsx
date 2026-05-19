"use client";

// Root-level error boundary — Next.js renders this when the root layout
// itself throws (above the `(product)/error.tsx` and workspace boundaries).
// At that point `<html>` and `<body>` are gone, so this file must render
// them itself. We keep it intentionally minimal: brand wordmark, calm
// reality/change framing, retry button — no Ap* primitives that might
// drag in the failed module graph.
//
// The Sentry SDK exports a dedicated GlobalError wrapper for this exact
// case; we route through `lib/observability` instead so the swap point
// for the reporter stays one file (feedback_no_silent_vendor_lock).

import { useEffect } from "react";
import { reportError } from "@/lib/observability";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global] error boundary:", error);
    reportError(error, {
      tags: { boundary: "global" },
      level: "fatal",
      extra: error.digest ? { digest: error.digest } : undefined,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: "#f7f4ee",
          color: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 520, width: "100%" }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#7a7368",
              margin: "0 0 12px",
            }}
          >
            agentplain · we hit a snag
          </p>
          <h1
            style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 32,
              lineHeight: 1.2,
              margin: "0 0 16px",
              fontWeight: 500,
            }}
          >
            Something on our side gave way.
          </h1>
          <p style={{ margin: "0 0 24px", lineHeight: 1.6 }}>
            Your data is intact and your fleet is still running. Try again —
            most snags clear on a second attempt. If it sticks, your service
            partner is already on it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              background: "#1a1a1a",
              color: "#f7f4ee",
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            try again
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: 24,
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#7a7368",
              }}
            >
              reference · {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
