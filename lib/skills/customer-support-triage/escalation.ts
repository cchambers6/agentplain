/**
 * lib/skills/customer-support-triage/escalation.ts
 *
 * The ESCALATE-FIRST classifier. This runs BEFORE any auto-answer
 * attempt, because the cost of auto-answering a question that needed a
 * human (a legal question, a distress signal, a data-deletion request) is
 * far higher than the cost of escalating one that didn't. When in doubt,
 * we route to a person.
 *
 * This is deliberately a deterministic keyword/threshold classifier, NOT
 * an LLM call — it must fire correctly even when the LLM is dead (the
 * degraded path leans on it). Cold-start safe: pure over its inputs.
 *
 * Each trigger is conservative-by-design: a false positive sends a
 * routine question to a human (mildly wasteful), a false negative lets a
 * sensitive question get auto-answered (the failure we refuse). We tune
 * toward false positives.
 */

import type {
  EscalationTrigger,
  SupportMessageSnapshot,
} from './types';

export interface EscalationMatch {
  trigger: EscalationTrigger;
  /** The specific phrase / signal that matched, for the page + audit. */
  evidence: string;
}

export interface ClassifyEscalationArgs {
  message: SupportMessageSnapshot;
  /** Billing-dispute dollar threshold (USD) above which a money dispute
   *  escalates. From resolveTriageConfig. */
  billingDisputeThresholdUsd: number;
}

/**
 * Classify whether the message must escalate to a human BEFORE any
 * auto-answer. Returns the FIRST matching trigger (priority order below)
 * or null when no escalation trigger fired. Priority is by severity: a
 * distress signal beats a billing dispute beats an explicit human ask.
 */
export function classifyEscalation(
  args: ClassifyEscalationArgs,
): EscalationMatch | null {
  const text = `${args.message.subject}\n${args.message.body}`.toLowerCase();

  // 1. Mental-health distress — highest priority, never auto-answered.
  const distress = matchAny(text, DISTRESS_SIGNALS);
  if (distress) {
    return { trigger: 'mental-health-distress', evidence: distress };
  }

  // 2. Vulnerability / security report — a person triages within 24h.
  const vuln = matchAny(text, VULNERABILITY_SIGNALS);
  if (vuln) {
    return { trigger: 'vulnerability-report', evidence: vuln };
  }

  // 3. Data-deletion / privacy-rights request — legal obligation, human.
  const deletion = matchAny(text, DATA_DELETION_SIGNALS);
  if (deletion) {
    return { trigger: 'data-deletion-request', evidence: deletion };
  }

  // 4. Legal / compliance question — never auto-answered.
  const legal = matchAny(text, LEGAL_COMPLIANCE_SIGNALS);
  if (legal) {
    return { trigger: 'legal-or-compliance', evidence: legal };
  }

  // 5. Billing dispute over the dollar threshold.
  const billing = matchBillingDispute(text, args.billingDisputeThresholdUsd);
  if (billing) {
    return { trigger: 'billing-dispute-over-threshold', evidence: billing };
  }

  // 6. ANY explicit request for a human.
  const human = matchAny(text, EXPLICIT_HUMAN_SIGNALS);
  if (human) {
    return { trigger: 'explicit-human-request', evidence: human };
  }

  return null;
}

function matchAny(text: string, phrases: readonly string[]): string | null {
  for (const p of phrases) {
    if (text.includes(p)) return p;
  }
  return null;
}

/**
 * Billing-dispute-over-threshold detection. Two signals must co-occur:
 * a dispute cue ("dispute", "chargeback", "overcharged", "refund", "wrong
 * charge", "double charged") AND a dollar amount in the text at/above the
 * threshold. A dispute with no amount, or a small amount, falls through to
 * the normal answer/draft path (a $20 refund question is routine).
 */
