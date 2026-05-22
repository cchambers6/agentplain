// Briefings boundary entry point.

import { env } from "../env";
import { NotionBriefingsProvider } from "./notion-provider";
import { TestBriefingsProvider } from "./test-provider";
import type { BriefingsProvider } from "./types";

let cached: BriefingsProvider | null = null;
let warnedAboutMissingNotionKey = false;

export function getBriefingsProvider(): BriefingsProvider {
  if (cached) return cached;
  switch (env.briefingsProvider()) {
    case "test":
      cached = new TestBriefingsProvider();
      break;
    case "notion":
    default: {
      // Briefings are additive, not core. If no Notion key is configured,
      // degrade to the empty provider rather than throwing — otherwise a
      // missing optional key takes down the whole workspace overview, which
      // calls getBriefingsProvider() eagerly at render. The TestBriefings
      // provider returns [] when unseeded, so the briefings card shows its
      // honest empty state instead of fabricating content.
      const apiKey = env.notionApiKeyOptional();
      if (!apiKey) {
        if (!warnedAboutMissingNotionKey) {
          warnedAboutMissingNotionKey = true;
          console.warn(
            "[briefings] NOTION_API_KEY is not set; briefings degrade to empty. " +
              "Set NOTION_API_KEY or BRIEFINGS_PROVIDER=test to silence this.",
          );
        }
        cached = new TestBriefingsProvider();
        break;
      }
      cached = new NotionBriefingsProvider({
        apiKey,
        briefingsDataSourceId: env.notionBriefingsDataSourceId(),
      });
      break;
    }
  }
  return cached;
}

export function __setBriefingsProviderForTests(
  p: BriefingsProvider | null,
): void {
  cached = p;
}

export type {
  Briefing,
  BriefingSection,
  BriefingsProvider,
  FetchBriefingsInput,
} from "./types";
export { NotionBriefingsProvider } from "./notion-provider";
export { TestBriefingsProvider } from "./test-provider";
export { TtlCache } from "./cache";
