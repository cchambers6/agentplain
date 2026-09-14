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

/**
 * Graph permissions that actually authorize the Outlook Calendar tool
 * surface.
 *
 * NOTE, 2026-09-13: NO marketplace tile currently requests any of these.
 * The Outlook tile requests `Mail.Read Mail.ReadWrite offline_access` and
 * nothing else, so on today's catalog this resolver will refuse every call.
 * That is the intended outcome of this change: the connector was already
 * non-functional, it just failed as an unattributed 403 from Graph instead
 * of saying so. Adding `Calendars.ReadWrite` to the Outlook tile is a
 * consent-screen decision for Conner, not a plumbing change.
 */
const CALENDAR_SCOPES: readonly string[] = [
  'Calendars.ReadWrite',
  'Calendars.Read',
];

/** True when the credential carries a scope that authorizes calendar calls. */
export function hasCalendarScope(scopes: readonly string[]): boolean {
  return scopes.some((s) => CALENDAR_SCOPES.includes(s));
}

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

  // An M365 credential resolving successfully does NOT mean it authorizes
  // calendar calls -- see CALENDAR_SCOPES above. Fail in words rather than
  // letting Graph return a 403 the customer never sees.
  if (!hasCalendarScope(result.value.scopes)) {
    return calendarError(
      'FORBIDDEN',
      `The Microsoft 365 connection for workspace ${args.workspaceId} does not grant calendar access ` +
        `(scopes on the credential: ${result.value.scopes.length > 0 ? result.value.scopes.join(', ') : 'none'}). ` +
        `Reconnect Outlook to grant calendar access at /app/workspace/${args.workspaceId}/integrations.`,
    );
  }

  return { ok: true, value: result.value };
}
