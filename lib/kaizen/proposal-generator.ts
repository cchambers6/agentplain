/**
 * lib/kaizen/proposal-generator.ts
 *
 * Turns detected patterns (pattern-detectors.ts) into structured improvement
 * proposals, and assembles the full KaizenRetro object + a markdown rendering.
 *
 * This is still deterministic. The proposals here are the *floor* — the
 * mechanical "given these numbers, here is the obvious recommendation". The
 * scheduled Opus session reads this output and layers judgment on top (which
 * proposals to act on, what the deeper cause is, what to tell Conner). Keeping
 * the floor in code means the retro never silently omits a pattern the data
 * shows, and every proposal cites its evidence (OS spec invariant I-11).
 */

import type { KaizenInputs } from './data-readers.js';
import {
  findExpensiveSessions,
  findRetryStorms,
  findLowCVBarScores,
  findFailedOrchestrators,
  analyzeModelEfficiency,
  findCostDiscrepancies,
  analyzeBudget,
  summarizeWindow,
  cheaperAlternative,
  CV_BAR_PASS,
  type RetryStorm,
  type ModelEfficiency,
  type CostDiscrepancy,
  type BudgetAnalysis,
  type WindowSummary,
} from './pattern-detectors.js';

export type ProposalCategory =
  | 'orchestrator-prompt'
  | 'model-routing'
  | 'skill-addition'
  | 'skill-deprecation'
  | 'scheduled-task'
  | 'budget'
  | 'process';

export type ProposalSeverity = 'info' | 'suggested' | 'recommended' | 'urgent';

export interface ImprovementProposal {
  id: string;
  category: ProposalCategory;
  severity: ProposalSeverity;
  title: string;
  /** Concrete artifact references — session ids, pr#s, numbers. Never vibes. */
  evidence: string[];
  recommendation: string;
  estimatedImpact?: string;
}

export interface KaizenRetro {
  /** ISO timestamp the retro was generated (stamped by the caller). */
  generatedAt: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  summary: WindowSummary;
  patterns: {
    expensiveSessions: ReturnType<typeof findExpensiveSessions>;
    retryStorms: RetryStorm[];
    lowCVBarScores: ReturnType<typeof findLowCVBarScores>;
    failedOrchestrators: ReturnType<typeof findFailedOrchestrators>;
    modelEfficiency: ModelEfficiency[];
    costDiscrepancies: CostDiscrepancy[];
    budget: BudgetAnalysis;
  };
  proposals: ImprovementProposal[];
  /** Loud, explicit gaps — never silently omit missing data (OS spec failure mode). */
  dataGaps: string[];
}

export interface GenerateRetroOptions {
  /** ISO timestamp to stamp; defaults to now. */
  generatedAt?: string;
  /** Per-session cost above which a session is "expensive". Default $40. */
  expensiveSessionUsd?: number;
  /** Per-session average above which a model is a downgrade candidate. Default $50. */
  expensiveModelAvgUsd?: number;
}

/**
 * Run every detector against the loaded inputs and synthesize proposals. Pure:
 * same inputs → same retro (modulo the injectable `generatedAt`).
 */
export function generateRetro(
  inputs: KaizenInputs,
  opts?: GenerateRetroOptions,
): KaizenRetro {
  const generatedAt = opts?.generatedAt ?? new Date().toISOString();
  const expensiveSessionUsd = opts?.expensiveSessionUsd ?? 40;

  const { sessions, cvBarScores, budget } = inputs;

  const patterns = {
    expensiveSessions: findExpensiveSessions(sessions, expensiveSessionUsd),
    retryStorms: findRetryStorms(sessions),
    lowCVBarScores: findLowCVBarScores(cvBarScores),
    failedOrchestrators: findFailedOrchestrators(sessions),
    modelEfficiency: analyzeModelEfficiency(sessions, cvBarScores, {
      expensiveAvgUsd: opts?.expensiveModelAvgUsd,
    }),
    costDiscrepancies: findCostDiscrepancies(sessions),
    budget: analyzeBudget(budget),
  };

  const summary = summarizeWindow(sessions, cvBarScores);
  const proposals = buildProposals(patterns, summary, expensiveSessionUsd);
  const dataGaps = collectDataGaps(inputs, patterns);

  return {
    generatedAt,
    windowDays: inputs.windowDays,
    windowStart: inputs.since.toISOString(),
    windowEnd: inputs.asOf.toISOString(),
    summary,
    patterns,
    proposals,
    dataGaps,
  };
}

// ─── Proposal synthesis ──────────────────────────────────────────────────────

