// Notion-backed BriefingsProvider with read-through TTL cache.
//
// All Notion SDK access lives in this file per feedback_no_silent_vendor_lock.
// Briefings render IN-PRODUCT only — no callers leak Notion URLs.
//
// Notion's 2025-09 API split databases from data sources. We accept a
// `briefingsDataSourceId` (the underlying data source id, NOT the database id)
// and use `dataSources.query`. To resolve a database id to its data source,
// fetch the database and read `data_sources[0].id` once at boot.

import { Client as NotionClient } from "@notionhq/client";
import type {
  Briefing,
  BriefingSection,
  BriefingsProvider,
  FetchBriefingsInput,
} from "./types";
import { TtlCache } from "./cache";

const DEFAULT_TTL_SECONDS = 300; // 5 min per engineering_plan §4.3

export interface NotionProviderOptions {
  apiKey: string;
  /** Notion data source id (post-2025-09 schema). Optional; provider returns [] when absent. */
  briefingsDataSourceId?: string | null;
  /** Override for tests with an injected client. */
  client?: NotionClient;
}

export class NotionBriefingsProvider implements BriefingsProvider {
  readonly providerName = "notion";
  private readonly client: NotionClient;
  private readonly briefingsDataSourceId: string | null;
  private readonly cache = new TtlCache<Briefing[]>();

  constructor(opts: NotionProviderOptions) {
    this.client = opts.client ?? new NotionClient({ auth: opts.apiKey });
    this.briefingsDataSourceId = opts.briefingsDataSourceId ?? null;
  }

  async fetchBriefings(input: FetchBriefingsInput): Promise<Briefing[]> {
    const ttlMs = (input.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;
    const limit = input.limit ?? 5;
    const cacheKey = `briefings:${input.workspaceId}:${limit}`;

    const cached = this.cache.get(cacheKey);
    if (cached && !cached.isStale) {
      return cached.value.map((b) => ({
        ...b,
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
        isStale: false,
      }));
    }

    if (!this.briefingsDataSourceId) {
      // Notion data source not configured — serve cached-stale if present, else empty.
      // Customer surface renders an empty-state message; never blank-screen.
      if (cached) {
        return cached.value.map((b) => ({ ...b, isStale: true }));
      }
      return [];
    }

    try {
      const result = await this.client.dataSources.query({
        data_source_id: this.briefingsDataSourceId,
        filter: {
          property: "Workspace",
          rich_text: { equals: input.workspaceId },
        },
        sorts: [{ property: "Published", direction: "descending" }],
        page_size: limit,
      });

      const briefings: Briefing[] = [];
      for (const r of result.results) {
        if (!isFullPage(r)) continue;
        briefings.push(this.toBriefing(r, input.workspaceId));
      }
      this.cache.set(cacheKey, briefings, ttlMs);
      return briefings.map((b) => ({ ...b, isStale: false }));
    } catch (err) {
      // Per engineering_plan §4.3: never blank-screen on Notion 5xx — serve
      // cached-stale if available; emit a warning otherwise.
      if (cached) {
        return cached.value.map((b) => ({ ...b, isStale: true }));
      }
      console.warn("notion briefings fetch failed", err);
      return [];
    }
  }

  async invalidate(workspaceId: string): Promise<void> {
    for (const key of this.cacheKeysForWorkspace(workspaceId)) {
      this.cache.delete(key);
    }
  }

  private cacheKeysForWorkspace(workspaceId: string): string[] {
    const prefix = `briefings:${workspaceId}:`;
    const keys: string[] = [];
    for (const limit of [1, 5, 10, 25]) {
      keys.push(`${prefix}${limit}`);
    }
    return keys;
  }

  private toBriefing(page: NotionPageLike, workspaceId: string): Briefing {
    const props = page.properties as Record<string, NotionPropertyValue>;
    const title = readTitle(props, "Title") ?? "Daily briefing";
    const publishedAt =
      readDate(props, "Published") ?? page.last_edited_time ?? new Date().toISOString();
    const body = readRichText(props, "Body") ?? "";
    const sections = readSections(props);
    return {
      sourceId: page.id,
      workspaceId,
      title,
      publishedAt,
      body,
      sections,
      fetchedAt: new Date().toISOString(),
      isStale: false,
    };
  }
}

// =============================================================================
// Notion property helpers — kept private. Anyone outside this adapter consumes
// the Briefing shape only.
// =============================================================================

interface NotionPageLike {
  id: string;
  properties: Record<string, unknown>;
  last_edited_time?: string;
}

const isFullPage = (result: unknown): result is NotionPageLike => {
  if (!result || typeof result !== "object") return false;
  const r = result as { object?: unknown; properties?: unknown; id?: unknown };
  return (
    r.object === "page" &&
    typeof r.id === "string" &&
    typeof r.properties === "object" &&
    r.properties !== null
  );
};

type NotionPropertyValue =
  | { type: "title"; title: Array<{ plain_text: string }> }
  | { type: "rich_text"; rich_text: Array<{ plain_text: string }> }
  | { type: "date"; date: { start: string } | null }
  | { type: string };

function readTitle(
  props: Record<string, NotionPropertyValue> | undefined,
  key: string,
): string | null {
  const v = props?.[key];
  if (!v || v.type !== "title") return null;
  const items = (v as { title: Array<{ plain_text: string }> }).title;
  return items.map((t) => t.plain_text).join("") || null;
}

function readRichText(
  props: Record<string, NotionPropertyValue> | undefined,
  key: string,
): string | null {
  const v = props?.[key];
  if (!v || v.type !== "rich_text") return null;
  const items = (v as { rich_text: Array<{ plain_text: string }> }).rich_text;
  return items.map((t) => t.plain_text).join("") || null;
}

function readDate(
  props: Record<string, NotionPropertyValue> | undefined,
  key: string,
): string | null {
  const v = props?.[key];
  if (!v || v.type !== "date") return null;
  return (v as { date: { start: string } | null }).date?.start ?? null;
}

function readSections(
  props: Record<string, NotionPropertyValue> | undefined,
): BriefingSection[] | undefined {
  if (!props) return undefined;
  const sections: BriefingSection[] = [];
  for (const k of Object.keys(props)) {
    if (!k.startsWith("Section:")) continue;
    const heading = k.slice("Section:".length).trim();
    const body = readRichText(props, k);
    if (heading && body) sections.push({ heading, body });
  }
  return sections.length > 0 ? sections : undefined;
}
