import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
// 2026-06-06 refresh (SEO/marketing pack), amended 2026-06-11 (vendor-invisible
// customer surfaces). Each card carries the full marketing frame:
//   - vertical name (clay eyebrow) + wordmark
//   - the vertical headline (display serif)
//   - a value-prop one-liner (sans) sourced from the vendor-generic subhead
//   - the softened ROI claim: "15–50× + the violations you don't pay for"
//   - a "Run for you" brand stamp. The underlying AI model is NOT named on a
//     customer surface (per the 2026-06-11 rule); the prior "Built on Claude"
//     stamp was replaced for that reason.
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

// NOTE: this route deliberately does NOT declare `runtime = "edge"`.
// Next 15 makes `export const runtime = "edge"` + `generateStaticParams()` a
// hard build error ("Edge runtime is not supported with
// `generateStaticParams`"). Next 14 tolerated the combination, so the
// conflict is pre-existing and was surfaced — not caused — by the 15.5.25
// upgrade. This route wants build-time generation (one card per vertical),
// so the static params win and the route generates on the Node runtime,
// where `next/og` renders `ImageResponse` exactly as it did on edge.
//
// `force-static` is load-bearing, not decoration. `generateStaticParams` alone
// does NOT guarantee a metadata image route is prerendered — without this the
// route still deploys as a serverless function and renders per request, and
// `public/` is not part of the lambda bundle (`/var/task`), so the backdrop
// read fails with ENOENT and every card 500s. Verified: that is exactly what
// happened before this line was added. With `force-static` the 11 cards are
// rendered once at build time, where `public/` exists, and served as static
// PNGs from the CDN.
export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The softened ROI line, identical to the FAQ + Product JSON-LD copy. Capped
// at 50× per PR #159; the retired 107× claim never appears.
const ROI_LINE = "15–50× per workflow + the violations you don't pay for";

export function generateStaticParams() {
  return [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS].map((vertical) => ({ vertical }));
}

// Per-vertical alt text. Used by Next.js to populate the og:image:alt tag.
export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  const content = getVerticalContent(vertical);
  const label = content ? `for ${content.name.toLowerCase()}` : "";
  return [
    {
      id: vertical,
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
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  const content = getVerticalContent(vertical);
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

  // Heritage Plaino backdrop. A right-anchored crop keeps the left 60% clean
  // Paper for the type, and a left-to-right Paper scrim guarantees legibility.
  // This lifts every per-vertical share card from text-only (WEAK) to the
  // heritage system. When per-vertical scene rasters land, swap the filename
  // to the vertical asset (public/brand/plaino-system/scenes/vertical-<slug>.png).
  //
  // This used to build an absolute URL from the live request host via
  // `headers()`, so Satori could fetch the PNG over HTTP. That is what put the
  // route in an impossible position: `headers()` is a request-time API, which
  // forces the route dynamic, and a dynamic route cannot also enumerate
  // `generateStaticParams()`. Reading the asset off disk removes the request
  // dependency entirely, which is what lets the static params stand.
  //
  // Reading from disk is also strictly more reliable than the fetch it
  // replaces: no dependency on the deployment origin being reachable while the
  // build runs, and preview and production render byte-identical cards.
  const heritageSrc = await loadHeritageDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
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
        {/* Heritage backdrop, right-anchored — keep left 60% clean for type. */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori <img>, decorative */}
        <img
          src={heritageSrc}
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
            objectPosition: "right center",
          }}
        />
        {/* Paper scrim — left-to-right so the type column stays on paper. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(90deg, rgba(247,244,237,0.98) 42%, rgba(247,244,237,0.72) 64%, rgba(247,244,237,0.30) 100%)",
          }}
        />
        {/* TOP — wordmark + vertical name as eyebrow stack */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
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
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20 }}>
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

        {/* BOTTOM — ROI claim (left) + brand stamp (right),
            over a clay accent bar */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20 }}>
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
              Run for you
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

// Load the heritage backdrop from the repo and inline it as a data URI so
// Satori never has to make a network request to render the card.
//
// Deliberately NOT wrapped in try/catch. If the asset is missing or unreadable
// the build must fail loudly: a share card that renders with its type but no
// background would still produce a green build, and a silently degraded card
// shipped to every social preview is the worse failure. `public/` is part of
// the repo, so a read failure here means something is genuinely wrong.
//
// Cost is bounded and paid once per build: the PNG is ~246 KB, decoded once
// and reused across all of VERTICAL_SLUGS + ON_RAMP_SLUGS.
let heritageDataUri: Promise<string> | undefined;
function loadHeritageDataUri(): Promise<string> {
  heritageDataUri ??= readFile(
    join(process.cwd(), "public", "brand", "plaino-system", "heritage.png"),
  ).then((bytes) => `data:image/png;base64,${bytes.toString("base64")}`);
  return heritageDataUri;
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
