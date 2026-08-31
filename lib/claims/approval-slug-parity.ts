/**
 * lib/claims/approval-slug-parity.ts
 *
 * Check 4 — consumer `agentSlug` filters vs. the slugs sinks actually write.
 *
 * THE BUG THIS EXISTS TO STOP (found 2026-08-30):
 * `lib/skills/finance-pulse-general/activity-snapshot.ts` counted
 * invoice-chase output with `agentSlug: 'invoice-chasing-realestate'`, while
 * the only producer that ever fires — `invoice-chase-general` — writes
 * `agentSlug: 'invoice-chase-general'`. The weekly finance pulse therefore
 * rendered "Invoice-chase drafts produced: 0" on every workspace, always.
 *
 * Every existing gate passed. Both slugs are legal strings, `agentSlug` is an
 * unconstrained column, and a `count()` over a slug nothing writes returns 0
 * rather than erroring. There is no runtime signal at all — the number is
 * simply wrong, forever, and it is customer-facing.
 *
 * WHY THIS CHECK IS STRUCTURAL AND NOT A PINNED STRING:
 * A test asserting `agentSlug === 'invoice-chase-general'` would have passed
 * against the bug just as happily as against the fix — it pins today's answer,
 * not the property that makes the answer right. The property is:
 *
 *     every statically-known slug a consumer FILTERS on must be a slug some
 *     sink WRITES.
 *
 * Both sides are derived from the source tree by `extractApprovalSlugUsage`.
 * Neither side is a fixture list, so a new sink, a renamed slug, or a new
 * consumer is picked up with no edit here — and a consumer pointed at a slug
 * that nothing produces fails the gate the day it is written.
 *
 * WHAT THIS CHECK DOES **NOT** COVER — the sibling `kind` column:
 * `WorkApprovalQueueItem.kind` has the identical failure mode (a filter on a
 * `kind` no sink writes returns 0 forever) and is NOT guarded here. Measured
 * 2026-08-31 against the post-#468 tree: **17 `kind` filter sites on
 * `WorkApprovalQueueItem` across 8 distinct expressions** — `ACTIVATION_DRAFT`
 * (3), file-local `KIND` (4: portal ×2, voice/recording ×2),
 * `'PLAINO_INSTRUCTION'` (3), `"PLAINO_INSTRUCTION"` (1), `'LEAD_TRIAGE'` (2),
 * `SUPPORT_HANDLER_KIND` (2), `SUPPORT_REPLY_KIND` (1),
 * `"SUPPORT_HANDLER_REPLY_DRAFT"` (1). PR #468's body said "12 sites"; that
 * count missed `fleet-health-check.ts:375`, both `LEAD_TRIAGE` dedup guards
 * and `talk/page.tsx:163`, saw only 2 of the 4 file-local `KIND` sites, and
 * counted `support/prisma-resolve-store.ts:57` — which is an in-JS
 * `item.kind !== SUPPORT_REPLY_KIND` comparison, not a `where` filter at all.
 * The corrected figure is recorded here rather than in a merged PR body so it
 * is somewhere a future reader will actually look. Extending the extractor to
 * the `kind` column is deliberately out of scope for now; this note exists so
 * the gap is stated rather than assumed covered.
 *
 * Per `lib/claims/types.ts`: the checker is PURE and dependency-injected. The
 * extractor takes file contents as an argument rather than reading the disk,
 * which is what makes the deliberate-failure fixtures in the test possible.
 */

import type { ClaimViolation } from './types';

/** One source file, injected. `path` is repo-relative and appears in the
 *  violation subject, so it must be stable (posix separators). */
export interface SourceFileLike {
  path: string;
  text: string;
}

/** An object literal that WRITES a `WorkApprovalQueueItem` row, with a slug
 *  we could resolve to a string at rest. */
export interface ProducedSlug {
  path: string;
  line: number;
  slug: string;
}

/** A `where` clause that FILTERS `agentSlug`, with a slug we could resolve. */
export interface ConsumedSlug {
  path: string;
  line: number;
  slug: string;
}

