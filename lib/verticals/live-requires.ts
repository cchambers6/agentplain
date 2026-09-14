/**
 * lib/verticals/live-requires.ts
 *
 * The `liveRequires` predicate -- the rule that decides whether a roster
 * card claiming `runtime: "live"` is HONESTLY live for a given workspace.
 *
 * This lived in `app/(product)/app/workspace/[id]/agents/live-requires.ts`,
 * and `tests/agent-roster-live-requires.test.ts` carried a hand-copied
 * SECOND implementation of it, with a comment explaining that the app
 * module could not be imported from a pure-Node test. That is a drift
 * hazard of exactly the kind this repo has been bitten by before: a test
 * that re-implements the thing it is testing stays green no matter what
 * the production code does. Moving the predicate into `lib/` (no Next, no
 * Prisma, no React) lets the page and the test import the SAME function.
 * The app-directory module is now a re-export shim.
 *
 * -- Why capability exists ---------------------------------------------
 *
 * `connectors` answers "does the workspace have an ACTIVE credential for
 * one of these providers?". For the Chief of Staff card that question had
 * the wrong answer: Gmail and Google Calendar share one GOOGLE credential
 * row, so a mail-only connection satisfied
 * `connectors: ["GOOGLE","M365"]` and the card rendered LIVE while every
 * calendar read 403'd at Google.
 *
 * A capability is the second half of the question -- a named runtime
 * ability the workspace must actually hold, verified against the scope
 * the provider granted rather than the provider's mere presence. Which
 * skills require which capability is declared in
 * `lib/skills/skill-capabilities.ts`; the calendar verdict itself lives
 * in `lib/integrations/calendar-scope.ts`.
 */

import { capabilityForSkill, type SkillCapability } from '@/lib/skills/skill-capabilities';
import type { AgentRosterEntry } from './types';

export type RosterCapability = SkillCapability;

/**
 * The capability this card requires, derived from the skill it is bound
 * to. Cards with no bound skill, or whose skill needs nothing beyond a
 * connector, return null.
 */
export function requiredCapability(
  agent: AgentRosterEntry,
): RosterCapability | null {
  return capabilityForSkill(agent.boundSkill);
}

/**
 * Render-time precondition check for `liveRequires`.
 *
 * A card is satisfied when:
 *   1. it declares no required connectors, OR
 *   2. at least one required connector is ACTIVE **and**, if its bound
 *      skill names a capability, that capability is satisfied.
 *
 * `satisfiedCapabilities` defaults to EMPTY, which means a card whose
 * skill declares a capability degrades to "connect to activate" when a
 * caller forgets to supply the set. That direction is deliberate. This
 * predicate guards a truthfulness claim, so its failure mode must be
 * understating what works, never overstating it.
 */
export function liveRequiresSatisfied(
  agent: AgentRosterEntry,
  activeConnectors: ReadonlySet<string>,
  satisfiedCapabilities: ReadonlySet<RosterCapability> = new Set(),
): boolean {
  const required = agent.liveRequires?.connectors;
  if (!required || required.length === 0) return true;
  if (!required.some((c) => activeConnectors.has(c))) return false;
  const capability = requiredCapability(agent);
  if (!capability) return true;
  return satisfiedCapabilities.has(capability);
}

/**
 * True when the card's connector IS wired but the capability behind it is
 * not -- i.e. the customer connected Google, but granted mail scope only.
 *
 * The agents page needs this distinct from "nothing connected", because
 * the two need different next actions from the customer: one is "connect
 * an account", the other is "reconnect and allow calendar access". The
 * single old "connect to activate" message sent a customer who had
 * ALREADY connected Google to a Connections page where everything looked
 * green -- which is a large part of why this defect stayed invisible.
 */
export function needsCapabilityReconnect(
  agent: AgentRosterEntry,
  activeConnectors: ReadonlySet<string>,
  satisfiedCapabilities: ReadonlySet<RosterCapability> = new Set(),
): boolean {
  const required = agent.liveRequires?.connectors;
  if (!required || required.length === 0) return false;
  const capability = requiredCapability(agent);
  if (!capability) return false;
  if (!required.some((c) => activeConnectors.has(c))) return false;
  return !satisfiedCapabilities.has(capability);
}

/**
 * Map `liveRequires.connectors` provider keys (which mirror
 * `IntegrationCredential.provider`) to the marketplace tile names a
 * customer recognizes. Falls back to the raw key when no mapping
 * exists so a new connector key doesn't render as blank.
 */
export function formatConnectors(connectors: string[]): string {
  if (connectors.length === 0) return 'a connector';
  const labels = connectors.map((c) => {
    switch (c) {
      case 'GOOGLE':
        return 'Google Calendar';
      case 'M365':
        return 'Outlook Calendar';
      case 'QUICKBOOKS':
        return 'QuickBooks';
      case 'DOCUSIGN':
        return 'DocuSign';
      case 'SLACK':
        return 'Slack';
      default:
        return c.toLowerCase();
    }
  });
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

/**
 * The customer-facing prompt for an unsatisfied card. Kept beside the
 * predicate so the verdict and the sentence explaining it cannot drift.
 *
 * Note what this never says: it does not claim the capability is working,
 * and it does not claim anything has been scheduled or sent.
 */
export function connectPrompt(
  agent: AgentRosterEntry,
  opts: { capabilityMissing: boolean },
): string {
  const connectors = [...(agent.liveRequires?.connectors ?? [])];
  if (opts.capabilityMissing && requiredCapability(agent) === 'calendar') {
    return 'Reconnect and allow calendar access to activate this capability';
  }
  return `Connect ${formatConnectors(connectors)} to activate this capability`;
}
