/**
 * lib/integrations/appfolio-mcp/test-server.ts
 *
 * Fixture-backed AppFolio MCP server — the second implementation that satisfies
 * the two-implementation rule (`feedback_runner_portability.md`). Deterministic,
 * no network, no credential resolution. Used by the smoke test + by
 * `INTEGRATIONS_PROVIDER=test` previews.
 *
 * Read methods return fixtures; mutating methods return the same
 * APPROVAL_REQUIRED the prod server returns — so the smoke test pins the gate
 * behaviour (nothing mutating fires without approval).
 */

import { gateMutation, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type AppFolioUnitSummary,
  type AppfolioMcpServer,
  type ChargeTenantInput,
  type ChargeTenantOutput,
  type CreateWorkOrderInput,
  type CreateWorkOrderOutput,
  type ListUnitsInput,
  type ListUnitsOutput,
  type SendNoticeInput,
  type SendNoticeOutput,
} from './types';

const FIXTURE_UNITS: AppFolioUnitSummary[] = [
  {
    id: 'u-1',
    address: '101 Oak St, Unit A',
    propertyId: 'p-1',
    occupancy: 'occupied',
    status: 'active',
  },
  {
    id: 'u-2',
    address: '101 Oak St, Unit B',
    propertyId: 'p-1',
    occupancy: 'vacant',
    status: 'active',
  },
  {
    id: 'u-3',
    address: '55 Pine Ave',
    propertyId: 'p-2',
    occupancy: 'unknown',
    status: 'pending',
  },
];

export class TestAppfolioMcpServer implements AppfolioMcpServer {
  readonly name = 'appfolio-test' as const;
  readonly workspaceId: string;
  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listUnits(input: ListUnitsInput): Promise<McpResult<ListUnitsOutput>> {
    let units = FIXTURE_UNITS;
    if (input.propertyId) units = units.filter((u) => u.propertyId === input.propertyId);
    return mcpOk({ units });
  }

  async createWorkOrder(
    _input: CreateWorkOrderInput,
  ): Promise<McpResult<CreateWorkOrderOutput>> {
    return gateMutation('AppFolio', 'creating a work order');
  }

  async chargeTenant(_input: ChargeTenantInput): Promise<McpResult<ChargeTenantOutput>> {
    return gateMutation('AppFolio', 'charging a tenant');
  }

  async sendNotice(_input: SendNoticeInput): Promise<McpResult<SendNoticeOutput>> {
    return gateMutation('AppFolio', 'sending a notice');
  }
}
