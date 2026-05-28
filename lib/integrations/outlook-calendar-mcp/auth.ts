/**
 * lib/integrations/outlook-calendar-mcp/auth.ts
 *
 * Credential resolution for the Outlook Calendar MCP server. Reuses the
 * Outlook MCP's `resolveCredential` because both ride the same per-
 * workspace M365 IntegrationCredential row — connecting Outlook yields
 * a credential with the consented scope set (the marketplace flow can
 * later add `Calendars.Read` alongside `Mail.Read`/`Mail.ReadWrite`).
 *
 * Per `feedback_no_silent_vendor_lock.md`: the M365 OAuth refresh path
 * stays in `lib/integrations/outlook-mcp/auth.ts` (one seam). This file
 * is a thin adapter that re-shapes outlook-mcp's error envelope into the
 * calendar-mcp's error envelope.
 *
 * Per `feedback_cold_start_safe_agents.md`: no decrypted credentials are
 * cached here. Each call re-resolves through outlook-mcp's auth.
 */

import { resolveCredential as resolveOutlookCredential } from '@/lib/integrations/outlook-mcp/auth';
import type { DecryptedCredential } from '@/lib/integrations/types';
import { calendarError, type OutlookCalendarMcpResult } from './types';

export interface ResolveCredentialArgs {
  workspaceId: string;
}

export async function resolveCredential(
  args: ResolveCredentialArgs,
): Promise<OutlookCalendarMcpResult<DecryptedCredential>> {
  const result = await resolveOutlookCredential({ workspaceId: args.workspaceId });
  if (!result.ok) {
    return calendarError(result.error.code, result.error.message, {
      status: result.error.status,
      reference: result.error.reference,
    });
  }
  return { ok: true, value: result.value };
}
