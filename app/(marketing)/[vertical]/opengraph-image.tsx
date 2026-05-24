import { ImageResponse } from "next/og";

import { tokens } from "@/lib/brand/tokens";
import {
  VERTICAL_SLUGS,
  ON_RAMP_SLUGS,
  getVerticalContent,
} from "@/lib/verticals";

// Per-vertical OpenGraph image. One distinct 1200×630 share preview per
// `/[vertical]` route — so a link to /real-estate, /cpa, /mortgage, etc.
// renders with the vertical's own name and value prop instead of the same
// generic agentplain card every time.
//
// Brand: heritage rooted tokens only (paper, ink, clay, mute) per
// `project_plaino_named_agent.md` + `feedback_brand_is_plain_not_plane.md`.
// No sleek-tech gradients, no aerial imagery. The visual cue is a calm
// hairline + a clay accent bar — same as the root OG image.
//
// Generation: Next.js calls this once per param returned by
// `generateStaticParams` on the page (the route already enumerates both
// VERTICAL_SLUGS and ON_RAMP_SLUGS — we mirror that here so /general also
// gets its own card). Static at build time via Vercel's OG image pipeline.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS].map((vertical) => ({ vertical }));
}

// Per-vertical alt text. Used by Next.js to populate the og:image:alt tag.
export function generateImageMetadata({
  params,
}: {
  params: { vertical: string };
}) {
  const content = getVerticalContent(params.vertical);
  const label = content ? `for ${content.name.toLowerCase()}` : "";
  return [
    {
      id: params.vertical,
      alt: content
        ? `${tokens.wordmark} ${label} — ${tokens.tagline}`
        : `${tokens.wordmark} — ${tokens.tagline}`,
      contentType,
      size,
    },
  ];
}

export default async function OpenGraphImage({
  params,
}: {
  params: { vertical: string };
}) {
  const content = getVerticalContent(params.vertical);
  const { colors } = tokens;

  // Headline + sub copy. Pull from the vertical's content if available;
  // fall back to the brand thesis so a misrouted call still renders a
  // valid card instead of throwing.
  const verticalName = content?.name ?? "Local business";
  const headline = content?.hero.headline ?? "Intelligence rooted in reality.";
  const eyebrow = content?.hero.eyebrow ?? tokens.wordmark;

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
        {/* TOP — wordmark + vertical name as eyebrow stack */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          <div
            style={{
              fontSize: 18,
              letterSpacing: 3,
              color: colors.clay.hex,
              fontFamily: "ui-monospace, monospace",
              textTransform: "uppercase",
            }}
          >
            for {verticalName.toLowerCase()}
          </div>
        </div>

        {/* MIDDLE — headline, trimmed to a single legible line */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 68,
              lineHeight: 1.08,
              letterSpacing: -1.5,
              maxWidth: 1040,
            }}
          >
            {trimToLines(headline, 3)}
          </div>
        </div>

        {/* BOTTOM — eyebrow framing + clay accent bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: colors.inkSoft.hex,
              maxWidth: 1040,
            }}
          >
            {eyebrow}
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

// OG canvases are width-bound; long hero headlines wrap unpredictably and
// can push the layout. Trim by character budget so the visible block stays
// within the 1040px max-width at 68px display serif.
function trimToLines(text: string, lines: number): string {
  const PER_LINE = 38;
  const max = PER_LINE * lines;
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length).trim()}…`;
}
