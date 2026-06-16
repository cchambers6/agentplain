import { ImageResponse } from "next/og";
import { tokens } from "@/lib/brand/tokens";

// Per-page OG card for /how-it-works. Text-only, brand-token canvas — no
// remote illustration fetch, so it renders fast and never depends on an asset
// path. 1200×630 is the OpenGraph standard.
//
// The underlying AI model is NOT named (2026-06-11 vendor-invisible rule).
// The line is the product in one breath: the loop ends in your approval.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "How agentplain works — it drafts, you sign";

const STEPS = ["Read", "Categorize", "Coordinate", "Schedule", "Draft"];

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
            color: colors.ink.hex,
          }}
        >
          {tokens.wordmark} · how it works
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 74, lineHeight: 1.04, letterSpacing: -2 }}>
            It drafts. You sign.
          </div>
          <div style={{ display: "flex", fontSize: 74, lineHeight: 1.04, letterSpacing: -2 }}>
            <span>Nothing leaves without </span>
            <span style={{ color: colors.clay.hex }}>you.</span>
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
            One loop on everything that lands — and it ends in your approval
            queue.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  letterSpacing: 1,
                  fontFamily: "ui-monospace, monospace",
                  textTransform: "uppercase",
                  color: i === STEPS.length - 1 ? colors.clay.hex : colors.ink.hex,
                }}
              >
                {s}
              </div>
              {i < STEPS.length - 1 ? (
                <div style={{ display: "flex", fontSize: 20, color: colors.inkSoft.hex }}>
                  →
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
