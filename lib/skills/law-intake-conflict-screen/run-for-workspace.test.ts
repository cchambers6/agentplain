/**
 * lib/skills/law-intake-conflict-screen/run-for-workspace.test.ts
 *
 * End-to-end tests for the law conflict-screen production wrapper (pfd-8).
 * Drives the real deterministic screen through a fixture intake source +
 * ledger + a recording sink — proving the workspace-level caller screens
 * each pending intake and produces a verdict card (the value a paying law
 * workspace now receives).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runConflictScreenForWorkspace } from './run-for-workspace';
import { JsonIntakeFetcher } from './prisma-intake-fetcher';
import { JsonLedgerFetcher } from './json-fetcher';
import { RecordingConflictApprovalSink } from './prisma-approval-sink';
import type { LedgerEntry, ProspectiveIntake } from './types';

const WS = 'ws-law-1';

function intake(over: Partial<ProspectiveIntake> = {}): ProspectiveIntake {
  return {
    matterId: 'M-1',
    prospectName: 'Jane Prospect',
    prospectEmail: 'jane@example.com',
    opposingParties: [],
    matterDescription: 'Estate plan',
    responsibleAttorney: { name: 'Pat Partner', email: 'pat@firm.example' },
    ...over,
  };
}

describe('runConflictScreenForWorkspace — screens each pending intake', () => {
  it('clear intake against a non-empty ledger → one CLEAR verdict + engagement letter', async () => {
    const sink = new RecordingConflictApprovalSink();
    const ledger: LedgerEntry[] = [
      { clientName: 'Acme Holdings', status: 'active' },
    ];
    const result = await runConflictScreenForWorkspace({
      workspaceId: WS,
      intakeFetcher: new JsonIntakeFetcher({ workspaceId: WS, intakes: [intake()] }),
      ledgerFetcher: new JsonLedgerFetcher({ workspaceId: WS, ledger }),
      sink,
    });
    assert.equal(result.intakesConsidered, 1);
    assert.equal(result.intakesScreened, 1);
    assert.equal(result.clear, 1);
    assert.equal(sink.calls.length, 1);
    assert.ok(sink.calls[0]!.engagementLetter, 'CLEAR path renders an engagement letter');
  });

  it('prospect matching an active client → needs-counsel-review verdict', async () => {
    const sink = new RecordingConflictApprovalSink();
    const ledger: LedgerEntry[] = [
      { clientName: 'Jane Prospect', status: 'active' },
    ];
    const result = await runConflictScreenForWorkspace({
      workspaceId: WS,
      intakeFetcher: new JsonIntakeFetcher({ workspaceId: WS, intakes: [intake()] }),
      ledgerFetcher: new JsonLedgerFetcher({ workspaceId: WS, ledger }),
      sink,
    });
    assert.equal(result.intakesScreened, 1);
    assert.equal(result.needsCounselReview, 1);
    assert.equal(sink.calls.length, 1);
  });

  it('empty pending-intake list is a quiet pass (no verdicts)', async () => {
    const sink = new RecordingConflictApprovalSink();
    const result = await runConflictScreenForWorkspace({
      workspaceId: WS,
      intakeFetcher: new JsonIntakeFetcher({ workspaceId: WS, intakes: [] }),
      ledgerFetcher: new JsonLedgerFetcher({ workspaceId: WS, ledger: [] }),
      sink,
    });
    assert.equal(result.intakesConsidered, 0);
    assert.equal(result.intakesScreened, 0);
    assert.equal(sink.calls.length, 0);
  });

  it('gate-denied → NOT_APPLICABLE per intake, no verdict, no throw', async () => {
    const sink = new RecordingConflictApprovalSink();
    const result = await runConflictScreenForWorkspace({
      workspaceId: WS,
      gateAllow: false,
      intakeFetcher: new JsonIntakeFetcher({ workspaceId: WS, intakes: [intake()] }),
      ledgerFetcher: new JsonLedgerFetcher({ workspaceId: WS, ledger: [] }),
      sink,
    });
    assert.equal(result.intakesConsidered, 1);
    assert.equal(result.intakesScreened, 0);
    assert.equal(sink.calls.length, 0);
  });

  it('screens multiple intakes against one ledger read', async () => {
    const sink = new RecordingConflictApprovalSink();
    const result = await runConflictScreenForWorkspace({
      workspaceId: WS,
      intakes: [intake({ matterId: 'M-1' }), intake({ matterId: 'M-2', prospectName: 'Bob Other' })],
      ledgerFetcher: new JsonLedgerFetcher({
        workspaceId: WS,
        ledger: [{ clientName: 'Some Client', status: 'closed' }],
      }),
      sink,
    });
    assert.equal(result.intakesScreened, 2);
    assert.equal(sink.calls.length, 2);
  });
});