function buildProposals(
  patterns: KaizenRetro['patterns'],
  summary: WindowSummary,
  expensiveSessionUsd: number,
): ImprovementProposal[] {
  const proposals: ImprovementProposal[] = [];
  let n = 0;
  const id = () => `kz-${String(++n).padStart(2, '0')}`;

  // Retry storms → process / orchestrator-prompt fix.
  for (const storm of patterns.retryStorms) {
    proposals.push({
      id: id(),
      category: storm.finalOutcome === 'delivered' ? 'process' : 'orchestrator-prompt',
      severity: storm.finalOutcome === 'delivered' ? 'suggested' : 'recommended',
      title: `Retry storm on "${storm.title}" — ${storm.attempts} attempts ($${storm.totalCostUsd})`,
      evidence: [
        `${storm.attempts} sessions (${storm.failedAttempts} non-delivered) on ${storm.workKey}`,
        `sessions: ${storm.sessionIds.join(', ')}`,
        `total estimated cost $${storm.totalCostUsd}, final outcome ${storm.finalOutcome ?? 'unknown'}`,
      ],
      recommendation:
        storm.finalOutcome === 'delivered'
          ? `Work landed but took ${storm.attempts} tries. Capture what unblocked the final attempt as a calibration prompt_pattern so the next similar wave gets it first try.`
          : `Repeated non-delivery on the same work signals a prompt or scoping problem, not a flaky run. Pull the failing sessions' INBOX notes, fix the orchestrator prompt or pre-decompose the work, and don't re-fire blind.`,
      estimatedImpact: `Avoids ~$${storm.totalCostUsd}/incident of repeated spend.`,
    });
  }

  // Failed orchestrators (errored/killed) not already covered by a storm.
  const stormSessionIds = new Set(
    patterns.retryStorms.flatMap((s) => s.sessionIds),
  );
  const loneFailures = patterns.failedOrchestrators.filter(
    (s) => !stormSessionIds.has(s.session_id),
  );
  if (loneFailures.length) {
    proposals.push({
      id: id(),
      category: 'process',
      severity: loneFailures.length >= 3 ? 'recommended' : 'suggested',
      title: `${loneFailures.length} session(s) failed entirely (errored/killed)`,
      evidence: loneFailures.map(
        (s) => `${s.session_id} — "${s.title}" (${s.outcome}, $${s.estimated_cost_usd})`,
      ),
      recommendation:
        'Review each failure mode. Killed = hit a cap or was aborted (check budget-state); errored = the run broke (check cold-start-safety, I-1). Recurring same-cause failures become a calibration known_waste_pattern.',
    });
  }

  // Model efficiency → routing change (downgrade candidate).
  for (const m of patterns.modelEfficiency) {
    if (m.flag !== 'expensive-low-value') continue;
    const cheaper = cheaperAlternative(m.model);
    proposals.push({
      id: id(),
      category: 'model-routing',
      severity: 'recommended',
      title: `${m.model}: $${m.avgCostUsd}/session avg but cv-bar only ${m.avgCvBar}/5`,
      evidence: [
        `${m.sessionCount} sessions, $${m.totalCostUsd} total, $${m.avgCostUsd} avg`,
        `${m.scoredCount} scored PRs, mean cv-bar ${m.avgCvBar}/5 (bar is ${CV_BAR_PASS})`,
        m.costPerCvPoint !== null ? `$${m.costPerCvPoint} per cv-bar point` : 'cost-per-point n/a',
      ],
      recommendation: cheaper
        ? `This model is not earning its cost on this work class. Route comparable sub-tasks to ${cheaper} and reserve ${m.model} for work that demonstrably needs it; re-measure cv-bar next week.`
        : `This model is not earning its cost on this work class. Audit what work is routed to it and whether a cheaper tier would score the same.`,
      estimatedImpact: cheaper
        ? `Downgrading this work class could cut ~$${m.totalCostUsd}/wk toward the cheaper tier's rate.`
        : undefined,
    });
  }

  // Low cv-bar scores → orchestrator-prompt tuning.
  if (patterns.lowCVBarScores.length) {
    const worst = patterns.lowCVBarScores.slice(0, 5);
    proposals.push({
      id: id(),
      category: 'orchestrator-prompt',
      severity: patterns.lowCVBarScores.length >= 3 ? 'recommended' : 'suggested',
      title: `${patterns.lowCVBarScores.length} PR(s) self-scored below the cv-bar (<${CV_BAR_PASS})`,
      evidence: worst.map(
        (s) =>
          `pr#${s.pr_number} "${s.pr_title}" — ${s.self_score}/5 (${s.model}): ${s.reasoning}`,
      ),
      recommendation:
        'Cluster the reasoning across these. Recurring causes (engineer vocab leaked, no live proof, scope too thin) each map to a preflight check baked into the wave template. A <4 should never have shipped a PR — confirm the gate held.',
    });
  }

  // Budget → urgent if over-cap risk or a tier breached.
  if (patterns.budget.overCapRisk || patterns.budget.tierBreaches.length) {
    const breachList = patterns.budget.tierBreaches
      .map((t) => `Tier ${t.tier} (${t.label}) ${t.pctUsed}% of $${t.capUsd}`)
      .join('; ');
    proposals.push({
      id: id(),
      category: 'budget',
      severity: patterns.budget.overCapRisk ? 'urgent' : 'recommended',
      title: patterns.budget.overCapRisk
        ? `Projected end-of-week spend ($${patterns.budget.projectedEowUsd}) exceeds cap ($${patterns.budget.totalCapUsd})`
        : `Tier budget pressure: ${breachList}`,
      evidence: [
        `week-to-date $${patterns.budget.totalSpentUsd} of $${patterns.budget.totalCapUsd} (${patterns.budget.totalPctUsed}%)`,
        breachList || 'no individual tier breach',
        patterns.budget.burstActive ? 'burst mode ACTIVE' : 'burst mode off',
      ],
      recommendation: patterns.budget.overCapRisk
        ? 'Trajectory overruns the weekly envelope. Either Conner lifts the cap (burst) or the remaining planned waves do not fire (I-8 mechanical refusal). Surface as a Conner decision, do not silently overspend.'
        : 'One or more tiers are near cap. Re-sequence remaining work toward tiers with headroom, or flag for a cap review.',
    });
  }

  // Cost-data hygiene → process (don't reason on bad numbers).
  if (patterns.costDiscrepancies.length) {
    const unpriced = patterns.costDiscrepancies.filter(
      (d) => d.reason === 'unpriced-model',
    );
    const mismatched = patterns.costDiscrepancies.filter(
      (d) => d.reason === 'mismatch',
    );
    proposals.push({
      id: id(),
      category: 'process',
      severity: 'info',
      title: `${patterns.costDiscrepancies.length} session cost row(s) need attention`,
      evidence: [
        ...(unpriced.length
          ? [`unpriced models: ${[...new Set(unpriced.map((d) => d.model))].join(', ')}`]
          : []),
        ...mismatched
          .slice(0, 5)
          .map(
            (d) =>
              `${d.sessionId}: recorded $${d.recordedUsd} vs recomputed $${d.recomputedUsd} (Δ$${d.deltaUsd})`,
          ),
      ],
      recommendation:
        'Cost numbers feed budget gating — keep them trustworthy. Add unpriced models to lib/kaizen/pricing.ts; investigate large recompute mismatches (stale token counts, wrong model string).',
    });
  }

  // If the window produced cv-bar coverage worth noting, surface a positive
  // calibration capture so the retro isn't purely problem-finding.
  if (
    summary.scoredPRs >= 3 &&
    summary.avgCvBar !== null &&
    summary.avgCvBar >= CV_BAR_PASS
  ) {
    proposals.push({
      id: id(),
      category: 'process',
      severity: 'info',
      title: `Strong week: ${summary.scoredPRs} PRs averaging ${summary.avgCvBar}/5`,
      evidence: [`${summary.delivered} delivered / ${summary.sessionsAnalyzed} sessions`],
      recommendation:
        'Capture what worked. Diff this week\'s wave templates against weaker weeks and promote the winning patterns into calibration.yaml prompt_patterns.',
    });
  }

  return proposals;
}

