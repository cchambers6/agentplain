/**
 * Tests for the `liveRequires.connectors` mechanism — the honest "live"
 * vs "connect to activate" derivation introduced this PR.
 *
 * Two invariants we lock in:
 *
 *   1. Every chief-of-staff card across all 11 verticals declares
 *      `liveRequires: { connectors: ["GOOGLE", "M365"] }`. The
 *      scheduler skill cannot run against a stubbed calendar anymore;
 *      a card claiming live without a calendar credential would lie.
 *      Per `reference_product_claims_vs_reality_2026_05_22`: live
 *      derives from real state.
 *
 *   2. The agents page derivation rule degrades the card honestly:
 *      - workspace has neither GOOGLE nor M365 active → "connect to
 *        activate" (and `needsConnector: true`).
 *      - workspace has at least one active → no needs-connector flag
 *        (the LIVE / ROOTING badge logic takes over).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getAllVerticalsIncludingOnRamps } from '@/lib/verticals';
import type { AgentRosterEntry } from '@/lib/verticals/types';

// Re-implement the `liveRequiresSatisfied` predicate from
// `app/(product)/app/workspace/[id]/agents/page.tsx` here. We do NOT
// import the server page (it pulls Next + Prisma); the predicate is
// small + the contract is what we want to pin, so a parallel impl
// keeps the test runnable in pure Node.
function liveRequiresSatisfied(
  agent: AgentRosterEntry,
  activeConnectors: ReadonlySet<string>,
): boolean {
  const required = agent.liveRequires?.connectors;
  if (!required || required.length === 0) return true;
  return required.some((c) => activeConnectors.has(c));
}

describe('chief-of-staff cards across all verticals declare liveRequires', () => {
  it('every vertical chief-of-staff card requires a calendar connector', () => {
    // /general is an on-ramp surface (not part of the locked 10) but it
    // also surfaces a Chief of Staff card — that surface needs honest
    // degrade too. Include it via `getAllVerticalsIncludingOnRamps`.
    const verticals = getAllVerticalsIncludingOnRamps();
    // Filter to cards bound to the chief-of-staff-scheduler skill.
    let count = 0;
    for (const v of verticals) {
      for (const agent of v.agentRoster ?? []) {
        if (agent.boundSkill !== 'chief-of-staff-scheduler') continue;
        count += 1;
        assert.ok(
          agent.liveRequires?.connectors?.length,
          `${v.slug}/${agent.slug} must declare liveRequires.connectors so the agents page degrades honestly when no calendar is connected`,
        );
        assert.deepEqual(
          agent.liveRequires!.connectors.sort(),
          ['GOOGLE', 'M365'],
          `${v.slug}/${agent.slug} should require GOOGLE or M365 calendar connectors`,
        );
      }
    }
    // Sanity: the audit reports 11 verticals surfacing chief-of-staff.
    assert.equal(count, 11);
  });
});

describe('/general cross-role cards declare liveRequires for mailbox-bound skills', () => {
  it('inbox-triage / follow-up-chaser / process-doc-drafter on /general all require GOOGLE or M365', () => {
    const verticals = getAllVerticalsIncludingOnRamps();
    const general = verticals.find((v) => v.slug === 'general');
    assert.ok(general, '/general surface must be registered');
    const mailboxBoundSkills = new Set([
      'inbox-triage-general',
      'follow-up-chaser-general',
      'process-doc-drafter-general',
    ]);
    const cards = (general!.agentRoster ?? []).filter(
      (a) => a.boundSkill && mailboxBoundSkills.has(a.boundSkill),
    );
    assert.equal(
      cards.length,
      3,
      'expect three cross-role cards bound to mailbox skills on /general',
    );
    for (const card of cards) {
      assert.ok(
        card.liveRequires?.connectors?.length,
        `/general/${card.slug} must declare liveRequires.connectors`,
      );
      assert.deepEqual(
        card.liveRequires!.connectors.sort(),
        ['GOOGLE', 'M365'],
        `/general/${card.slug} should require GOOGLE or M365`,
      );
    }
  });
});

describe('liveRequiresSatisfied — workspace with no connectors degrades the card', () => {
  it('returns false when none of the required connectors are active', () => {
    const agent: AgentRosterEntry = {
      slug: 'realty-chief-of-staff',
      name: 'Chief of Staff',
      job: 'Proposes meetings.',
      runtime: 'live',
      boundSkill: 'chief-of-staff-scheduler',
      liveRequires: { connectors: ['GOOGLE', 'M365'] },
    };
    const empty = new Set<string>();
    assert.equal(liveRequiresSatisfied(agent, empty), false);
  });
});

describe('liveRequiresSatisfied — workspace with Google connected satisfies the card', () => {
  it('returns true when at least one required connector is active', () => {
    const agent: AgentRosterEntry = {
      slug: 'realty-chief-of-staff',
      name: 'Chief of Staff',
      job: 'Proposes meetings.',
      runtime: 'live',
      boundSkill: 'chief-of-staff-scheduler',
      liveRequires: { connectors: ['GOOGLE', 'M365'] },
    };
    const active = new Set<string>(['GOOGLE']);
    assert.equal(liveRequiresSatisfied(agent, active), true);
  });
});

describe('liveRequiresSatisfied — cards without liveRequires are unaffected', () => {
  it('returns true regardless of active connectors', () => {
    const agent: AgentRosterEntry = {
      slug: 'realty-buyer-inquiry-router',
      name: 'Buyer Inquiry Router',
      job: 'Routes inbound buyer inquiries.',
      runtime: 'live',
      owns: ['buyer-inquiry'],
    };
    assert.equal(liveRequiresSatisfied(agent, new Set()), true);
    assert.equal(liveRequiresSatisfied(agent, new Set(['GOOGLE'])), true);
  });
});

describe('liveRequiresSatisfied — only M365 connected', () => {
  it('still satisfies a card that accepts either GOOGLE or M365', () => {
    const agent: AgentRosterEntry = {
      slug: 'cpa-chief-of-staff',
      name: 'Chief of Staff',
      job: 'Proposes meetings.',
      runtime: 'live',
      boundSkill: 'chief-of-staff-scheduler',
      liveRequires: { connectors: ['GOOGLE', 'M365'] },
    };
    const active = new Set<string>(['M365']);
    assert.equal(liveRequiresSatisfied(agent, active), true);
  });
});
