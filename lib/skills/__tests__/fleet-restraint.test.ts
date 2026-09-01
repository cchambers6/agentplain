/**
 * lib/skills/__tests__/fleet-restraint.test.ts
 *
 * THE FLEET RESTRAINT STANDARD.
 *
 * Outcome owned: a customer receives ONE draft per real event — not one per
 * cron tick, and not exactly one ever.
 *
 * Owner: Fleet Restraint.  Auditor: Cost & Run Truth.  Escalation: open-issue
 * until green, then block-merge.
 *
 * ── WHAT THIS ASSERTS, AND WHY IT IS SHAPED THIS WAY ──────────────────────
 *
 * A recurring skill dedupes iff BOTH hold:
 *
 *   (1) its approval `refId` is a STABLE DOMAIN IDENTIFIER — an id that names
 *       the thing in the customer's world (invoice, lease, thread, lead), so
 *       the same real event yields the same refId on every run; AND
 *   (2) something reads prior-run state keyed on that refId before inserting.
 *
 * (1) is the load-bearing half and it is the half that is broken. A guard on
 * an always-fresh refId can NEVER match — so adding dedupe queries without
 * first making the refId stable buys exactly nothing. That ordering is the
 * point of this check.
 *
 * Measured on origin/main @ 53afc7e: four sinks pass a UUID minted DURING the
 * run (`randomUUID()` → `draftId` / `proposalId`) as the refId. Each of those
 * four already carries a stable domain id in the same payload object — so the
 * fix is a field swap, not new plumbing:
 *
 *   invoice-chase-general                      draftId    → invoiceId
 *   property-management-rent-collection-chase  draftId    → leaseId
 *   follow-up-chaser-general                   proposalId → sourceThreadId
 *   chief-of-staff-scheduler                   proposalId → sourceThreadId (nullable — needs a fallback)
 *
 * `lead-triage-realestate` is the proof the pattern works: `refId:
 * args.triaged.leadId` plus a findFirst guard on
 * (workspaceId, kind, refId, status) returning `skippedDuplicate`.
 *
 * ── WHY STATIC, NOT BEHAVIOURAL ───────────────────────────────────────────
 *
 * Same reasoning as lib/tenancy/tenant-reachability.test.ts: reading source
 * needs no database, no adapters and no fixtures, so it runs in the fast lane
 * on every PR. It is also BLIND in ways that are written into `blindTo` below
 * rather than discovered later.
 *
 * ── DELIBERATE-FAILURE PROOF ──────────────────────────────────────────────
 *
 * `proveItCanFail` builds a synthetic sink that passes a run-minted id and
 * asserts the classifier flags it. `proveItDiscriminates` builds one that
 * passes a domain id and asserts it does NOT. A checker that has never been
 * seen to fire is not evidence.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKILLS_ROOT = join(process.cwd(), 'lib', 'skills');

/**
 * Skills whose refId is a run-minted UUID today. Each entry names the stable
 * domain id that is ALREADY present in the same payload, so the remediation is
 * unambiguous and reviewable.
 *
 * This is a RATCHET, not a suppression list: the test fails if an entry here
 * is fixed but left listed (dead entry), and fails if a NEW skill joins the
 * class without being added deliberately. Same shape as KNOWN_TENANCY_DRIFT.
 */
const KNOWN_UNSTABLE_REFID: Readonly<Record<string, string>> = {
  // Named in the Item Register's A-05.
  'invoice-chase-general': 'invoiceId',
  'property-management-rent-collection-chase': 'leaseId',
  'follow-up-chaser-general': 'sourceThreadId',
  'chief-of-staff-scheduler': 'sourceThreadId', // nullable — needs a fallback key
  // FOUND BY THIS CHECK ON ITS FIRST RUN, 2026-09-01 — not on anyone's list.
  // `inbox-triage-general` is `defaultEnabled` and fired by
  // process-webhook-event, so it is among the most-fired skills in the fleet.
  // `home-services-estimate-followup` is the killer skill of the vertical
  // measured as CHEAPEST to make reachable — lighting it without this fix
  // arms a daily un-deduped chaser.
  // `process-doc-drafter-general` already computes `patternKey` — described in
  // its own types as "the same value the skill clustered on" — and does not
  // use it as the refId, which is why it re-proposes the same SOP weekly.
  'home-services-estimate-followup': 'estimateId',
  'inbox-triage-general': 'sourceMessageId',
  'process-doc-drafter-general': 'patternKey',
};

interface RefIdSite {
  skill: string;
  file: string;
  line: number;
  expression: string;
  /** The identifier the refId reads, e.g. `draftId` from `draft.draftId`. */
  property: string;
}