// ─── Data-gap collection (loud, never silent) ─────────────────────────────────

function collectDataGaps(
  inputs: KaizenInputs,
  patterns: KaizenRetro['patterns'],
): string[] {
  const gaps: string[] = [];

  if (inputs.sessions.length === 0) {
    gaps.push(
      `DATA MISSING: zero session-costs rows in the last ${inputs.windowDays}d. Either no sessions ran, or the Librarian INBOX → session-costs.yaml pipe is not populating. The per-session stamp (lib/kaizen/session-stamp.ts) is what fills this — confirm sessions call it on completion.`,
    );
  }
  if (inputs.cvBarScores.length === 0 && inputs.sessions.length > 0) {
    gaps.push(
      'DATA MISSING: sessions ran but zero cv-bar scores were recorded this window. Model-efficiency and prompt-quality analysis are blind without scores — confirm PRs are stamping cv-bar via session-stamp.',
    );
  }
  if (patterns.budget.totalCapUsd === 0) {
    gaps.push(
      'DATA MISSING: budget-state.yaml reports a $0 weekly cap — budget analysis cannot gate. Confirm the current_week block is populated.',
    );
  }
  const unparseableScores = inputs.cvBarScores.filter(
    (s) => !Number.isFinite(new Date(s.scored_at).getTime()),
  );
  if (unparseableScores.length) {
    gaps.push(
      `DATA SUSPECT: ${unparseableScores.length} cv-bar score(s) have an unparseable scored_at timestamp; they were kept but not window-filtered.`,
    );
  }

  return gaps;
}

