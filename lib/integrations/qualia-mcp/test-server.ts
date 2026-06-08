/**
 * lib/integrations/qualia-mcp/test-server.ts
 *
 * Fixture-backed Qualia MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`)
 * and lets the closing-doc-chase skill run end-to-end in dev with NO live
 * credentials. Deterministic, no network, no credential resolution.
 *
 * Default server when `QUALIA_ADAPTER_LIVE` is not `on` (see index.ts).
 * The fixtures span received / pending / late items across multiple
 * responsible parties so the skill's per-party bucketing + draft paths are
 * all exercised against real-shaped data.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type GetClosingOrderInput,
  type GetClosingOrderOutput,
  type QualiaChecklistItem,
  type QualiaMcpServer,
  type QualiaOrderSummary,
  type QualiaReceivedDoc,
} from './types';

/** The single order id the fixture order is keyed on. */
export const QUALIA_FIXTURE_ORDER_ID = 'QUA-2026-0042';

const FIXTURE_ORDER: QualiaOrderSummary = {
  id: QUALIA_FIXTURE_ORDER_ID,
  propertyAddress: '742 Evergreen Ter, Atlanta, GA 30307',
  scheduledClosingDate: '2026-06-19',
  closingCoordinator: {
    name: 'Robin Vasquez',
    email: 'robin.vasquez@summit-title.example',
    role: 'underwriter',
  },
  parties: [
    { name: 'Dana Carver', email: 'dana.carver@example.com', role: 'buyer' },
    { name: 'Eli Monroe', email: 'eli.monroe@example.com', role: 'seller' },
    { name: 'Pinewood Mortgage', email: 'closing@pinewood-mtg.example', role: 'lender' },
    { name: 'Hart & Lowe LLP', email: 'closings@hartlowe.example', role: 'buyer-attorney' },
  ],
};

const FIXTURE_CHECKLIST: QualiaChecklistItem[] = [
  // Received — drops out of the chase.
  { id: 'CK-1', label: 'Purchase Agreement', responsibleParty: 'buyer', dueDate: '2026-06-10', required: true },
  // Pending (due in the future) — buyer.
  { id: 'CK-2', label: 'Buyer ID & Wire Authorization', responsibleParty: 'buyer', dueDate: '2026-06-18', required: true },
  // Late (past due, not received) — lender.
  { id: 'CK-3', label: 'Final Closing Disclosure', responsibleParty: 'lender', dueDate: '2026-06-12', required: true },
  // Late — seller.
  { id: 'CK-4', label: 'Seller Payoff Statement', responsibleParty: 'seller', dueDate: '2026-06-11', required: true },
  // Optional, pending — buyer-attorney (tracked, soft chase).
  { id: 'CK-5', label: 'Survey (optional)', responsibleParty: 'buyer-attorney', dueDate: '2026-06-17', required: false },
];

const FIXTURE_RECEIVED: QualiaReceivedDoc[] = [
  {
    id: 'DOC-1',
    satisfiesChecklistItemId: 'CK-1',
    receivedAt: '2026-06-09T14:30:00Z',
    filename: 'purchase-agreement-signed.pdf',
  },
];

export class TestQualiaMcpServer implements QualiaMcpServer {
  readonly name = 'qualia-test' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async getClosingOrder(
    input: GetClosingOrderInput,
  ): Promise<McpResult<GetClosingOrderOutput>> {
    if (input.orderId !== QUALIA_FIXTURE_ORDER_ID) {
      return mcpError('NOT_FOUND', `Qualia fixture has no order ${input.orderId}`);
    }
    return mcpOk({
      order: FIXTURE_ORDER,
      checklist: FIXTURE_CHECKLIST,
      receivedDocs: FIXTURE_RECEIVED,
    });
  }
}
