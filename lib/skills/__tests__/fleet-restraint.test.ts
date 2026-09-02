/**
 * lib/skills/__tests__/fleet-restraint.test.ts
 *
 * THE FLEET RESTRAINT STANDARD.
 *
 * Outcome owned: a customer receives ONE draft per real event — not one per
 * scheduled fire, and not exactly one ever.
 *
 * Owner: Fleet Restraint.  Auditor: Cost & Run Truth.  Escalation: open-issue
 * until the ratchet reaches zero, then block-merge.
 *
 * ── WHAT THIS ASSERTS, AND WHY IT IS SHAPED THIS WAY ──────────────────────
 *
 * A recurring skill dedupes iff BOTH hold:
 *
 *   (1) its approval `refId` is a STABLE DOMAIN IDENTIFIER — an id naming the
 *       thing in the customer's world (invoice, lease, thread, lead, matter),
 *       so the same real event yields the same refId on every run; AND
 *   (2) something reads prior-run state keyed on that refId before inserting.
 *
 * (1) is the load-bearing half and it is the half that is broken. A guard on
 * an always-fresh refId can NEVER match — so adding dedupe queries without
 * first making the refId stable buys exactly nothing. This check enforces
 * that ordering. **It verifies (1) only; (2) is unverified — see `blindTo`.**
 *
 * Measured on origin/main @ 53afc7e: SEVEN sinks pass an id minted DURING the
 * run as the refId. Each already carries a stable domain id in the same
 * payload, so the remediation is a field swap, not new plumbing:
 *
 *   invoice-chase-general                      draftId    → invoiceId
 *   property-management-rent-collection-chase  draftId    → leaseId
 *   follow-up-chaser-general                   proposalId → sourceThreadId
 *   chief-of-staff-scheduler                   proposalId → sourceThreadId  (NULLABLE — needs a fallback)
 *   home-services-estimate-followup            draftId    → estimateId
 *   inbox-triage-general                       proposalId → sourceMessageId
 *   process-doc-drafter-general                proposalId → patternKey
 *
 * TWO proven-good controls, both pinned below — stable refId AND a prior-run
 * guard: `lead-triage-realestate` (refId=leadId; findFirst → skippedDuplicate)
 * and `law-intake-conflict-screen` (refId=matterId; the intake fetcher
 * excludes any matter that already has a row).
 *
 * NULLABLE-KEY FALLBACK, already proven in this repo: four writers outside
 * `lib/skills` key on a CONTENT FINGERPRINT plus a find-or-create guard —
 * `lib/portal/owner-approval-gate-prisma.ts`, `lib/voice/recording.ts`,
 * `lib/integrations/approval/approval-gate-prisma.ts`,
 * `lib/integrations/docusign-mcp/approval-gate-prisma.ts`. That is the shape
 * `chief-of-staff-scheduler` should adopt where `sourceThreadId` is null.
 *
 * ── WHY STATIC, NOT BEHAVIOURAL ───────────────────────────────────────────
 *
 * Same reasoning as lib/tenancy/tenant-reachability.test.ts: reading source
 * needs no database, no adapters and no fixtures, so it runs in the fast lane
 * on every PR. It is BLIND in ways written into `blindTo` rather than
 * discovered later.
 *
 * ── SELF-PROOF ────────────────────────────────────────────────────────────
 *
 * The deliberate-failure fixtures are SYNTHETIC TREES built in a temp dir, so
 * the proof is independent of production source. An earlier revision asserted
 * the classifier against `invoice-chase-general` itself, which meant applying
 * this file's own prescribed remediation turned its self-proof red. A proof
 * coupled to the defect it exists to remove is not a proof.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SKILLS_ROOT = join(process.cwd(), 'lib', 'skills');

/** Non-skill directories under lib/skills. */
const NON_SKILL_DIRS = ['config', 'prompts', 'scheduler', '__tests__'];

/** Files that legitimately mint ids for demo/fixture data. Excluded from the
 *  mint search so a CORRECT skill is not flagged because a sibling fixture
 *  generator happens to mint a field of the same name. */
// NOTE: `json-fetcher.ts` is deliberately NOT excluded. It is a production
// fetcher implementation exported from each skill's `index.ts` (the manual
// CSV/JSON import path used while an MCP is in flight), not a fixture — and it
// is exactly where a manual-import adapter would mint ids for records that
// arrive without one. Excluding it created a silent fail-open across 15 of the
// 30 skill directories. Round-2 audit caught this; do not re-add it.
const FIXTURE_FILE = /(^|[\\/])(fixtures?|demo|seed)[^\\/]*\.ts$/i;

/** Anything that makes a value fresh per run, not just randomUUID. */
const MINT_FNS = String.raw`randomUUID|crypto\.randomUUID|uuidv4|uuidV4|uuid4|nanoid|createId|cuid`;

