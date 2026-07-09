/**
 * prisma/seed-demo.ts
 *
 * Seed (or re-seed) the Peachtree Realty Demo workspace — the exact state
 * Conner opens on a discovery call. Spec + call script:
 * docs/killer-workflows/RE-lead-triage/.
 *
 * What lands (all from lib/demo/peachtree-dataset.ts, all obviously fake):
 *   - Workspace "Peachtree Realty Demo" (REAL_ESTATE, GA) owned by
 *     DEMO_OWNER_EMAIL (default: Conner) as BROKER_OWNER
 *   - A placeholder FOLLOW_UP_BOSS credential (providerMetadata.isDemo=true;
 *     sentinel token — the FUB sync sweep skips demo credentials, so no
 *     vendor call ever fires against it)
 *   - lead-triage-realestate installed
 *   - 20 leads run through the REAL triage skill (heuristic path, zero LLM
 *     calls — works with the prod ANTHROPIC_API_KEY paused):
 *       · 3 "overnight" leads → PENDING LEAD_TRIAGE approval cards
 *       · 17 prior-week leads → APPROVED cards, decided by the owner
 *   - Saved-time ledger entries (lead-enrichment + drafted-email per lead,
 *     calibrated by lib/guarantee/savings-calibration)
 *   - Lead records as isDemo-flagged KnowledgeDocuments + handoff-log rows
 *
 * The triage output is produced by `runSkill` over `JsonLeadFetcher` and
 * persisted through `PrismaLeadTriageApprovalSink` / `buildLeadTriageApprovalRow`
 * — the same code path the hourly FUB sweep uses in production. The demo IS
 * the live workflow on synthetic inputs; connecting a real Follow Up Boss key
 * only swaps the fetcher.
 *
 * Idempotent by replacement: an existing workspace with the demo slug is
 * deleted (cascades wipe its approvals / ledger / docs) and re-created, so
 * running this between calls resets any approve/reject Conner did live.
 * `scripts/reset-demo.mjs` is the one-liner wrapper.
 *
 * Safety: refuses NODE_ENV=production unless DEMO_SEED_ALLOW_PRODUCTION=
 * "peachtree" — and even then only ever touches the one demo-slug workspace.
 * ENCRYPTION_KEY must be set (approval payloads are encrypted at rest).
 *
 * Run:  npx tsx prisma/seed-demo.ts
 */

import { prisma, withSystemContext } from '@/lib/db';
import { runSkill } from '@/lib/skills/lead-triage-realestate';
import { JsonLeadFetcher } from '@/lib/skills/lead-triage-realestate/json-fetcher';
import {
  buildLeadTriageApprovalRow,
  PrismaLeadTriageApprovalSink,
} from '@/lib/skills/lead-triage-realestate/prisma-approval-sink';
import type { TriagedLead } from '@/lib/skills/lead-triage-realestate/types';
import { recordSavedTime } from '@/lib/guarantee/saved-time';
import {
  isDemoCredentialMetadata,
  PEACHTREE_AGENTS,
  PEACHTREE_CAMPAIGNS,
  PEACHTREE_DEMO_NAME,
  PEACHTREE_DEMO_SLUG,
  PEACHTREE_DEMO_SOURCE,
  PEACHTREE_SAVED_TIME_TABLE,
  peachtreeLeads,
} from '@/lib/demo/peachtree-dataset';

const OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL || 'connerchambers6@gmail.com';
const OWNER_NAME = 'Conner Chambers';
const VERTICAL_SLUG = 'real-estate';
/** Sentinel — never a real vendor key. The FUB sweep's demo-credential
 *  guard means nothing autonomous ever tries to use it; a manual tool
 *  call against it fails loudly at decrypt. */
