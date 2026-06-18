/**
 * lib/integrations/gmail-mcp/with-approval.ts
 *
 * The Gmail approval gate — the connector-specific decorator that forces EVERY
 * mutating Gmail method through the shared connector approval gate
 * (`lib/integrations/approval`) before the Gmail REST API is touched. Mirrors
 * `hubspot-mcp/with-approval.ts`, built on the generic gate so every connector
 * shares one fingerprint / persistence / audit core.
 *
 * Gating policy follows the established wave-2 model
 * (`marketplace-smoke-wave2.test.ts`): gate genuinely OUTBOUND writes (mail
 * leaves the mailbox), leave INTERNAL mailbox organization ungated. So:
 *   - GATED (outbound): `composeFromTemplate` (sends a message),
 *     `scheduleSend` (sends a message at a future time).
 *   - UNGATED (internal, like a draft/note/label): `draftMessage` (creates a
 *     Draft — nothing sent), `labelMessage` = users.messages.modify
 *     (mailbox labels), `archive` (removes the INBOX label). These mutate only
 *     the customer's own mailbox state and reach no third party — the same
 *     reasoning that leaves QuickBooks `create_invoice` and HubSpot
 *     `create_note` ungated.
 * A missing/invalid/expired grant on a gated method returns APPROVAL_REQUIRED
 * and the Gmail send never happens; a valid grant lets it run + audit-logs it.
 *
 * Installed at the factory seam (`buildGmailMcpServer`), so an ungated Gmail
 * server cannot be obtained.
 *
 * ── The GmailMcpResult ↔ McpResult bridge ──
 * Gmail uses its OWN result type, `GmailMcpResult<T>` (`./types.ts`), whose
 * error-code union does NOT include `'APPROVAL_REQUIRED'`. The shared gate
 * (`gateAndRun`) is typed against the generic `McpResult<T>` from
 * `lib/integrations/mcp-core`. The two shapes are STRUCTURALLY identical
 * (`{ok:true,value} | {ok:false,error:{code,message,...}}`), so we bridge with
 * two narrow `as unknown as` casts:
 *   1. the inner Gmail method's `GmailMcpResult` is cast to `McpResult` going
 *      INTO `gateAndRun` (so the gate can audit success/failure uniformly);
 *   2. the `McpResult` `gateAndRun` returns — either the inner result, or an
 *      `APPROVAL_REQUIRED` error the gate synthesized — is cast back OUT to
 *      `GmailMcpResult`. The synthesized `APPROVAL_REQUIRED` code is not in the
 *      Gmail union, but at runtime it is just a string the caller surfaces via
 *      `json-rpc.ts` (which maps unknown Gmail codes to UPSTREAM_ERROR by
 *      default). This is the intended, documented coupling — both modules
 *      deliberately share the discriminated-union shape.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import {
  gateAndRun,
  type ConnectorApprovalDeps,
  type GatedAction,
} from '@/lib/integrations/approval';
import type {
  ArchiveInput,
  ArchiveOutput,
  ComposeFromTemplateInput,
  ComposeFromTemplateOutput,
  DraftMessageInput,
  DraftMessageOutput,
  GetMessageInput,
  GetMessageOutput,
  GmailMcpResult,
  GmailMcpServer,
  LabelMessageInput,
  LabelMessageOutput,
  ListLabelsOutput,
  ListMessagesInput,
  ListMessagesOutput,
  ReadResourceInput,
  ReadResourceOutput,
  ResourceDescriptor,
  ScheduleSendInput,
  ScheduleSendOutput,
  SearchThreadsInput,
  SearchThreadsOutput,
} from './types';
import {
  COMPOSE_FROM_TEMPLATE,
  SCHEDULE_SEND,
  gmailAction,
  type WriteActionDescriptor,
} from './actions';

/** Wrap a Gmail server so all mutating methods require an approved grant. */
export function withGmailApproval(
  inner: GmailMcpServer,
  deps: ConnectorApprovalDeps,
): GmailMcpServer {
  return new GatedGmailMcpServer(inner, deps);
}

class GatedGmailMcpServer implements GmailMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: GmailMcpServer,
    private readonly deps: ConnectorApprovalDeps,
  ) {
    this.name = inner.name;
    this.workspaceId = inner.workspaceId;
  }

  /**
   * Run a mutating Gmail method behind the shared gate. `execute` returns the
   * connector-native `GmailMcpResult`; we cast it to the structurally
   * identical `McpResult` for `gateAndRun` (which audits uniformly), then cast
   * the gate's return back to `GmailMcpResult`. See the file header for why
   * this cast is sound and intentional.
   */
  private async gate<T>(
    action: GatedAction,
    execute: () => Promise<GmailMcpResult<T>>,
  ): Promise<GmailMcpResult<T>> {
    const result = await gateAndRun<T>({
      gate: this.deps.gate,
      audit: this.deps.audit,
      workspaceId: this.workspaceId,
      action,
      execute: () => execute() as unknown as Promise<McpResult<T>>,
    });
    return result as unknown as GmailMcpResult<T>;
  }

  // ── Reads: straight pass-through ───────────────────────────────────────

  listMessages(input: ListMessagesInput): Promise<GmailMcpResult<ListMessagesOutput>> {
    return this.inner.listMessages(input);
  }
  getMessage(input: GetMessageInput): Promise<GmailMcpResult<GetMessageOutput>> {
    return this.inner.getMessage(input);
  }
  searchThreads(input: SearchThreadsInput): Promise<GmailMcpResult<SearchThreadsOutput>> {
    return this.inner.searchThreads(input);
  }
  listLabels(): Promise<GmailMcpResult<ListLabelsOutput>> {
    return this.inner.listLabels();
  }
  listResources(): Promise<GmailMcpResult<ResourceDescriptor[]>> {
    return this.inner.listResources();
  }
  readResource(input: ReadResourceInput): Promise<GmailMcpResult<ReadResourceOutput>> {
    return this.inner.readResource(input);
  }

  // ── Internal mailbox writes: ungated (draft/label/archive reach no third
  //    party — see file header + wave-2 model). ─────────────────────────────

  draftMessage(input: DraftMessageInput): Promise<GmailMcpResult<DraftMessageOutput>> {
    return this.inner.draftMessage(input);
  }
  labelMessage(input: LabelMessageInput): Promise<GmailMcpResult<LabelMessageOutput>> {
    return this.inner.labelMessage(input);
  }
  archive(input: ArchiveInput): Promise<GmailMcpResult<ArchiveOutput>> {
    return this.inner.archive(input);
  }

  // ── Outbound writes: approval-gated ────────────────────────────────────

  composeFromTemplate(
    input: ComposeFromTemplateInput,
  ): Promise<GmailMcpResult<ComposeFromTemplateOutput>> {
    return this.gate(gmailAction(COMPOSE_FROM_TEMPLATE, input), () =>
      this.inner.composeFromTemplate(input),
    );
  }
  scheduleSend(input: ScheduleSendInput): Promise<GmailMcpResult<ScheduleSendOutput>> {
    return this.gate(gmailAction(SCHEDULE_SEND, input), () => this.inner.scheduleSend(input));
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
