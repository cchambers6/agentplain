/**
 * lib/knowledge/openai-embedding.ts
 *
 * OpenAI implementation of `IEmbeddingProvider`. Calls
 * `POST /v1/embeddings` directly via `fetch` — no SDK dependency. Per
 * `feedback_no_silent_vendor_lock.md`, this is the ONLY file in the
 * codebase that knows OpenAI's URL or request shape.
 *
 * Default model: `text-embedding-3-small`. Per OpenAI's pricing page
 * (https://openai.com/api/pricing/ — read 2026-05-12), this model
 * emits 1536-dim vectors at $0.02 / 1M input tokens — same dim as the
 * deprecated `text-embedding-ada-002` (so storage migrations stay
 * trivial) at ~5x lower cost. The model can be overridden via
 * `OPENAI_EMBEDDING_MODEL`; the store cross-checks the emitted dim
 * against its configured dim and errors loudly on mismatch.
 *
 * Cost projection at the seed-pass scale (≤ 100 documents,
 * ~30k tokens total): $0.0006 — well under the $50 hard-stop the
 * project_knowledge_substrate spec requires. At a steady-state of
 * 5,000 customer-facing queries/day × ~200 tokens each = 1M tokens/day,
 * the monthly bill lands at ~$0.60. Bounded.
 */

import {
  EmbeddingValue,
  IEmbeddingProvider,
  KnowledgeResult,
  knowledgeError,
  knowledgeOk,
} from './types';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const ENDPOINT = 'https://api.openai.com/v1/embeddings';

/**
 * Minimal HTTP client surface. Production wiring uses `globalThis.fetch`;
 * tests can pass a stub returning canned responses without spinning up
 * a server.
 */
export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface OpenAIEmbeddingProviderConfig {
  apiKey: string;
  model?: string;
  dimensions?: number;
  /** Override for tests. Defaults to global `fetch`. */
  fetchImpl?: FetchLike;
  /** Override for tests. Defaults to `ENDPOINT`. */
  endpoint?: string;
}

interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{ object: string; index: number; embedding: number[] }>;
  model: string;
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

interface OpenAIErrorEnvelope {
  error?: { message?: string; type?: string; code?: string | null };
}

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'openai' as const;
  readonly model: string;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly endpoint: string;

  constructor(config: OpenAIEmbeddingProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.dimensions = config.dimensions ?? DEFAULT_DIMENSIONS;
    this.fetchImpl = config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.endpoint = config.endpoint ?? ENDPOINT;
  }

  async embed(text: string): Promise<KnowledgeResult<EmbeddingValue>> {
    if (!this.apiKey) {
      return knowledgeError(
        'NOT_CONFIGURED',
        'OpenAIEmbeddingProvider has no API key configured. Set OPENAI_API_KEY.',
      );
    }
    if (typeof text !== 'string' || text.length === 0) {
      return knowledgeError(
        'INVALID_ARGUMENT',
        'OpenAIEmbeddingProvider.embed received an empty string.',
      );
    }

    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: 'float',
        }),
      });
    } catch (err) {
      return knowledgeError(
        'NETWORK',
        `OpenAI embeddings request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const bodyText = await response.text();
    if (!response.ok) {
      return mapHttpError(response.status, bodyText);
    }

    let parsed: OpenAIEmbeddingResponse;
    try {
      parsed = JSON.parse(bodyText) as OpenAIEmbeddingResponse;
    } catch {
      return knowledgeError('MALFORMED_RESPONSE', 'OpenAI embeddings response was not JSON.', {
        status: response.status,
      });
    }

    if (!Array.isArray(parsed.data) || parsed.data.length === 0 || !Array.isArray(parsed.data[0].embedding)) {
      return knowledgeError('MALFORMED_RESPONSE', 'OpenAI embeddings response missing data[0].embedding.');
    }
    const vector = parsed.data[0].embedding;
    if (vector.length !== this.dimensions) {
      return knowledgeError(
        'DIMENSION_MISMATCH',
        `OpenAI returned ${vector.length}-dim vector but provider configured for ${this.dimensions}.`,
      );
    }
    return knowledgeOk({
      vector,
      model: parsed.model ?? this.model,
      usage: {
        promptTokens:
          typeof parsed.usage?.prompt_tokens === 'number' ? parsed.usage.prompt_tokens : null,
      },
    });
  }
}

function mapHttpError(status: number, body: string): KnowledgeResult<EmbeddingValue> {
  let reference: string | undefined;
  try {
    const env = JSON.parse(body) as OpenAIErrorEnvelope;
    if (env?.error?.message) reference = env.error.message;
  } catch {
    reference = body.slice(0, 200);
  }
  if (status === 401 || status === 403) {
    return knowledgeError('AUTHENTICATION', `OpenAI ${status}`, { status, reference });
  }
  if (status === 429) {
    return knowledgeError('RATE_LIMITED', `OpenAI ${status}`, { status, reference });
  }
  if (status === 400) {
    return knowledgeError('INVALID_ARGUMENT', `OpenAI ${status}`, { status, reference });
  }
  return knowledgeError('UPSTREAM_ERROR', `OpenAI ${status}`, { status, reference });
}
