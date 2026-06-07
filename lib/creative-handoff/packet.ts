// Creator-brief packet builder.
//
// The fleet does NOT improvise brand assets in raw SVG/PNG when a real design
// tool exists OR when the work is brand-defining
// (feedback_creative_assets_use_tools_or_humans). For the brand-defining jobs
// in JOB_TO_TOOL_MATRIX.md that route to "human creator required", the Media
// discipline's creative router (`media-creative-router`) assembles a
// CreatorBriefPacket: a self-contained brief an outside creator can act on
// without our context — brand tokens snapshot, references, delivery spec, and
// acceptance criteria.
//
// Everything here is PURE (no I/O) so the packet shape is testable in
// isolation, matching the lib/billing/budget.ts convention. Persistence lives
// in ./store.

import { tokens } from "@/lib/brand/tokens";
import { PLAINO_PARTNER } from "@/lib/onboarding/service-partner";
import type { CreatorBriefKind } from "@prisma/client";

/** A reference the creator should study — an existing asset, a mood image, a
 *  competitor anti-pattern. Path or URL is opaque to this module. */
export interface BriefReference {
  /** Vercel Blob URL, repo path, or external URL. */
  ref: string;
  /** Why it's here: "north-star", "anti-pattern", "prior-version", "context". */
  role: "north-star" | "anti-pattern" | "prior-version" | "context";
  note?: string;
}

/** The technical delivery spec — what files, what sizes, what formats. */
export interface DeliverySpec {
  /** Vector-first for marks/illustration; raster for photo direction. */
  formats: string[];
  /** Pixel or physical dimensions the creator must deliver at. */
  dimensions: string[];
  /** Color space / profile note (e.g. "sRGB for screen; CMYK proof for print"). */
  colorSpace: string;
  /** Hard constraints: transparent background, safe-area, etc. */
  constraints: string[];
}

/** A brand-token snapshot frozen into the packet so the brief is durable even
 *  if tokens move later. We embed the v0 palette + type system verbatim. */
export interface BrandSnapshot {
  wordmark: string;
  tagline: string;
  version: string;
  palette: Array<{ name: string; hex: string; use: string }>;
  typography: { display: string; sans: string; mono: string };
  /** The single named service partner — Plaino (the 8-bit robot dog on the
   *  8-bit plain). Brand-defining illustration must respect this character. */
  servicePartner: { name: string; pronoun: string; role: string };
}

export interface CreatorBriefPacket {
  brand: BrandSnapshot;
  /** The grounded brand-voice / anti-slop guardrails an outside creator needs. */
  guardrails: string[];
  references: BriefReference[];
  delivery: DeliverySpec;
  /** Concrete, checkable acceptance criteria. The acceptance review at
   *  /operator/creative-briefs walks these. */
  acceptanceCriteria: string[];
}

export interface BuildPacketInput {
  kind: CreatorBriefKind;
  /** Free-form creative direction from the router / creative director. */
  direction: string;
  references?: BriefReference[];
  /** Optional spec overrides; sensible per-kind defaults fill the rest. */
  delivery?: Partial<DeliverySpec>;
  /** Optional extra acceptance criteria appended to the per-kind defaults. */
  extraAcceptance?: string[];
}

// ── brand snapshot ────────────────────────────────────────────────────────

/** Freeze the canonical v0 tokens into a portable snapshot. Pure — reads the
 *  static `tokens` object, no I/O. */
export function brandSnapshot(): BrandSnapshot {
  return {
    wordmark: tokens.wordmark,
    tagline: tokens.tagline,
    version: tokens.version,
    palette: [
      { name: "paper", hex: tokens.colors.paper.hex, use: "background" },
      { name: "ink", hex: tokens.colors.ink.hex, use: "primary text / line" },
      { name: "clay", hex: tokens.colors.clay.hex, use: "primary accent" },
      { name: "moss", hex: tokens.colors.moss.hex, use: "verified / passed states only" },
      { name: "flag", hex: tokens.colors.flag.hex, use: "compliance flag / error only" },
      { name: "mute", hex: tokens.colors.mute.hex, use: "captions / secondary text" },
    ],
    typography: {
      display: tokens.typography.displayFamily,
      sans: tokens.typography.sansFamily,
      mono: tokens.typography.monoFamily,
    },
    servicePartner: {
      name: PLAINO_PARTNER.name,
      pronoun: PLAINO_PARTNER.pronoun,
      role: PLAINO_PARTNER.role,
    },
  };
}

// ── guardrails ──────────────────────────────────────────────────────────────

/** The anti-slop / grounded-brand guardrails. Lifted from the media SKILLs +
 *  AI_VIDEO_STACK.md standing rule so a creator who never saw our system still
 *  ships on-brand. */
export const BRAND_GUARDRAILS: readonly string[] = [
  '"Intelligence rooted in reality." Heritage, grounded, calm — the enemy is AI-slop (over-glossy, uncanny, over-saturated synthetic look).',
  "No coastal-SaaS sleekness, no chirpy exclamation copy.",
  "Banned wordplay: it is always *plain*, never *plane* — no aviation puns anywhere.",
  "The mascot is an 8-bit robot dog standing on an 8-bit plain — Plaino IS the dog. The metaphor is public-facing; keep the dog and the plain legible at small sizes.",
  "No human faces and no product UI are ever synthetic — if the asset implies either, it is photographed / captured real, never AI-generated.",
  "Numbers in any layout are real or labelled — never invented (feedback_no_guesses_no_estimates).",
] as const;

// ── per-kind delivery defaults ───────────────────────────────────────────────