/**
 * An `agentSlug:` site the checker declines to judge. Two reasons:
 *
 *   `role: 'producer' | 'consumer'` — the site's role is known, but the slug
 *     is computed at runtime (`args.skillSlug`, a template literal,
 *     `{ in: [...] }`), so there is no string to compare.
 *
 *   `role: 'unclassified'` — the slug may well be a plain literal, but the
 *     site sits in an object literal that is neither a `where` clause nor a
 *     row builder (no `refTable` sibling). The commonest real shape is a
 *     filter hoisted to a variable:
 *
 *         const filter = { agentSlug: 'x' };
 *         await tx.workApprovalQueueItem.count({ where: filter });
 *
 *     The frame label is `filter`, not `where`, so the lexical scan cannot
 *     tell that from an output mapping (`{ agentSlug: row.agentSlug }`).
 *     Judging it would invent a fact; DROPPING it would shrink the checked
 *     denominator with no signal, which is the failure mode that actually
 *     matters — the gate stays green while it stops looking. So it is carried
 *     out here instead, with `container` naming the identifier before the `{`
 *     so a human can classify it in one glance.
 *
 * Nothing in `dynamic` is ever a violation. It exists so the non-vacuity test
 * can prove the extractor is not silently discarding the interesting cases.
 */
export interface DynamicSlugRef {
  path: string;
  line: number;
  role: 'producer' | 'consumer' | 'unclassified';
  expression: string;
  /** The identifier immediately preceding the enclosing `{` (`where`,
   *  `filter`, `data`, `''` for an anonymous literal). Triage aid only. */
  container: string;
  /** Present when the expression DID resolve to a string but the site's role
   *  did not. `undefined` means the expression itself was unresolvable. */
  slug?: string;
}

export interface ApprovalSlugUsage {
  producers: ProducedSlug[];
  consumers: ConsumedSlug[];
  dynamic: DynamicSlugRef[];
}

// ─────────────────────────────────────────────────────────────────────────
// The checker
// ─────────────────────────────────────────────────────────────────────────

/**
 * A consumer filter is a promise that rows with that slug exist. When no sink
 * writes it, the promise is unkeepable and the query is a permanent zero.
 *
 * Only statically-resolvable slugs are judged. A filter built from a runtime
 * value (`agentSlug: args.skillSlug`) is a different, weaker coupling — it
 * cannot be checked here without executing the caller, and pretending
 * otherwise would make this gate arguable. `dynamic` carries those out so the
 * omission is visible rather than silent.
 */
