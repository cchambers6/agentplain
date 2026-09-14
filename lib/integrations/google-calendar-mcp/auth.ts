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

/**
 * Scopes that actually authorize the Google Calendar tool surface.
 *
 * `calendar.events` is what agentplain requests (GOOGLE_GMAIL_SCOPES in
 * lib/integrations/google/oauth.ts). The broader `calendar` scope is
 * accepted too: a workspace that granted it before the request was narrowed
 * is still fully authorized, and refusing it would break a working
 * connection for no gain.
 */
const CALENDAR_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
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

  // A GOOGLE credential resolving successfully does NOT mean it authorizes
  // calendar calls. This resolver passed the Gmail credential straight
  // through without ever inspecting its scopes, so a workspace that
  // connected Gmail before `calendar.events` was requested got a healthy
  // credential and then a bare 403 from Google on every calendar call --
  // invisible to the customer, who sees a connector that says "connected".
  // Measured 2026-09-13. Fail here, in words, instead.
  if (!hasCalendarScope(result.value.scopes)) {
    return calendarError(
      'FORBIDDEN',
      `The Google connection for workspace ${args.workspaceId} does not grant calendar access ` +
        `(scopes on the credential: ${result.value.scopes.length > 0 ? result.value.scopes.join(', ') : 'none'}). ` +
        `Reconnect Google to grant calendar access at /app/workspace/${args.workspaceId}/integrations.`,
    );
  }

  return { ok: true, value: result.value };
}
