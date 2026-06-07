import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { tokens } from "@/lib/brand/tokens";

// Dynamic OG image — rendered by next/og at request time and edge-cached by Vercel.
// The heritage Plaino illustration (public/brand/plaino-system/heritage.png) is the
// hero. next/og fetches it from the deployment's own origin at request time, so
// nothing is bundled (an inlined base64 of the illustration ballooned the build).
// 1200×630 is the OpenGraph standard size.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${tokens.wordmark} — ${tokens.tagline}`;

export default async function OpenGraphImage() {
  const { colors } = tokens;
  const h = headers();
  const host = h.get("host") ?? "agentplain.com";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const heritageUrl = `${proto}://${host}/brand/plaino-system/heritage.png`;
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: colors.paper.hex,
          color: colors.ink.hex,
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Heritage illustration — full-bleed hero behind the brand text.
            Plain <img> is required: this renders inside next/og's Satori,
            which does not support next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori <img>, decorative */}
        <img
          src={heritageUrl}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Paper scrim for text legibility — bottom-anchored gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(247,244,237,0) 30%, rgba(247,244,237,0.55) 60%, rgba(247,244,237,0.96) 100%)",
          }}
        />
        {/* Wordmark eyebrow, top-left */}
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 80,
            fontSize: 22,
            letterSpacing: 4,
            color: colors.ink.hex,
            fontFamily: "ui-monospace, monospace",
            textTransform: "uppercase",
          }}
        >
          {tokens.wordmark}
        </div>
        {/* Tagline lockup, bottom */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            padding: "0 80px 72px",
          }}
        >
          <div style={{ fontSize: 76, lineHeight: 1.04, letterSpacing: -2 }}>
            Intelligence rooted in
          </div>
          {/* Satori requires display:flex on any div with more than one child */}
          <div
            style={{
              display: "flex",
              fontSize: 76,
              lineHeight: 1.04,
              letterSpacing: -2,
            }}
          >
            <span style={{ color: colors.clay.hex }}>reality</span>
            <span>.</span>
          </div>
          <div
            style={{
              fontSize: 26,
              color: colors.inkSoft.hex,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            The service layer that makes Claude work for local businesses.
          </div>
          <div style={{ width: 120, height: 4, background: colors.clay.hex }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
