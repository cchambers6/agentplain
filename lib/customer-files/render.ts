/**
 * lib/customer-files/render.ts
 *
 * Render a list of CustomerContextSnippet into a prompt-ready block.
 * The composer (lib/skills/prompts/compose.ts) inlines the result into
 * the draft + coordinate system prompts so the prod LLM and the test
 * heuristic both see the workspace's actual file context.
 *
 * Returns an EMPTY string when there are no snippets — the composer
 * skips the wrap when both prefs and context are blank.
 */

export interface CustomerContextSnippet {
  title: string;
  body: string;
  sourceUrl: string | null;
  /** Cosine similarity, 1 = perfect match. Surfaced in the block so the
   *  model can weigh higher-similarity snippets more heavily. */
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface RenderCustomerContextOptions {
  /** Per-snippet body cap to keep the prompt bounded. Default 800. */
  bodyCharCap?: number;
  /** Hard cap on snippets rendered. Default 5. */
  maxSnippets?: number;
}

export function renderCustomerContextBlock(
  snippets: CustomerContextSnippet[],
  opts: RenderCustomerContextOptions = {},
): string {
  if (snippets.length === 0) return '';
  const bodyCap = opts.bodyCharCap ?? 800;
  const maxN = opts.maxSnippets ?? 5;
  const lines: string[] = [
    // These snippets are excerpts from the broker-owner's OWN files
    // (past replies, listings, playbooks, templates). They are the
    // single best signal for how THIS customer writes — treat them as
    // voice exemplars, not just facts. The directive below is the
    // product differentiator: drafts that sound like the customer, not
    // like generic boilerplate.
    'WORKSPACE FILE CONTEXT — excerpts from the broker-owner’s own files (past messages, listings, playbooks, templates). These are the gold standard for how THIS customer writes:',
    '  • VOICE: Follow the tone, structure, and phrasings of these examples. Match THIS customer’s voice — do NOT fall back on generic, paraphrased boilerplate.',
    '  • CITE: Reuse or reference at least one of these examples when applicable.',
    '  • GROUND: Anchor specifics (names, numbers, terms) to these snippets; never invent facts that contradict them.',
  ];
  for (const s of snippets.slice(0, maxN)) {
    lines.push('');
    const similarity = `similarity=${s.similarity.toFixed(2)}`;
    const titleLine = s.sourceUrl
      ? `— ${s.title} (${similarity}; ${s.sourceUrl})`
      : `— ${s.title} (${similarity})`;
    lines.push(titleLine);
    lines.push(truncate(s.body.trim(), bodyCap));
  }
  return lines.join('\n');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
