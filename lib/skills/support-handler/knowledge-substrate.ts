/**
 * lib/skills/support-handler/knowledge-substrate.ts
 *
 * Two impls of `IKnowledgeSubstratePort`:
 *
 *   - `CustomerFilesKnowledgeSubstrate` (production) — delegates to
 *     `retrieveCustomerContext`, which talks to the substrate through
 *     the existing MCP-fronted boundary (no direct DB access from the
 *     skill, per project_mcp_first_integration_architecture).
 *
 *   - `RecordingKnowledgeSubstrate` (test) — returns canned snippets the
 *     test passes in. Powers the empty-substrate path, the high-confidence
 *     path, and the cross-workspace isolation assertion.
 *
 * The skill itself imports the port; it never touches Prisma or the
 * knowledge store directly. This file is the single seam.
 */

import { retrieveCustomerContext } from '../../customer-files';
import type { CustomerContextSnippet } from '../../customer-files';
import type { IKnowledgeSubstratePort, SupportContextSnippet } from './types';

export class CustomerFilesKnowledgeSubstrate implements IKnowledgeSubstratePort {
  readonly name = 'customer-files-mcp' as const;

  async searchForRequest(args: {
    workspaceId: string;
    query: string;
    k: number;
  }): Promise<SupportContextSnippet[]> {
    const snippets = await retrieveCustomerContext({
      workspaceId: args.workspaceId,
      query: args.query,
      k: args.k,
    });
    return snippets.map(toSupportSnippet);
  }
}

function toSupportSnippet(s: CustomerContextSnippet): SupportContextSnippet {
  return {
    title: s.title,
    bodyExcerpt: s.body,
    sourceUrl: s.sourceUrl,
    similarity: s.similarity,
  };
}

/** Test impl. The caller seeds `snippetsByWorkspace` keyed by workspaceId
 *  so a cross-workspace isolation test can assert that a SupportRequest
 *  from workspace A never produces a draft cited against workspace B. */
export class RecordingKnowledgeSubstrate implements IKnowledgeSubstratePort {
  readonly name = 'recording' as const;
  readonly calls: Array<{ workspaceId: string; query: string; k: number }> = [];
  private readonly snippetsByWorkspace: Map<string, SupportContextSnippet[]>;

  constructor(seed: Record<string, SupportContextSnippet[]>) {
    this.snippetsByWorkspace = new Map(Object.entries(seed));
  }

  async searchForRequest(args: {
    workspaceId: string;
    query: string;
    k: number;
  }): Promise<SupportContextSnippet[]> {
    this.calls.push({ workspaceId: args.workspaceId, query: args.query, k: args.k });
    const found = this.snippetsByWorkspace.get(args.workspaceId) ?? [];
    return found.slice(0, args.k);
  }
}