const PLACEHOLDER_FUB_KEY = 'peachtree-demo:not-a-real-key';
const MINUTE = 60 * 1000;

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.DEMO_SEED_ALLOW_PRODUCTION !== 'peachtree'
  ) {
    throw new Error(
      'Refusing to seed the demo workspace with NODE_ENV=production. ' +
        'Set DEMO_SEED_ALLOW_PRODUCTION=peachtree to seed the discovery-call ' +
        'demo on a production database (it only touches the ' +
        `"${PEACHTREE_DEMO_SLUG}" workspace).`,
    );
  }

  const anchor = new Date();
  const leads = peachtreeLeads(anchor);

  // ── 1. Replace any prior demo workspace (cascade wipes its rows) ──────
  const removed = await withSystemContext((tx) =>
    tx.workspace.deleteMany({ where: { slug: PEACHTREE_DEMO_SLUG } }),
  );
  if (removed.count > 0) {
    console.log(`reset: removed existing "${PEACHTREE_DEMO_SLUG}" workspace`);
  }

  // ── 2. Owner, workspace, membership, skill install, demo credential ───
  const { workspaceId, ownerId } = await withSystemContext(async (tx) => {
    const owner = await tx.user.upsert({
      where: { email: OWNER_EMAIL },
      update: {},
      create: { email: OWNER_EMAIL, name: OWNER_NAME },
    });
    const workspace = await tx.workspace.create({
      data: {
        name: PEACHTREE_DEMO_NAME,
        slug: PEACHTREE_DEMO_SLUG,
        vertical: 'REAL_ESTATE',
        stateCode: 'GA',
        // Not an abandoned signup — keep the setup-nudge sweep away from
        // the demo (lib/billing/abandoned-signup.ts keys on this column).
        signupSetupCompletedAt: anchor,
      },
    });
    await tx.membership.create({
      data: {
        userId: owner.id,
        workspaceId: workspace.id,
        role: 'BROKER_OWNER',
        status: 'ACTIVE',
        // Never fire the first-run tour in the middle of a call.
        welcomeTourSeenAt: anchor,
      },
    });
    await tx.workspaceSkillInstallation.create({
      data: {
        workspaceId: workspace.id,
        skillSlug: 'lead-triage-realestate',
        installedByUserId: owner.id,
      },
    });
    const credential = await tx.integrationCredential.create({
      data: {
        workspaceId: workspace.id,
        provider: 'FOLLOW_UP_BOSS',
        accountId: 'peachtree-demo-fub',
        accountEmail: 'ops@peachtree-demo.example.com',
        accessTokenEncrypted: PLACEHOLDER_FUB_KEY,
        // FUB API keys never expire — same far-future sentinel the real
        // connect route writes.
        expiresAt: new Date('2099-01-01T00:00:00Z'),
        providerMetadata: { isDemo: true, source: PEACHTREE_DEMO_SOURCE },
        status: 'ACTIVE',
      },
    });
    if (!isDemoCredentialMetadata(credential.providerMetadata)) {
      throw new Error(
        'demo credential metadata failed the isDemo guard — the FUB sweep ' +
          'would call the vendor with a sentinel key. Aborting.',
      );
    }
    return { workspaceId: workspace.id, ownerId: owner.id };
  });

  // ── 3. Run the REAL triage skill over the synthetic pipeline ──────────
  const fetcher = new JsonLeadFetcher({
    workspaceId,
    leads: leads.all,
    agents: PEACHTREE_AGENTS,
    campaigns: PEACHTREE_CAMPAIGNS,
  });
  const triageRes = await runSkill({ workspaceId, fetcher, persister: null });
  if (!triageRes.ok) {
    throw new Error(`lead triage failed: ${triageRes.error.message}`);
  }
  const byLeadId = new Map<string, TriagedLead>(
    triageRes.value.triaged.map((t) => [t.leadId, t]),
  );

  // ── 4a. Overnight leads → PENDING cards via the production sink ───────
  const sink = new PrismaLeadTriageApprovalSink();
  for (const lead of leads.overnight) {
    const triaged = byLeadId.get(lead.id);
    if (!triaged) throw new Error(`overnight lead not triaged: ${lead.id}`);
    const res = await sink.record({ workspaceId, triaged });
    if (!res.ok) {
      throw new Error(`approval sink failed for ${lead.id}: ${res.error.message}`);
    }
    // Backdate to when the lead actually landed — the card should read
    // "caught at 9:16pm", not "created when Conner ran the seed".
    await withSystemContext((tx) =>
      tx.workApprovalQueueItem.update({
        where: { id: res.value.sinkId },
        data: { proposedAt: new Date(lead.receivedAt.getTime() + 2 * MINUTE) },
      }),
    );
  }

  // ── 4b. Prior-week leads → APPROVED cards (decided by the owner) ──────
  for (const lead of leads.historical) {
    const triaged = byLeadId.get(lead.id);
    if (!triaged) throw new Error(`historical lead not triaged: ${lead.id}`);
    const row = buildLeadTriageApprovalRow(workspaceId, triaged);
    const proposedAt = new Date(lead.receivedAt.getTime() + 2 * MINUTE);
    await withSystemContext((tx) =>
      tx.workApprovalQueueItem.create({
        data: {
          ...row,
          status: 'APPROVED',
          proposedAt,
          // Decided within the same morning/evening — a realistic
          // approve-on-next-glance rhythm.
          decidedAt: new Date(proposedAt.getTime() + 47 * MINUTE),
          decidedByUserId: ownerId,
        },
      }),
    );
  }

  // ── 5. Saved-time ledger — calibrated minutes per action performed ────
  let ledgerMinutes = 0;
  for (const lead of leads.all) {
    const triaged = byLeadId.get(lead.id);
    const enriched = await recordSavedTime({
      workspaceId,
      actionType: 'lead-enrichment',
      verticalSlug: VERTICAL_SLUG,
      source: { table: PEACHTREE_SAVED_TIME_TABLE, id: lead.id },
      now: new Date(lead.receivedAt.getTime() + 2 * MINUTE),
    });
    ledgerMinutes += enriched.minutesSaved;
    if (triaged?.firstTouchDraft) {
      const drafted = await recordSavedTime({
        workspaceId,
        actionType: 'drafted-email',
        verticalSlug: VERTICAL_SLUG,
        source: { table: PEACHTREE_SAVED_TIME_TABLE, id: lead.id },
        now: new Date(lead.receivedAt.getTime() + 2 * MINUTE),
      });
      ledgerMinutes += drafted.minutesSaved;
    }
  }

  // ── 6. Lead records + overnight handoff trail ─────────────────────────
  await withSystemContext(async (tx) => {
    await tx.knowledgeDocument.createMany({
      data: leads.all.map((lead) => ({
        workspaceId,
        contextKind: 'CUSTOMER' as const,
        title: `${lead.fullName} — inbound lead (${lead.source})`,
        body: [
          lead.inquirySubject ? `Subject: ${lead.inquirySubject}` : null,
          lead.inquiryText,
          lead.propertyContext.addressText
            ? `Property: ${lead.propertyContext.addressText}`
            : null,
          lead.statedTimeline ? `Timeline: ${lead.statedTimeline}` : null,
          lead.statedFinancing ? `Financing: ${lead.statedFinancing}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        metadata: {
          isDemo: true,
          source: PEACHTREE_DEMO_SOURCE,
          leadId: lead.id,
        },
      })),
    });
    await tx.handoffLogEntry.createMany({
      data: leads.overnight.map((lead) => {
        const triaged = byLeadId.get(lead.id);
        return {
          workspaceId,
          fromAgent: 'lead-triage-realestate',
          toAgent: 'approvals-queue',
          handoffType: 'lead-triage-draft',
          payload: {
            leadId: lead.id,
            leadName: lead.fullName,
            category: triaged?.category ?? 'unknown',
          },
          relatedSubjectTable: 'LeadTriageProposal',
          relatedSubjectId: lead.id,
          occurredAt: new Date(lead.receivedAt.getTime() + 2 * MINUTE),
        };
      }),
    });
  });

  const counts = triageRes.value.categoryCounts;
  console.log('');
  console.log(`Seeded "${PEACHTREE_DEMO_NAME}" (${PEACHTREE_DEMO_SLUG})`);
  console.log(
    `  leads: ${leads.all.length} (${leads.overnight.length} pending, ` +
      `${leads.historical.length} decided) — ` +
      `hot ${counts.hot} · warm ${counts.warm} · cold ${counts.cold} · nurture ${counts.nurture}`,
  );
  console.log(`  saved-time ledger: ${ledgerMinutes} calibrated minutes`);
  console.log(`  owner login: ${OWNER_EMAIL}`);
  console.log('');
  console.log(`  Today view:  /app/workspace/${workspaceId}`);
  console.log(`  Approvals:   /app/workspace/${workspaceId}/approvals`);
  console.log(`  Watch-it-run: /app/workspace/${workspaceId}/demo`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
