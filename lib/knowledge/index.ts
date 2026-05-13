/**
 * lib/knowledge/index.ts
 *
 * Knowledge substrate entrypoint. The MCP route, the seed script, and
 * downstream skills get their stores + embedders from here. No other
 * file constructs a concrete provider/store directly.
 *
 * Selection rules:
 *
 *   `KNOWLEDGE_EMBEDDING_PROVIDER`
 *     `openai` (default when `OPENAI_API_KEY` is set) → OpenAIEmbeddingProvider
 *     `test`                                          → TestEmbeddingProvider
 *     unset + no OPENAI_API_KEY                       → TestEmbeddingProvider (heuristic)
 *
 *   `KNOWLEDGE_STORE`
 *     `pgvector` (default)                            → PgvectorKnowledgeStore
 *     `test`                                          → TestKnowledgeStore
 *
 * The test-fallback when OPENAI_API_KEY is unset mirrors
 * `lib/llm/index.ts`'s pattern: keep the chain runnable on mock data so
 * the value loop stays demonstrable until the prod key lands. The store
 * logs which provider/store is active so a "why are my results random"
 * debug session is one log line away from the answer.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the only file outside
 * the impls that resolves to the concrete classes.
 *
 * Per `feedback_runner_portability.md`: every consumer of the substrate
 * speaks `IEmbeddingProvider` and `IKnowledgeStore` only. Swapping to
 * Pinecone is a new `IKnowledgeStore` impl, not a callsite rewrite.
 */

import { env } from '../env';
import { RlsContext } from '../db/rls';
import { OpenAIEmbeddingProvider } from './openai-embedding';
import { PgvectorKnowledgeStore } from './pgvector-store';
import { TestEmbeddingProvider } from './test-embedding';
import { TestKnowledgeStore } from './test-store';
import type { IEmbeddingProvider, IKnowledgeStore } from './types';

let cachedEmbedder: IEmbeddingProvider | null = null;
let cachedTestStore: TestKnowledgeStore | null = null;

export function getEmbeddingProvider(): IEmbeddingProvider {
  if (cachedEmbedder) return cachedEmbedder;
  cachedEmbedder = buildEmbeddingProvider();
  return cachedEmbedder;
}

function buildEmbeddingProvider(): IEmbeddingProvider {
  const mode = env.knowledgeEmbeddingProvider();
  if (mode === 'test') return new TestEmbeddingProvider();
  const apiKey = env.openaiApiKey();
  if (!apiKey) return new TestEmbeddingProvider();
  return new OpenAIEmbeddingProvider({
    apiKey,
    model: env.knowledgeEmbeddingModel(),
  });
}

export function resetEmbeddingProviderForTests(provider?: IEmbeddingProvider): void {
  cachedEmbedder = provider ?? null;
}

export function resetKnowledgeStoreForTests(): void {
  cachedTestStore = null;
}

/**
 * Build a knowledge store bound to a specific RLS context.
 *
 * `pgvector` mode: cheap per-request construction — the underlying
 * PrismaClient is shared, the store wraps each method in `withRls(ctx)`.
 *
 * `test` mode: a process-singleton in-memory store, repointed to each
 * call's context. Singleton-ness is required so writes through one
 * factory call show up in reads from a later call within the same
 * process — the MCP route builds separate stores for write vs. read
 * paths.
 */
export function getKnowledgeStore(rlsContext: RlsContext): IKnowledgeStore {
  const mode = env.knowledgeStore();
  const embedder = getEmbeddingProvider();
  if (mode === 'test') {
    if (!cachedTestStore) cachedTestStore = new TestKnowledgeStore(embedder);
    cachedTestStore.setContext({
      workspaceId: rlsContext.workspaceId,
      isOperator: rlsContext.isOperator,
    });
    return cachedTestStore;
  }
  return new PgvectorKnowledgeStore({ embedder, rlsContext });
}

export {
  OpenAIEmbeddingProvider,
  PgvectorKnowledgeStore,
  TestEmbeddingProvider,
  TestKnowledgeStore,
};
export type {
  IEmbeddingProvider,
  IKnowledgeStore,
  KnowledgeError,
  KnowledgeErrorCode,
  KnowledgeResult,
  KnowledgeSearchHit,
  KnowledgeSearchInput,
  KnowledgeUpsertInput,
  KnowledgeUpsertResult,
  KnowledgeDeleteInput,
  EmbeddingValue,
  EmbeddingUsage,
} from './types';
export { knowledgeOk, knowledgeError } from './types';
export { hashToVector } from './test-embedding';
export { TEST_OPERATOR_CONTEXT } from './test-store';
