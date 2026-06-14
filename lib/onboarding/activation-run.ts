/**
 * lib/onboarding/activation-run.ts
 *
 * The "first 5 minutes" activation engine. Within the customer's first session
 * this produces ONE real, send-ready draft — the thing their vertical's killer
 * workflow promises — and lands it in the approval queue so they SEE Plaino do
 * something for them, not just describe it.
 *
 * Flow (`runActivationForWorkspace`), idempotent end to end:
 *   1. read the workspace vertical + name
 *   2. seed the demo dataset if it isn't already (lib/onboarding/demo-seed)
 *   3. pick the one urgent demo record
 *   4. build the draft deterministically (lib/onboarding/demo-data) — NO LLM,
 *      NO network, so the magic moment lands every time even with the model
 *      key paused (the same deterministic-by-design choice killer-workflow.ts
 *      made)
 *   5. write a PENDING `ACTIVATION_DRAFT` WorkApprovalQueueItem + a DRAFTED
 *      SkillRun, both flagged demo so they never count toward real metrics
 *
 * Idempotent: if an ACTIVATION_DRAFT already exists for the workspace the run
 * returns it untouched — safe to call on every welcome-page load.
 *
 * No-outbound (project_no_outbound_architecture): the draft is queued for the
 * owner's approval. Nothing here sends.
 */

import type { Prisma, Vertical, WorkApprovalStatus } from '@prisma/client';
import { withSystemContext } from '../db/rls';
import { verticalSlugFromEnum } from '../auth/vertical-enum';
import { encryptPayloadForWrite, decryptPayloadForRead } from '../security/payload-crypto';
import {
  buildActivationDraft,
  demoDatasetFor,
  type DemoKind,
} from './demo-data';
import { seedDemoData, listDemoRecords } from './demo-seed';

export const ACTIVATION_AGENT_SLUG = 'plaino-activation';
export const ACTIVATION_SKILL_SLUG = 'activation-first-action';

/** Map each demo-kind to the discipline its draft belongs under, so the
 *  activation draft buckets correctly in /approvals alongside real work. */
const DISCIPLINE_BY_KIND: Record<DemoKind, string> = {
  'first-touch-lead': 'sales-enablement',
  'estimate-chase': 'sales-enablement',
  'missing-receipts': 'finance',
  'intake-follow-up': 'legal',
  'client-check-in': 'customer-success',
  'condition-chase': 'operations',
  'coi-reply': 'operations',
  'late-rent-reminder': 'finance',
  'missing-doc-flag': 'operations',
  'invoice-chase': 'finance',
};

export interface ActivationRunResult {
  /** The ACTIVATION_DRAFT queue item id. */
  itemId: string;
  /** True when this call created the row; false when one already existed. */
  created: boolean;
  savedMinutes: number;
}

/**
 * Run (or resume) the activation draft for a workspace. Returns null only when
 * the workspace doesn't exist or has no demo dataset to act on.
 */
