// Brand token interface. The canonical agentplain brand standards v0 live in
// agentplain_brand_standards_v0.md (sourced from flatsbo install_now memory).
// Implementations of this interface MUST cite the spec section their values
// come from in a comment, and flag any derived (non-spec) tokens with
// `derived: true` in the surrounding object structure.

export interface BrandColor {
  /** CSS-ready hex string, including the leading '#'. */
  hex: string;
  /** Section of agentplain_brand_standards_v0.md that authorizes this value. */
  source: string;
  /** True when the value is derived (not directly enumerated in the spec). */
  derived?: boolean;
}

export interface BrandColors {
  paper: BrandColor;
  paperDeep: BrandColor;
  ink: BrandColor;
  inkSoft: BrandColor;
  clay: BrandColor;
  clayDeep: BrandColor;
  moss: BrandColor;
  flag: BrandColor;
  mute: BrandColor;
  rule: BrandColor;
  // ── Support tokens (additive, 2026-06-19, de-AI-fication wave 2) ─────────────
  // Extracted from the design-mirror study (docs/brand/design-mirror-2026-06-19.md):
  // heritage earth tones + tonal-layering surfaces that read as "made by a person."
  // All in-family (warm, desaturated) and Conner-gated for sign-off; clay remains
  // the single primary accent — these support, never replace, the v0 charge rules.
  /** Deep heritage green for grounded full-bleed pause bands. Patagonia/forest pull. */
  forest?: BrandColor;
  /** Harvest gold — the rare second accent (≤1 use per long page). Mailchimp-yellow pull. */
  wheat?: BrandColor;
  /** A half-step brighter than paper — lets a surface lift with no shadow. MUJI pull. */
  paperBright?: BrandColor;
  /** Clay at low value — highlight-band / pull-quote ground. Mailchimp/Linear pull. */
  clayWash?: BrandColor;
  /** A slightly stronger hairline than `rule`, for figure frames. Heritage pull. */
  midRule?: BrandColor;
  // ── Heritage Plains Editorial rollout (2026-06-22, PR #316) ──────────────────
  /** The darkest field tone — full-bleed footer / closing-panel ground. */
  forestDeep?: BrandColor;
  /** Weathered tan. DECORATIVE / large-text only (lighter than `mute`, fails AA small). */
  dust?: BrandColor;
  /** Muted field green. DECORATIVE accent only (fails AA at small sizes). */
  sage?: BrandColor;
}

export interface BrandTypography {
  /** Display serif. V0 dev substitute per spec §3 + §11 (paid serif deferred to V1). */
  displayFamily: string;
  /** Body sans per spec §3. */
  sansFamily: string;
  /** Mono per spec §3 — data, code, listing IDs, deal references. */
  monoFamily: string;
}

export interface BrandTokens {
  colors: BrandColors;
  typography: BrandTypography;
  /** The locked tagline, exact form. spec §1. */
  tagline: string;
  /** The locked wordmark, exact form. spec §2. */
  wordmark: string;
  /** Used to verify nothing accidentally drifts off-canonical at runtime. */
  version: "v0";
}
