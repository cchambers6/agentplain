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