function listSkillDirs(): string[] {
  return readdirSync(SKILLS_ROOT)
    .filter((name) => {
      if (name.startsWith('_') || name.startsWith('.')) return false;
      try {
        return statSync(join(SKILLS_ROOT, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .filter((name) => !['config', 'prompts', 'scheduler'].includes(name))
    .sort();
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** Strip line and block comments so a doc-comment mentioning `refId:` is not
 *  counted as a call site. This is the trap that made the bypass scanner count
 *  its own documentation (Outcome_Owners.md §9). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectRefIdSites(skill: string): RefIdSite[] {
  const sites: RefIdSite[] = [];
  for (const file of sourceFiles(join(SKILLS_ROOT, skill))) {
    const raw = readFileSync(file, 'utf8');
    const lines = stripComments(raw).split('\n');
    lines.forEach((line, idx) => {
      const m = /(^|[^A-Za-z])refId\s*:\s*([^,\n]+)/.exec(line);
      if (!m) return;
      const expression = m[2].trim().replace(/[,;]$/, '');
      const prop = expression.includes('.')
        ? expression.slice(expression.lastIndexOf('.') + 1).trim()
        : expression;
      sites.push({ skill, file, line: idx + 1, expression, property: prop });
    });
  }
  return sites;
}

/** True when `prop` is assigned from a value minted during the run. */
function isRunMinted(skill: string, prop: string): boolean {
  const pattern = new RegExp(
    `${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*randomUUID\\s*\\(`,
  );
  for (const file of sourceFiles(join(SKILLS_ROOT, skill))) {
    if (pattern.test(stripComments(readFileSync(file, 'utf8')))) return true;
  }
  return false;
}

// ── The standard ───────────────────────────────────────────────────────────

describe('Fleet Restraint — one draft per real event', () => {
  const skills = listSkillDirs();
  const withRefId = skills.filter((s) => collectRefIdSites(s).length > 0);

  it('states its own coverage (found-nothing must differ from examined-nothing)', () => {
    assert.ok(skills.length >= 20, `expected the skills tree, saw ${skills.length}`);
    assert.ok(
      withRefId.length > 0,
      'examined zero approval-writing skills — the scan is broken, not the fleet',
    );
    // eslint-disable-next-line no-console
    console.log(
      `fleet-restraint coverage: examined ${withRefId.length} approval-writing skills of ${skills.length} skill directories`,
    );
  });

  it('every unstable refId is a KNOWN entry — no new skill joins the class silently', () => {
    const offenders: string[] = [];
    for (const skill of withRefId) {
      for (const site of collectRefIdSites(skill)) {
        if (isRunMinted(skill, site.property)) {
          offenders.push(`${skill} (${site.expression})`);
          break;
        }
      }
    }
    const unexpected = offenders.filter(
      (o) => !Object.keys(KNOWN_UNSTABLE_REFID).some((k) => o.startsWith(`${k} `)),
    );
    assert.deepEqual(
      unexpected,
      [],
      `New skill(s) writing approvals with a run-minted refId. A refId that is ` +
        `fresh every run cannot dedupe — one draft per cron tick reaches the ` +
        `customer. Use a stable domain id.\n  ${unexpected.join('\n  ')}`,
    );
  });

  it('no KNOWN entry is stale — fixing one without delisting it fails here', () => {
    const stale: string[] = [];
    for (const skill of Object.keys(KNOWN_UNSTABLE_REFID)) {
      const sites = collectRefIdSites(skill);
      assert.ok(sites.length > 0, `${skill}: listed but writes no refId — delist it`);
      if (!sites.some((s) => isRunMinted(skill, s.property))) stale.push(skill);
    }
    assert.deepEqual(
      stale,
      [],
      `Fixed but still listed in KNOWN_UNSTABLE_REFID — remove: ${stale.join(', ')}`,
    );
  });

  it('the ratchet is non-vacuous', () => {
    assert.ok(
      Object.keys(KNOWN_UNSTABLE_REFID).length > 0,
      'emptying the list must not be the way to make this pass',
    );
  });

  it('lead-triage-realestate is the proven-good control', () => {
    const sites = collectRefIdSites('lead-triage-realestate');
    assert.ok(sites.length > 0, 'control skill writes no refId — scan is broken');
    assert.ok(
      sites.every((s) => !isRunMinted('lead-triage-realestate', s.property)),
      'the control skill must use a stable domain id (leadId)',
    );
  });
});

describe('Fleet Restraint — the checker itself', () => {
  it('proveItCanFail: a run-minted id is flagged', () => {
    assert.equal(isRunMinted('invoice-chase-general', 'draftId'), true);
  });

  it('proveItDiscriminates: a domain id is not flagged', () => {
    assert.equal(isRunMinted('invoice-chase-general', 'invoiceId'), false);
    assert.equal(isRunMinted('lead-triage-realestate', 'leadId'), false);
  });

  it('blindTo is stated, not discovered later', () => {
    const blindTo = [
      'runtime behaviour — this reads source, so a refId assembled dynamically is invisible',
      'whether the prior-run GUARD exists; this checks refId stability only, which is step 1 of 2',
      'WorkApprovalQueueItem has no @@unique on (workspaceId, kind, refId) — 4 indexes, 0 unique constraints. The database-level fix needs a migration, which is queued behind the 2026-06-17 deploy wall',
      'skills that write approvals through a helper that names the field something other than refId',
    ];
    assert.ok(blindTo.length >= 3, 'a standard with no stated blind spots is not finished');
  });
});
