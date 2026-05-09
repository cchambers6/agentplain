// In-memory BriefingsProvider for tests + dev. Seed with `seed()`.
// Useful for local development without a Notion API key.

import type {
  Briefing,
  BriefingsProvider,
  FetchBriefingsInput,
} from "./types";

export class TestBriefingsProvider implements BriefingsProvider {
  readonly providerName = "test";
  private byWorkspace = new Map<string, Briefing[]>();
  invalidations: string[] = [];

  seed(workspaceId: string, briefings: Omit<Briefing, "workspaceId" | "fetchedAt" | "isStale">[]): void {
    const now = new Date().toISOString();
    this.byWorkspace.set(
      workspaceId,
      briefings.map((b) => ({
        ...b,
        workspaceId,
        fetchedAt: now,
        isStale: false,
      })),
    );
  }

  async fetchBriefings(input: FetchBriefingsInput): Promise<Briefing[]> {
    const all = this.byWorkspace.get(input.workspaceId) ?? [];
    return all.slice(0, input.limit ?? 5);
  }

  async invalidate(workspaceId: string): Promise<void> {
    this.invalidations.push(workspaceId);
    this.byWorkspace.delete(workspaceId);
  }
}
