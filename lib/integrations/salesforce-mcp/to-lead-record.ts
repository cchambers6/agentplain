/**
 * lib/integrations/salesforce-mcp/to-lead-record.ts
 *
 * Adapter — maps a `SalesforceLeadSummary` to agentplain's provider-
 * neutral `LeadRecord` (the shape `lib/skills/lead-triage-realestate`
 * consumes). Lives here, not inside the skill, so the skill never imports
 * a Salesforce-shaped type (per `feedback_no_silent_vendor_lock.md`).
 */

import type { LeadRecord, LeadSource } from '@/lib/skills/lead-triage-realestate/types';
import type { SalesforceLeadSummary } from './types';

export function toLeadRecord(args: {
  lead: SalesforceLeadSummary;
  inquiryText?: string;
  inquirySubject?: string | null;
  hasBeenContacted?: boolean;
}): LeadRecord {
  const { lead } = args;
  return {
    id: `salesforce-${lead.id}`,
    fullName: composeFullName(lead.firstName, lead.lastName, lead.email),
    email: lead.email,
    phone: lead.phone,
    source: mapSource(lead.leadSource),
    inquiryText:
      args.inquiryText ??
      `${composeFullName(lead.firstName, lead.lastName, lead.email)} came in from ${
        lead.leadSource ?? 'unknown source'
      } in Salesforce (status: ${lead.status ?? 'unknown'}). No inbound message body captured on the lead record.`,
    inquirySubject: args.inquirySubject ?? null,
    propertyContext: {
      type: 'general',
      mlsNumber: null,
      addressText: null,
    },
    statedTimeline: null,
    statedFinancing: null,
    receivedAt: lead.createdAt ? new Date(lead.createdAt) : new Date(),
    hasBeenContacted: args.hasBeenContacted ?? (lead.status?.toLowerCase().includes('contacted') ?? false),
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

function mapSource(raw: string | null): LeadSource {
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  if (lower.includes('zillow')) return 'zillow';
  if (lower.includes('realtor')) return 'realtor-com';
  if (lower.includes('idx') || lower.includes('web') || lower.includes('paid search')) return 'idx';
  if (lower.includes('referral') || lower.includes('partner')) return 'referral';
  if (lower.includes('open house') || lower.includes('event')) return 'open-house';
  if (lower.includes('sphere') || lower.includes('purchased list')) return 'sphere';
  if (lower.includes('cold') || lower.includes('phone inquiry') || lower.includes('other')) return 'cold-inbound';
  return 'other';
}
