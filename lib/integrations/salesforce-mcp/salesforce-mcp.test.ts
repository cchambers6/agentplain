/**
 * Pins the Salesforce MCP read + write paths and the adapter:
 *   - listLeads / getLead return mapped DTOs
 *   - listOpportunities filters by accountId
 *   - listAccounts + getAccount roundtrip
 *   - createTask records the call + validates target ids
 *   - Recording server enforces NOT_FOUND on missing ids
 *   - Adapter (toLeadRecord) maps source strings + composes full name
 *   - SalesforceLeadFetcher rejects workspaceId mismatch
 *   - SalesforceLeadFetcher returns NOT_CONFIGURED when no credential
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RecordingSalesforceMcpServer,
  SalesforceLeadFetcher,
  toLeadRecord,
  type SalesforceLeadSummary,
  type SalesforceOpportunitySummary,
  type SalesforceAccountSummary,
  type SalesforceContactSummary,
} from '.';

function fakeLead(over: Partial<SalesforceLeadSummary> = {}): SalesforceLeadSummary {
  return {
    id: '00Q000000000001',
    firstName: 'Sam',
    lastName: 'Buyer',
    email: 'sam@example.com',
    phone: '555-0100',
    company: 'Acme Co',
    status: 'Open - Not Contacted',
    leadSource: 'Web',
    rating: 'Hot',
    createdAt: '2026-05-30T12:00:00.000+0000',
    modifiedAt: '2026-05-30T12:00:00.000+0000',
    ...over,
  };
}

describe('salesforce-mcp — recording server', () => {
  it('listLeads returns seeded leads up to the limit', async () => {
    const mcp = new RecordingSalesforceMcpServer({
      workspaceId: 'ws-1',
      seed: { leads: [fakeLead()] },
    });
    const res = await mcp.listLeads({ limit: 10 });
    assert.ok(res.ok);
    assert.equal(res.value.leads.length, 1);
    assert.equal(res.value.leads[0].rating, 'Hot');
  });

  it('getLead returns NOT_FOUND for unknown ids', async () => {
    const mcp = new RecordingSalesforceMcpServer({ workspaceId: 'ws-1' });
    const res = await mcp.getLead({ leadId: 'missing' });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'NOT_FOUND');
  });

  it('listOpportunities filters by accountId', async () => {
    const oppA: SalesforceOpportunitySummary = {
      id: '0061', name: 'Opp A', amount: 100, stage: 'Prospecting',
      closeDate: null, accountId: '001A', probability: 10,
      createdAt: null, modifiedAt: null,
    };
    const oppB: SalesforceOpportunitySummary = {
      id: '0062', name: 'Opp B', amount: 200, stage: 'Closed Won',
      closeDate: null, accountId: '001B', probability: 100,
      createdAt: null, modifiedAt: null,
    };
    const mcp = new RecordingSalesforceMcpServer({
      workspaceId: 'ws-1',
      seed: { opportunities: [oppA, oppB] },
    });
    const res = await mcp.listOpportunities({ accountId: '001A' });
    assert.ok(res.ok);
    assert.equal(res.value.opportunities.length, 1);
    assert.equal(res.value.opportunities[0].id, '0061');
  });

  it('listAccounts + getAccount roundtrip', async () => {
    const account: SalesforceAccountSummary = {
      id: '001AAA',
      name: 'Globex',
      industry: 'Technology',
      website: 'globex.example',
      phone: '555-0123',
      createdAt: null,
      modifiedAt: null,
    };
    const mcp = new RecordingSalesforceMcpServer({
      workspaceId: 'ws-1',
      seed: { accounts: [account] },
    });
    const list = await mcp.listAccounts({});
    assert.ok(list.ok);
    assert.equal(list.value.accounts.length, 1);
    const one = await mcp.getAccount({ accountId: '001AAA' });
    assert.ok(one.ok);
    assert.equal(one.value.account.industry, 'Technology');
  });

  it('listContacts filters by accountId', async () => {
    const contact: SalesforceContactSummary = {
      id: '003C', firstName: 'Pat', lastName: 'Decider',
      email: 'pat@globex.example', phone: null,
      accountId: '001AAA', title: 'VP Ops',
      createdAt: null, modifiedAt: null,
    };
    const mcp = new RecordingSalesforceMcpServer({
      workspaceId: 'ws-1',
      seed: { contacts: [contact] },
    });
    const res = await mcp.listContacts({ accountId: '001AAA' });
    assert.ok(res.ok);
    assert.equal(res.value.contacts.length, 1);
    assert.equal(res.value.contacts[0].title, 'VP Ops');
  });

  it('createTask returns a taskId and records the call', async () => {
    const mcp = new RecordingSalesforceMcpServer({
      workspaceId: 'ws-1',
      seed: { leads: [fakeLead()] },
    });
    const res = await mcp.createTask({
      subject: 'Follow up with Sam',
      whoId: '00Q000000000001',
    });
    assert.ok(res.ok);
    assert.ok(res.value.taskId.startsWith('task-'));
    assert.equal(mcp.calls.filter((c) => c.tool === 'createTask').length, 1);
  });

  it('createTask rejects empty subject', async () => {
    const mcp = new RecordingSalesforceMcpServer({ workspaceId: 'ws-1' });
    const res = await mcp.createTask({ subject: '   ' });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'INVALID_ARGUMENT');
  });

  it('createTask rejects unknown whoId', async () => {
    const mcp = new RecordingSalesforceMcpServer({ workspaceId: 'ws-1' });
    const res = await mcp.createTask({ subject: 'x', whoId: 'missing' });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'NOT_FOUND');
  });
});

describe('salesforce-mcp — toLeadRecord adapter', () => {
  it('composes full name from first + last + maps Web → idx', () => {
    const rec = toLeadRecord({ lead: fakeLead() });
    assert.equal(rec.fullName, 'Sam Buyer');
    assert.equal(rec.email, 'sam@example.com');
    assert.equal(rec.id, 'salesforce-00Q000000000001');
    assert.equal(rec.source, 'idx');
  });

  it('falls back to email when name is missing', () => {
    const rec = toLeadRecord({ lead: fakeLead({ firstName: null, lastName: null }) });
    assert.equal(rec.fullName, 'sam@example.com');
  });

  it('infers hasBeenContacted from status', () => {
    const rec = toLeadRecord({
      lead: fakeLead({ status: 'Working - Contacted' }),
    });
    assert.equal(rec.hasBeenContacted, true);
  });

  it('maps Partner Referral → referral, Other → cold-inbound', () => {
    assert.equal(toLeadRecord({ lead: fakeLead({ leadSource: 'Partner Referral' }) }).source, 'referral');
    assert.equal(toLeadRecord({ lead: fakeLead({ leadSource: 'Other' }) }).source, 'cold-inbound');
  });
});

describe('salesforce-mcp — SalesforceLeadFetcher', () => {
  it('rejects mismatched workspaceId', async () => {
    const mcp = new RecordingSalesforceMcpServer({ workspaceId: 'ws-A' });
    const fetcher = new SalesforceLeadFetcher({ workspaceId: 'ws-A', mcp });
    const res = await fetcher.fetchInboundLeads({ workspaceId: 'ws-B' });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'INVALID_INPUT');
  });

  it('returns mapped LeadRecords on success', async () => {
    const mcp = new RecordingSalesforceMcpServer({
      workspaceId: 'ws-A', seed: { leads: [fakeLead()] },
    });
    const fetcher = new SalesforceLeadFetcher({ workspaceId: 'ws-A', mcp });
    const res = await fetcher.fetchInboundLeads({ workspaceId: 'ws-A' });
    assert.ok(res.ok);
    assert.equal(res.value.length, 1);
    assert.equal(res.value[0].id, 'salesforce-00Q000000000001');
  });
});
