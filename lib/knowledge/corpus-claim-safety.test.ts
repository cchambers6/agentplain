/**
 * lib/knowledge/corpus-claim-safety.test.ts
 *
 * THE KNOWLEDGE CORPUS IS A CUSTOMER SURFACE. Rows seeded by
 * `buildSeedAssembly()` whose `contextKind` is in the customer chat's
 * retrieval set (`app/api/chat/route.ts` → SKILL / CUSTOMER / VERTICAL /
 * COMPLIANCE) are retrieved verbatim and spliced into an answer a paying
 * customer reads. They must be audited as MARKETING COPY, not as data.
 *
 * Why this file exists rather than an extension of
 * `tests/marketing-banned-strings.test.ts`: that standard cannot see this
 * corpus. `lib/knowledge/seed-data.ts` is outside its SURFACE_FILES, and
 * its `stripComments` pass makes comment-borne text invisible by
 * construction. Every page-oriented sweep misses these rows by design —
 * which is exactly how a retired billing claim and a model-vendor filename
 * reached the retrieval set and survived repeated audits.
 *
 * Two standing hazards this file is built against:
 *
 *  1. VACUITY. `assert.deepEqual(x, [])` passes green against an empty
 *     input set. So this file reports `examined N of M` and FAILS when
 *     N is zero — a corpus that stopped building must break the gate, not
 *     silently pass it.
 *
 *  2. INSTRUMENT BLINDNESS. A zero-hit result is only meaningful if the
 *     matcher can see a real violation. `control plants` asserts every
 *     pattern fires against a known-positive string before the real corpus
 *     is judged, so a regex that rots into a no-op fails loudly instead of
 *     reporting a clean sweep.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildSeedAssembly } from './seed-data';
import type { KnowledgeUpsertInput } from './types';

/**
 * The customer chat's retrieval set, mirrored from
 * `app/api/chat/route.ts` → `searchKnowledge()` → `contextKinds`.
 * CROSS_CUSTOMER is deliberately absent: platform doctrine rows
 * (positioning, pricing, brand) are NOT retrievable by a customer, which
 * is why they may name things these rows may not.
 */
const CHAT_RETRIEVABLE_KINDS = ['SKILL', 'CUSTOMER', 'VERTICAL', 'COMPLIANCE'] as const;

interface Banned {
  readonly name: string;
  readonly why: string;
  readonly pattern: RegExp;
  /** A string that MUST match, proving the pattern is not a no-op. */
  readonly control: string;
}

/**
 * Retired claims and vendor names, each with the reason it is retired.
 * Sources of truth: `lib/billing/facts.ts` for billing mechanics and
 * price; the model-vendor-invisibility constraint for vendor names.
 */
const BANNED: readonly Banned[] = [
  {
    name: 'reserved-hours',
    why: 'PARTNER_SUPPORT.includesConnerTime is false — partner support is priority email/chat plus a quarterly check-in, with NO reserved hours.',
    pattern: /reserved\s+(?:time|hours?)|dedicated\s+hours?|4\s*hrs?\s*\/?\s*mo|\b4\s+(?:reserved\s+)?hours?\s+(?:a|per|each)\s+month\b/i,
    control: 'Named-service-partner with 4 hrs/mo reserved time each month',
  },
  {
    name: 'thirty-day-trial',
    why: 'TRIAL_PERIOD_DAYS is 7, extended to 14 for CPA and Law. A 30-day trial has never existed.',
    pattern: /30[-\s]day\s+(?:free\s+)?trial/i,
    control: 'Start with a 30-day free trial',
  },
  {
    name: 'first-month-free',
    why: 'Dead. A card IS captured at signup and the first charge lands when the trial ends; the trial is the on-ramp, not a free month.',
    pattern: /first\s+month\s+free/i,
    control: 'Your first month free, then we bill you',
  },
  {
    name: 'per-seat-price',
    why: 'MONTHLY_PRICE_USD_CENTS is ONE flat price for every customer, every vertical, any headcount. There is no seat fee.',
    pattern: /per[-\s]seat\s|\$\s*\d[\d,]*\s*(?:\/|per\s+)seat/i,
    control: 'Billed at $99 per seat per month',
  },
  {
    name: 'retired-price-ladder',
    why: 'The per-tier/per-band ladder is retired. The only live figure is MONTHLY_PRICE_USD_CENTS.',
    pattern: /\$(?:119|149|179|199|219|249|279|299|349|399|449|499|500)\b/,
    control: 'Priced at $499 for the Max tier',
  },
  {
    name: 'model-vendor-anthropic',
    why: 'Model vendor must be invisible on every customer-reachable surface. This row is retrievable by the customer chat.',
    pattern: /anthropic/i,
    control: 'runs on lib/llm/anthropic-provider.ts',
  },
  {
    name: 'model-vendor-claude',
    why: 'Model vendor must be invisible on every customer-reachable surface.',
    pattern: /\bclaude\b/i,
    control: 'powered by Claude',
  },
  {
    name: 'model-vendor-openai',
    why: 'Model vendor must be invisible on every customer-reachable surface.',
    pattern: /openai|chatgpt|gpt-[0-9]/i,
    control: 'we call OpenAI ChatGPT gpt-4o',
  },
];

function chatRetrievableRows(): { retrievable: KnowledgeUpsertInput[]; total: number } {
  const a = buildSeedAssembly();
  const all = [...a.skill, ...a.vertical, ...a.compliance, ...a.crossCustomer];
  const kinds = new Set<string>(CHAT_RETRIEVABLE_KINDS);
  return { retrievable: all.filter((r) => kinds.has(String(r.contextKind))), total: all.length };
}

describe('knowledge corpus claim safety (customer-reachable rows)', () => {
  it('control plants: every banned pattern fires against a known positive', () => {
    const blind = BANNED.filter((b) => !b.pattern.test(b.control)).map((b) => b.name);
    assert.deepEqual(
      blind,
      [],
      `Pattern(s) no longer match their own control string, so a clean sweep would prove nothing: ${blind.join(', ')}`,
    );
    assert.ok(BANNED.length > 0, 'BANNED list is empty — nothing would be checked');
  });

  it('examines a non-empty slice of the corpus (vacuity guard)', () => {
    const { retrievable, total } = chatRetrievableRows();
    console.log(`examined ${retrievable.length} of ${total} seeded knowledge rows`);
    assert.ok(
      retrievable.length > 0,
      'ZERO chat-retrievable rows examined — the corpus stopped building, or the retrieval-kind set drifted. A green pass here would be vacuous.',
    );
    assert.ok(
      total > retrievable.length,
      'Expected at least one NON-retrievable (CROSS_CUSTOMER) row; if every row is retrievable, the kind filter is not filtering.',
    );
  });

  it('carries no retired billing, pricing, or model-vendor claim', () => {
    const { retrievable, total } = chatRetrievableRows();
    const violations: string[] = [];

    for (const row of retrievable) {
      const text = `${row.title}\n${row.body}`;
      for (const banned of BANNED) {
        const m = text.match(banned.pattern);
        if (m) {
          violations.push(
            `[${banned.name}] ${String(row.contextKind)} ${row.sourceId} matched ${JSON.stringify(m[0])} — ${banned.why}`,
          );
        }
      }
    }

    console.log(
      `examined ${retrievable.length} of ${total} rows against ${BANNED.length} banned patterns`,
    );
    assert.deepEqual(violations, [], `Retired claim(s) reachable by the customer chat:\n${violations.join('\n')}`);
  });
});
