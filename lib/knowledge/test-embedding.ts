/**
 * lib/knowledge/test-embedding.ts
 *
 * Deterministic in-memory embedder. Satisfies the two-implementation
 * rule for `IEmbeddingProvider` per `feedback_runner_portability.md` +
 * `project_living_portable_architecture.md`.
 *
 * The vector is derived from a stable hash of the text + an optional
 * seed map for "this exact text should embed to this exact vector"
 * scenarios. Useful when a test asserts on cosine-distance ordering
 * (the seed map gives precise control over which doc ranks first).
 *
 * Defaults to 1536 dimensions to match the production OpenAI provider,
 * so the test embedder can drop into a pgvector store without dimension
 * conflicts. Override `dimensions` only for very specific tests that
 * exercise dim-mismatch error paths.
 */

import { createHash } from 'node:crypto';
import {
  EmbeddingValue,
  IEmbeddingProvider,
  KnowledgeResult,
  knowledgeError,
  knowledgeOk,
} from './types';

export interface TestEmbeddingSeed {
  /** Text → fixed vector. The vector MUST be the same length as `dimensions`. */
  [text: string]: number[];
}

export interface TestEmbeddingProviderConfig {
  model?: string;
  dimensions?: number;
  /** Pre-seeded text → vector overrides. */
  seed?: TestEmbeddingSeed;
}

const DEFAULT_DIMENSIONS = 1536;

export class TestEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'test' as const;
  readonly model: string;
  readonly dimensions: number;
  private readonly seed: TestEmbeddingSeed;

  constructor(config: TestEmbeddingProviderConfig = {}) {
    this.model = config.model ?? 'test-embedding-deterministic';
    this.dimensions = config.dimensions ?? DEFAULT_DIMENSIONS;
    this.seed = config.seed ?? {};
  }

  /** Seed a fixed embedding for a specific input text. Vector length must
   *  match `this.dimensions`. */
  seedText(text: string, vector: number[]): void {
    if (vector.length !== this.dimensions) {
      throw new Error(
        `TestEmbeddingProvider.seedText: vector length ${vector.length} != dimensions ${this.dimensions}`,
      );
    }
    this.seed[text] = vector;
  }

  async embed(text: string): Promise<KnowledgeResult<EmbeddingValue>> {
    if (typeof text !== 'string' || text.length === 0) {
      return knowledgeError(
        'INVALID_ARGUMENT',
        'TestEmbeddingProvider.embed received an empty string.',
      );
    }
    const seeded = this.seed[text];
    if (seeded) {
      return knowledgeOk({
        vector: seeded.slice(),
        model: this.model,
        usage: { promptTokens: null },
      });
    }
    return knowledgeOk({
      vector: hashToVector(text, this.dimensions),
      model: this.model,
      usage: { promptTokens: null },
    });
  }
}

/**
 * Hash-derived vector: SHA-256 the text, then unroll the digest bytes
 * (cycling as needed) into floats in [-1, 1] and normalize. Stable across
 * processes and Node versions. NOT a real embedding — useful only for
 * tests that need deterministic round-trip behavior.
 */
export function hashToVector(text: string, dimensions: number): number[] {
  const digest = createHash('sha256').update(text, 'utf8').digest();
  const v: number[] = new Array(dimensions);
  for (let i = 0; i < dimensions; i += 1) {
    const byte = digest[i % digest.length];
    // Map [0, 255] → [-1, 1].
    v[i] = (byte / 127.5) - 1;
  }
  return normalize(v);
}

function normalize(v: number[]): number[] {
  let sum = 0;
  for (let i = 0; i < v.length; i += 1) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (norm === 0) return v;
  const out = new Array(v.length);
  for (let i = 0; i < v.length; i += 1) out[i] = v[i] / norm;
  return out;
}
