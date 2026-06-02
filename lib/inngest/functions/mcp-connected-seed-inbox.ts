/**
 * Inngest event handler: agentplain/mcp.connected.seed-inbox
 *
 * Wave-10 phase-3a SEAM. Dispatched by the Google + Outlook OAuth
 * callbacks the moment a workspace's first inbox MCP credential lands
 * (`integration.connected` audit row). The intent for wave-10b is to
 * pre-fetch the last 7 days of inbox content into the knowledge
 * substrate so first-fire skills (inbox-triage-general,
 * chief-of-staff-scheduler, follow-up-chaser-general, etc.) have real
 * threads to draft against when the wizard's first-fire dispatches a
 * few minutes later.
 *
 * **Wave-10 ships the trigger seam ONLY.** The knowledge substrate does
 * not yet have an inbox-message ingestion path — only file/document
 * ingestion exists (`lib/inngest/functions/customer-files-ingestion-sweep.ts`,
 * `lib/integrations/notion-mcp/notion-file-source.ts`). Building a
 * message-shaped ingestion pipeline + schema + skill-side reader is
 * wave-10b scope.
 *
 * For wave-10 the handler:
 *   1. Records an AuditLog row so the operator can verify the event
 *      flows in prod (`action: 'integration.seed-inbox-requested'`).
 *   2. Logs the event with a clear "wave-10b will implement" message.
 *   3. Returns ok without doing any work.
 *
 * Why this seam shape and not "skip the dispatch entirely until wave-10b":
 * landing the dispatch sites in OAuth callbacks NOW means wave-10b's
 * implementer only edits this one file (the handler body), never the
 * callbacks. Per `feedback_runner_portability.md` — every integration
 * has an abstraction seam; this is that seam.
 *
 * Per `project_no_outbound_architecture.md`: the eventual real handler
 * only READS the inbox + writes to the workspace's own substrate.
 * Nothing leaves the workspace.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger } from '@/lib/observability';
import { withSystemContext } from '@/lib/db/rls';

export const MCP_CONNECTED_SEED_INBOX_FUNCTION_ID =
  'agentplain-mcp-connected-seed-inbox';

export const MCP_CONNECTED_SEED_INBOX_EVENT =
  'agentplain/mcp.connected.seed-inbox';

/** Shape the OAuth callbacks emit. `provider` lets the wave-10b handler
 *  fan out to the right MCP server (gmail-mcp / outlook-mcp). */
export interface McpConnectedSeedInboxEventData {
  workspaceId: string;
  /** 'GOOGLE' for Gmail, 'M365' for Outlook. Matches
   *  `IntegrationCredential.provider`. */
  provider: 'GOOGLE' | 'M365';
  /** Credential row id — wave-10b reads its decrypted token via
   *  `lib/integrations/<provider>/auth.ts:resolveCredential`. */
  credentialId: string;
}

export interface McpConnectedSeedInboxResult {
  workspaceId: string;
  provider: 'GOOGLE' | 'M365';
  credentialId: string;
  /** Always 'queued-no-op' in wave-10. Wave-10b will return ingestion
   *  stats (messagesScanned, messagesIngested, etc.). */
  outcome: 'queued-no-op' | 'ingested';
  /** Operator-facing note explaining the no-op. Surfaces in logs +
   *  audit so the deferral is visible, not invisible. */
  note: string;
}

export async function runMcpConnectedSeedInbox(
  data: McpConnectedSeedInboxEventData,
): Promise<McpConnectedSeedInboxResult> {
  const note =
    'wave-10 ships the trigger seam only. Inbox substrate ingestion is wave-10b.';

  // Best-effort audit row. Failure here is non-fatal — the seed event
  // is observability, not correctness, until wave-10b lands. We still
  // log + return.
  try {
    await withSystemContext((tx) =>
      tx.auditLog.create({
        data: {
          workspaceId: data.workspaceId,
          action: 'integration.seed-inbox-requested',
          targetTable: 'IntegrationCredential',
          targetId: data.credentialId,
          payload: {
            provider: data.provider,
            wave: 'wave-10-seam',
            note,
          },
        },
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    getLogger().warn('seed-inbox audit write failed (non-fatal)', {
      workspace_id: data.workspaceId,
      provider: data.provider,
      error: msg,
    });
  }

  return {
    workspaceId: data.workspaceId,
    provider: data.provider,
    credentialId: data.credentialId,
    outcome: 'queued-no-op',
    note,
  };
}

function parseEventData(
  raw: unknown,
): McpConnectedSeedInboxEventData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.workspaceId !== 'string') return null;
  if (typeof r.credentialId !== 'string') return null;
  if (r.provider !== 'GOOGLE' && r.provider !== 'M365') return null;
  return {
    workspaceId: r.workspaceId,
    provider: r.provider,
    credentialId: r.credentialId,
  };
}

export const mcpConnectedSeedInboxFn = inngest.createFunction(
  {
    id: MCP_CONNECTED_SEED_INBOX_FUNCTION_ID,
    name: 'agentplain mcp-connected seed-inbox',
    concurrency: { limit: 4 },
    retries: 1,
    triggers: [{ event: MCP_CONNECTED_SEED_INBOX_EVENT }],
  },
  async ({ event }) =>
    runWithDisableGate(MCP_CONNECTED_SEED_INBOX_FUNCTION_ID, () =>
      withInngestErrorReporting(
        { functionId: MCP_CONNECTED_SEED_INBOX_FUNCTION_ID },
        async () => {
          const logger = getLogger().child({
            boundary: 'inngest',
            function_id: MCP_CONNECTED_SEED_INBOX_FUNCTION_ID,
          });
          const data = parseEventData(event?.data);
          if (!data) {
            logger.info('seed-inbox event missing required fields — skipping');
            return { skipped: true, reason: 'malformed-event' as const };
          }
          try {
            const out = await runMcpConnectedSeedInbox(data);
            logger.info('mcp-connected seed-inbox seam fired (no-op)', {
              workspace_id: data.workspaceId,
              provider: data.provider,
              credential_id: data.credentialId,
              outcome: out.outcome,
              note: out.note,
              wave10b_followup: true,
            });
            return out;
          } catch (err) {
            reportInngestItemFailure(err, {
              functionId: MCP_CONNECTED_SEED_INBOX_FUNCTION_ID,
              extraTags: {
                workspace_id: data.workspaceId,
                provider: data.provider,
              },
            });
            throw err;
          }
        },
      ),
    ),
);
