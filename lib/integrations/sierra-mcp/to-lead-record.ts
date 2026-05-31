/**
 * lib/integrations/sierra-mcp/to-lead-record.ts
 *
 * Adapter — maps a `SierraLeadSummary` to agentplain's provider-neutral
 * `LeadRecord` shape. Mirrors the FUB → LeadRecord adapter so the
 * lead-triage-realestate skill consumes both CRMs through one port.
 */

import type {
  LeadRecord,
  LeadSource,
} from '@/lib/skills/lead-triage-realestate/types';
import type { SierraLeadSummary } from './types';

export function toLeadRecord(args: {
  lead: SierraLeadSummary;
  inquiryText?: string;
  inquirySubject?: string | null;
  hasBeenContacted?: boolean;
}): LeadRecord {
  const { lead } = args;
  return {
    id: `sierra-${lead.id}`,
    fullName: composeFullName(lead.firstName, lead.lastName),
    email: lead.emails[0] ?? null,
    phone: lead.phones[0] ?? null,
    source: mapSource(lead.source),
    inquiryText:
      args.inquiryText ??
      `${composeFullName(lead.firstName, lead.lastName)} came in from ${
        lead.source ?? 'unknown source'
      }. Sierra contact record carries no inbound message body.`,
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
