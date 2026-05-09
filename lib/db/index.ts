import type { Prisma } from "@prisma/client";

export { prisma } from "./prisma";
export { withRls, withSystemContext, SYSTEM_OPERATOR_CONTEXT } from "./rls";
export type { RlsContext } from "./rls";

// Domain types from the underlying ORM. Re-exported so route/component code
// imports from `@/lib/db` and never reaches into `@prisma/client` directly —
// the lib/<domain>/ boundary stays the single swap point for the ORM.
export type {
  ComplianceSeverity,
  WorkApprovalKind,
  WorkApprovalStatus,
  Role,
  MembershipStatus,
  WorkspaceTier,
  WorkspaceBillingMode,
  ComplianceFlagState,
  CapabilityProposalState,
} from "@prisma/client";

// Transactional client type — used by handlers that need to run multiple
// queries in a single $transaction (e.g. webhook dispatch). Aliased so
// callers don't reach into the `Prisma` namespace directly.
export type DbTransactionClient = Prisma.TransactionClient;
