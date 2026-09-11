/**
 * lib/approvals/accepted-status.ts
 *
 * The accepted-class predicate, and nothing else.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * `isAcceptedStatus` was born in `lib/approvals/executors.ts` and this is
 * still its ONLY definition -- executors.ts now re-exports it from here, so
 * every existing importer is unchanged and there is exactly one copy of the
 * rule in the repo.
 *
 * It moved because the approvals CARD needs it. `ApprovalsList.tsx` carries
 * `"use client"` and imports `ApprovalCard`, which puts ApprovalCard in the
 * CLIENT graph. Importing `executors.ts` from there would drag
 * `executors/artifact-handoff.ts` -- and therefore `node:crypto` -- into a
 * browser bundle. The predicate is a Set and four lines; the executor
 * registry behind it is a server concern. Splitting the leaf out is cheaper
 * and safer than either bundling a node builtin into the client or writing a
 * second status comparison.
 *
 * DO NOT re-derive this as `status === "APPROVED"`. A literal comparison
 * silently skips every row the confidence threshold accepted, and this repo
 * already carries that bug once, at `lib/voice/recording.ts:51`.
 */

import type { WorkApprovalStatus } from "@prisma/client";

/**
 * The two statuses that mean "accepted": a human clicked approve, or
 * `applyApprovalThreshold` accepted it on the machine path. Every consumer in
 * the repo treats them as one class.
 *
 * Exported as a tuple as well as a Set because callers need both shapes: the
 * Set answers "is this one of them", and a Prisma `status: { in: [...] }`
 * needs the array. Deriving the Set FROM the tuple is what keeps a query and
 * a predicate from disagreeing about what "accepted" means.
 */
export const ACCEPTED_APPROVAL_STATUSES = [
  "APPROVED",
  "AUTO_APPROVED",
] as const;

export type AcceptedApprovalStatus = (typeof ACCEPTED_APPROVAL_STATUSES)[number];

const ACCEPTED_STATUSES: ReadonlySet<string> = new Set(
  ACCEPTED_APPROVAL_STATUSES,
);

/**
 * The single accepted-class predicate. Every seam and every consumer uses
 * this rather than comparing to "APPROVED", because a `=== "APPROVED"` check
 * silently skips every row the confidence threshold accepted.
 *
 * Accepts `null` / `undefined` and answers false, deliberately: a row shape
 * that failed to carry a status must FAIL CLOSED to "not accepted" rather
 * than throwing inside a render or defaulting to delivered.
 */
export function isAcceptedStatus(
  status: WorkApprovalStatus | string | null | undefined,
): status is AcceptedApprovalStatus {
  return typeof status === "string" && ACCEPTED_STATUSES.has(status);
}
