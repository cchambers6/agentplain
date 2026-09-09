/**
 * lib/graph/__tests__/topology-truth.test.ts
 *
 * THE STANDING INVARIANT over `lib/graph/topology.ts`.
 *
 * A declared topology that nobody re-derives is a diagram, not evidence.
 * This suite fails when a declared edge does not resolve against
 * origin/main: the named dispatch file must exist, the named skill
 * entrypoint must be imported FROM the target skill's module in that
 * file, and it must actually be called there. Rename the entrypoint, move
 * the file, or delete the call, and this goes red.
 *
 * Coverage is stated out loud, because this repo has a recorded failure
 * where `assert.deepEqual(unaccepted, [])` passed green over an EMPTY
 * input set -- "found nothing" and "examined nothing" were
 * indistinguishable in the output. So: `examined N of M` is printed every
 * run, N===0 fails, and M is asserted against the live catalog size.
 * Convention follows `lib/skills/__tests__/fleet-restraint.test.ts`
 * ("states its own coverage") and the `CoverageReport` shape in
 * `lib/tenancy/types.ts`.
 *
 * Reads blobs from origin/main rather than the working tree on purpose:
 * the working tree is a shared, dirty branch, and the claim being tested
 * is about what is on main.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

import {
  ORCHESTRATOR_DELEGATIONS,
  ORCHESTRATOR_NODES,
  SKILL_SLUGS,
  SUBGRAPHS,
  TOPOLOGY_EDGES,
  DISPATCHED_BUT_NOT_INSTALLABLE,
  KNOWN_UNDISPATCHED_SKILLS,
  orchestrator,
  skillNode,
  splitDispatchSite,
  topologyCoverage,
  undispatchedSkills,
} from '../topology';
import { SKILL_CATALOG } from '../../skills/registry';

/** The ref every claim in topology.ts is made about. */
const REF = 'origin/main';

// __dirname = <worktree>/lib/graph/__tests__ -> 3 up = worktree root.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Blob text at REF, or null when the path does not exist there. */
function blobAt(file: string): string | null {
  try {
    return git(['show', `${REF}:${file}`]);
  } catch {
    return null;
  }
}

const blobCache = new Map<string, string | null>();
function source(file: string): string | null {
  if (!blobCache.has(file)) blobCache.set(file, blobAt(file));
  return blobCache.get(file) ?? null;
}

interface ImportStatement {
  /** Full statement text, braces and all. */
  text: string;
  /** The module specifier. */
  specifier: string;
}

/**
 * Every `import ... from '<spec>'` in the source. `[^;]*?` keeps one
 * statement from swallowing the next -- an import never contains a
 * semicolon before its own terminator.
 */
function importStatements(src: string): ImportStatement[] {
  const re = /\bimport\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const out: ImportStatement[] = [];
  let m: RegExpExecArray | null = re.exec(src);
  while (m !== null) {
    out.push({ text: m[0], specifier: m[1] });
    m = re.exec(src);
  }
  return out;
}

/** True when `slug` is a whole path segment of the module specifier. */
function specifierTargetsSkill(specifier: string, slug: string): boolean {
  return specifier.split('/').includes(slug);
}

