/**
 * lib/integrations/ezlynx-mcp/test-server.ts
 *
 * Fixture-backed EZLynx MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`)
 * and lets the COI-request skill run end-to-end in dev with NO live
 * credentials. Deterministic, no network, no credential resolution.
 *
 * Default server when `EZLYNX_ADAPTER_LIVE` is not `on` (see index.ts).
 * The fixtures span an in-force line, an expired line, and an unknown
 * insured (empty policy set) so the skill's ready-to-issue / expired /
 * coverage-gap paths are all exercised against real-shaped data.
 */

import { mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type EzlynxMcpServer,
  type EzlynxPolicy,
  type ListPoliciesInput,
  type ListPoliciesOutput,
} from './types';

/** Legal name the fixture insured is keyed on (case-insensitive match). */
export const EZLYNX_FIXTURE_INSURED = 'Beacon Roofing & Restoration LLC';

const FIXTURE_POLICIES: EzlynxPolicy[] = [
  {
    // In force — backs a ready-to-issue line.
    policyNumber: 'GL-7788-2026',
    carrierName: 'Travelers',
    line: 'general-liability',
    expirationDate: '2026-12-01',
    inForce: true,
  },
  {
    // In force — workers comp.
    policyNumber: 'WC-3321-2026',
    carrierName: 'The Hartford',
    line: 'workers-comp',
    expirationDate: '2026-11-15',
    inForce: true,
  },
  {
    // Expired term — surfaces as expired-coverage if requested.
    policyNumber: 'AUTO-5540-2025',
    carrierName: 'Progressive Commercial',
    line: 'auto-liability',
    expirationDate: '2025-12-31',
    inForce: false,
  },
];

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class TestEzlynxMcpServer implements EzlynxMcpServer {
  readonly name = 'ezlynx-test' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listPoliciesForInsured(
    input: ListPoliciesInput,
  ): Promise<McpResult<ListPoliciesOutput>> {
    if (normalize(input.insuredLegalName) === normalize(EZLYNX_FIXTURE_INSURED)) {
      return mcpOk({ policies: FIXTURE_POLICIES });
    }
    // Unknown insured → empty (skill treats lines as not-on-file).
    return mcpOk({ policies: [] });
  }
}