/**
 * Skills whose refId is minted per run today, keyed `skill:property` so a
 * SECOND broken refId in an already-listed skill is not silently excused.
 * `stableTarget` names the domain id ALREADY on that payload, so remediation
 * is unambiguous; `nullableTarget` marks the one target that can be null.
 *
 * RATCHET, not suppression: fails on a new offender, on an entry fixed but
 * left listed, and on an emptied list. Same shape as KNOWN_TENANCY_DRIFT.
 */
interface DriftEntry {
  stableTarget: string;
  nullableTarget?: true;
}
const KNOWN_UNSTABLE_REFID: Readonly<Record<string, DriftEntry>> = {
  'invoice-chase-general:draftId': { stableTarget: 'invoiceId' },
  'property-management-rent-collection-chase:draftId': { stableTarget: 'leaseId' },
  'follow-up-chaser-general:proposalId': { stableTarget: 'sourceThreadId' },
  // sourceThreadId is `string | null` on MeetingProposal and TodoProposal —
  // this one needs the content-fingerprint fallback named in the header.
  'chief-of-staff-scheduler:proposalId': { stableTarget: 'sourceThreadId', nullableTarget: true },
  'home-services-estimate-followup:draftId': { stableTarget: 'estimateId' },
  // Fired by process-webhook-event per inbound message, NOT by a cron sweep —
  // its duplication risk is webhook redelivery/replay, not a scheduled tick.
  'inbox-triage-general:proposalId': { stableTarget: 'sourceMessageId' },
  // patternKey is described in its own types as "the same value the skill
  // clustered on" — the dedupe key is already computed and unused.
  'process-doc-drafter-general:proposalId': { stableTarget: 'patternKey' },
};

interface RefIdSite {
  skill: string;
  file: string;
  line: number;
  expression: string;
  property: string;
}

function listSkillDirs(root: string): string[] {
  return readdirSync(root)
    .filter((n) => !n.startsWith('_') && !n.startsWith('.'))
    .filter((n) => {
      try {
        return statSync(join(root, n)).isDirectory();
      } catch {
        return false;
      }
    })
    .filter((n) => !NON_SKILL_DIRS.includes(n))
    .sort();
}

function sourceFiles(dir: string, recurse = true): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (recurse) out.push(...sourceFiles(p));
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

/** Replace comments with an EQUAL NUMBER OF NEWLINES so reported line numbers
 *  stay true. (A previous revision collapsed block comments to '', which made
 *  every reported line short by the height of the file's doc header.) */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectRefIdSites(skill: string, root: string): RefIdSite[] {
  const sites: RefIdSite[] = [];
  for (const file of sourceFiles(join(root, skill))) {
    stripComments(readFileSync(file, 'utf8'))
      .split('\n')
      .forEach((line, idx) => {
        const m = /(^|[^A-Za-z])refId\s*:\s*([^,\n]+)/.exec(line);
        if (!m) return;
        const expression = m[2].trim().replace(/[,;]\s*$/, '');
        // Take the trailing identifier, tolerating close-brackets from a
        // single-line object literal (`({ refId: d.draftId })`), which a plain
        // lastIndexOf('.') would render as the property `draftId })`.
        // Sinks on `main` are multi-line and parse correctly either way: this
        // guards the single-line shape and the synthetic fixtures below. It is
        // NOT a claim that main was ever mis-parsed. It was not.
        const pm = /([A-Za-z_$][\w$]*)\s*[)}\]\s]*$/.exec(expression);
        const property = pm ? pm[1] : expression;
        sites.push({ skill, file, line: idx + 1, expression, property });
      });
  }
  return sites;
}

/** Freshness visible in the refId EXPRESSION itself — a timestamp, a date, or
 *  an inline mint. Catches `refId: \`${x.id}-${Date.now()}\`` which no
 *  property-assignment search would see. */
function expressionIsFresh(expression: string): boolean {
  return new RegExp(`Date\\.now\\s*\\(|new Date\\s*\\(|${MINT_FNS}`).test(expression);
}

/**
 * Is `prop` assigned from a per-run mint anywhere in the skill (excluding
 * fixture/demo generators)? Covers BOTH the object-literal form
 * (`draftId: randomUUID()`) and the ALIAS form (`const draftId = randomUUID()`
 * … `refId: draftId`), which is live on main at lib/skills/draft.ts.
 * Returns the matching file so a false positive is diagnosable.
 */
