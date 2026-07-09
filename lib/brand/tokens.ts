import type { BrandTokens } from "./types";

// Canonical agentplain brand tokens, v0.
// Source: C:\flatsbo\outputs\install_now\memory\agentplain_brand\agentplain_brand_standards_v0.md
// Ratified by Conner 2026-05-10 per ~/.claude/projects/C--agentplain/memory/project_brand_locked.md.
// Per portability rule (feedback_runner_portability.md): tailwind.config.ts and
// app/globals.css consume these tokens. Components never hardcode hex values.

export const tokens: BrandTokens = {
  colors: {
    paper: {
      // Heritage Plains Editorial rollout (2026-06-22, PR #316 winner): the base
      // surface is a true newsprint cream, warmed a half-step from the prior
      // #F7F4ED. ink stays near-black so body contrast is unaffected (≈ 9:1).
      // Source: app/style/direction-1-heritage-plains/styles.css --h-cream.
      hex: "#F5F0E6",
      source: "spec §4 / heritage rollout — newsprint cream (--h-cream)",
    },
    paperDeep: {
      // Derived: tonal step for header strips and card-on-card surfaces. Spec §6 prefers
      // hairline rules over tonal steps, but the existing layouts use a deeper tone; keeping
      // this in-family lets us land the brand without reworking section structure.
      // Re-grounded to the cream family for the heritage rollout.
      hex: "#ECE5D6",
      source: "derived — paper @ -5% L (heritage cream family)",
      derived: true,
    },
    ink: {
      // Heritage rollout: warm near-black (was the neutral-cool #1A1A1F). Reads as
      // letterpress ink on cream, not screen-black. Source: --h-ink.
      hex: "#1A1612",
      source: "spec §4 / heritage rollout — warm letterpress ink (--h-ink)",
    },
    inkSoft: {
      // Secondary text on cream — heritage warm body tone (was the cool #2E2E33).
      // Contrast on cream ≈ 8.5:1, well past WCAG AA. Source: --h-prose body color.
      hex: "#34302A",
      source: "derived — heritage warm body (--h-prose), AA on cream",
      derived: true,
    },
    clay: {
      // Heritage clay — a hair more saturated than the prior #B65D3A. Stays the
      // single primary accent. Source: --h-clay.
      hex: "#B85540",
      source: "spec §4 (primary accent) / heritage rollout (--h-clay)",
    },
    clayDeep: {
      // Hover state for clay CTAs. Source: --h-clay-deep.
      hex: "#97402E",
      source: "derived — clay @ -12% L (--h-clay-deep)",
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
      // UNCHANGED through the heritage rollout: this is the WCAG-AA-tuned caption /
      // small-print color (4.85:1 on cream). Heritage `dust` (#9C8B73) is lighter and
      // is decorative/large-text only — small captions keep using `mute`.
      hex: "#726A5E",
      source: "spec §4 (captions, citations, secondary text); darkened from #8C8478 for WCAG AA — 4.85:1 on paper",
    },
    rule: {
      // Hairline rule color. Heritage line tone — a touch stronger than the prior
      // #E0DAC9 so editorial section rules read on cream. Source: --h-line.
      hex: "#D8CFBA",
      source: "derived — heritage hairline (--h-line)",
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
    forestDeep: {
      // Heritage rollout: the darkest field tone, for full-bleed footer + closing
      // panels (the heritage footer/CTA ground). Source: --h-forest-deep.
      hex: "#16291F",
      source: "heritage rollout (--h-forest-deep) — full-bleed footer / closing panel ground",
      derived: true,
    },
    wheat: {
      hex: "#C8A24A",
      source: "design-mirror §5/§6 (Mailchimp/heritage) — rare harvest accent, ≤1 use per long page",
      derived: true,
    },
    paperBright: {
      hex: "#FBF8F1",
      source: "design-mirror §2 (MUJI) / heritage (--h-paper-bright) — half-step above cream; no-shadow lift",
      derived: true,
    },
    clayWash: {
      hex: "#F3E7E0",
      source: "design-mirror §1/§5 (Linear/Mailchimp) — clay @ low value, highlight-band ground",
      derived: true,
    },
    midRule: {
      hex: "#C2B69B",
      source: "heritage rollout (--h-line-strong) — stronger hairline for figure frames + price cards",
      derived: true,
    },
    // Heritage earth tones (2026-06-22, PR #316). DECORATIVE / large-text only —
    // both are lighter than `mute` and must NOT back small captions or body copy
    // (they fail WCAG AA at small sizes). Use on forest panels, dividers, marks,
    // and oversized display flourishes. Source: --h-dust / --h-sage.
    dust: {
      hex: "#9C8B73",
      source: "heritage rollout (--h-dust) — weathered tan; decorative / large-text only",
      derived: true,
    },
    sage: {
      hex: "#7A8B6F",
      source: "heritage rollout (--h-sage) — muted field green; decorative accent only",
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
  // Heritage rollout (2026-06-22) — bg-forest-deep, text-dust, text-sage, etc.
  "forest-deep": tokens.colors.forestDeep!.hex,
  dust: tokens.colors.dust!.hex,
  sage: tokens.colors.sage!.hex,
} as const;

// Motion tokens (2026-07-08 design-system tighten). The complete sanctioned
// motion vocabulary: three durations, two easings. Mirrored as CSS variables
// in app/globals.css (--motion-*, --ease-*) and as Tailwind utilities
// (duration-quick, ease-out-soft, …) in tailwind.config.ts — keep all three
// in lockstep, same rule as the color tokens. Reference:
// docs/brand/design-tokens-2026-07-08.md §6.
export const motion = {
  durations: {
    /** Hover/focus state changes. */
    quick: "120ms",
    /** Sheet + panel entrances — translate only, never fade. */
    settle: "180ms",
    /** Ambient loader travel (the rooted-loader hairline strip). */
    drift: "1200ms",
  },
  easings: {
    /** Entrances — settles in like a sheet of paper laid down. */
    outSoft: "cubic-bezier(0.2, 0, 0, 1)",
    /** Continuous, even travel for looping movement. */
    travel: "cubic-bezier(0.4, 0, 0.6, 1)",
  },
} as const;
