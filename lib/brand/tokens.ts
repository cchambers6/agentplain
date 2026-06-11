import type { BrandTokens } from "./types";

// Canonical agentplain brand tokens, v0.
// Source: C:\flatsbo\outputs\install_now\memory\agentplain_brand\agentplain_brand_standards_v0.md
// Ratified by Conner 2026-05-10 per ~/.claude/projects/C--agentplain/memory/project_brand_locked.md.
// Per portability rule (feedback_runner_portability.md): tailwind.config.ts and
// app/globals.css consume these tokens. Components never hardcode hex values.

export const tokens: BrandTokens = {
  colors: {
    paper: {
      hex: "#F7F4ED",
      source: "spec §4",
    },
    paperDeep: {
      // Derived: tonal step for header strips and card-on-card surfaces. Spec §6 prefers
      // hairline rules over tonal steps, but the existing layouts use a deeper tone; keeping
      // this in-family lets us land the brand without reworking section structure.
      hex: "#EDE9DE",
      source: "derived — paper @ -6% L",
      derived: true,
    },
    ink: {
      hex: "#1A1A1F",
      source: "spec §4",
    },
    inkSoft: {
      // Derived: secondary text on paper. Held neutral-cool to match canonical ink.
      hex: "#2E2E33",
      source: "derived — ink @ +12% L",
      derived: true,
    },
    clay: {
      hex: "#B65D3A",
      source: "spec §4 (primary accent)",
    },
    clayDeep: {
      // Derived: hover state for clay CTAs.
      hex: "#9A4D2F",
      source: "derived — clay @ -12% L",
      derived: true,
    },
    moss: {
      hex: "#3F5C3F",
      source: "spec §4 (verified / passed states only — never primary accent)",
    },
    flag: {
      hex: "#B43A3A",
      source: "spec §4 (compliance flag / error utility only)",
    },
    mute: {
      hex: "#726A5E",
      source: "spec §4 (captions, citations, secondary text); darkened from #8C8478 for WCAG AA — 4.85:1 on paper",
    },
    rule: {
      // Derived: hairline rule color, mute-family.
      hex: "#E0DAC9",
      source: "derived — mute @ ~20% on paper",
      derived: true,
    },
  },
  typography: {
    // Display face is Fraunces — the ratified brand display per
    // docs/brand-and-claims.md §Typography (Source Serif 4 was the V0 dev
    // stand-in; aligned to spec in Wave A3, 2026-06-11). Loaded as a variable
    // font with the opsz optical-size axis in app/layout.tsx.
    displayFamily: "Fraunces",
    sansFamily: "Inter",
    monoFamily: "JetBrains Mono",
  },
  // Tagline locked 2026-05-11 per project_agentplain_mission_and_positioning.md.
  // Form: no mid-sentence period — "Intelligence rooted in reality." reads as
  // a single thought, not two beats. The prior comma-spliced form has been
  // retired across every customer surface.
  tagline: "Intelligence rooted in reality.",
  wordmark: "agentplain",
  version: "v0",
};

// Convenience: flat hex map for tailwind.config.ts consumption.
export const colorHex = {
  paper: tokens.colors.paper.hex,
  "paper-deep": tokens.colors.paperDeep.hex,
  ink: tokens.colors.ink.hex,
  "ink-soft": tokens.colors.inkSoft.hex,
  clay: tokens.colors.clay.hex,
  "clay-deep": tokens.colors.clayDeep.hex,
  moss: tokens.colors.moss.hex,
  flag: tokens.colors.flag.hex,
  mute: tokens.colors.mute.hex,
  rule: tokens.colors.rule.hex,
} as const;
