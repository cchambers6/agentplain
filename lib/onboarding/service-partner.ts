// Service-partner identity.
//
// The customer-facing service partner is a single named character —
// Plaino — across every workspace. The earlier name-pool hashing
// (Sarah / James / Emma / Daniel / Maya / Owen) is removed: the brand
// is one rooted character, not a rotating cast.
//
// The Geico-gecko model: the heritage agentplain wordmark stays the
// serious surface; Plaino is the warmth on top — a small avatar plus
// a named voice that introduces the work the fleet is doing.
//
// See memory/feedback_brand_is_plain_not_plane.md for brand semantics
// (agent + the PLAINS) and docs/product-design-language-2026-05-17.md
// §10 for the Plaino character spec.

export const PLAINO_PARTNER = {
  name: "Plaino",
  pronoun: "they",
  role: "your service partner",
} as const;

export type ServicePartner = typeof PLAINO_PARTNER;

// Kept for backwards compatibility with existing call sites that
// destructure a string. The workspaceId argument is unused — every
// workspace meets the same Plaino — but the signature is preserved so
// the call sites don't need to churn.
export function servicePartnerForWorkspace(
  _workspaceId: string,
): string {
  return PLAINO_PARTNER.name;
}
