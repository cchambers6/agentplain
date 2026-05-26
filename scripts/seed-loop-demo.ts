/**
 * scripts/seed-loop-demo.ts
 *
 * Make the value loop VISIBLE end-to-end in the actual product — without
 * Google OAuth (which is Conner-gated) and without an LLM API key.
 *
 * `scripts/demo-skill-chain.ts` proves the chain runs, but only in memory
 * (RecordingDraftPersister + writeLog:false, no DB writes), so nothing
 * shows up in the workspace. The Inngest processor (process-webhook-event)
 * DOES write artifacts, but only fires on real Gmail/Outlook push events,
 * which need live OAuth. This script bridges that gap: it seeds a real
 * workspace + an ACTIVE Google credential + a WebhookSubscription, inserts
 * real `WebhookEvent` rows from the fixture corpus, runs the REAL
 * `runSkillChain`, and calls the REAL `persistSkillRunArtifacts` — so
 * `HandoffLogEntry` + `WorkApprovalQueueItem` rows land and the loop is
 * clickable in the overview + /approvals UI.
 *
 * The chain uses `FixtureMessageFetcher` (no Gmail) + `TestLlmProvider`
 * (no API key), so it runs anywhere a dev DB is reachable. The only fake
 * part is the inbound message source and the draft sink; everything the
 * customer SEES (categorization, schedule proposal, drafted reply,
 * handoff trail, approval card) is produced by the same code paths that
 * run in production.
 *
 * Run:  npx tsx scripts/seed-loop-demo.ts
 * View: open the workspace URL the script prints, then /approvals.
 *
 * Safety: refuses to run when NODE_ENV=production — this seeds demo rows
 * and must never touch a customer database (feedback_no_prod_secrets_in_dev).
 */

import type { Vertical } from "@prisma/client";
import { prisma, withSystemContext } from "@/lib/db";
import { runSkillChain } from "@/lib/skills/runner";
import { RecordingDraftPersister } from "@/lib/skills/draft";
import { TestLlmProvider } from "@/lib/llm/test-provider";
import {
  FixtureMessageFetcher,
  buildWebhookEventFromFixture,
  type WebhookEventFixture,
} from "@/lib/skills/fixture-fetcher";
import { persistSkillRunArtifacts, summarizeOutcome } from "@/lib/skills/persist-artifacts";
import { CORPUS } from "@/tests/fixtures/webhook-events/_corpus";

// ── Demo workspace identity ────────────────────────────────────────────
const DEMO_SLUG = "plaino-demo";
const DEMO_NAME = "Plaino Demo Brokerage";
const DEMO_VERTICAL: Vertical = "REAL_ESTATE";
const DEMO_VERTICAL_SLUG = "real-estate";
const DEMO_OWNER_EMAIL = "demo-owner@agentplain.dev";
const DEMO_OWNER_NAME = "Demo Owner";
const DEMO_ACCOUNT_EMAIL = "demo-owner@plaino-demo.test";
// Placeholder ciphertext. The demo uses FixtureMessageFetcher, so this token
// is never decrypted — but the column is non-null, so we store a clearly
// labeled sentinel rather than a forged ciphertext.
const PLACEHOLDER_TOKEN = "seed-loop-demo:not-a-real-token";

/** How many fixtures (matching the demo vertical) to seed. */
const FIXTURE_LIMIT = 3;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "seed-loop-demo refuses to run with NODE_ENV=production. This seeds demo " +
        "rows and must only run against a dev/preview database.",
    );
  }

  const fixtures = CORPUS.filter(
    (f) => f.verticalSlug === DEMO_VERTICAL_SLUG,
  ).slice(0, FIXTURE_LIMIT);
  if (fixtures.length === 0) {
    throw new Error(
      `No fixtures found for vertical "${DEMO_VERTICAL_SLUG}" in the corpus.`,
    );
  }

  console.log(`\nSeeding the value-loop demo into workspace "${DEMO_SLUG}"…`);

  const { workspaceId, subscriptionId } = await seedWorkspaceAndConnection();
  await clearPriorDemoArtifacts(workspaceId, subscriptionId);

  let totalHandoffs = 0;
  let totalApprovals = 0;

  for (const fixture of fixtures) {
    const result = await seedAndRunFixture({
      fixture,
      workspaceId,
      subscriptionId,
    });
    totalHandoffs += result.handoffsWritten;
    totalApprovals += result.approvalsWritten;
    console.log(
      `  • ${fixture.id} → ${result.summary} ` +
        `(handoffs: ${result.handoffsWritten}, approvals: ${result.approvalsWritten})`,
    );
  }

  const origin = process.env.APP_PUBLIC_ORIGIN ?? "http://localhost:3000";
  console.log(
    `\nDone. ${fixtures.length} events processed → ` +
      `${totalHandoffs} handoffs, ${totalApprovals} approvals written.`,
  );
  console.log(`\nView the loop:`);
  console.log(`  Overview:  ${origin}/app/workspace/${workspaceId}`);
  console.log(`  Approvals: ${origin}/app/workspace/${workspaceId}/approvals`);
  console.log(
    `\n(Sign in as ${DEMO_OWNER_EMAIL} — or set AUTH_PROVIDER=test for the ` +
      `dev magic-link queue. Briefings degrade to empty unless NOTION_API_KEY ` +
      `is set or BRIEFINGS_PROVIDER=test.)\n`,
  );
}

/**
 * Idempotently upsert the demo owner, workspace, broker-owner membership,
 * an ACTIVE Google IntegrationCredential, and a WebhookSubscription. All
 * writes run under the system context so RLS policies allow the inserts.
 */