function mintSiteFor(skill: string, prop: string, root: string): string | null {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    // \b matters: without it, a truncated property name like `a` matched
    // `metadat[a]: randomUUID(` and reported a stable refId as an offender.
    String.raw`(?:(?:const|let|var)\s+)?\b${esc}\s*[:=]\s*(?:await\s+)?(?:${MINT_FNS})\s*\(`,
  );
  for (const file of sourceFiles(join(root, skill))) {
    if (FIXTURE_FILE.test(file)) continue;
    if (pattern.test(stripComments(readFileSync(file, 'utf8')))) return file;
  }
  return null;
}

/** All offenders in a tree, as `skill:property` with a diagnosable reason. */
function findOffenders(root: string): { key: string; detail: string }[] {
  const out: { key: string; detail: string }[] = [];
  for (const skill of listSkillDirs(root)) {
    for (const site of collectRefIdSites(skill, root)) {
      const key = `${skill}:${site.property}`;
      if (out.some((o) => o.key === key)) continue;
      if (expressionIsFresh(site.expression)) {
        out.push({
          key,
          detail: `${site.file}:${site.line} refId: ${site.expression} — fresh in the expression itself`,
        });
        continue;
      }
      const mint = mintSiteFor(skill, site.property, root);
      if (mint) {
        out.push({
          key,
          detail: `${site.file}:${site.line} refId: ${site.expression} — "${site.property}" minted at ${mint}`,
        });
      }
    }
  }
  return out;
}

// ── Synthetic trees, so the self-proof is not coupled to production source ──