export async function runActivationForWorkspace(args: {
  workspaceId: string;
}): Promise<ActivationRunResult | null> {
  const startedMs = Date.now();
  return withSystemContext(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: args.workspaceId },
      select: { vertical: true, name: true },
    });
    if (!workspace) return null;

    // Idempotency: one activation draft per workspace, ever.
    const existing = await tx.workApprovalQueueItem.findFirst({
      where: { workspaceId: args.workspaceId, kind: 'ACTIVATION_DRAFT' },
      orderBy: { proposedAt: 'desc' },
      select: { id: true, payload: true },
    });
    if (existing) {
      const view = readPayload(existing.payload);
      return {
        itemId: existing.id,
        created: false,
        savedMinutes: view?.savedMinutes ?? demoDatasetFor(workspace.vertical).savedMinutes,
      };
    }

    // Seed demo data if it isn't already (idempotent), then pick the urgent one.
    await seedDemoData({
      workspaceId: args.workspaceId,
      vertical: workspace.vertical,
      tx,
    });
    const records = await listDemoRecords(args.workspaceId, { tx });
    const urgent = records.find((r) => r.urgent) ?? records[0];
    if (!urgent) return null;

    const dataset = demoDatasetFor(workspace.vertical);
    const draft = buildActivationDraft({
      vertical: workspace.vertical,
      record: urgent,
      businessName: workspace.name,
      savedMinutes: dataset.savedMinutes,
    });

    const verticalSlug = verticalSlugFromEnum(workspace.vertical);
    const discipline = DISCIPLINE_BY_KIND[urgent.demoKind] ?? null;

    const payload = encryptPayloadForWrite({
      subject: draft.subject,
      body: draft.body,
      toEmails: [draft.party.email],
      partyName: draft.party.name,
      recordTitle: draft.recordTitle,
      demoKind: draft.demoKind,
      savedMinutes: draft.savedMinutes,
      promiseHeadline: draft.promiseHeadline,
      isDemo: true,
      verticalSlug,
    });

    const item = await tx.workApprovalQueueItem.create({
      data: {
        workspaceId: args.workspaceId,
        agentSlug: ACTIVATION_AGENT_SLUG,
        kind: 'ACTIVATION_DRAFT',
        refTable: 'KnowledgeDocument',
        refId: urgent.knowledgeDocumentId,
        status: 'PENDING',
        discipline,
        payload,
      },
      select: { id: true },
    });

    await tx.skillRun.create({
      data: {
        workspaceId: args.workspaceId,
        skillSlug: ACTIVATION_SKILL_SLUG,
        discipline,
        outcome: 'DRAFTED',
        completedAt: new Date(),
        durationMs: Math.max(0, Date.now() - startedMs),
        queueItemId: item.id,
      },
    });

    return { itemId: item.id, created: true, savedMinutes: draft.savedMinutes };
  });
}

export interface ActivationDraftView {
  itemId: string;
  status: WorkApprovalStatus;
  subject: string;
  body: string;
  toName: string;
  toEmail: string;
  recordTitle: string;
  savedMinutes: number;
  promiseHeadline: string;
  proposedAtIso: string;
}

/**
 * Read the workspace's activation draft for the welcome surface. Returns null
 * when no activation draft exists yet (the caller runs it first).
 */
export async function loadActivationDraft(
  workspaceId: string,
): Promise<ActivationDraftView | null> {
  const item = await withSystemContext((tx) =>
    tx.workApprovalQueueItem.findFirst({
      where: { workspaceId, kind: 'ACTIVATION_DRAFT' },
      orderBy: { proposedAt: 'desc' },
      select: {
        id: true,
        status: true,
        payload: true,
        proposedAt: true,
      },
    }),
  );
  if (!item) return null;
  const view = readPayload(item.payload);
  if (!view) return null;
  return {
    itemId: item.id,
    status: item.status,
    subject: view.subject,
    body: view.body,
    toName: view.partyName,
    toEmail: view.toEmail,
    recordTitle: view.recordTitle,
    savedMinutes: view.savedMinutes,
    promiseHeadline: view.promiseHeadline,
    proposedAtIso: item.proposedAt.toISOString(),
  };
}

interface DecodedPayload {
  subject: string;
  body: string;
  toEmail: string;
  partyName: string;
  recordTitle: string;
  savedMinutes: number;
  promiseHeadline: string;
}

function readPayload(stored: unknown): DecodedPayload | null {
  const raw = decryptPayloadForRead(stored);
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const subject = typeof p.subject === 'string' ? p.subject : '';
  const body = typeof p.body === 'string' ? p.body : '';
  if (!subject || !body) return null;
  const toEmails = Array.isArray(p.toEmails) ? p.toEmails : [];
  const toEmail = typeof toEmails[0] === 'string' ? toEmails[0] : '';
  return {
    subject,
    body,
    toEmail,
    partyName: typeof p.partyName === 'string' ? p.partyName : '',
    recordTitle: typeof p.recordTitle === 'string' ? p.recordTitle : '',
    savedMinutes: typeof p.savedMinutes === 'number' ? p.savedMinutes : 15,
    promiseHeadline:
      typeof p.promiseHeadline === 'string' ? p.promiseHeadline : '',
  };
}