export function checkApprovalSlugParity(
  usage: ApprovalSlugUsage,
): ClaimViolation[] {
  const produced = new Set(usage.producers.map((p) => p.slug));
  const violations: ClaimViolation[] = [];

  for (const consumer of usage.consumers) {
    if (produced.has(consumer.slug)) continue;
    violations.push({
      check: 'approval-slug-parity',
      // Subject omits the line number on purpose: it is the ratchet key, and
      // a key that moves when the file is reformatted would silently stop
      // matching an accepted entry.
      subject: `${consumer.path}:${consumer.slug}`,
      detail:
        `${consumer.path}:${consumer.line} filters WorkApprovalQueueItem on ` +
        `agentSlug "${consumer.slug}", which NO sink writes. The query is not ` +
        `an error — it returns 0 forever, and whatever surface renders that ` +
        `count is quietly wrong on every workspace.`,
      remedy:
        `Point the filter at a slug some sink writes (import the exported ` +
        `*_AGENT_SLUG constant from that sink rather than retyping the string ` +
        `— a second string literal is how this defect happens), or add the ` +
        `sink that produces "${consumer.slug}".`,
    });
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────
// The extractor
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lexical scan for the two shapes, using the repo's own conventions:
 *
 *   PRODUCER — an `agentSlug:` key in an object literal that also carries a
 *              `refTable:` key. Every `WorkApprovalQueueItem` create row in
 *              this repo carries `refTable`; nothing else does. This is what
 *              makes the producer side derived-from-the-sinks rather than a
 *              list of blessed slugs.
 *   CONSUMER — an `agentSlug:` key with a `where` object anywhere above it.
 *
 * `select: { agentSlug: true }` projections and interface members are dropped
 * outright — `agentSlug: true` / `agentSlug: string` names a column to read or
 * a type, and neither promises nor produces rows.
 *
 * Everything else that matches neither shape — output mappings, and crucially
 * a `where` object hoisted to a differently-named variable — is NOT dropped.
 * It goes to `dynamic` with `role: 'unclassified'`. See `DynamicSlugRef`: the
 * hoisted-filter case is invisible to a lexical `where`-label scan, and a
 * check whose denominator can shrink without a signal is worse than one that
 * reports what it could not classify.
 *
 * Identifier right-hand sides resolve against `const NAME = '...'` in the
 * same file, then by FOLLOWING THE IMPORT to the declaring module, and only
 * then against a repo-wide table by name — and that last step is taken only
 * when the name is unambiguous. FOUR different files declare a private
 * `const AGENT_SLUG` with four different values —
 * `lib/integrations/docusign-mcp/approval-gate-prisma.ts`
 * (`docusign-approval-gate`), `lib/portal/owner-approval-gate-prisma.ts`
 * (`portal-owner-approval-gate`), `lib/voice/recording.ts`
 * (`voice-recording-consent`) and `lib/voice/transcript-actions.ts`
 * (`voice-transcript-actions`) — and `PULSE_AGENT_SLUG`
 * exists twice with two different values (the sweep's ACTIVATION slug
 * `analytics-weekly-pulse` and the sink's ROW slug
 * `analytics-weekly-pulse-general` — two namespaces, one name). Resolving
 * either by name alone would invent a fact, so the import edge is what makes
 * those sinks resolvable instead of merely ambiguous.
 */
export function extractApprovalSlugUsage(
  files: readonly SourceFileLike[],
): ApprovalSlugUsage {
  const perFileImports = new Map<string, Map<string, string>>();
  const tables: ResolutionTables = {
    consts: new Map(),
    reExports: new Map(),
    global: new Map(),
  };

  for (const file of files) {
    const consts = collectStringConsts(file.text);
    tables.consts.set(file.path, consts);
    tables.reExports.set(file.path, collectReExports(file.path, file.text));
    perFileImports.set(file.path, collectNamedImports(file.path, file.text));
    for (const [name, value] of consts) {
      const seen = tables.global.get(name) ?? new Set<string>();
      seen.add(value);
      tables.global.set(name, seen);
    }
  }

  const usage: ApprovalSlugUsage = {
    producers: [],
    consumers: [],
    dynamic: [],
  };

  for (const file of files) {
    const local = tables.consts.get(file.path) ?? new Map<string, string>();
    const imports = perFileImports.get(file.path) ?? new Map<string, string>();
    for (const site of scanAgentSlugSites(file.text)) {
      const role = site.inWhere
        ? ('consumer' as const)
        : site.siblingKeys.has('refTable')
          ? ('producer' as const)
          : ('unclassified' as const);

      const slug = resolveExpression(site.expression, local, imports, tables);

      // Carried out, never dropped. An unclassified site is not a violation,
      // but a site that vanishes is a hole in the denominator nobody can see.
      if (role === 'unclassified' || slug === null) {
        usage.dynamic.push({
          path: file.path,
          line: site.line,
          role,
          expression: site.expression,
          container: site.containerLabel,
          ...(slug === null ? {} : { slug }),
        });
        continue;
      }
      const hit = { path: file.path, line: site.line, slug };
      if (role === 'producer') usage.producers.push(hit);
      else usage.consumers.push(hit);
    }
  }

  return usage;
}

/** `const X = 'lit'` / `export const X: T = "lit"`, value optionally wrapped
 *  onto the next line (the repo does this when the slug is long). */
function collectStringConsts(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const re =
    /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:\r?\n\s*)?(['"])((?:[^'"\\]|\\.)*)\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.set(m[1], m[3]);
  return out;
}

/**
 * `import { A, B as C } from '<spec>'` → imported name → the repo-relative
 * module path the name came from. `@/x` is the repo-root alias; `./x` and
 * `../x` resolve against the importing file's directory.
 */
function collectNamedImports(
  fromPath: string,
  text: string,
): Map<string, string> {
  const out = new Map<string, string>();
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const target = resolveModulePath(fromPath, m[2]);
    if (!target) continue;
    for (const clause of m[1].split(',')) {
      const parts = clause.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
      const localName = (parts[1] ?? parts[0]).trim();
      const sourceName = parts[0].trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(localName)) continue;
      // Keyed by the LOCAL name; the source name is recovered on lookup.
      out.set(localName, `${target}#${sourceName}`);
    }
  }
  return out;
}

/** What a module hands onward without declaring: `export { X } from './y'`
 *  and `export * from './y'`. Consumers import slug constants through the
 *  skill's `index.ts` barrel, so without this edge the constant is
 *  unresolvable and a correctly-written consumer looks dynamic. */
interface ReExports {
  named: Map<string, string>;
  wildcards: string[];
}

function collectReExports(fromPath: string, text: string): ReExports {
  const named = new Map<string, string>();
  const wildcards: string[] = [];

  const namedRe =
    /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = namedRe.exec(text)) !== null) {
    const target = resolveModulePath(fromPath, m[2]);
    if (!target) continue;
    for (const clause of m[1].split(',')) {
      const parts = clause.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
      const exportedName = (parts[1] ?? parts[0]).trim();
      const sourceName = parts[0].trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(exportedName)) continue;
      named.set(exportedName, `${target}#${sourceName}`);
    }
  }

  const starRe = /export\s+\*\s+from\s*['"]([^'"]+)['"]/g;
  while ((m = starRe.exec(text)) !== null) {
    const target = resolveModulePath(fromPath, m[1]);
    if (target) wildcards.push(target);
  }

  return { named, wildcards };
}

