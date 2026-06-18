/**
 * lib/voice/provisioning.ts
 *
 * Per-customer phone-number provisioning + the number→workspace resolver the
 * incoming-call route uses to pick a playbook.
 *
 * STATUS — the assign/release operations are STUBBED until a Twilio account
 * exists: `provisionNumber`/`releaseNumber` return a structured
 * NOT_CONFIGURED result rather than calling Twilio (per the build brief: build
 * everything codeable, park account-needed work). Once TWILIO_ACCOUNT_SID +
 * TWILIO_AUTH_TOKEN are set and the `twilio` SDK is installed, the marked seam
 * wires `client.incomingPhoneNumbers.create(...)` / `.remove()` plus the
 * webhook-URL configuration from the `twilio-webhook-architecture` skill.
 *
 * The number→workspace mapping is read through a `NumberResolver` port so the
 * routes and tests don't depend on where the mapping lives. Until a dedicated
 * `VoiceNumber` table lands, `envNumberResolver` reads a JSON map from
 * `VOICE_NUMBER_MAP` — a stopgap that lets a pilot number route to a workspace
 * with zero schema change.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import { mcpError, mcpOk } from '@/lib/integrations/mcp-core';
import { isTwilioConfigured } from './config';

/** A provisioned number bound to a workspace + (optionally) a pinned playbook. */
export interface VoiceNumberAssignment {
  /** E.164 number. */
  phoneNumber: string;
  workspaceId: string;
  /** Pin a specific playbook id; else resolved from the workspace vertical. */
  playbookId?: string;
  /** Marketing vertical slug, used to resolve the playbook when not pinned. */
  verticalSlug?: string;
}

/** Resolve an inbound `To` number to its workspace assignment. */
export interface NumberResolver {
  resolve(toNumber: string): Promise<VoiceNumberAssignment | null>;
}

/**
 * Env-backed resolver. `VOICE_NUMBER_MAP` is a JSON object keyed by E.164:
 *   {"+18005550100": {"workspaceId":"ws_…","verticalSlug":"cpa"}}
 * Returns null for unmapped numbers (the route then plays a safe fallback).
 */
export const envNumberResolver: NumberResolver = {
  async resolve(toNumber: string): Promise<VoiceNumberAssignment | null> {
    const raw = process.env.VOICE_NUMBER_MAP;
    if (!raw) return null;
    let map: Record<string, Partial<VoiceNumberAssignment>>;
    try {
      map = JSON.parse(raw);
    } catch {
      return null;
    }
    const entry = map[toNumber];
    if (!entry || !entry.workspaceId) return null;
    return {
      phoneNumber: toNumber,
      workspaceId: entry.workspaceId,
      playbookId: entry.playbookId,
      verticalSlug: entry.verticalSlug,
    };
  },
};

export interface ProvisionNumberInput {
  workspaceId: string;
  /** Desired area code or 'tollfree' — used when buying a number. */
  areaCodeOrTollFree: string;
  verticalSlug?: string;
}

/**
 * Buy + configure a number for a workspace. STUB until Twilio is configured.
 * Once live, this is where `incomingPhoneNumbers.create` runs and the voice/
 * status/recording webhook URLs are set on the number (see
 * twilio-webhook-architecture §5).
 */
export async function provisionNumber(
  _input: ProvisionNumberInput,
): Promise<McpResult<VoiceNumberAssignment>> {
  if (!isTwilioConfigured()) {
    return mcpError(
      'NOT_IMPLEMENTED',
      'Number provisioning is parked until TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are configured.',
    );
  }
  // SEAM: wire twilio client.incomingPhoneNumbers.create({...}) here.
  return mcpError('NOT_IMPLEMENTED', 'Twilio provisioning seam not yet wired.');
}

/** Release a number. STUB until Twilio is configured (mirror of provision). */
export async function releaseNumber(_phoneNumber: string): Promise<McpResult<{ released: boolean }>> {
  if (!isTwilioConfigured()) {
    return mcpError(
      'NOT_IMPLEMENTED',
      'Number release is parked until TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are configured.',
    );
  }
  // SEAM: wire twilio client.incomingPhoneNumbers(sid).remove() here.
  return mcpOk({ released: false });
}
