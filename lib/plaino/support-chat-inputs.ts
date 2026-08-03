/**
 * lib/plaino/support-chat-inputs.ts
 *
 * Pre-generation requirements check for the in-app support chat
 * (`app/api/chat/route.ts`, mode="support").
 *
 * The support prompt is built from three workspace-grounding loads: the
 * workspace row (name / vertical / tier), the capability snapshot (what's
 * connected and how it's doing), and a knowledge search over the saved
 * substrate. Each load used to fail SILENTLY — the snapshot behind a
 * `.catch(() => null)`, the search behind a `catch { return [] }`, and a
 * missing workspace row behind a `?? "your workspace"` default. Every one
 * of those degrades into a prompt that looks well-formed and is grounded
 * in nothing, and the customer gets a confident answer about a workspace
 * Plaino cannot actually see.
 *
 * This module owns the line between the two failure shapes that matter:
 *
 *   - EMPTY is fine. Zero knowledge hits means the customer asked about
 *     something we have no material on; the prompt's honest "I don't know
 *     yet" path handles that correctly and the turn should proceed.
 *   - FAILED is not. A store error, a thrown search, or a snapshot that
 *     blew up means we don't know what we don't know.
 *
 * We refuse when the workspace row itself is missing (nothing is grounded)
 * or when BOTH grounding loads failed (every workspace-specific input the
 * prompt depends on is unavailable). One surviving load is enough to
 * answer honestly, so a single failure never over-refuses.
 *
 * Lives outside the route file so it can be unit-tested without pulling in
 * Next's server internals. Pure: no I/O, no clock, no model call.
 */

import {
  buildMissingInputsReport,
  MISSING_CAPABILITY_SNAPSHOT,
  MISSING_KNOWLEDGE,
  MISSING_WORKSPACE,
  type MissingInput,
  type MissingInputReport,
} from './missing-inputs';

export interface SupportChatInputAvailability {
  /** Did the Workspace row load? False = nothing about this workspace is known. */
  workspaceFound: boolean;
  /** True when buildCapabilitySnapshot threw / rejected. NOT "returned nothing". */
  snapshotFailed: boolean;
  /** True when the knowledge search errored. NOT "returned zero hits". */
  knowledgeFailed: boolean;
}

/**
 * Returns a report when the turn should refuse, or null to proceed to the
 * model. Deliberately narrow — empty results are never a refusal reason.
 */
export function checkSupportChatInputs(
  availability: SupportChatInputAvailability,
): MissingInputReport | null {
  const missing: MissingInput[] = [];

  if (!availability.workspaceFound) {
    missing.push(MISSING_WORKSPACE);
  }

  // Both grounding loads down = the prompt would carry no workspace-
  // specific truth at all. Either one alone still leaves the turn
  // answerable, so we don't name a lone failure.
  const bothGroundingLoadsFailed =
    availability.snapshotFailed && availability.knowledgeFailed;
  if (bothGroundingLoadsFailed) {
    missing.push(MISSING_CAPABILITY_SNAPSHOT, MISSING_KNOWLEDGE);
  }

  if (missing.length === 0) return null;
  return buildMissingInputsReport('SUPPORT_CHAT', missing);
}