function matchBillingDispute(
  text: string,
  thresholdUsd: number,
): string | null {
  const disputeCue = matchAny(text, BILLING_DISPUTE_CUES);
  if (!disputeCue) return null;
  const maxDollars = largestDollarAmount(text);
  if (maxDollars === null || maxDollars < thresholdUsd) return null;
  return `${disputeCue} ($${maxDollars.toFixed(2)} ≥ $${thresholdUsd.toFixed(2)} threshold)`;
}

/**
 * Extract the largest dollar amount in the text. Matches `$1,234.56`,
 * `$200`, `1200 dollars`, `1200 usd`. Returns null when no amount found.
 */
export function largestDollarAmount(text: string): number | null {
  const amounts: number[] = [];
  // $-prefixed: $1,234.56 / $200
  for (const m of text.matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)/g)) {
    const n = Number.parseFloat(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) amounts.push(n);
  }
  // trailing-unit: 1200 dollars / 1200 usd / 1,200 bucks
  for (const m of text.matchAll(
    /\b([\d,]+(?:\.\d{1,2})?)\s?(?:dollars?|usd|bucks)\b/g,
  )) {
    const n = Number.parseFloat(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) amounts.push(n);
  }
  if (amounts.length === 0) return null;
  return Math.max(...amounts);
}

// ── Signal corpora ──────────────────────────────────────────────────────
// Lower-cased substrings. Conservative-by-design — we'd rather escalate a
// routine message than auto-answer a sensitive one.

const DISTRESS_SIGNALS: readonly string[] = [
  'suicide',
  'suicidal',
  'kill myself',
  'end my life',
  'want to die',
  'self-harm',
  'self harm',
  'hurt myself',
  'harm myself',
  "can't go on",
  'cant go on',
  'no reason to live',
];

const VULNERABILITY_SIGNALS: readonly string[] = [
  'vulnerability',
  'security vulnerability',
  'security issue',
  'security flaw',
  'exploit',
  'data breach',
  'breach',
  'leaked',
  'leaking data',
  'exposed data',
  'sql injection',
  'xss',
  'cross-site scripting',
  'csrf',
  'i can see other',
  "i can access another",
  'someone else',
  'unauthorized access',
  'responsible disclosure',
  'pen test',
  'penetration test',
];

const DATA_DELETION_SIGNALS: readonly string[] = [
  'delete my data',
  'delete my account',
  'erase my data',
  'right to be forgotten',
  'gdpr',
  'ccpa',
  'data deletion',
  'remove my information',
  'remove my data',
  'purge my data',
  'data subject request',
  'dsar',
];

const LEGAL_COMPLIANCE_SIGNALS: readonly string[] = [
  'lawsuit',
  'sue you',
  'legal action',
  'attorney',
  'my lawyer',
  'our lawyer',
  'cease and desist',
  'subpoena',
  'liable',
  'liability',
  'compliance violation',
  'regulatory',
  'fair housing',
  'tcpa',
  'respa',
  'sec marketing rule',
  'is this legal',
  'violation of',
  'breach of contract',
  'terms of service violation',
];

const BILLING_DISPUTE_CUES: readonly string[] = [
  'dispute',
  'chargeback',
  'charge back',
  'overcharged',
  'over charged',
  'wrong charge',
  'wrongly charged',
  'double charged',
  'double-charged',
  'charged twice',
  'unauthorized charge',
  'refund',
  'reimburse',
  'incorrect bill',
  'incorrect invoice',
  'billing error',
];

const EXPLICIT_HUMAN_SIGNALS: readonly string[] = [
  'talk to a human',
  'speak to a human',
  'talk to a person',
  'speak to a person',
  'real person',
  'speak to someone',
  'talk to someone',
  'human agent',
  'human support',
  'talk to your ceo',
  'speak to your ceo',
  'talk to the founder',
  'talk to your founder',
  'talk to a manager',
  'speak to a manager',
  'escalate this',
  'escalate to',
  'not a bot',
  'stop the bot',
  'no more bot',
];
