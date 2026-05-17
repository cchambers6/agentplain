/**
 * lib/skills/invoice-chasing-realestate/json-fetcher.ts
 *
 * Second implementation of `InvoiceFetcher` — accepts a pre-loaded JSON
 * payload (the same shape the QuickBooks MCP will return when built) and
 * serves it without any vendor SDK. Used today by:
 *
 *   - Tests
 *   - Brokers running a manual CSV/JSON import while the QuickBooks MCP
 *     is in flight
 *
 * Per `feedback_runner_portability.md` rule 3: this is the second
 * implementation of `InvoiceFetcher` so the interface is real (not
 * code-with-extra-steps). The QuickBooks-backed impl will be the third.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ContactRecord,
  InvoiceFetcher,
  InvoiceRecord,
} from './types';

export interface JsonInvoiceFetcherSeed {
  workspaceId: string;
  invoices: InvoiceRecord[];
  contacts: Record<string, ContactRecord>;
}

export class JsonInvoiceFetcher implements InvoiceFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonInvoiceFetcherSeed) {}

  async fetchOpenInvoices(args: { workspaceId: string }): Promise<SkillResult<InvoiceRecord[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonInvoiceFetcher seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    return skillOk(this.seed.invoices);
  }

  async fetchContactsByIds(args: {
    workspaceId: string;
    contactIds: string[];
  }): Promise<SkillResult<Record<string, ContactRecord>>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonInvoiceFetcher seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    const out: Record<string, ContactRecord> = {};
    for (const id of args.contactIds) {
      const hit = this.seed.contacts[id];
      if (hit) out[id] = hit;
    }
    return skillOk(out);
  }
}
