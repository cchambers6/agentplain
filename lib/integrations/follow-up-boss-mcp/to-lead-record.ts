/**
 * lib/integrations/follow-up-boss-mcp/to-lead-record.ts
 *
 * Adapter — maps a `FubLeadSummary` to agentplain's provider-neutral
 * `LeadRecord` (the shape `lib/skills/lead-triage-realestate` consumes).
 * Lives here, not inside the skill, so the skill never imports an
 * FUB-shaped type (per `feedback_no_silent_vendor_lock.md`).
 */

import type { LeadRecord, LeadSource } from '@/lib/skills/lead-triage-realestate/types';
import type { FubLeadSummary } from './types';

export function toLeadRecord(args: {
  lead: FubLeadSummary;
  /** Optional inquiry text — FUB's people-list endpoint does not carry
   *  inquiry body; the caller can pass the most-recent inbound text
   *  when joining against notes / messages. */
  inquiryText?: string;
  /** Optional subject — same reasoning. */
  inquirySubject?: string | null;
  /** Optional flag — has the lead been touched in FUB (e.g. has any
   *  outbound activity logged). Drives first-touch vs follow-up copy. */
  hasBeenContacted?: boolean;
}): LeadRecord {
  const { lead } = args;
  return {
    id: `fub-${lead.id}`,
    fullName: composeFullName(lead.firstName, lead.lastName),
    email: lead.emails[0] ?? null,
    phone: lead.phones[0] ?? null,
    source: mapSource(lead.source),
    inquiryText:
      args.inquiryText ??
      `${composeFullName(lead.firstName, lead.lastName)} came in from ${
        lead.source ?? 'unknown source'
      }. No inbound message body captured on the FUB person record.`,
    inquirySubject: args.inquirySubject ?? null,
    propertyContext: {
      type: 'general',
      mlsNumber: null,
      addressText: null,
    },
    statedTimeline: null,
    statedFinancing: null,
    receivedAt: lead.createdAt ? new Date(lead.createdAt) : new Date(),
    hasBeenContacted: args.hasBeenContacted ?? false,
  };
}

function composeFullName(
  first: string | null,
  last: string | null,
): string {
  const trimmed = [first, last].map((s) => s?.trim() ?? '').filter(Boolean);
  return trimmed.length > 0 ? trimmed.join(' ') : 'Unknown lead';
}

/** Map FUB's free-text source to the closed LeadSource enum. */
function mapSource(raw: string | null): LeadSource {
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  if (lower.includes('zillow')) return 'zillow';
  if (lower.includes('realtor')) return 'realtor-com';
  if (lower.includes('idx')) return 'idx';
  if (lower.includes('referral')) return 'referral';
  if (lower.includes('open house')) return 'open-house';
  if (lower.includes('sphere')) return 'sphere';
  if (lower.includes('cold') || lower.includes('manual')) return 'cold-inbound';
  return 'other';
}
