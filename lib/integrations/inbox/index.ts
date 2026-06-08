/**
 * lib/integrations/inbox/index.ts
 *
 * Public entrypoint + factory for the inbox-snapshot seam. Callers (the
 * chief-of-staff scheduler fetcher, the lead-triage cron) ask for an
 * `InboxSnapshotFetcher` and get either the live MCP-backed impl or the
 * deterministic fixture impl, based on the `LIVE_INBOX_FETCH` go-live
 * gate (`./flag.ts`).
 *
 * Per `feedback_runner_portability.md`: the per-call selector lives HERE.
 * No call site outside this module branches on impl name or reads the env
 * flag directly.
 *
 * CONNER ACTION: live reads (`LIVE_INBOX_FETCH=true`) require the Google
 * OAuth consent screen verified + scopes granted. Until then this factory
 * returns the fixture impl so the scheduler + lead-triage exercise the
 * full seam in dev without a live mailbox.
 */

import { isLiveInboxFetchEnabled } from './flag';
import { FixtureInboxFetcher } from './fixture-inbox-fetcher';
import { McpInboxFetcher, type InboxProvider } from './mcp-inbox-fetcher';
import type { InboxSnapshotFetcher } from './types';

export interface BuildInboxFetcherArgs {
  workspaceId: string;
  /** Which provider the workspace's active email credential is for. Only
   *  consulted on the live path; the fixture impl ignores it. */
  provider: InboxProvider;
  /** Force the fixture impl regardless of env. Tests pass true. */
  preferFixture?: boolean;
  /** Seed override for the fixture impl (ignored on the live path). */
  fixtureMessages?: ConstructorParameters<
    typeof FixtureInboxFetcher
  >[0]['messages'];
}

export function buildInboxFetcher(
  args: BuildInboxFetcherArgs,
): InboxSnapshotFetcher {
  const useFixture = args.preferFixture === true || !isLiveInboxFetchEnabled();
  if (useFixture) {
    return new FixtureInboxFetcher({
      workspaceId: args.workspaceId,
      messages: args.fixtureMessages,
    });
  }
  return new McpInboxFetcher({
    workspaceId: args.workspaceId,
    provider: args.provider,
  });
}

export { isLiveInboxFetchEnabled } from './flag';
export { FixtureInboxFetcher } from './fixture-inbox-fetcher';
export {
  McpInboxFetcher,
  type InboxProvider,
} from './mcp-inbox-fetcher';
export type {
  InboxFetchArgs,
  InboxSnapshotFetcher,
} from './types';
