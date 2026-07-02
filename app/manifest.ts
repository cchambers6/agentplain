import type { MetadataRoute } from "next";
import { tokens } from "@/lib/brand/tokens";

// Web App Manifest (App Router metadata route → /manifest.webmanifest).
// Makes agentplain installable as a PWA with the Plaino brand identity.
//
// Icons:
//   - icon.png        — 64×64 favicon-class mark (any purpose), already shipped.
//   - icon-maskable   — 512×512 with safe-zone padding so Android can crop the
//                        outer ring to a circle/squircle without clipping Plaino.
//   - apple-icon.png is consumed by iOS via the App Router apple-icon route, not
//     the manifest, so it is intentionally not listed here.
//
// Colours are brand tokens — Paper #F5F0E6 background, Ink #1A1612 theme. No
// blue (brand rule). See lib/brand/tokens.ts.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: tokens.wordmark,
    short_name: tokens.wordmark,
    description:
      "A managed AI fleet for local businesses, run for you. Intelligence rooted in reality.",
    start_url: "/",
    display: "standalone",
    background_color: tokens.colors.paper.hex,
    theme_color: tokens.colors.ink.hex,
    icons: [
      {
        src: "/icon.png",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