// ─── Markdown rendering ────────────────────────────────────────────────────────

/**
 * Render the retro as the Sunday-morning markdown the scheduled session posts
 * (after layering its own judgment). Deterministic — drives the CLI's default
 * stdout output.
 */
export function renderRetroMarkdown(retro: KaizenRetro): string {
  const L: string[] = [];
  const d = (iso: string) => iso.slice(0, 10);

  L.push(`# Weekly Kaizen Retro — ${d(retro.windowStart)} → ${d(retro.windowEnd)}`);
  L.push('');
  L.push(
    `_Fleet self-improvement review (Tier 3). Generated ${retro.generatedAt}. Window: ${retro.windowDays} days. All costs are ESTIMATES from token counts (I-11)._`,
  );
  L.push('');

  // Data gaps first — if the data is thin, say so before any conclusions.
  if (retro.dataGaps.length) {
    L.push('## ⚠️ Data gaps');
    L.push('');
    for (const g of retro.dataGaps) L.push(`- ${g}`);
    L.push('');
  }

  // Summary.
  const s = retro.summary;
  L.push('## At a glance');
  L.push('');
  L.push(`- **Sessions analyzed:** ${s.sessionsAnalyzed} (${s.delivered} delivered, ${s.failed} failed, ${s.partial} partial)`);
  L.push(`- **Estimated spend:** $${s.totalCostUsd}`);
  L.push(`- **PRs scored:** ${s.scoredPRs}${s.avgCvBar !== null ? ` (avg cv-bar ${s.avgCvBar}/5)` : ''}`);
  L.push(`- **Retry storms:** ${s.retryStorms}`);
  const b = retro.patterns.budget;
  L.push(`- **Budget:** $${b.totalSpentUsd}/$${b.totalCapUsd} week-to-date (${b.totalPctUsed}%)${b.overCapRisk ? ' — ⚠️ projected over cap' : ''}${b.burstActive ? ' — burst ON' : ''}`);
  L.push('');

  // Proposals — the actionable core.
  L.push('## Proposed improvements');
  L.push('');
  if (!retro.proposals.length) {
    L.push('_No mechanical proposals this window — either a clean week or thin data (see gaps above)._');
    L.push('');
  } else {
    const order: ProposalSeverity[] = ['urgent', 'recommended', 'suggested', 'info'];
    const sorted = [...retro.proposals].sort(
      (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
    );
    for (const p of sorted) {
      L.push(`### ${sevIcon(p.severity)} [${p.category}] ${p.title}`);
      L.push('');
      L.push(`**Recommendation:** ${p.recommendation}`);
      if (p.estimatedImpact) L.push('', `**Estimated impact:** ${p.estimatedImpact}`);
      L.push('', '**Evidence:**');
      for (const e of p.evidence) L.push(`- ${e}`);
      L.push('');
    }
  }

  // Model routing table — always show, it's the headline economic question.
  if (retro.patterns.modelEfficiency.length) {
    L.push('## Model routing (cost vs. customer value)');
    L.push('');
    L.push('| Model | Sessions | Total $ | Avg $/session | Scored | Avg cv-bar | $/cv-point | Flag |');
    L.push('|---|--:|--:|--:|--:|--:|--:|---|');
    for (const m of retro.patterns.modelEfficiency) {
      L.push(
        `| ${m.model} | ${m.sessionCount} | $${m.totalCostUsd} | $${m.avgCostUsd} | ${m.scoredCount} | ${m.avgCvBar ?? '—'} | ${m.costPerCvPoint !== null ? '$' + m.costPerCvPoint : '—'} | ${m.flag} |`,
      );
    }
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push(
    '_This is the deterministic floor. The scheduled session adds judgment: which proposals to act on, the deeper cause, and what reaches the Conner queue. Detectors: `lib/kaizen/pattern-detectors.ts`. Spec: `docs/specs/kaizen-loop-2026-06-15.md`._',
  );

  return L.join('\n');
}

function sevIcon(sev: ProposalSeverity): string {
  switch (sev) {
    case 'urgent':
      return '🔴';
    case 'recommended':
      return '🟠';
    case 'suggested':
      return '🟡';
    case 'info':
      return 'ℹ️';
  }
}
