// Service-partner name derivation.
//
// Per the product brief, the customer-facing onboarding surface and
// workspace overview must name a real person ("Hi, I'm Sarah, your
// service partner") rather than referring to the fleet abstractly.
// Until partner identities are assigned in a join table, derive the
// name from the workspace ID — same input always returns the same
// person, so the customer doesn't experience an identity swap on
// refresh.
//
// When we wire real assignments (Phase 2: WorkspacePartner join), drop
// this fallback and read the assignment directly.

const SERVICE_PARTNERS: readonly string[] = [
  "Sarah",
  "James",
  "Emma",
  "Daniel",
  "Maya",
  "Owen",
];

// Cheap, deterministic, no crypto dependency. Output stable across
// platforms. Not security-sensitive — we just need a stable index.
function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function servicePartnerForWorkspace(workspaceId: string): string {
  if (!workspaceId) return SERVICE_PARTNERS[0]!;
  const idx = hashStringToInt(workspaceId) % SERVICE_PARTNERS.length;
  return SERVICE_PARTNERS[idx]!;
}

export const SERVICE_PARTNER_POOL = SERVICE_PARTNERS;
