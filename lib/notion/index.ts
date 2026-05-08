// Briefings boundary entry point.

import { env } from "../env";
import { NotionBriefingsProvider } from "./notion-provider";
import { TestBriefingsProvider } from "./test-provider";
import type { BriefingsProvider } from "./types";

let cached: BriefingsProvider | null = null;

export function getBriefingsProvider(): BriefingsProvider {
  if (cached) return cached;
  switch (env.briefingsProvider()) {
    case "test":
      cached = new TestBriefingsProvider();
      break;
    case "notion":
    default:
      cached = new NotionBriefingsProvider({
        apiKey: env.notionApiKey(),
        briefingsDataSourceId: env.notionBriefingsDataSourceId(),
      });
      break;
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
