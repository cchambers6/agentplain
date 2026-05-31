/**
 * lib/integrations/hubspot-mcp/to-lead-record.ts
 *
 * Adapter — maps a `HubspotContactSummary` to agentplain's provider-
 * neutral `LeadRecord` (the shape `lib/skills/lead-triage-realestate`
 * consumes). Lives here, not inside the skill, so the skill never imports
 * a HubSpot-shaped type (per `feedback_no_silent_vendor_lock.md`).
 *
 * The real-estate skill is the closest existing LeadRecord consumer; the
 * same shape is reused as the universal lead surface for any future
 * cross-vertical triage skill (HubSpot is `vertical: ['all']`, so its
 * leads land in whichever workspace has the right skill installed).
 */

import type { LeadRecord, LeadSource } from '@/lib/skills/lead-triage-realestate/types';
import type { HubspotContactSummary } from './types';

export function toLeadRecord(args: {
  contact: HubspotContactSummary;
  inquiryText?: string;
  inquirySubject?: string | null;
  hasBeenContacted?: boolean;
}): LeadRecord {
  const { contact } = args;
  return {
    id: `hubspot-${contact.id}`,
    fullName: composeFullName(contact.firstName, contact.lastName, contact.email),
    email: contact.email,
    phone: contact.phone,
    source: mapSource(contact.leadSource),
    inquiryText:
      args.inquiryText ??
      `${composeFullName(contact.firstName, contact.lastName, contact.email)} came in from ${
        contact.leadSource ?? 'unknown source'
      } in HubSpot. No inbound message body captured on the contact record.`,
    inquirySubject: args.inquirySubject ?? null,
    propertyContext: {
      type: 'general',
      mlsNumber: null,
      addressText: null,
    },
    statedTimeline: null,
    statedFinancing: null,
    receivedAt: contact.createdAt ? new Date(contact.createdAt) : new Date(),
    hasBeenContacted: args.hasBeenContacted ?? false,
  };
}

function composeFullName(
  first: string | null,
  last: string | null,
  emailFallback: string | null,
): string {
  const trimmed = [first, last].map((s) => s?.trim() ?? '').filter(Boolean);
  if (trimmed.length > 0) return trimmed.join(' ');
  if (emailFallback) return emailFallback;
  return 'Unknown lead';
}

/** Map HubSpot's free-text source to the closed LeadSource enum. */
function mapSource(raw: string | null): LeadSource {
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  if (lower.includes('zillow')) return 'zillow';
  if (lower.includes('realtor')) return 'realtor-com';
  if (lower.includes('idx') || lower.includes('organic search') || lower.includes('paid search')) return 'idx';
  if (lower.includes('referral') || lower.includes('direct')) return 'referral';
  if (lower.includes('open house')) return 'open-house';
  if (lower.includes('sphere') || lower.includes('email marketing')) return 'sphere';
  if (lower.includes('cold') || lower.includes('manual') || lower.includes('offline')) return 'cold-inbound';
  return 'other';
}
