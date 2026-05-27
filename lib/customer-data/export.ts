/**
 * lib/customer-data/export.ts
 *
 * Builds a single JSON artifact containing every workspace-scoped row a
 * customer owns. The export is the legitimate plaintext egress to the
 * data owner — `KnowledgeDocument.body` is decrypted in-flight when the
 * deployment has at-rest encryption enabled (lib/security/encryption.ts);
 * plaintext bodies pass through unchanged.
 *
 * Scoping invariant (load-bearing — has a test):
 *
 *   Every row in the returned export carries the requested `workspaceId`.
 *   No cross-workspace contamination is possible because:
 *     1. Every read runs inside `withRls(ctx, ...)` with the caller's
 *        workspaceId on the GUC — the SQL RLS policies on every
 *        workspace-scoped table reject foreign rows.
 *     2. The Prisma `where` clause re-states `workspaceId === args.workspaceId`
 *        on every model — application-layer defense-in-depth (matches the
 *        pattern in `lib/customer-files/retrieve.ts`).
 *     3. The shape returned never includes user data from other workspaces:
 *        IntegrationCredential rows are redacted to drop the encrypted
 *        token blobs; Membership rows include only userId + role + status
 *        (no User joins).
 *
 * Sync vs async: v1 is synchronous. The export size is bounded by the
 * V1 ingestion caps (200 files / workspace * ~10 chunks per file *
 * ~1500 chars per chunk + bounded approval/handoff/audit history). A
 * realistic V1 workspace produces a JSON payload under 5 MB. If a future
 * tier lifts the caps such that the synchronous path would exceed the
 * route response budget, switch to the Inngest async path: fire an
 * `agentplain/workspace-export.requested` event, have a worker upload the
 * artifact to Vercel Blob, and email the customer a signed URL. The
 * shape returned by `buildWorkspaceExport` is the contract either path
 * would emit.
 */

import type { PrismaClient } from '@prisma/client';
import {
  decrypt,
  isEncrypted,
  isEncryptionConfigured,
} from '../security/encryption';
import { withRls, type RlsContext } from '../db/rls';

/** Export format version. Bump if the top-level shape changes. */
export const EXPORT_SCHEMA_VERSION = '1.0';

/** Hard cap on per-table row counts in a single sync export. Keeps the
 *  serialized JSON under a few MB for the V1 worker memory budget. */
export const PER_TABLE_ROW_CAP = 5000;

export interface BuildWorkspaceExportArgs {
  workspaceId: string;
  /** The caller's RLS context — MUST already be scoped to the same
   *  workspaceId. Passed in (not constructed here) so the function does
   *  not become a way to bypass membership checks. */
  rls: RlsContext;
  /** Captured for the metadata block; never gates what's returned. */
  requestedByUserId: string;
  now?: Date;
  /** Optional Prisma client override — forwarded to `withRls`'s `{client}`
   *  option so tests can pass a shape-compatible mock. The mock still goes
   *  through the same `withRls` plumbing, so the GUC set + per-row
   *  `where` clauses are exercised by the test. */
  client?: PrismaClient;
}

export interface WorkspaceExportMetadata {
  schemaVersion: string;
  workspaceId: string;
  generatedAt: string;
  requestedByUserId: string;
  /** True iff the deployment has ENCRYPTION_KEY configured. When false,
   *  KnowledgeDocument.body values that ARE encrypted at rest cannot be
   *  decrypted and are emitted with `decryptionFailed: true` rather than
   *  leaking ciphertext or being silently omitted. */
  encryptionConfigured: boolean;
  truncated: Array<{ table: string; capped: number }>;
}

export interface WorkspaceExportArtifact {
  metadata: WorkspaceExportMetadata;
  workspace: WorkspaceExportWorkspaceRow;
  closure: WorkspaceExportClosureState;
  memberships: WorkspaceExportMembershipRow[];
  onboardingState: WorkspaceExportOnboardingState | null;
  preferences: WorkspaceExportPreferences | null;
  preferenceSignals: WorkspaceExportPreferenceSignalRow[];
  knowledgeDocuments: WorkspaceExportKnowledgeDocumentRow[];
  workApprovals: WorkspaceExportWorkApprovalRow[];
  handoffs: WorkspaceExportHandoffRow[];
  integrations: WorkspaceExportIntegrationRow[];
  webhookSubscriptions: WorkspaceExportWebhookSubscriptionRow[];
  webhookEvents: WorkspaceExportWebhookEventRow[];
  auditLog: WorkspaceExportAuditLogRow[];
  inquiries: WorkspaceExportInquiryRow[];
  subscription: WorkspaceExportSubscriptionRow | null;
  invoices: WorkspaceExportInvoiceRow[];
}

