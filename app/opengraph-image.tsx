import { ImageResponse } from "next/og";
import { tokens } from "@/lib/brand/tokens";

// Dynamic OG image — rendered by next/og at request time and edge-cached by Vercel.
// Source-of-truth SVG mirror lives at public/brand/og-image.svg.
// 1200×630 is the OpenGraph standard size.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${tokens.wordmark} — ${tokens.tagline}`;

export default async function OpenGraphImage() {
  const { colors } = tokens;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: colors.paper.hex,
          color: colors.ink.hex,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontSize: 20,
            letterSpacing: 3.6,
            color: colors.mute.hex,
            fontFamily: "ui-monospace, monospace",
            textTransform: "uppercase",
          }}
        >
          {tokens.wordmark}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 92, lineHeight: 1.05, letterSpacing: -2 }}>
            Intelligence.
          </div>
          <div style={{ fontSize: 92, lineHeight: 1.05, letterSpacing: -2 }}>
            Rooted in{" "}
            <span style={{ color: colors.clay.hex }}>reality</span>.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 26, color: colors.inkSoft.hex }}>
            The agentic operating layer for the independent brokerage.
          </div>
          <div
            style={{
              width: 120,
              height: 4,
              background: colors.clay.hex,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
