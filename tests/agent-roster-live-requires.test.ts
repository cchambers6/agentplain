/**
 * Tests for the `liveRequires` mechanism — the honest "live" vs "connect
 * to activate" derivation on the agents page.
 *
 * ── What changed in this PR, and why it matters to this file ────────────
 *
 * This test used to carry a HAND-COPIED re-implementation of
 * `liveRequiresSatisfied`, with a comment explaining that the app-router
 * module could not be imported from a pure-Node test. That made the file
 * a mirror, not a test: it would have stayed green through any change to
 * the real predicate, including the one this PR fixes. The predicate now
 * lives in `lib/verticals/live-requires.ts` (no Next, no Prisma, no
 * React) and is imported here directly.
 *
 * Invariants locked in:
 *
 *   1. Every chief-of-staff card across all 11 verticals declares
 *      `liveRequires: { connectors: ["GOOGLE", "M365"] }`.
 *   2. Those cards additionally require the `calendar` CAPABILITY, via
 *      the `lib/skills/skill-capabilities.ts` sidecar. A connector alone
 *      is not enough: Gmail and Google Calendar share one GOOGLE
 *      credential row, so "GOOGLE is active" was satisfied by a mail-only
 *      grant and the card rendered LIVE while every calendar read 403'd.
 *   3. The mailbox-bound cards on /general do NOT require a capability —
 *      mail scope is what the connect flows actually request, so for them
 *      provider presence really does imply capability. This is asserted
 *      rather than assumed, so that adding a capability to the sidecar
 *      cannot silently degrade three working cards.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getAllVerticalsIncludingOnRamps } from '@/lib/verticals';
import {
  connectPrompt,
  liveRequiresSatisfied,
  needsCapabilityReconnect,
  requiredCapability,
  type RosterCapability,
} from '@/lib/verticals/live-requires';
import type { AgentRosterEntry } from '@/lib/verticals/types';

const NO_CAPABILITIES: ReadonlySet<RosterCapability> = new Set();
const CALENDAR_OK: ReadonlySet<RosterCapability> = new Set(['calendar']);

function chiefOfStaffCard(
  overrides: Partial<AgentRosterEntry> = {},
): AgentRosterEntry {
  return {
    slug: 'realty-chief-of-staff',
    name: 'Chief of Staff',
    job: 'Proposes meetings.',
    runtime: 'live',
    boundSkill: 'chief-of-staff-scheduler',
    liveRequires: { connectors: ['GOOGLE', 'M365'] },
    ...overrides,
  };
}

describe('chief-of-staff cards across all verticals declare liveRequires', () => {
  it('every vertical chief-of-staff card requires a calendar connector AND the calendar capability', () => {
    // /general is an on-ramp surface (not part of the locked 10) but it
    // also surfaces a Chief of Staff card — that surface needs honest
    // degrade too. Include it via `getAllVerticalsIncludingOnRamps`.
    const verticals = getAllVerticalsIncludingOnRamps();
    let examined = 0;
    for (const v of verticals) {
      for (const agent of v.agentRoster ?? []) {
        if (agent.boundSkill !== 'chief-of-staff-scheduler') continue;
        examined += 1;
        assert.ok(
          agent.liveRequires?.connectors?.length,
          `${v.slug}/${agent.slug} must declare liveRequires.connectors so the agents page degrades honestly when no calendar is connected`,
        );
        assert.deepEqual(
          [...agent.liveRequires!.connectors].sort(),
          ['GOOGLE', 'M365'],
          `${v.slug}/${agent.slug} should require GOOGLE or M365 calendar connectors`,
        );
        assert.equal(
          requiredCapability(agent),
          'calendar',
          `${v.slug}/${agent.slug} must require the calendar CAPABILITY — a GOOGLE credential can be mail-only`,
        );
      }
    }
    assert.ok(
      examined > 0,
      'examined 0 chief-of-staff cards — the roster corpus is empty, so this suite proves nothing',
    );
    // Sanity: the audit reports 11 verticals surfacing chief-of-staff.
    assert.equal(examined, 11, `examined ${examined} of 11 expected cards`);
  });
});

describe('/general cross-role cards declare liveRequires for mailbox-bound skills', () => {
  it('inbox-triage / follow-up-chaser / process-doc-drafter on /general all require GOOGLE or M365 and NO capability', () => {
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
      `examined ${cards.length} of 3 expected cross-role cards bound to mailbox skills on /general`,
    );
    for (const card of cards) {
      assert.ok(
        card.liveRequires?.connectors?.length,
        `/general/${card.slug} must declare liveRequires.connectors`,
      );
      assert.deepEqual(
        [...card.liveRequires!.connectors].sort(),
        ['GOOGLE', 'M365'],
        `/general/${card.slug} should require GOOGLE or M365`,
      );
      assert.equal(
        requiredCapability(card),
        null,
        `/general/${card.slug} needs mail scope, which the connect flow does request — adding a capability here would degrade a card that genuinely works`,
      );
    }
  });
});

describe('liveRequiresSatisfied — connector dimension', () => {
  it('returns false when none of the required connectors are active', () => {
    assert.equal(
      liveRequiresSatisfied(chiefOfStaffCard(), new Set(), CALENDAR_OK),
      false,
    );
  });

  it('cards without liveRequires are unaffected', () => {
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

describe('liveRequiresSatisfied — capability dimension (the defect)', () => {
  it('GOOGLE active but calendar capability NOT granted → card is not live', () => {
    // This is the Gmail-only workspace. Before this PR the card said
    // LIVE here, and the sweep 403'd behind it.
    assert.equal(
      liveRequiresSatisfied(
        chiefOfStaffCard(),
        new Set(['GOOGLE']),
        NO_CAPABILITIES,
      ),
      false,
    );
  });

  it('GOOGLE active AND calendar capability granted → card is live', () => {
    assert.equal(
      liveRequiresSatisfied(
        chiefOfStaffCard(),
        new Set(['GOOGLE']),
        CALENDAR_OK,
      ),
      true,
    );
  });

  it('M365 active AND calendar capability granted → card is live', () => {
    assert.equal(
      liveRequiresSatisfied(
        chiefOfStaffCard({ slug: 'cpa-chief-of-staff' }),
        new Set(['M365']),
        CALENDAR_OK,
      ),
      true,
    );
  });

  it('omitting the capability set fails CLOSED, never open', () => {
    // A caller that forgets to pass capabilities must understate what
    // works. Overstating is the bug class this whole mechanism exists to
    // prevent, so the default must not be "assume granted".
    assert.equal(
      liveRequiresSatisfied(chiefOfStaffCard(), new Set(['GOOGLE'])),
      false,
    );
  });
});

describe('needsCapabilityReconnect — distinguishes the two failure modes', () => {
  it('nothing connected → NOT a reconnect case (it is a connect case)', () => {
    assert.equal(
      needsCapabilityReconnect(chiefOfStaffCard(), new Set(), NO_CAPABILITIES),
      false,
    );
  });

  it('connected without the scope → IS a reconnect case', () => {
    assert.equal(
      needsCapabilityReconnect(
        chiefOfStaffCard(),
        new Set(['GOOGLE']),
        NO_CAPABILITIES,
      ),
      true,
    );
  });

  it('fully satisfied → not a reconnect case', () => {
    assert.equal(
      needsCapabilityReconnect(
        chiefOfStaffCard(),
        new Set(['GOOGLE']),
        CALENDAR_OK,
      ),
      false,
    );
  });

  it('a card with no capability requirement is never a reconnect case', () => {
    const mailCard = chiefOfStaffCard({
      slug: 'general-inbox-triage',
      boundSkill: 'inbox-triage-general',
    });
    assert.equal(
      needsCapabilityReconnect(mailCard, new Set(['GOOGLE']), NO_CAPABILITIES),
      false,
    );
  });
});

describe('connectPrompt — the customer is told the right next step', () => {
  it('nothing connected → asks them to connect', () => {
    const msg = connectPrompt(chiefOfStaffCard(), { capabilityMissing: false });
    assert.match(msg, /^Connect /);
    assert.match(msg, /Google Calendar or Outlook Calendar/);
  });

  it('connected without calendar scope → asks them to RECONNECT', () => {
    const msg = connectPrompt(chiefOfStaffCard(), { capabilityMissing: true });
    assert.match(msg, /Reconnect/);
    assert.match(msg, /calendar access/);
  });

  it('never claims the capability is working or that anything was scheduled', () => {
    for (const capabilityMissing of [true, false]) {
      const msg = connectPrompt(chiefOfStaffCard(), { capabilityMissing });
      assert.doesNotMatch(msg, /\blive\b/i);
      assert.doesNotMatch(msg, /scheduled|booked|on your calendar/i);
    }
  });
});