export interface WorkspaceExportWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  verticalTier: string;
  tier: string;
  stateCode: string;
  billingMode: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceExportClosureState {
  closureStatus: string;
  closingInitiatedAt: string | null;
  scheduledHardPurgeAt: string | null;
  closedAt: string | null;
}

export interface WorkspaceExportMembershipRow {
  userId: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface WorkspaceExportOnboardingState {
  currentStep: string;
  completedSteps: unknown;
  completedAt: string | null;
}

export interface WorkspaceExportPreferences {
  draftingTone: string | null;
  categorizationNotes: string | null;
  calendarWindow: string | null;
  learnedDraftNotes: string[];
}

export interface WorkspaceExportPreferenceSignalRow {
  id: string;
  source: string;
  kind: string;
  text: string;
  refTable: string | null;
  refId: string | null;
  capturedAt: string;
}

export interface WorkspaceExportKnowledgeDocumentRow {
  id: string;
  title: string;
  /** Plaintext body. NULL only when at-rest decryption was attempted and
   *  failed (encryption key missing or mismatch); see `decryptionFailed`. */
  body: string | null;
  decryptionFailed: boolean;
  sourceUrl: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface WorkspaceExportWorkApprovalRow {
  id: string;
  agentSlug: string;
  kind: string;
  status: string;
  payload: unknown;
  proposedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
}

export interface WorkspaceExportHandoffRow {
  id: string;
  fromAgent: string;
  toAgent: string;
  handoffType: string;
  payload: unknown;
  occurredAt: string;
}

export interface WorkspaceExportIntegrationRow {
  id: string;
  provider: string;
  accountEmail: string;
  scopes: string[];
  status: string;
  expiresAt: string;
  lastRefreshedAt: string | null;
  createdAt: string;
}

export interface WorkspaceExportWebhookSubscriptionRow {
  id: string;
  provider: string;
  resource: string;
  expiresAt: string;
  status: string;
  lastRenewedAt: string | null;
  createdAt: string;
}

export interface WorkspaceExportWebhookEventRow {
  id: string;
  receivedAt: string;
  processed: boolean;
  processedAt: string | null;
  rawPayload: unknown;
}

export interface WorkspaceExportAuditLogRow {
  id: string;
  actorUserId: string | null;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  payload: unknown;
  occurredAt: string;
}

export interface WorkspaceExportInquiryRow {
  id: string;
  name: string;
  business: string;
  vertical: string;
  email: string;
  inquiryType: string;
  status: string;
  createdAt: string;
}

export interface WorkspaceExportSubscriptionRow {
  status: string;
  tier: string;
  seatBand: string;
  seats: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface WorkspaceExportInvoiceRow {
  id: string;
  amountUsdCents: number;
  status: string;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  issuedAt: string;
  paidAt: string | null;
}

/**
 * Build the full export artifact. Pure function over the DB — caller is
 * responsible for membership + role enforcement.
 */
export async function buildWorkspaceExport(
  args: BuildWorkspaceExportArgs,
): Promise<WorkspaceExportArtifact> {
  if (args.rls.workspaceId !== args.workspaceId) {
    // Defense-in-depth — never let the caller hand us an RLS context that
    // scopes to a different workspace than the one being exported.
    throw new Error(
      `RLS context workspaceId mismatch: rls=${args.rls.workspaceId ?? 'null'}, requested=${args.workspaceId}`,
    );
  }
  if (args.rls.isOperator) {
    throw new Error('buildWorkspaceExport refuses isOperator=true contexts');
  }

  const generatedAt = (args.now ?? new Date()).toISOString();
  const encryptionConfigured = isEncryptionConfigured();
  const truncated: Array<{ table: string; capped: number }> = [];

  const recordCap = <T>(rows: T[], table: string): T[] => {
    if (rows.length >= PER_TABLE_ROW_CAP) {
      truncated.push({ table, capped: rows.length });
    }
    return rows;
  };

  return withRls(
    args.rls,
    async (tx) => {
      const [
        workspace,
        memberships,
        onboarding,
        preferences,
        preferenceSignals,
        knowledgeDocuments,
        workApprovals,
        handoffs,
        integrations,
        webhookSubscriptions,
        webhookEvents,
        auditLog,
        inquiries,
        subscription,
        invoices,
      ] = await Promise.all([
        tx.workspace.findUnique({ where: { id: args.workspaceId } }),
        tx.membership.findMany({
          where: { workspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { createdAt: 'asc' },
        }),
        tx.onboardingState.findUnique({ where: { workspaceId: args.workspaceId } }),
        tx.workspacePreference.findUnique({ where: { workspaceId: args.workspaceId } }),
        tx.preferenceSignal.findMany({
          where: { workspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { capturedAt: 'desc' },
        }),
        tx.knowledgeDocument.findMany({
          where: { workspaceId: args.workspaceId, contextKind: 'CUSTOMER' },
          take: PER_TABLE_ROW_CAP,
          orderBy: { createdAt: 'desc' },
        }),
        tx.workApprovalQueueItem.findMany({
          where: { workspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { proposedAt: 'desc' },
        }),
        tx.handoffLogEntry.findMany({
          where: { workspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { occurredAt: 'desc' },
        }),
        tx.integrationCredential.findMany({
          where: { workspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { createdAt: 'asc' },
        }),
        tx.webhookSubscription.findMany({
          where: { workspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { createdAt: 'asc' },
        }),
        tx.webhookEvent.findMany({
          where: { workspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { receivedAt: 'desc' },
        }),
        tx.auditLog.findMany({
          where: { workspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { occurredAt: 'desc' },
        }),
        tx.inquiry.findMany({
          where: { convertedWorkspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { id: 'asc' },
        }),
        tx.subscription.findUnique({ where: { workspaceId: args.workspaceId } }),
        tx.workspaceInvoice.findMany({
          where: { workspaceId: args.workspaceId },
          take: PER_TABLE_ROW_CAP,
          orderBy: { issuedAt: 'desc' },
        }),
      ]);

      if (!workspace) {
        throw new Error(`workspace ${args.workspaceId} not visible under RLS context`);
      }
      if (workspace.id !== args.workspaceId) {
        throw new Error(
          `RLS returned a workspace whose id (${workspace.id}) does not match the requested workspaceId (${args.workspaceId})`,
        );
      }

      const knowledgeRows = recordCap(knowledgeDocuments, 'knowledgeDocuments').map(
        (r): WorkspaceExportKnowledgeDocumentRow => {
          const body = decryptIfNeeded(r.body, encryptionConfigured);
          return {
            id: r.id,
            title: r.title,
            body: body.value,
            decryptionFailed: body.failed,
            sourceUrl: r.sourceUrl,
            metadata: r.metadata as unknown,
            createdAt: r.createdAt.toISOString(),
          };
        },
      );

      const exportArtifact: WorkspaceExportArtifact = {
        metadata: {
          schemaVersion: EXPORT_SCHEMA_VERSION,
          workspaceId: args.workspaceId,
          generatedAt,
          requestedByUserId: args.requestedByUserId,
          encryptionConfigured,
          truncated,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          vertical: workspace.vertical,
          verticalTier: workspace.verticalTier,
          tier: workspace.tier,
          stateCode: workspace.stateCode,
          billingMode: workspace.billingMode,
          createdAt: workspace.createdAt.toISOString(),
          updatedAt: workspace.updatedAt.toISOString(),
        },
        closure: {
          closureStatus: workspace.closureStatus,
          closingInitiatedAt: workspace.closingInitiatedAt
            ? workspace.closingInitiatedAt.toISOString()
            : null,
          scheduledHardPurgeAt: workspace.scheduledHardPurgeAt
            ? workspace.scheduledHardPurgeAt.toISOString()
            : null,
          closedAt: workspace.closedAt ? workspace.closedAt.toISOString() : null,
        },
        memberships: recordCap(memberships, 'memberships').map((r) => ({
          userId: r.userId,
          role: r.role,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
        onboardingState: onboarding
          ? {
              currentStep: onboarding.currentStep,
              completedSteps: onboarding.completedSteps as unknown,
              completedAt: onboarding.completedAt
                ? onboarding.completedAt.toISOString()
                : null,
            }
          : null,
        preferences: preferences
          ? {
              draftingTone: preferences.draftingTone,
              categorizationNotes: preferences.categorizationNotes,
              calendarWindow: preferences.calendarWindow,
              learnedDraftNotes: preferences.learnedDraftNotes,
            }
          : null,
        preferenceSignals: recordCap(preferenceSignals, 'preferenceSignals').map(
          (r) => ({
            id: r.id,
            source: r.source,
            kind: r.kind,
            text: r.text,
            refTable: r.refTable,
            refId: r.refId,
            capturedAt: r.capturedAt.toISOString(),
          }),
        ),
        knowledgeDocuments: knowledgeRows,
        workApprovals: recordCap(workApprovals, 'workApprovals').map((r) => ({
          id: r.id,
          agentSlug: r.agentSlug,
          kind: r.kind,
          status: r.status,
          payload: r.payload as unknown,
          proposedAt: r.proposedAt.toISOString(),
          decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
          decisionReason: r.decisionReason,
        })),
        handoffs: recordCap(handoffs, 'handoffs').map((r) => ({
          id: r.id,
          fromAgent: r.fromAgent,
          toAgent: r.toAgent,
          handoffType: r.handoffType,
          payload: r.payload as unknown,
          occurredAt: r.occurredAt.toISOString(),
        })),
        integrations: recordCap(integrations, 'integrations').map((r) => ({
          // accessTokenEncrypted / refreshTokenEncrypted intentionally
          // omitted: the customer never had the plaintext to begin with
          // (they granted via OAuth, the provider held the secret), so
          // the export shouldn't pretend it does — and the encrypted
          // blobs outside our key envelope are meaningless to them.
          id: r.id,
          provider: r.provider,
          accountEmail: r.accountEmail,
          scopes: r.scopes,
          status: r.status,
          expiresAt: r.expiresAt.toISOString(),
          lastRefreshedAt: r.lastRefreshedAt
            ? r.lastRefreshedAt.toISOString()
            : null,
          createdAt: r.createdAt.toISOString(),
        })),
        webhookSubscriptions: recordCap(
          webhookSubscriptions,
          'webhookSubscriptions',
        ).map((r) => ({
          id: r.id,
          provider: r.provider,
          resource: r.resource,
          expiresAt: r.expiresAt.toISOString(),
          status: r.status,
          lastRenewedAt: r.lastRenewedAt
            ? r.lastRenewedAt.toISOString()
            : null,
          createdAt: r.createdAt.toISOString(),
        })),
        webhookEvents: recordCap(webhookEvents, 'webhookEvents').map((r) => ({
          id: r.id,
          receivedAt: r.receivedAt.toISOString(),
          processed: r.processed,
          processedAt: r.processedAt ? r.processedAt.toISOString() : null,
          rawPayload: r.rawPayload as unknown,
        })),
        auditLog: recordCap(auditLog, 'auditLog').map((r) => ({
          id: r.id,
          actorUserId: r.actorUserId,
          action: r.action,
          targetTable: r.targetTable,
          targetId: r.targetId,
          payload: r.payload as unknown,
          occurredAt: r.occurredAt.toISOString(),
        })),
        inquiries: recordCap(inquiries, 'inquiries').map((r) => ({
          id: r.id,
          name: r.name,
          business: r.business,
          vertical: r.vertical,
          email: r.email,
          inquiryType: r.inquiryType,
          status: r.status,
          createdAt: generatedAt,
        })),
        subscription: subscription
          ? {
              status: subscription.status,
              tier: subscription.tier,
              seatBand: subscription.seatBand,
              seats: subscription.seats,
              trialEndsAt: subscription.trialEndsAt
                ? subscription.trialEndsAt.toISOString()
                : null,
              currentPeriodEnd: subscription.currentPeriodEnd
                ? subscription.currentPeriodEnd.toISOString()
                : null,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            }
          : null,
        invoices: recordCap(invoices, 'invoices').map((r) => ({
          id: r.id,
          amountUsdCents: r.amountUsdCents,
          status: r.status,
          hostedInvoiceUrl: r.hostedInvoiceUrl,
          pdfUrl: r.pdfUrl,
          issuedAt: r.issuedAt.toISOString(),
          paidAt: r.paidAt ? r.paidAt.toISOString() : null,
        })),
      };

      return exportArtifact;
    },
    args.client ? { client: args.client } : undefined,
  );
}

function decryptIfNeeded(
  body: string,
  encryptionConfigured: boolean,
): { value: string | null; failed: boolean } {
  if (!isEncrypted(body)) {
    return { value: body, failed: false };
  }
  if (!encryptionConfigured) {
    return { value: null, failed: true };
  }
  try {
    return { value: decrypt(body), failed: false };
  } catch {
    return { value: null, failed: true };
  }
}