/** True when the source calls `symbol` (not merely mentions it). */
function callsSymbol(src: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\s*\\(`).test(src);
}

// -- 0. Preconditions -------------------------------------------------------
// If git or the ref is unavailable, this suite must FAIL, not skip. A
// silently-skipped invariant is the green-check-over-a-gap failure mode
// this file exists to prevent.

describe('topology-truth -- preconditions', () => {
  it(`resolves ${REF} (the suite verifies against it, never skips)`, () => {
    let sha = '';
    assert.doesNotThrow(() => {
      sha = git(['rev-parse', REF]).trim();
    }, `cannot resolve ${REF}. Fetch it; do not skip this suite.`);
    assert.match(sha, /^[0-9a-f]{40}$/, `${REF} did not resolve to a sha`);
  });

  it('every declared dispatchSite parses as <file>:<symbol>', () => {
    const bad: string[] = [];
    for (const e of [...TOPOLOGY_EDGES, ...ORCHESTRATOR_DELEGATIONS]) {
      try {
        splitDispatchSite(e.dispatchSite);
      } catch (err) {
        bad.push(`${e.from} -> ${e.to}: ${(err as Error).message}`);
      }
    }
    assert.deepEqual(bad, []);
  });
});

// -- 1. Coverage, stated out loud ------------------------------------------

describe('topology-truth -- states its own coverage', () => {
  const cov = topologyCoverage();

  it('examined N of M, N > 0, M === live catalog size', () => {
    // eslint-disable-next-line no-console
    console.log(
      `topology coverage: examined ${cov.examined} of ${cov.total} ` +
        `${cov.unit} (${TOPOLOGY_EDGES.length} declared edges across ` +
        `${ORCHESTRATOR_NODES.length} orchestrators)`,
    );
    for (const b of cov.blindTo) {
      // eslint-disable-next-line no-console
      console.log(`  blind to: ${b}`);
    }

    assert.notEqual(
      cov.examined,
      0,
      'examined 0 skills. An empty scan reports the same green as a clean ' +
        'one -- that is the exact defect this file exists to prevent.',
    );
    assert.equal(
      cov.total,
      SKILL_CATALOG.length,
      `topology says it covers ${cov.total} skills but SKILL_CATALOG has ` +
        `${SKILL_CATALOG.length}. The declaration is scoped to a stale ` +
        `catalog snapshot.`,
    );
    assert.equal(
      cov.examined,
      cov.total,
      `reached a verdict on only ${cov.examined} of ${cov.total} catalog ` +
        `slugs. Every slug must be either dispatched or listed in ` +
        `KNOWN_UNDISPATCHED_SKILLS -- silence about a slug is not a verdict.`,
    );
    assert.ok(cov.blindTo.length > 0, 'blindTo must name real mechanisms');
  });
});

// -- 2. THE INVARIANT: every declared edge resolves at origin/main ---------

describe(`topology-truth -- every declared edge resolves at ${REF}`, () => {
  it('there is something to verify (a wiped edge list is not a pass)', () => {
    assert.ok(
      TOPOLOGY_EDGES.length >= 20,
      `only ${TOPOLOGY_EDGES.length} declared edges. 28 on ${REF}. An ` +
        `emptied list would make every per-edge case below vacuous.`,
    );
  });

  for (const edge of TOPOLOGY_EDGES) {
    const label = `${edge.from} -> ${edge.to} [${edge.kind}]`;

    it(`${label} :: endpoints are declared nodes`, () => {
      assert.ok(
        orchestrator(edge.from),
        `edge names orchestrator "${edge.from}" which is not in ` +
          `ORCHESTRATOR_NODES`,
      );
      assert.ok(
        skillNode(edge.to),
        `edge names skill "${edge.to}" which is not a SKILL_CATALOG slug`,
      );
    });

    it(`${label} :: dispatch file exists and belongs to the orchestrator`, () => {
      const { file } = splitDispatchSite(edge.dispatchSite);
      const src = source(file);
      assert.ok(
        src !== null && src.length > 0,
        `dispatch file "${file}" does not exist at ${REF}. The declared ` +
          `edge points at nothing.`,
      );
      const node = orchestrator(edge.from);
      assert.equal(
        file,
        node?.file,
        `dispatchSite file "${file}" is not the file that declares ` +
          `${edge.from} ("${node?.file}"). Multi-hop dispatch belongs in ` +
          `ORCHESTRATOR_DELEGATIONS, not folded into a skill edge.`,
      );
    });

    it(`${label} :: the orchestrator symbol is declared in that file`, () => {
      const node = orchestrator(edge.from)!;
      const src = source(node.file);
      assert.ok(src, `orchestrator file "${node.file}" missing at ${REF}`);
      assert.match(
        src!,
        new RegExp(`export\\s+(const|async\\s+function|function)\\s+${node.symbol}\\b`),
        `"${node.file}" does not export ${node.symbol} at ${REF} -- the ` +
          `orchestrator endpoint of this edge does not resolve.`,
      );
    });

    it(`${label} :: the entrypoint is imported FROM the ${edge.to} module`, () => {
      const { file, symbol } = splitDispatchSite(edge.dispatchSite);
      const src = source(file)!;
      assert.ok(src, `dispatch file "${file}" missing at ${REF}`);
      const matching = importStatements(src).filter(
        (imp) =>
          specifierTargetsSkill(imp.specifier, edge.to) &&
          new RegExp(`\\b${symbol}\\b`).test(imp.text),
      );
      assert.ok(
        matching.length > 0,
        `"${file}" has no import that binds ${symbol} from a module under ` +
          `"${edge.to}". Either the entrypoint was renamed/moved, or this ` +
          `edge asserts a dispatch that does not exist. Imports seen from ` +
          `${edge.to}: ` +
          JSON.stringify(
            importStatements(src)
              .filter((i) => specifierTargetsSkill(i.specifier, edge.to))
              .map((i) => i.specifier),
          ),
      );
    });

    it(`${label} :: ${edge.to}'s entrypoint is actually CALLED there`, () => {
      const { file, symbol } = splitDispatchSite(edge.dispatchSite);
      const src = source(file)!;
      assert.ok(
        callsSymbol(src, symbol),
        `"${file}" imports ${symbol} but never calls it. An import is not ` +
          `a dispatch -- this edge is a claim, not an edge.`,
      );
    });
  }
});

// -- 3. Orchestrator -> orchestrator hops resolve too -----------------------