/** Repo-relative, posix, WITHOUT extension. null for bare package specs. */
function resolveModulePath(fromPath: string, spec: string): string | null {
  if (spec.startsWith('@/')) return normalizeSegments(spec.slice(2).split('/'));
  if (!spec.startsWith('.')) return null;
  const dir = fromPath.split('/').slice(0, -1);
  return normalizeSegments([...dir, ...spec.split('/')]);
}

function normalizeSegments(segments: readonly string[]): string {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

interface ResolutionTables {
  consts: Map<string, Map<string, string>>;
  reExports: Map<string, ReExports>;
  global: Map<string, Set<string>>;
}

function moduleCandidates(modulePath: string): string[] {
  return [
    `${modulePath}.ts`,
    `${modulePath}.tsx`,
    `${modulePath}/index.ts`,
    `${modulePath}/index.tsx`,
  ];
}

/** Follow `modulePath`'s declarations, then its re-export edges, for `name`.
 *  `seen` bounds the walk — a barrel cycle must not hang the gate. */
function lookupExportedConst(
  modulePath: string,
  name: string,
  tables: ResolutionTables,
  seen: Set<string>,
): string | null {
  for (const candidate of moduleCandidates(modulePath)) {
    const consts = tables.consts.get(candidate);
    if (!consts) continue;

    const key = `${candidate}#${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const direct = consts.get(name);
    if (direct !== undefined) return direct;

    const reExports = tables.reExports.get(candidate);
    if (!reExports) continue;

    const forwarded = reExports.named.get(name);
    if (forwarded) {
      const hash = forwarded.lastIndexOf('#');
      const hit = lookupExportedConst(
        forwarded.slice(0, hash),
        forwarded.slice(hash + 1),
        tables,
        seen,
      );
      if (hit !== null) return hit;
    }
    for (const wildcard of reExports.wildcards) {
      const hit = lookupExportedConst(wildcard, name, tables, seen);
      if (hit !== null) return hit;
    }
  }
  return null;
}

/** null = not statically resolvable. */
function resolveExpression(
  expression: string,
  local: Map<string, string>,
  imports: Map<string, string>,
  tables: ResolutionTables,
): string | null {
  const literal = /^(['"])((?:[^'"\\]|\\.)*)\1$/.exec(expression);
  if (literal) return literal[2];

  if (!/^[A-Za-z_$][\w$]*$/.test(expression)) return null;

  const localHit = local.get(expression);
  if (localHit !== undefined) return localHit;

  // Follow the import edge before falling back to name matching. This is what
  // disambiguates the two `PULSE_AGENT_SLUG`s.
  const imported = imports.get(expression);
  if (imported) {
    const hash = imported.lastIndexOf('#');
    return lookupExportedConst(
      imported.slice(0, hash),
      imported.slice(hash + 1),
      tables,
      new Set(),
    );
  }

  const globalHit = tables.global.get(expression);
  if (globalHit && globalHit.size === 1) return [...globalHit][0];
  return null;
}

interface AgentSlugSite {
  line: number;
  /** Raw right-hand side text, trimmed. */
  expression: string;
  /** Keys declared in the SAME object literal (may be declared after). */
  siblingKeys: Set<string>;
  /** Identifier immediately preceding the enclosing `{`. `''` when the
   *  literal is anonymous (an argument, an array element). */
  containerLabel: string;
  /** Some enclosing object literal is a `where` clause. */
  inWhere: boolean;
  /** Some enclosing object literal is a Prisma `select` / `by` projection —
   *  `agentSlug: true` names a column to READ, it neither filters nor writes. */
  inProjection: boolean;
}

/** A right-hand side that is a TypeScript type, not a value. Interface members
 *  (`agentSlug: string;`) sit in objects that also declare `refTable: string`,
 *  so without this they would masquerade as producers. */
function isTypeAnnotation(expression: string): boolean {
  return (
    expression.endsWith(';') ||
    expression === 'true' ||
    expression === 'false' ||
    /^(string|number|boolean)(\s*\|\s*(string|number|boolean|null|undefined))*$/.test(
      expression,
    )
  );
}

interface Frame {
  label: string;
  keys: Set<string>;
}

/**
 * Single character pass. Tracks strings, template literals, both comment
 * forms, and a stack of object-literal frames labelled by the identifier
 * immediately preceding the `{`. Sibling keys are finalised when the frame
 * closes, so a `refTable` declared after `agentSlug` still counts.
 */
function scanAgentSlugSites(text: string): AgentSlugSite[] {
  const sites: AgentSlugSite[] = [];
  const pending: { site: AgentSlugSite; frame: Frame }[] = [];
  const stack: Frame[] = [];
  let line = 1;
  let lastWord = '';
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '\n') {
      line += 1;
      i += 1;
      continue;
    }

    // Comments.
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') line += 1;
        i += 1;
      }
      i += 2;
      continue;
    }

    // Strings + template literals: skipped wholesale. Any `agentSlug:` inside
    // one is prose or SQL, not a filter.
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = skipString(text, i);
      for (let k = i; k < end && k < text.length; k += 1) {
        if (text[k] === '\n') line += 1;
      }
      i = end;
      continue;
    }

    if (ch === '{') {
      stack.push({ label: lastWord, keys: new Set() });
      lastWord = '';
      i += 1;
      continue;
    }

    if (ch === '}') {
      const closed = stack.pop();
      if (closed) {
        for (let p = pending.length - 1; p >= 0; p -= 1) {
          if (pending[p].frame === closed) {
            sites.push(pending[p].site);
            pending.splice(p, 1);
          }
        }
      }
      lastWord = '';
      i += 1;
      continue;
    }

    // Identifier run.
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < text.length && /[\w$]/.test(text[j])) j += 1;
      const word = text.slice(i, j);

      // Is it an object key (`word:` with no `?` type-optional marker in the
      // way)? Look ahead past whitespace for a single `:`.
      let k = j;
      while (k < text.length && /\s/.test(text[k])) k += 1;
      const isKey =
        text[k] === ':' && text[k + 1] !== ':' && stack.length > 0;

      if (isKey) {
        const frame = stack[stack.length - 1];
        frame.keys.add(word);
        if (word === 'agentSlug') {
          const expression = readValueExpression(text, k + 1).trim();
          const site: AgentSlugSite = {
            line,
            expression,
            siblingKeys: frame.keys,
            containerLabel: frame.label,
            inWhere: stack.some((f) => f.label === 'where'),
            inProjection: stack.some(
              (f) => f.label === 'select' || f.label === 'by',
            ),
          };
          if (!site.inProjection && !isTypeAnnotation(expression)) {
            pending.push({ site, frame });
          }
        }
      }

      lastWord = word;
      i = j;
      continue;
    }

    i += 1;
  }

  // Unbalanced tail (shouldn't happen on valid TS) — keep what we have.
  for (const p of pending) sites.push(p.site);
  return sites;
}

/** Read a property value up to the `,` or `}` that closes it at depth 0. */
function readValueExpression(text: string, start: number): string {
  let depth = 0;
  let i = start;
  while (i < text.length && /[ \t]/.test(text[i])) i += 1;
  const from = i;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(text, i);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === '}') {
      if (depth === 0) break;
      depth -= 1;
    } else if (ch === ',' && depth === 0) break;
    else if (ch === '\n' && depth === 0) break;
    i += 1;
  }
  return text.slice(from, i);
}

/** Index just past the closing quote of the string starting at `start`. */
function skipString(text: string, start: number): number {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === quote) return i + 1;
    if (quote !== '`' && text[i] === '\n') return i; // unterminated — bail
    i += 1;
  }
  return i;
}
