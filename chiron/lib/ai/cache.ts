// Prompt-caching wrapper. Callers pass system blocks in stable→volatile
// order; the last block marked `stable: true` gets the cache breakpoint.
// Rule (from the #380 cost plan, doc 06): nothing timestamped or random may
// appear before the breakpoint, or the cache silently never hits.

export interface CacheableMessage {
  text: string;
  /** Part of the stable prefix (system prompt, philosophy pack, day plan). */
  stable?: boolean;
}

interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export function withCaching(blocks: CacheableMessage[]): SystemBlock[] {
  const lastStable = blocks.reduce(
    (acc, b, i) => (b.stable ? i : acc),
    -1,
  );
  return blocks.map((b, i) => ({
    type: "text" as const,
    text: b.text,
    ...(i === lastStable ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}