describe(`topology-truth -- every delegation resolves at ${REF}`, () => {
  assert.ok(ORCHESTRATOR_DELEGATIONS.length > 0);

  for (const hop of ORCHESTRATOR_DELEGATIONS) {
    it(`${hop.from} => ${hop.to} :: call site resolves`, () => {
      const from = orchestrator(hop.from);
      const to = orchestrator(hop.to);
      assert.ok(from, `unknown orchestrator "${hop.from}"`);
      assert.ok(to, `unknown orchestrator "${hop.to}"`);

      const { file, symbol } = splitDispatchSite(hop.dispatchSite);
      assert.equal(file, from!.file, 'delegation must originate in its own file');

      const src = source(file);
      assert.ok(src, `"${file}" does not exist at ${REF}`);
      assert.equal(
        symbol,
        to!.symbol,
        `delegation calls "${symbol}" but ${hop.to} is declared as ` +
          `"${to!.symbol}"`,
      );
      assert.ok(
        callsSymbol(src!, symbol),
        `"${file}" never calls ${symbol} at ${REF}`,
      );
      const target = source(to!.file);
      assert.ok(target, `"${to!.file}" does not exist at ${REF}`);
      assert.match(
        target!,
        new RegExp(`export\\s+(const|async\\s+function|function)\\s+${symbol}\\b`),
        `"${to!.file}" does not export ${symbol} at ${REF}`,
      );
    });
  }
});

// -- 4. Graph hygiene -------------------------------------------------------

describe('topology-truth -- the declaration is internally coherent', () => {
  it('no duplicate edges', () => {
    const keys = TOPOLOGY_EDGES.map(
      (e) => `${e.from}|${e.to}|${e.dispatchSite}`,
    );
    assert.deepEqual(
      keys.filter((k, i) => keys.indexOf(k) !== i),
      [],
    );
  });

  it('every orchestrator node has at least one outgoing edge or delegation', () => {
    const used = new Set<string>([
      ...TOPOLOGY_EDGES.map((e) => e.from),
      ...ORCHESTRATOR_DELEGATIONS.flatMap((d) => [d.from, d.to]),
    ]);
    const orphans = ORCHESTRATOR_NODES.filter((o) => !used.has(o.id)).map(
      (o) => o.id,
    );
    assert.deepEqual(
      orphans,
      [],
      'an orchestrator node with no edge is decoration, not topology',
    );
  });

  it('every subgraph names only declared orchestrators, and covers them all', () => {
    const declared = new Set(ORCHESTRATOR_NODES.map((o) => o.id));
    const grouped = new Set(SUBGRAPHS.flatMap((s) => s.orchestrators));
    const unknown = [...grouped].filter((id) => !declared.has(id));
    assert.deepEqual(unknown, [], 'subgraph names an undeclared orchestrator');
    const ungrouped = [...declared].filter((id) => !grouped.has(id));
    assert.deepEqual(ungrouped, [], 'orchestrator belongs to no subgraph');
  });
});

// -- 5. The negative space is declared, not implied -------------------------

describe('topology-truth -- undispatched and dark skills are named', () => {
  it('the derived undispatched set equals KNOWN_UNDISPATCHED_SKILLS', () => {
    assert.deepEqual(
      undispatchedSkills(),
      [...KNOWN_UNDISPATCHED_SKILLS].sort(),
      'A catalog skill gained or lost a dispatcher. If a skill was wired ' +
        'up, remove it from KNOWN_UNDISPATCHED_SKILLS and declare the edge. ' +
        'If a new dark skill appeared, list it -- do not let it in quietly.',
    );
  });

  it('every undispatched skill is honestly badged (not runtime:live)', () => {
    const lying = KNOWN_UNDISPATCHED_SKILLS.filter(
      (slug) => skillNode(slug)?.runtime === 'live',
    );
    assert.deepEqual(
      lying,
      [],
      'a skill with NO dispatcher anywhere is marked runtime:"live" in ' +
        'SKILL_CATALOG -- the marketplace tells customers it fires and ' +
        'nothing fires it.',
    );
  });

  it('DISPATCHED_BUT_NOT_INSTALLABLE is exactly the derived set', () => {
    const derived = [
      ...new Set(
        TOPOLOGY_EDGES.map((e) => e.to).filter(
          (slug) => skillNode(slug)?.runtime !== 'live',
        ),
      ),
    ].sort();
    assert.deepEqual(
      derived,
      [...DISPATCHED_BUT_NOT_INSTALLABLE].sort(),
      'A skill has a real dispatcher but its catalog runtime is not ' +
        '"live", so isSkillInstalledForWorkspace returns false and the ' +
        'dispatcher no-ops on every workspace with zero errors -- class (b) ' +
        'of the 2026-06-10 signup-to-go audit. Either set runtime:"live" or ' +
        'record it here; do not leave it undeclared.',
    );
  });

  it('every catalog slug has exactly one verdict', () => {
    const dispatched = new Set(TOPOLOGY_EDGES.map((e) => e.to));
    const dark = new Set(KNOWN_UNDISPATCHED_SKILLS);
    const both = SKILL_SLUGS.filter((s) => dispatched.has(s) && dark.has(s));
    const neither = SKILL_SLUGS.filter((s) => !dispatched.has(s) && !dark.has(s));
    assert.deepEqual(both, [], 'slug is claimed dispatched AND undispatched');
    assert.deepEqual(neither, [], 'slug has no verdict at all');
  });
});
