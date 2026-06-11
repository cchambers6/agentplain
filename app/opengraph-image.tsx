import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { tokens } from "@/lib/brand/tokens";

// Dynamic OG image — rendered by next/og at request time and edge-cached by Vercel.
// The heritage Plaino illustration (public/brand/plaino-system/heritage.png) is the
// hero. next/og fetches it from the deployment's own origin at request time, so
// nothing is bundled (an inlined base64 of the illustration ballooned the build).
// A source-of-truth SVG mirror lives at public/brand/og-image.svg; a committed
// PNG preview for mobile spot-check lives at public/og/home.png.
// 1200×630 is the OpenGraph standard size.
//
// 2026-06-06 refresh (SEO/marketing pack), amended 2026-06-11 (vendor-invisible
// customer surfaces): the heritage illustration is the hero canvas; the text
// overlay carries a vendor-generic positioning subhead, the softened ROI claim,
// and a brand stamp ("Intelligence rooted in reality"). The underlying AI model
// is NOT named on a customer surface (per the 2026-06-11 rule); the prior
// "Built on Claude" stamp + subhead were replaced for that reason.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${tokens.wordmark} — ${tokens.tagline}`;

const ROI_LINE = "15–50× per workflow + the violations you don't pay for";

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
        {/* Paper scrim for text legibility — bottom-anchored gradient.
            Lifted higher than the standalone Plaino card because the overlay
            now carries the positioning subhead + ROI row, not just the tagline. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(247,244,237,0) 22%, rgba(247,244,237,0.62) 52%, rgba(247,244,237,0.97) 100%)",
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
        {/* Tagline + positioning lockup, bottom */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: "0 80px 56px",
          }}
        >
          <div style={{ fontSize: 72, lineHeight: 1.04, letterSpacing: -2 }}>
            Intelligence rooted in
          </div>
          {/* Satori requires display:flex on any div with more than one child */}
          <div
            style={{
              display: "flex",
              fontSize: 72,
              lineHeight: 1.04,
              letterSpacing: -2,
            }}
          >
            <span style={{ color: colors.clay.hex }}>reality</span>
            <span>.</span>
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
            The best AI tools are powerful. We make them usable — a service
            partner that runs the fleet for you.
          </div>
          {/* ROI claim + brand stamp, over a clay accent bar */}
          <div style={{ display: "flex", width: 120, height: 4, background: colors.clay.hex, marginTop: 4 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: colors.ink.hex,
                maxWidth: 760,
                lineHeight: 1.25,
              }}
            >
              {ROI_LINE}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: `2px solid ${colors.ink.hex}`,
                padding: "10px 18px",
                fontSize: 18,
                letterSpacing: 1.5,
                color: colors.ink.hex,
                fontFamily: "ui-monospace, monospace",
                textTransform: "uppercase",
              }}
            >
              Run for you
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