async function seedWorkspaceAndConnection(): Promise<{
  workspaceId: string;
  subscriptionId: string;
}> {
  return withSystemContext(async (tx) => {
    const owner = await tx.user.upsert({
      where: { email: DEMO_OWNER_EMAIL },
      update: {},
      create: { email: DEMO_OWNER_EMAIL, name: DEMO_OWNER_NAME },
      select: { id: true },
    });

    const workspace = await tx.workspace.upsert({
      where: { slug: DEMO_SLUG },
      update: { name: DEMO_NAME, vertical: DEMO_VERTICAL },
      create: { slug: DEMO_SLUG, name: DEMO_NAME, vertical: DEMO_VERTICAL },
      select: { id: true },
    });

    await tx.membership.upsert({
      where: {
        userId_workspaceId: { userId: owner.id, workspaceId: workspace.id },
      },
      update: { role: "BROKER_OWNER", status: "ACTIVE" },
      create: {
        userId: owner.id,
        workspaceId: workspace.id,
        role: "BROKER_OWNER",
        status: "ACTIVE",
      },
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const credential = await tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId: workspace.id,
          provider: "GOOGLE",
          accountId: "seed-loop-demo-account",
        },
      },
      update: { status: "ACTIVE", expiresAt },
      create: {
        workspaceId: workspace.id,
        provider: "GOOGLE",
        accountId: "seed-loop-demo-account",
        accountEmail: DEMO_ACCOUNT_EMAIL,
        accessTokenEncrypted: PLACEHOLDER_TOKEN,
        scopes: ["gmail.readonly", "gmail.modify", "gmail.compose"],
        expiresAt,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    // WebhookSubscription has no natural unique key beyond id, so find-or-create.
    const existing = await tx.webhookSubscription.findFirst({
      where: {
        workspaceId: workspace.id,
        integrationCredentialId: credential.id,
        provider: "GOOGLE",
      },
      select: { id: true },
    });
    const subscription =
      existing ??
      (await tx.webhookSubscription.create({
        data: {
          workspaceId: workspace.id,
          integrationCredentialId: credential.id,
          provider: "GOOGLE",
          subscriptionId: "seed-loop-demo-history-1",
          resource: DEMO_ACCOUNT_EMAIL,
          expiresAt,
          notificationUrl: "https://example.invalid/api/webhooks/google",
        },
        select: { id: true },
      }));

    return { workspaceId: workspace.id, subscriptionId: subscription.id };
  });
}

/**
 * Wipe this demo workspace's prior loop artifacts so re-runs stay clean.
 * Scoped to the demo workspace + its subscription only.
 */
async function clearPriorDemoArtifacts(
  workspaceId: string,
  subscriptionId: string,
): Promise<void> {
  await withSystemContext(async (tx) => {
    await tx.workApprovalQueueItem.deleteMany({ where: { workspaceId } });
    await tx.handoffLogEntry.deleteMany({ where: { workspaceId } });
    await tx.webhookEvent.deleteMany({ where: { subscriptionId } });
  });
}

/**
 * Insert a real WebhookEvent for the fixture, run the real skill chain
 * against it, persist the real artifacts, then mark it processed — the
 * exact sequence process-webhook-event.ts runs in production, minus the
 * Gmail adapter (fixture stands in) and the LLM API (test provider stands in).
 */
async function seedAndRunFixture(args: {
  fixture: WebhookEventFixture;
  workspaceId: string;
  subscriptionId: string;
}): Promise<{ summary: string; handoffsWritten: number; approvalsWritten: number }> {
  const { fixture, workspaceId, subscriptionId } = args;

  // 1. Insert the real WebhookEvent row (its UUID is the loop's ref id).
  //    workspaceId is denormalized on WebhookEvent for RLS
  //    (20260526000000_add_integration_rls) — pass the seed workspace id.
  const eventRow = await withSystemContext((tx) =>
    tx.webhookEvent.create({
      data: {
        subscriptionId,
        workspaceId,
        rawPayload: fixture.webhookEvent.rawPayload,
        receivedAt: new Date(fixture.webhookEvent.receivedAt),
        processed: false,
      },
      select: { id: true },
    }),
  );

  // 2. Clone the fixture so its event id matches the real DB row — the
  //    FixtureMessageFetcher asserts event.id === fixture.webhookEvent.id,
  //    and persistSkillRunArtifacts keys handoffs/approvals on the same id.
  const boundFixture: WebhookEventFixture = {
    ...fixture,
    webhookEvent: {
      ...fixture.webhookEvent,
      id: eventRow.id,
      subscriptionId,
    },
  };

  // 3. Run the real chain with the fixture fetcher + test LLM (no API key).
  const { record, outcome } = await runSkillChain({
    workspace: {
      id: workspaceId,
      slug: DEMO_SLUG,
      name: DEMO_NAME,
      vertical: DEMO_VERTICAL,
    },
    event: buildWebhookEventFromFixture(boundFixture),
    fetcher: new FixtureMessageFetcher(boundFixture),
    persister: new RecordingDraftPersister(),
    llm: new TestLlmProvider(),
    writeLog: false,
  });

  // 4. Persist the real customer-visible artifacts.
  const artifacts = await persistSkillRunArtifacts({ workspaceId, record });

  // 5. Mark the event processed, mirroring the production processor.
  await withSystemContext((tx) =>
    tx.webhookEvent.update({
      where: { id: eventRow.id },
      data: { processed: true, processedAt: new Date(), error: null },
    }),
  );

  return {
    summary: summarizeOutcome(outcome),
    handoffsWritten: artifacts.handoffsWritten,
    approvalsWritten: artifacts.approvalsWritten,
  };
}

main()
  .catch((err) => {
    console.error("\nseed-loop-demo failed:\n", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
