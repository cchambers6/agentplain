import { ImageResponse } from "next/og";
import { tokens } from "@/lib/brand/tokens";

// Per-page OG card for /compare. Text-only, brand-token canvas — renders fast,
// no remote asset fetch. 1200×630 OpenGraph standard.
//
// Vendor-generic framing per the 2026-06-11 rule: the contrast is "do it
// yourself" vs "run for you," never a named product.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Do it yourself, or have it run for you — agentplain";

export default function OpenGraphImage() {
  const { colors } = tokens;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: colors.paper.hex,
          color: colors.ink.hex,
          fontFamily: "Georgia, serif",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 4,
            fontFamily: "ui-monospace, monospace",
            textTransform: "uppercase",
          }}
        >
          {tokens.wordmark} · compare
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.04, letterSpacing: -2 }}>
            Do it yourself, or
          </div>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.04, letterSpacing: -2 }}>
            <span>have it </span>
            <span style={{ color: colors.clay.hex }}>run for you.</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: colors.inkSoft.hex,
              fontFamily: "system-ui, sans-serif",
              maxWidth: 1000,
            }}
          >
            A blank box and a bill, or a fleet installed for your trade and run
            for you. Drafts land in your queue; you approve and send.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 120, height: 4, background: colors.clay.hex }} />
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: colors.ink.hex,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {tokens.tagline}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
