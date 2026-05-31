/**
 * Two impls of `IResearchSubstratePort` — production + recording. The
 * production impl delegates to `retrieveCustomerContext` (the MCP-
 * fronted boundary the support-handler already uses), so the skill
 * never opens a direct DB connection.
 *
 * Per `project_mcp_first_integration_architecture` + the
 * two-implementation rule: this is the single seam between the skill
 * and the customer-files retrieval surface.
 */

import { retrieveCustomerContext } from '../../customer-files';
import type { SupportContextSnippet } from '../support-handler';
import type { IResearchSubstratePort } from './types';

export class CustomerFilesResearchSubstrate implements IResearchSubstratePort {
  readonly name = 'customer-files-mcp' as const;

  async searchForResearch(args: {
    workspaceId: string;
    query: string;
    k: number;
  }): Promise<SupportContextSnippet[]> {
    const snippets = await retrieveCustomerContext({
      workspaceId: args.workspaceId,
      query: args.query,
      k: args.k,
    });
    return snippets.map((s) => ({
      title: s.title,
      bodyExcerpt: s.body,
      sourceUrl: s.sourceUrl,
      similarity: s.similarity,
    }));
  }
}

export class RecordingResearchSubstrate implements IResearchSubstratePort {
  readonly name = 'recording' as const;
  readonly calls: Array<{ workspaceId: string; query: string; k: number }> = [];
  private readonly snippetsByWorkspace: Map<string, SupportContextSnippet[]>;

  constructor(seed: Record<string, SupportContextSnippet[]>) {
    this.snippetsByWorkspace = new Map(Object.entries(seed));
  }

  async searchForResearch(args: {
    workspaceId: string;
    query: string;
    k: number;
  }): Promise<SupportContextSnippet[]> {
    this.calls.push({
      workspaceId: args.workspaceId,
      query: args.query,
      k: args.k,
    });
    return (this.snippetsByWorkspace.get(args.workspaceId) ?? []).slice(0, args.k);
  }
}
