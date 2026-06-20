import { ImageResponse } from "next/og";
import { tokens } from "@/lib/brand/tokens";
import { getVerticalContent } from "@/lib/verticals";

// Programmatic per-vertical OG endpoint.
//
// A directly-fetchable share card at GET /api/og/<vertical> (1200×630). It pulls
// the vertical's name, value prop, and the brand tagline, and pairs them with a
// DISTINCT per-vertical emblem drawn in brand tokens — so /api/og/real-estate,
// /api/og/cpa, /api/og/law, etc. each render a recognizably different card
// instead of one generic backdrop.
//
// This complements the meta-wired `app/(marketing)/[vertical]/opengraph-image.tsx`
// (which Next.js auto-attaches to og:image). This route exists as an explicit,
// addressable endpoint — usable in hand-authored share links, email headers, ad
// units, and CI/visual verification.
//
// Self-contained on purpose: the emblem is an inline data-URI SVG (Satori renders
// <img data:image/svg+xml> reliably; external SVG refs in Satori are not), so the
// card has no network dependency and renders at the edge.

export const runtime = "edge";

const C = tokens.colors;
const SIZE = { width: 1200, height: 630 };
const ROI_LINE = "15–50× per workflow + the violations you don't pay for";

// Per-vertical emblem — a compact, distinctive heritage glyph in brand tokens.
// Drawn with primitives so each vertical is visually unmistakable on the card.
function emblem(slug: string): string {
  const { paper, paperDeep, ink, clay, moss, mute } = {
    paper: C.paper.hex,
    paperDeep: C.paperDeep.hex,
    ink: C.ink.hex,
    clay: C.clay.hex,
    moss: C.moss.hex,
    mute: C.mute.hex,
  };
  const glyphs: Record<string, string> = {
    // house + key
    "real-estate": `
      <rect x="118" y="150" width="170" height="150" fill="${paper}" stroke="${ink}" stroke-width="3"/>
      <polygon points="104,150 203,72 302,150" fill="${clay}"/>
      <rect x="150" y="214" width="44" height="86" fill="${ink}"/>
      <rect x="232" y="186" width="44" height="44" fill="${paper}" stroke="${ink}" stroke-width="3"/>
      <circle cx="150" cy="350" r="20" fill="${clay}"/><circle cx="150" cy="350" r="9" fill="${paperDeep}"/>
      <rect x="168" y="344" width="74" height="13" fill="${clay}"/><rect x="226" y="357" width="11" height="18" fill="${clay}"/>`,
    // stacked tax folders + calculator
    cpa: `
      <rect x="96" y="120" width="210" height="30" fill="${clay}"/>
      <rect x="110" y="156" width="210" height="30" fill="${moss}"/>
      <rect x="90" y="192" width="210" height="30" fill="${mute}"/>
      <rect x="120" y="250" width="120" height="120" rx="10" fill="${ink}"/>
      <rect x="134" y="264" width="92" height="26" fill="${paper}"/>
      <circle cx="150" cy="320" r="8" fill="${paper}"/><circle cx="180" cy="320" r="8" fill="${paper}"/><circle cx="210" cy="320" r="8" fill="${clay}"/>
      <circle cx="150" cy="350" r="8" fill="${paper}"/><circle cx="180" cy="350" r="8" fill="${paper}"/><circle cx="210" cy="350" r="8" fill="${paper}"/>`,
    // gavel + books
    law: `
      <rect x="96" y="150" width="170" height="30" fill="${clay}"/>
      <rect x="106" y="186" width="170" height="30" fill="${moss}"/>
      <rect x="90" y="222" width="170" height="30" fill="${ink}"/>
      <g transform="rotate(-20 250 300)">
        <rect x="206" y="284" width="120" height="34" rx="10" fill="${clay}"/>
        <rect x="250" y="246" width="34" height="104" rx="8" fill="${clay}"/>
      </g>
      <rect x="196" y="356" width="150" height="18" rx="4" fill="${ink}"/>`,
    // multi-unit building + keyring
    "property-management": `
      <rect x="110" y="110" width="200" height="240" fill="${paper}" stroke="${ink}" stroke-width="3"/>
      ${Array.from({ length: 3 }, (_, i) => Array.from({ length: 4 }, (_, j) => `<rect x="${130 + j * 44}" y="${132 + i * 60}" width="26" height="36" fill="${ink}"/>`).join("")).join("")}
      <rect x="190" y="300" width="40" height="50" fill="${clay}"/>
      <circle cx="120" cy="370" r="20" fill="${clay}"/><circle cx="120" cy="370" r="9" fill="${paperDeep}"/>
      <rect x="138" y="364" width="70" height="13" fill="${clay}"/>`,
    // window + laptop (kitchen-table office)
    general: `
      <rect x="110" y="100" width="200" height="200" fill="${paper}" stroke="${ink}" stroke-width="3"/>
      <line x1="210" y1="100" x2="210" y2="300" stroke="${ink}" stroke-width="3"/>
      <line x1="110" y1="200" x2="310" y2="200" stroke="${ink}" stroke-width="3"/>
      <circle cx="160" cy="150" r="22" fill="${clay}" opacity="0.45"/>
      <rect x="130" y="318" width="160" height="92" rx="8" fill="${ink}"/>
      <rect x="142" y="330" width="136" height="68" fill="${paper}"/>
      <polygon points="116,410 304,410 318,420 102,420" fill="${ink}"/>`,
  };
  const inner = glyphs[slug] ?? glyphs.general;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="460" viewBox="0 0 420 460"><rect width="420" height="460" fill="none"/>${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function GET(
  _req: Request,
  { params }: { params: { vertical: string } },
): Response {
  const content = getVerticalContent(params.vertical);
  const verticalName = content?.name ?? "Local business";
  const headline = content?.hero.valueProp ?? tokens.tagline;
  const eyebrow = content?.hero.eyebrow ?? "agentplain";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: C.paper.hex,
          color: C.ink.hex,
          fontFamily: "Georgia, serif",
        }}
      >
        {/* LEFT — type column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 56px 56px 72px",
            width: 760,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                fontSize: 20,
                letterSpacing: 3.6,
                color: C.mute.hex,
                fontFamily: "ui-monospace, monospace",
                textTransform: "uppercase",
              }}
            >
              {tokens.wordmark}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                letterSpacing: 3,
                color: C.clay.hex,
                fontFamily: "ui-monospace, monospace",
                textTransform: "uppercase",
              }}
            >
              {`for ${verticalName.toLowerCase()}`}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 52, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 640 }}>
              {trim(headline, 92)}
            </div>
            <div style={{ display: "flex", width: 120, height: 4, background: C.clay.hex }} />
            <div style={{ display: "flex", fontSize: 26, color: C.clay.hex }}>{tokens.tagline}</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              color: C.inkSoft.hex,
              fontFamily: "system-ui, sans-serif",
              maxWidth: 640,
            }}
          >
            {ROI_LINE}
          </div>
        </div>
        {/* RIGHT — paperDeep panel with the per-vertical emblem */}
        <div
          style={{
            width: 440,
            height: "100%",
            background: C.paperDeep.hex,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderLeft: `2px solid ${C.rule.hex}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori <img>, decorative */}
          <img src={emblem(params.vertical)} width={420} height={460} alt="" />
        </div>
      </div>
    ),
    { ...SIZE },
  );
}

function trim(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > 0 ? sp : cut.length).trim()}…`;
}
