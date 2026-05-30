/**
 * lib/skills/lead-triage-realestate/parsed-message-fetcher.test.ts
 *
 * Pins the ParsedMessage → LeadRecord adapter. The wave-1 router
 * depends on this conversion being honest (no fabrication when fields
 * are missing; no-reply senders dropped; MLS hints surfaced).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ParsedMessageLeadFetcher,
  toLeadRecord,
} from './parsed-message-fetcher';
import type { ParsedMessage } from '../types';

const WORKSPACE_ID = 'ws-pm-fetcher-test';

function message(overrides: Partial<ParsedMessage> = {}): ParsedMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    rfcMessageId: null,
    fromEmail: 'lead@example.com',
    fromName: 'Lead Name',
    toEmails: ['agent@brokerage.com'],
    ccEmails: [],
    subject: 'Question about your listing',
    bodyText: 'Looking to tour something next weekend.',
    snippet: 'Looking to tour something',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date('2026-05-20T10:00:00Z'),
    labels: ['INBOX'],
    ...overrides,
  };
}

describe('toLeadRecord — happy + honesty cases', () => {
  it('maps a sane inbound message to a LeadRecord', () => {
    const lead = toLeadRecord(message());
    assert.ok(lead);
    assert.equal(lead!.email, 'lead@example.com');
    assert.equal(lead!.fullName, 'Lead Name');
    assert.equal(lead!.source, 'cold-inbound');
    assert.equal(lead!.propertyContext.type, 'general');
  });

  it('infers source from sender domain for zillow/realtor.com', () => {
    const z = toLeadRecord(message({ fromEmail: 'noteaboutlisting@zillow.com', fromName: 'a' }));
    // zillow no-reply pattern (starts with "noteaboutlisting" — not no-reply)
    assert.ok(z);
    assert.equal(z!.source, 'zillow');
    const r = toLeadRecord(message({ fromEmail: 'leads@realtor.com', fromName: 'b' }));
    assert.ok(r);
    assert.equal(r!.source, 'realtor-com');
  });

  it('extracts an MLS number when present in the subject', () => {
    const lead = toLeadRecord(
      message({ subject: 'Interested in MLS# 7000123' }),
    );
    assert.ok(lead);
    assert.equal(lead!.propertyContext.type, 'specific-listing');
    assert.equal(lead!.propertyContext.mlsNumber, '7000123');
  });

  it('returns null for no-reply senders (no fake lead)', () => {
    assert.equal(
      toLeadRecord(message({ fromEmail: 'no-reply@zillow.com' })),
      null,
    );
    assert.equal(
      toLeadRecord(message({ fromEmail: 'noreply@brokerage.com' })),
      null,
    );
    assert.equal(
      toLeadRecord(message({ fromEmail: 'do-not-reply@idx.com' })),
      null,
    );
    assert.equal(
      toLeadRecord(message({ fromEmail: 'donotreply@platform.com' })),
      null,
    );
  });

  it('returns null when the body is empty (no inquiry text → no honest lead)', () => {
    assert.equal(toLeadRecord(message({ bodyText: '' })), null);
    assert.equal(toLeadRecord(message({ bodyText: '   ' })), null);
  });
});

describe('ParsedMessageLeadFetcher — port behavior', () => {
  it('returns no roster / no drips (honest — no source wired yet)', async () => {
    const fetcher = new ParsedMessageLeadFetcher({
      workspaceId: WORKSPACE_ID,
      messages: [],
    });
    const roster = await fetcher.fetchAgentRoster({
      workspaceId: WORKSPACE_ID,
    });
    assert.equal(roster.ok, true);
    if (roster.ok) assert.deepEqual(roster.value, []);
    const drips = await fetcher.fetchDripCampaigns({
      workspaceId: WORKSPACE_ID,
    });
    assert.equal(drips.ok, true);
    if (drips.ok) assert.deepEqual(drips.value, []);
  });

  it('refuses to surface leads for a different workspace id', async () => {
    const fetcher = new ParsedMessageLeadFetcher({
      workspaceId: WORKSPACE_ID,
      messages: [message()],
    });
    const res = await fetcher.fetchInboundLeads({
      workspaceId: 'ws-other',
    });
    assert.equal(res.ok, true);
    if (res.ok) assert.deepEqual(res.value, []);
  });
});
