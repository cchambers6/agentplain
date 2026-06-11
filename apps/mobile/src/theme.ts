// agentplain mobile design tokens.
//
// Mirrors the web "editorial / heritage" language (paper + ink + clay) so the
// native app reads as the same brand. Calm, grounded, not chirpy — per
// project_plaino_named_agent (Plaino's heritage voice) and the locked brand.
// This is a small, hand-kept token set; the web design system (lib/brand/tokens.ts)
// is the source of truth if the two ever disagree.

export const colors = {
  paper: "#F7F4ED", // app background — warm off-white
  paperRaised: "#FFFFFF", // cards
  ink: "#1A1A1F", // primary text
  inkSoft: "#5C5852", // secondary text
  inkFaint: "#8A847B", // tertiary / captions
  line: "#E7E1D7", // hairline borders
  lineStrong: "#D8D0C3",
  clay: "#B8542F", // primary accent (terracotta)
  clayDeep: "#8F3F22",
  clayWash: "#F3E7DF", // accent background wash
  sage: "#5E7355", // positive / approve
  sageWash: "#E8EDE4",
  amber: "#9A7B23", // pending
  danger: "#A23B2E",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const font = {
  // System serif gives a heritage feel without bundling a custom face in V1.
  // A licensed display serif (e.g. Instrument Serif, matching web) is a
  // fast-follow once expo-font + the license are wired.
  display: undefined as string | undefined,
  displayWeight: "600" as const,
  body: undefined as string | undefined,
} as const;

export const type = {
  h1: { fontSize: 28, lineHeight: 34, color: colors.ink, fontWeight: "700" as const },
  h2: { fontSize: 20, lineHeight: 26, color: colors.ink, fontWeight: "700" as const },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: colors.clay,
    fontWeight: "600" as const,
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink },
  bodySoft: { fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  caption: { fontSize: 13, lineHeight: 18, color: colors.inkFaint },
} as const;