const DEFAULT_DELIVERY: Record<CreatorBriefKind, DeliverySpec> = {
  BRAND_MARK: {
    formats: ["SVG (master)", "PNG @1x/@2x/@3x", "ICO (favicon)", "PDF (print)"],
    dimensions: ["master vector", "1024×1024 app icon", "512/256/64/32/16 favicons"],
    colorSpace: "sRGB for screen; provide a 1-color and a reversed (knockout) variant",
    constraints: [
      "Legible at 16px favicon size",
      "Transparent background on PNG/SVG",
      "Holds up in 1-color on paper and on ink",
    ],
  },
  HERO_ILLUSTRATION: {
    formats: ["SVG or layered source", "PNG @2x", "WebP (web-optimized)"],
    dimensions: ["2400×1260 (OG/hero)", "1200×630 (OG fallback)"],
    colorSpace: "sRGB; palette restricted to the brand snapshot below",
    constraints: ["Safe-area for headline overlay", "No stock-photo realism"],
  },
  MASCOT_ILLUSTRATION: {
    formats: ["SVG (master)", "PNG @1x/@2x with transparency"],
    dimensions: ["1024×1024 per pose", "256×256 sticker crop"],
    colorSpace: "sRGB; 8-bit / pixel-grid aesthetic on the brand palette",
    constraints: [
      "Same Plaino character across every pose — proportions locked",
      "Reads at 64px",
      "Transparent background",
    ],
  },
  PHOTOGRAPHY_DIRECTION: {
    formats: ["Shot list (PDF)", "Reference board", "Delivered RAW + retouched JPEG/WebP"],
    dimensions: ["3:2 native; crops to 16:9 and 1:1"],
    colorSpace: "sRGB delivery; natural grade, no over-saturation",
    constraints: ["Real people, real places", "No synthetic faces"],
  },
  MOTION_IDENT: {
    formats: ["MP4 (H.264)", "ProRes master", "Lottie/JSON if vector"],
    dimensions: ["1920×1080", "1080×1080", "1080×1920"],
    colorSpace: "Rec.709; brand palette",
    constraints: ["≤4s", "Silent-safe (works without audio)", "No AI-generated UI/faces"],
  },
  PRINT_COLLATERAL: {
    formats: ["Print-ready PDF/X", "Editable source (INDD/AI/Figma)"],
    dimensions: ["per piece — specify in direction"],
    colorSpace: "CMYK with bleed + crop marks",
    constraints: ["Min 300dpi raster elements", "Embedded/outlined fonts"],
  },
  OTHER: {
    formats: ["specify"],
    dimensions: ["specify"],
    colorSpace: "specify",
    constraints: [],
  },
};

// ── per-kind acceptance criteria ─────────────────────────────────────────────

const BASE_ACCEPTANCE: readonly string[] = [
  "On-brand per the guardrails — passes a grounded/anti-slop read by the Creative Director.",
  "Uses only the brand snapshot palette + type system (or a deliberate, noted exception).",
  "No banned wordplay; no synthetic faces or product UI.",
  "Source files delivered (not just flattened exports) so the asset stays editable.",
];

const KIND_ACCEPTANCE: Partial<Record<CreatorBriefKind, string[]>> = {
  BRAND_MARK: [
    "Legible and balanced at 16px favicon size.",
    "Works in full-color, 1-color, and reversed (knockout).",
    "Reads as the robot-dog-on-a-plain metaphor without explanation.",
  ],
  HERO_ILLUSTRATION: [
    "Headline-overlay safe-area preserved.",
    "Renders crisply at 2400px wide and degrades cleanly to 1200px.",
  ],
  MASCOT_ILLUSTRATION: [
    "Plaino is unmistakably the same character as the existing mark.",
    "Pose reads at 64px.",
  ],
  PHOTOGRAPHY_DIRECTION: [
    "Subjects are real; grade is natural, not over-saturated.",
    "Crops to 16:9 and 1:1 without losing the subject.",
  ],
  MOTION_IDENT: ["Reads silent.", "Under the duration cap.", "No AI-generated UI or faces."],
  PRINT_COLLATERAL: ["Prints true to the on-screen proof.", "Bleed + crop marks present."],
};

/** Assemble the full acceptance checklist for a kind, plus any extras. Pure. */
export function acceptanceCriteriaFor(
  kind: CreatorBriefKind,
  extra: string[] = [],
): string[] {
  return [...BASE_ACCEPTANCE, ...(KIND_ACCEPTANCE[kind] ?? []), ...extra];
}

// ── the builder ──────────────────────────────────────────────────────────────

/** Build a complete, portable CreatorBriefPacket. Pure — no I/O. The
 *  `direction` is the only free-form input; everything else is derived from
 *  the kind so two briefs of the same kind are structurally consistent. */
export function buildBriefPacket(input: BuildPacketInput): CreatorBriefPacket {
  const base = DEFAULT_DELIVERY[input.kind];
  return {
    brand: brandSnapshot(),
    guardrails: [`Direction: ${input.direction.trim()}`, ...BRAND_GUARDRAILS],
    references: input.references ?? [],
    delivery: {
      formats: input.delivery?.formats ?? base.formats,
      dimensions: input.delivery?.dimensions ?? base.dimensions,
      colorSpace: input.delivery?.colorSpace ?? base.colorSpace,
      constraints: input.delivery?.constraints ?? base.constraints,
    },
    acceptanceCriteria: acceptanceCriteriaFor(input.kind, input.extraAcceptance ?? []),
  };
}
