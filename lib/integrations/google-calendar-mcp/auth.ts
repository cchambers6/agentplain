/**
 * lib/integrations/google-calendar-mcp/auth.ts
 *
 * Credential resolution for the Google Calendar MCP server. We REUSE the
 * Gmail MCP's `resolveCredential` because both ride the same per-workspace
 * GOOGLE IntegrationCredential row — connecting Gmail (or, in production,
 * Gmail + Calendar with `include_granted_scopes=true`) yields one
 * credential with the merged scope set. This file is a thin adapter that
 * re-shapes Gmail MCP's error envelope into the calendar MCP's error
 * envelope so callers above the seam only ever see calendar error codes.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the GOOGLE OAuth refresh path
 * stays in `lib/integrations/google/oauth.ts` (one seam). This file just
 * routes the resolved credential through.
 *
 * Per `feedback_cold_start_safe_agents.md`: no decrypted credentials are
 * cached here. Each call re-resolves through the Gmail MCP auth resolver,
 * which itself reads durable state on every call.
 */

import { resolveCredential as resolveGmailCredential } from '@/lib/integrations/gmail-mcp/auth';
import type { DecryptedCredential } from '@/lib/integrations/types';
import { calendarError, type GoogleCalendarMcpResult } from './types';

export interface ResolveCredentialArgs {
  workspaceId: string;
}

export async function resolveCredential(
  args: ResolveCredentialArgs,
): Promise<GoogleCalendarMcpResult<DecryptedCredential>> {
  const result = await resolveGmailCredential({ workspaceId: args.workspaceId });
  if (!result.ok) {
    // Re-shape gmail-mcp's error code into the calendar-mcp's error code.
    // The codes are intentionally parallel, so most are 1:1.
    return calendarError(result.error.code, result.error.message, {
      status: result.error.status,
      reference: result.error.reference,
    });
  }
  return { ok: true, value: result.value };
}
