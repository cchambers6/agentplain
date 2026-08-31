/**
 * lib/tenancy/tenant-reachability.ts
 *
 * The tenant-isolation checkers. Pure functions over injected schema data —
 * see `types.ts` for why the injection matters.
 *
 * None of these read the filesystem. `schema-graph.ts` does the parsing;
 * `tenant-reachability.test.ts` binds these to the real parsed schema for the
 * production assertions AND to synthetic violating fixtures for the
 * deliberate-failure assertions.
 */

import type {
  CoverageReport,
  TenancyReport,
  TenancyViolation,
} from './types';

// ─────────────────────────────────────────────────────────────────────────
// Injected schema shape
// ─────────────────────────────────────────────────────────────────────────

/**
 * One Prisma model, reduced to what the reachability question needs.
 *
 * `fkTargets` is the OWNING side only — the models this model holds a foreign
 * key column to (`@relation(fields: [...], references: [...])`). Back-relation
 * list fields are deliberately excluded: `Workspace.portalConfig` is not a
 * foreign key on Workspace, and treating it as an edge would make every model
 * in the schema trivially "reachable" and the check meaningless.
 */
export interface SchemaModelLike {
  model: string;
  /** Physical table name (`@@map` applied), which is what RLS statements name. */
  table: string;
  fkTargets: readonly string[];
}

