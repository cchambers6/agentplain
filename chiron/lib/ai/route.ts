// Tiered model routing. Tiers are capability labels — "heavy",
// "conversational", "lightweight" — never vendor names. The vendor/model
// binding lives HERE and in prices.ts only; agent code asks for a tier.
// (Vendor names may appear in internal code/comments, never in parent-facing
// copy — see docs/products/ai-headmaster/2026-07-10-poc-plan/06-cost-architecture.md.)

import { withCaching, type CacheableMessage } from "./cache";
import { recordCall, type AgentName } from "./meter";

export type Tier = "heavy" | "conversational" | "lightweight";

interface TierConfig {
  apiKeyEnv: string;
  model: string; // provider model id — internal only
  baseUrl: string;
  maxOutputTokens: number;
}

// Model ids per tier. Heavy = deep weekly reasoning; conversational = daily
// debrief chat; lightweight = triage/brief generation that gates the heavy tier.
const TIERS: Record<Tier, TierConfig> = {
  heavy: {
    apiKeyEnv: "AI_HEAVY_API_KEY",
    model: "claude-opus-4-8",
    baseUrl: "https://api.anthropic.com/v1/messages",
    maxOutputTokens: 8192,
  },
  conversational: {
    apiKeyEnv: "AI_CONVERSATIONAL_API_KEY",
    model: "claude-sonnet-5",
    baseUrl: "https://api.anthropic.com/v1/messages",
    maxOutputTokens: 4096,
  },
  lightweight: {
    apiKeyEnv: "AI_LIGHTWEIGHT_API_KEY",
    model: "claude-haiku-4-5-20251001",
    baseUrl: "https://api.anthropic.com/v1/messages",
    maxOutputTokens: 2048,
  },
};

export interface AiCallOptions {
  tier: Tier;
  agent: AgentName;
  familyId: string;
  system: CacheableMessage[]; // stable→volatile order; cache breakpoints applied
  messages: { role: "user" | "assistant"; content: string }[];
  stream?: boolean;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AiResult {
  text: string;
  usage: AiUsage;
}

export function tierConfigured(tier: Tier): boolean {
  return Boolean(process.env[TIERS[tier].apiKeyEnv]);
}

/**
 * One completion call against the given tier. Applies the prompt-caching
 * wrapper, records usage to the cost meter, returns text + usage.
 *
 * M1 ships the seam; M2+ agents are the callers. If the tier's key is not
 * configured the call throws — callers surface a degraded state, never a
 * silent fallback.
 */
export async function aiCall(opts: AiCallOptions): Promise<AiResult> {
  const cfg = TIERS[opts.tier];
  const apiKey = process.env[cfg.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`AI tier "${opts.tier}" is not configured (${cfg.apiKeyEnv} unset)`);
  }

  const body = {
    model: cfg.model,
    max_tokens: cfg.maxOutputTokens,
    system: withCaching(opts.system),
    messages: opts.messages,
  };

  const res = await fetch(cfg.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI call failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  const usage: AiUsage = {
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: data.usage?.cache_creation_input_tokens ?? 0,
  };

  await recordCall({
    familyId: opts.familyId,
    agent: opts.agent,
    tier: opts.tier,
    model: cfg.model,
    usage,
  });

  const text = Array.isArray(data.content)
    ? data.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("")
    : "";

  return { text, usage };
}
