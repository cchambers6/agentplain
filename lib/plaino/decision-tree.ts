/**
 * buildDecisionTreeCard — pure, deterministic builder behind the V32
 * "decision tree" card (visual answer to "which workflow fits me?").
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §4 (visual library extension).
 *
 * Purpose: help the customer identify WHICH agentplain workflow applies to
 * their immediate situation — no LLM reasoning required, just branching on
 * a workspace-level question. Each branch is a deep link into the workspace.
 * 2–4 branches only.
 *
 * PURE function. No I/O. Every branch href is a real workspace deep link;
 * branches are grounded in the discipline catalog (never promise a skill
 * that isn't wired).
 *
 * TEXT FALLBACK: same contract as V27–V34 — the Plaino reply body is the
 * source of truth; the card is an additive enhancement (never replaces text).
 */
import type { DecisionBranch, DecisionTreeCard } from './visual-card';

export interface BuildDecisionTreeArgs {
  workspaceId: string;
  /** The urgency axis: "inbox", "approvals", "compliance", or "general". The
   *  caller picks the axis based on what the customer asked about. The general
   *  tree is used when the question is open-ended ("where do I start?"). */
  axis: 'inbox' | 'approvals' | 'compliance' | 'general';
}

const TREES: Record<
  BuildDecisionTreeArgs['axis'],
  { question: string; branches: Omit<DecisionBranch, 'href'>[] }
> = {
  inbox: {
    question: 'What kind of message matters most right now?',
    branches: [
      {
        condition: 'a customer complaint or issue',
        outcome: 'support triage',
        discipline: 'customer-support',
      },
      {
        condition: 'a contract, proposal, or legal document',
        outcome: 'legal review',
        discipline: 'legal',
      },
      {
        condition: 'a lead or new prospect',
        outcome: 'lead intake',
        discipline: 'sales',
      },
      {
        condition: 'a scheduling or logistics question',
        outcome: 'scheduling',
        discipline: 'operations',
      },
    ],
  },
  approvals: {
    question: 'What is waiting in your approval queue?',
    branches: [
      {
        condition: 'a draft reply to a customer',
        outcome: 'customer comms approval',
        discipline: 'customer-support',
      },
      {
        condition: 'a contract draft or legal filing',
        outcome: 'legal approval',
        discipline: 'legal',
      },
      {
        condition: 'a financial draft or invoice',
        outcome: 'finance approval',
        discipline: 'finance',
      },
      {
        condition: 'a follow-up or outreach draft',
        outcome: 'comms approval',
        discipline: 'sales',
      },
    ],
  },
  compliance: {
    question: 'Which compliance area needs attention?',
    branches: [
      {
        condition: 'a flagged customer communication',
        outcome: 'comms compliance',
        discipline: 'legal',
      },
      {
        condition: 'a license disclosure or regulatory filing',
        outcome: 'regulatory review',
        discipline: 'compliance',
      },
      {
        condition: 'a contract clause the sentinel flagged',
        outcome: 'contract review',
        discipline: 'legal',
      },
    ],
  },
  general: {
    question: 'What is the most urgent thing on your plate?',
    branches: [
      {
        condition: 'unread messages are piling up',
        outcome: 'start with inbox triage',
        discipline: 'inbox',
      },
      {
        condition: 'drafts are waiting for my approval',
        outcome: 'go to the approval queue',
        discipline: 'approvals',
      },
      {
        condition: 'a compliance flag needs clearing',
        outcome: 'review the compliance page',
        discipline: 'compliance',
      },
      {
        condition: 'I need to set up a new workflow',
        outcome: 'check available integrations',
        discipline: 'integrations',
      },
    ],
  },
};

/** Map from discipline label → workspace path segment. */
const DISCIPLINE_PATH: Record<string, string> = {
  'customer-support': 'approvals',
  legal: 'approvals',
  finance: 'approvals',
  sales: 'approvals',
  compliance: 'compliance',
  operations: 'approvals',
  inbox: 'inbox',
  approvals: 'approvals',
  integrations: 'integrations',
};

/**
 * Build the V32 decision-tree card for the given axis and workspace. Returns
 * 2–4 branches, each with a real deep link. Falls back to "general" if the
 * axis is unrecognized.
 */
export function buildDecisionTreeCard(
  args: BuildDecisionTreeArgs,
): DecisionTreeCard {
  const { workspaceId, axis } = args;
  const tree = TREES[axis] ?? TREES['general'];
  const base = `/app/workspace/${workspaceId}`;

  const branches: DecisionBranch[] = tree.branches.map((b) => {
    const pathSegment =
      b.discipline !== undefined
        ? (DISCIPLINE_PATH[b.discipline] ?? 'overview')
        : 'overview';
    return {
      condition: b.condition,
      outcome: b.outcome,
      href: `${base}/${pathSegment}`,
      ...(b.discipline !== undefined ? { discipline: b.discipline } : {}),
    };
  });

  return {
    type: 'decision-tree',
    question: tree.question,
    branches,
  };
}