export interface TenancyInput {
  models: readonly SchemaModelLike[];
  /** Tables with an `ENABLE`/`FORCE ROW LEVEL SECURITY` statement in a migration. */
  rlsTables: ReadonlySet<string>;
  /**
   * Tables declared to hold no customer-tenant data. Every model that does not
   * reach the tenant root MUST appear here with a reason — see
   * `known-tenancy-drift.ts`. The check refuses to silently pass an
   * unclassified table, because "no path to Workspace" is exactly as likely to
   * mean "the tenant link was forgotten" as it is to mean "this is global."
   */
  declaredGlobal: ReadonlyMap<string, string>;
  /** The tenant root. `Workspace` in this schema. */
  rootModel: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Reachability
// ─────────────────────────────────────────────────────────────────────────

/**
 * Models that reach the tenant root by following owning-side foreign keys.
 *
 * A model is tenant-reachable when a chain of its own FK columns terminates at
 * `rootModel`. `PortalMessage -> PortalThread -> PortalConfig -> Workspace` is
 * three hops and counts; `OutreachProspect`, which holds no FK at all, does
 * not. Depth is unbounded on purpose — capping it is how a check silently
 * stops covering the deep end of the graph as the schema grows.
 */
export function computeTenantReachable(
  models: readonly SchemaModelLike[],
  rootModel: string,
): ReadonlySet<string> {
  const byName = new Map(models.map((m) => [m.model, m]));
  const memo = new Map<string, boolean>();

  const reaches = (name: string, seen: ReadonlySet<string>): boolean => {
    if (name === rootModel) return true;
    const cached = memo.get(name);
    if (cached !== undefined) return cached;
    if (seen.has(name)) return false; // cycle — no new information down this arm
    const node = byName.get(name);
    if (!node) return false;

    const nextSeen = new Set(seen).add(name);
    let result = false;
    for (const target of node.fkTargets) {
      if (reaches(target, nextSeen)) {
        result = true;
        break;
      }
    }
    // Only memoise results computed without leaning on the cycle guard, so a
    // `false` produced by revisiting an in-progress node is never cached as a
    // fact about that node.
    if (seen.size === 0 || result) memo.set(name, result);
    return result;
  };

  const out = new Set<string>();
  for (const m of models) {
    if (m.model === rootModel) continue;
    if (reaches(m.model, new Set())) out.add(m.model);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Check 1 — tenant-reachable tables must be RLS-protected
// ─────────────────────────────────────────────────────────────────────────

const BLIND_SPOTS: readonly string[] = [
  'Follows Prisma-declared owning-side foreign keys only. A tenant link carried by a raw-SQL join, an untyped Json column, or a string id with no @relation is invisible here.',
  'Proves an ENABLE/FORCE ROW LEVEL SECURITY statement exists in a migration. Does NOT evaluate the policy predicate — a table with RLS enabled and a USING (true) policy passes this check and isolates nothing.',
  'Does not read the live database. A policy dropped by hand in production, or a migration that never applied (see the P3009 block), still reads as protected here.',
  'withSystemContext() sets app.is_operator = true and bypasses tenant predicates by design. That bypass surface is measured by checkSystemContextBudget, not by this check.',
];

/**
 * Every model that reaches the tenant root must have row-level security on its
 * table, and every model that does NOT reach the root must be declared global
 * with a reason. Both directions matter: the first is the leak, the second is
 * how the first hides — an un-linked table looks safe and is indistinguishable
 * from a table whose tenant FK was never added.
 */
export function checkTenantReachability(input: TenancyInput): TenancyReport {
  const reachable = computeTenantReachable(input.models, input.rootModel);
  const violations: TenancyViolation[] = [];

  for (const m of input.models) {
    if (m.model === input.rootModel) continue;

    if (reachable.has(m.model)) {
      if (!input.rlsTables.has(m.table)) {
        violations.push({
          check: 'tenant-reachable-without-rls',
          subject: m.model,
          detail: `${m.model} (table ${m.table}) reaches ${input.rootModel} through foreign keys [${m.fkTargets.join(', ') || 'none'}], so its rows belong to a specific customer — but no migration enables row-level security on ${m.table}. Any query that omits a workspace filter returns every customer's rows.`,
          remedy: `Add a migration that runs ALTER TABLE "${m.table}" ENABLE ROW LEVEL SECURITY / FORCE ROW LEVEL SECURITY plus a policy joining ${m.table} back to ${input.rootModel} via its FK chain, mirroring prisma/migrations/20260526000001_force_rls.`,
        });
      }
      continue;
    }

    // Not reachable. That is a claim about the data, so it has to be declared.
    if (!input.declaredGlobal.has(m.table)) {
      violations.push({
        check: 'undeclared-global-table',
        subject: m.model,
        detail: `${m.model} (table ${m.table}) holds no foreign-key path to ${input.rootModel} and is not declared global. Either it is genuinely tenant-free, or its tenant link was never added — this check cannot tell those apart, and neither can a reader.`,
        remedy: `If ${m.model} holds no customer-tenant data, add it to GLOBAL_TABLES in lib/tenancy/known-tenancy-drift.ts with the reason. If it does, add the foreign key to ${input.rootModel} and an RLS policy.`,
      });
    }
  }

  // A global declaration for a table that has since grown a tenant FK is a
  // lie the list is telling on the schema's behalf. Fail on it.
  for (const [table, _reason] of input.declaredGlobal) {
    const model = input.models.find((m) => m.table === table);
    if (!model) {
      violations.push({
        check: 'stale-global-declaration',
        subject: table,
        detail: `GLOBAL_TABLES declares ${table} tenant-free, but no model in the schema maps to that table. The declaration is fiction and would keep suppressing a future model of the same name.`,
        remedy: `Remove ${table} from GLOBAL_TABLES in lib/tenancy/known-tenancy-drift.ts.`,
      });
      continue;
    }
    if (reachable.has(model.model)) {
      violations.push({
        check: 'stale-global-declaration',
        subject: table,
        detail: `GLOBAL_TABLES declares ${table} tenant-free, but ${model.model} now reaches ${input.rootModel} through [${model.fkTargets.join(', ')}]. It holds customer data and needs a policy, not a declaration.`,
        remedy: `Remove ${table} from GLOBAL_TABLES and add an RLS migration for it.`,
      });
    }
  }

  const coverage: CoverageReport = {
    examined: input.models.length,
    total: input.models.length,
    unit: 'Prisma models',
    blindTo: BLIND_SPOTS,
  };

  return { violations, coverage };
}

/** Counts, for reporting. Not a gate — the gate is the violation list. */
export function summariseReachability(input: TenancyInput): {
  reachable: number;
  global: number;
  rlsProtected: number;
  total: number;
} {
  const reachable = computeTenantReachable(input.models, input.rootModel);
  return {
    reachable: reachable.size,
    global: input.models.length - reachable.size - 1,
    rlsProtected: input.models.filter((m) => input.rlsTables.has(m.table))
      .length,
    total: input.models.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Check 2 — the RLS bypass surface must not grow silently
// ─────────────────────────────────────────────────────────────────────────

export interface SystemContextInput {
  /** Files scanned, with the count of `withSystemContext(` call sites in each. */
  callSitesByFile: ReadonlyMap<string, number>;
  /** Ceiling agreed as of the date in `known-tenancy-drift.ts`. */
  budget: number;
  /** Total files scanned, for the coverage report. */
  filesScanned: number;
}

/**
 * `withSystemContext` runs its callback with `app.is_operator = 'true'` and
 * `app.workspace_id = ''`. Every policy written as "operator sees all" is
 * therefore disabled for the duration. It is a legitimate tool — webhooks and
 * the pre-session auth flow have no workspace yet — but each call site is an
 * unaudited hole in the isolation story, and the count only ever goes up
 * unless something is watching it.
 *
 * This is a budget, not a ban. The gate fails when the count EXCEEDS the
 * recorded ceiling, which forces a new bypass to be argued for in a PR rather
 * than absorbed. It does not fail when the count drops — it reports it, so the
 * budget can be ratcheted down.
 */
export function checkSystemContextBudget(
  input: SystemContextInput,
): TenancyReport {
  let total = 0;
  for (const n of input.callSitesByFile.values()) total += n;

  const violations: TenancyViolation[] = [];
  if (total > input.budget) {
    const worst = [...input.callSitesByFile.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([f, n]) => `${f} (${n})`)
      .join(', ');
    violations.push({
      check: 'system-context-budget',
      subject: 'withSystemContext-call-sites',
      detail: `${total} withSystemContext call sites, over the recorded budget of ${input.budget}. Each one runs queries with app.is_operator = 'true', which disables the tenant predicate on every policy written as "operator sees all". Densest files: ${worst}.`,
      remedy: `Either replace the new call site with withRls(ctx, ...) carrying a real workspace context, or raise SYSTEM_CONTEXT_BUDGET in lib/tenancy/known-tenancy-drift.ts in the same PR with a one-line reason. Raising it is allowed; raising it quietly is not.`,
    });
  }

  return {
    violations,
    coverage: {
      examined: input.callSitesByFile.size,
      total: input.filesScanned,
      unit: 'source files containing withSystemContext (of files scanned)',
      blindTo: [
        'Counts literal `withSystemContext(` occurrences. A call reached through an alias, a re-export, or a helper that wraps it is not counted.',
        'Counts call sites, not executions. One call site inside a hot loop is one unit here and unbounded at runtime.',
        'Says nothing about whether a given bypass is justified — only that the total has not grown without anyone saying so.',
      ],
    },
  };
}
