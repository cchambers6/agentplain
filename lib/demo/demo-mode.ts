/**
 * lib/demo/demo-mode.ts
 *
 * The pure predicate that decides when a workspace lands in DEMO MODE — the
 * state where the Today view leads with the visible killer-workflow runtime
 * running on synthetic data, instead of an empty "nothing's come in yet" void.
 *
 * The conversion bet: a brand-new trial workspace has nothing connected and
 * nothing in its queue, so its first impression is emptiness. Demo mode fills
 * that first impression with Plaino visibly doing the one thing their vertical
 * cares about — then points at the single tool that makes it real.
 *
 * A workspace is in demo mode while it has no real work to show yet — no
 * pending approvals and no handoffs. The moment real work exists (the fleet
 * drafts something, a handoff lands), demo mode steps aside for it.
 *
 * PURE — no I/O. The Today server loader passes in the counts it already has.
 */

export interface DemoModeInput {
  pendingApprovals: number;
  recentHandoffsCount: number;
}

export function isDemoMode(input: DemoModeInput): boolean {
  return input.pendingApprovals <= 0 && input.recentHandoffsCount <= 0;
}