function makeTree(
  skills: Record<string, Record<string, string>>,
): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'fleet-restraint-'));
  for (const [skill, files] of Object.entries(skills)) {
    mkdirSync(join(root, skill), { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(root, skill, name), body, 'utf8');
    }
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ── The standard ───────────────────────────────────────────────────────────

describe('Fleet Restraint — one draft per real event', () => {
  const skills = listSkillDirs(SKILLS_ROOT);
  const withRefId = skills.filter((s) => collectRefIdSites(s, SKILLS_ROOT).length > 0);

  it('states its own coverage (found-nothing must differ from examined-nothing)', () => {
    assert.ok(skills.length >= 20, `expected the skills tree, saw ${skills.length}`);
    assert.ok(
      withRefId.length >= 15,
      `examined only ${withRefId.length} approval-writing skills — the scan is ` +
        `broken, not the fleet. (15 on origin/main @ 53afc7e.)`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `fleet-restraint coverage: examined ${withRefId.length} approval-writing skills of ${skills.length} skill directories`,
    );
  });

  it('every unstable refId is a KNOWN entry — no new skill joins the class silently', () => {
    const offenders = findOffenders(SKILLS_ROOT);
    const unexpected = offenders.filter((o) => !(o.key in KNOWN_UNSTABLE_REFID));
    assert.deepEqual(
      unexpected.map((o) => `${o.key} — ${o.detail}`),
      [],
      'New approval refId(s) that change every run. A refId minted per run ' +
        'cannot dedupe, so one draft per fire reaches the customer. Use a ' +
        'stable domain id already on the payload.',
    );
  });

  it('no KNOWN entry is stale — fixing one without delisting it fails here', () => {
    const live = new Set(findOffenders(SKILLS_ROOT).map((o) => o.key));
    const stale = Object.keys(KNOWN_UNSTABLE_REFID).filter((k) => !live.has(k));
    assert.deepEqual(
      stale,
      [],
      `Fixed but still listed in KNOWN_UNSTABLE_REFID — delist: ${stale.join(', ')}`,
    );
  });

  it('every prescribed stableTarget really exists on that skill', () => {
    const missing: string[] = [];
    for (const [key, entry] of Object.entries(KNOWN_UNSTABLE_REFID)) {
      const skill = key.slice(0, key.lastIndexOf(':'));
      const present = sourceFiles(join(SKILLS_ROOT, skill)).some((f) =>
        new RegExp(`\\b${entry.stableTarget}\\s*:`).test(stripComments(readFileSync(f, 'utf8'))),
      );
      if (!present) missing.push(`${key} → ${entry.stableTarget}`);
    }
    assert.deepEqual(
      missing,
      [],
      'Prescribed stable target does not exist on that payload — the ' +
        'remediation this file prescribes would not compile.',
    );
  });

  it('exactly one entry is flagged nullable (chief-of-staff needs a fallback)', () => {
    const nullable = Object.entries(KNOWN_UNSTABLE_REFID)
      .filter(([, e]) => e.nullableTarget)
      .map(([k]) => k);
    assert.deepEqual(nullable, ['chief-of-staff-scheduler:proposalId']);
  });

  it('the ratchet accounts for every live offender and nothing else', () => {
    // Strictly stronger than the old `length > 0` non-vacuity check, and it
    // reaches a LEGAL ZERO STATE. The previous form turned this suite
    // unconditionally red on the day the seventh skill was fixed — a standard
    // with no green finish line gets its assertion deleted, which is how a
    // gate stops being read. Emptying the list while offenders remain is
    // already caught by the KNOWN-entry test above.
    assert.equal(
      findOffenders(SKILLS_ROOT).length,
      Object.keys(KNOWN_UNSTABLE_REFID).length,
      'the ratchet must name exactly the live offenders — no more, no fewer',
    );
  });

  it('both proven-good controls use a stable domain id', () => {
    for (const control of ['lead-triage-realestate', 'law-intake-conflict-screen']) {
      const sites = collectRefIdSites(control, SKILLS_ROOT);
      assert.ok(sites.length > 0, `${control}: writes no refId — scan is broken`);
      const bad = findOffenders(SKILLS_ROOT).filter((o) => o.key.startsWith(`${control}:`));
      assert.deepEqual(bad, [], `${control} must remain a proven-good control`);
    }
  });
});

describe('Fleet Restraint — the checker itself, proven on synthetic trees', () => {
  it('proveItCanFail: object-literal mint is flagged', () => {
    const t = makeTree({
      'zz-object-literal': {
        'skill.ts': 'export const d = () => ({ draftId: randomUUID(), invoiceId: inv.id });',
        'sink.ts': 'export const w = (d) => ({ refId: d.draftId });',
      },
    });
    try {
      assert.deepEqual(findOffenders(t.root).map((o) => o.key), ['zz-object-literal:draftId']);
    } finally {
      t.cleanup();
    }
  });

  it('proveItCanFail: ALIAS form is flagged (the form live at lib/skills/draft.ts)', () => {
    const t = makeTree({
      'zz-alias': {
        'skill.ts': 'const draftId = randomUUID();\nexport const d = { draftId, invoiceId: inv.id };',
        'sink.ts': 'export const w = (d) => ({ refId: d.draftId });',
      },
    });
    try {
      assert.deepEqual(findOffenders(t.root).map((o) => o.key), ['zz-alias:draftId']);
    } finally {
      t.cleanup();
    }
  });

  it('proveItCanFail: non-UUID freshness in the expression is flagged', () => {
    const t = makeTree({
      'zz-timestamp': {
        'sink.ts': 'export const w = (x) => ({ refId: `${x.id}-${Date.now()}` });',
      },
    });
    try {
      assert.equal(findOffenders(t.root).length, 1);
    } finally {
      t.cleanup();
    }
  });

  it('proveItDiscriminates: a stable domain id is NOT flagged', () => {
    const t = makeTree({
      'zz-stable': {
        'skill.ts': 'export const d = (inv) => ({ invoiceId: inv.invoiceId });',
        'sink.ts': 'export const w = (d) => ({ refId: d.invoiceId });',
      },
    });
    try {
      assert.deepEqual(findOffenders(t.root), []);
    } finally {
      t.cleanup();
    }
  });

  it('proveItDiscriminates: a fixture generator minting the same field is NOT a false positive', () => {
    const t = makeTree({
      'zz-fixture-victim': {
        'sink.ts': 'export const w = (rec) => ({ refId: rec.invoiceId });',
        'fixtures.ts': 'export const f = () => ({ invoiceId: randomUUID() });',
      },
    });
    try {
      assert.deepEqual(findOffenders(t.root), []);
    } finally {
      t.cleanup();
    }
  });

  it('proveItDiscriminates: a doc-comment mentioning refId is not a call site', () => {
    const t = makeTree({
      'zz-comment-only': {
        'sink.ts': '/**\n * refId: draftId is what we used to do.\n */\nexport const w = (d) => ({ refId: d.invoiceId });',
        'skill.ts': 'export const d = { draftId: randomUUID() };',
      },
    });
    try {
      assert.deepEqual(findOffenders(t.root), []);
    } finally {
      t.cleanup();
    }
  });

  it('blindTo is stated, not discovered later', () => {
    const blindTo = [
      'STEP 2 IS UNVERIFIED — this checks refId stability only; it does not assert a prior-run guard exists',
      'runtime behaviour — reads source, so a refId assembled through a helper or an untracked alias chain is invisible',
      'scope — only lib/skills/<dir>/**; root-level lib/skills/*.ts (e.g. persist-artifacts.ts, itself an approval writer) and the ~7 approval writers outside lib/skills entirely are unexamined',
      'WorkApprovalQueueItem has 4 @@index and 0 @@unique — the durable DB fix (partial unique on workspaceId+kind+refId where status=PENDING) needs a migration queued behind the 2026-06-17 deploy wall',
      'two proposals derived from the same thread in one run would collapse under a thread-keyed refId; this cannot be tested without a runtime',
    ];
    assert.ok(blindTo.length >= 5, 'a standard with no stated blind spots is not finished');
  });
});
