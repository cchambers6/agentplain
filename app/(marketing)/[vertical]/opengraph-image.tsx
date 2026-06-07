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
// 2026-06-06 refresh (SEO/marketing pack following PR #158 SBM-wrapper +
// PR #159 ROI softening). Each card now carries the full marketing frame:
//   - vertical name (clay eyebrow) + wordmark
//   - the vertical headline (display serif)
//   - a value-prop one-liner (sans) sourced from the SBM-wrapper subhead
//   - the softened ROI claim: "15–50× + the violations you don't pay for"
//   - a "Built on Claude" stamp (per `project_sbm_wrapper_positioning_2026_06_06.md`
//     — true + verifiable; never a competitor framing)
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
// A committed static preview of each card lives at `public/og/<slug>.png`
// for mobile spot-check (see `tools/brand/og-preview.html` + the PR notes).

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The softened ROI line, identical to the FAQ + Product JSON-LD copy. Capped
// at 50× per PR #159; the retired 107× claim never appears.
const ROI_LINE = "15–50× per workflow + the violations you don't pay for";

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
        ? `${tokens.wordmark} ${label} — ${tokens.tagline} Built on Claude.`
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
  // Value-prop one-liner — prefer the SBM-wrapper subhead, fall back to the
  // hero eyebrow, then the brand line.
  const oneLiner =
    content?.hero.sbmSubhead ?? content?.hero.eyebrow ?? tokens.tagline;

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
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* TOP — wordmark + vertical name as eyebrow stack */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

        {/* MIDDLE — headline + value-prop one-liner */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              lineHeight: 1.08,
              letterSpacing: -1.5,
              maxWidth: 1040,
            }}
          >
            {trimToChars(headline, 96)}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              lineHeight: 1.35,
              color: colors.inkSoft.hex,
              maxWidth: 1000,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {trimToChars(oneLiner, 130)}
          </div>
        </div>

        {/* BOTTOM — ROI claim (left) + Built on Claude stamp (right),
            over a clay accent bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ width: 120, height: 4, background: colors.clay.hex }} />
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
              Built on Claude
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

// OG canvases are width-bound; long hero headlines wrap unpredictably and
// can push the layout. Trim by character budget so the visible block stays
// within the max-width.
function trimToChars(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length).trim()}…`;
}
