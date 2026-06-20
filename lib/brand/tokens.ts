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
    // ── Support tokens (additive, 2026-06-19) ─────────────────────────────────
    // Source: docs/brand/design-mirror-2026-06-19.md — heritage earth tones +
    // tonal-layering surfaces that read as human, not generic-SaaS. All warm and
    // desaturated; clay stays the single primary accent. Conner-gated (see
    // docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md). Until sign-off these
    // are opt-in primitives surfaced on /style — no existing surface adopts them.
    forest: {
      hex: "#1F3D2E",
      source: "design-mirror §3/§6 (Patagonia/heritage) — deep field tone, never a status green",
      derived: true,
    },
    wheat: {
      hex: "#C8A24A",
      source: "design-mirror §5/§6 (Mailchimp/heritage) — rare harvest accent, ≤1 use per long page",
      derived: true,
    },
    paperBright: {
      hex: "#FCFAF4",
      source: "design-mirror §2 (MUJI) — half-step above paper; no-shadow surface lift",
      derived: true,
    },
    clayWash: {
      hex: "#F3E7E0",
      source: "design-mirror §1/§5 (Linear/Mailchimp) — clay @ low value, highlight-band ground",
      derived: true,
    },
    midRule: {
      hex: "#D9D5C7",
      source: "design-mirror §6 (heritage) — stronger hairline for figure frames; already gate-known",
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
  // Support tokens (additive 2026-06-19) — auto-wired into Tailwind utilities
  // (bg-forest, text-wheat, bg-paper-bright, bg-clay-wash, border-mid-rule).
  forest: tokens.colors.forest!.hex,
  wheat: tokens.colors.wheat!.hex,
  "paper-bright": tokens.colors.paperBright!.hex,
  "clay-wash": tokens.colors.clayWash!.hex,
  "mid-rule": tokens.colors.midRule!.hex,
} as const;
