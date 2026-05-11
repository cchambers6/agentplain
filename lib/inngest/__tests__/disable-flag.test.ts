/**
 * Unit tests for lib/inngest/disable-flag.ts.
 *
 * The whole point of the in-house disable-flag pattern (capability_inbox
 * proposal #13) is that it's tiny, predictable, and never lies. These
 * tests pin down the normalization rules so every `INNGEST_FN_DISABLE_*`
 * variable name written by the Vercel adapter matches what every Inngest
 * function reads at handler entry. Drift here = silent missed pause.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  INNGEST_FN_DISABLE_PREFIX,
  disableFlagEnvName,
  isFunctionDisabled,
} from '../disable-flag'

describe('disableFlagEnvName — normalization', () => {
  it('exposes the prefix as a constant for reuse', () => {
    assert.equal(INNGEST_FN_DISABLE_PREFIX, 'INNGEST_FN_DISABLE_')
  })

  it('upper-cases ASCII letters', () => {
    assert.equal(
      disableFlagEnvName('cosdailybrief'),
      'INNGEST_FN_DISABLE_COSDAILYBRIEF',
    )
  })

  it('replaces dashes with underscores', () => {
    assert.equal(
      disableFlagEnvName('flatsbo-capability-builder-morning'),
      'INNGEST_FN_DISABLE_FLATSBO_CAPABILITY_BUILDER_MORNING',
    )
  })

  it('handles mixed casing with dashes — covers every real cron id', () => {
    const cases: Record<string, string> = {
      'flatsbo-chief-of-staff-daily-brief':
        'INNGEST_FN_DISABLE_FLATSBO_CHIEF_OF_STAFF_DAILY_BRIEF',
      'flatsbo-listing-coord-readiness-sweep':
        'INNGEST_FN_DISABLE_FLATSBO_LISTING_COORD_READINESS_SWEEP',
      'flatsbo-b2b-sales-rep-daily-pre-call-brief':
        'INNGEST_FN_DISABLE_FLATSBO_B2B_SALES_REP_DAILY_PRE_CALL_BRIEF',
      'flatsbo-b2b-sales-rep-daily-reply-sweep':
        'INNGEST_FN_DISABLE_FLATSBO_B2B_SALES_REP_DAILY_REPLY_SWEEP',
      'flatsbo-business-manager-daily':
        'INNGEST_FN_DISABLE_FLATSBO_BUSINESS_MANAGER_DAILY',
      'flatsbo-tech-lead-daily':
        'INNGEST_FN_DISABLE_FLATSBO_TECH_LEAD_DAILY',
    }
    for (const [input, expected] of Object.entries(cases)) {
      assert.equal(disableFlagEnvName(input), expected, `mismatch for ${input}`)
    }
  })

  it('preserves digits without modification', () => {
    assert.equal(
      disableFlagEnvName('agent-v2-foo'),
      'INNGEST_FN_DISABLE_AGENT_V2_FOO',
    )
  })

  it('throws on empty or non-string input', () => {
    assert.throws(() => disableFlagEnvName(''), /non-empty/)
    // @ts-expect-error — exercising runtime guard
    assert.throws(() => disableFlagEnvName(undefined))
    // @ts-expect-error — exercising runtime guard
    assert.throws(() => disableFlagEnvName(null))
  })
})

describe('isFunctionDisabled — env-var check', () => {
  const fnId = 'flatsbo-capability-builder-morning'
  const envKey = disableFlagEnvName(fnId)

  it('returns true when env var is exactly the literal "true"', () => {
    const env = { [envKey]: 'true' } as NodeJS.ProcessEnv
    assert.equal(isFunctionDisabled(fnId, env), true)
  })

  it('returns false when env var is unset', () => {
    const env = {} as NodeJS.ProcessEnv
    assert.equal(isFunctionDisabled(fnId, env), false)
  })

  it('returns false when env var is the literal "false"', () => {
    const env = { [envKey]: 'false' } as NodeJS.ProcessEnv
    assert.equal(isFunctionDisabled(fnId, env), false)
  })

  it('returns false for typoed truthy strings — strict equality, not coercion', () => {
    for (const v of ['True', 'TRUE', '1', 'yes', 'on', '"true"', ' true ']) {
      const env = { [envKey]: v } as NodeJS.ProcessEnv
      assert.equal(
        isFunctionDisabled(fnId, env),
        false,
        `expected ${JSON.stringify(v)} to be treated as not-disabled`,
      )
    }
  })

  it('returns false when env var is an empty string', () => {
    const env = { [envKey]: '' } as NodeJS.ProcessEnv
    assert.equal(isFunctionDisabled(fnId, env), false)
  })

  it('reads from process.env when no env arg provided', () => {
    const prev = process.env[envKey]
    process.env[envKey] = 'true'
    try {
      assert.equal(isFunctionDisabled(fnId), true)
    } finally {
      if (prev === undefined) delete process.env[envKey]
      else process.env[envKey] = prev
    }
  })

  it('does not cross-contaminate between functions', () => {
    const otherId = 'flatsbo-cos-daily-brief'
    const env = { [disableFlagEnvName(fnId)]: 'true' } as NodeJS.ProcessEnv
    assert.equal(isFunctionDisabled(fnId, env), true)
    assert.equal(isFunctionDisabled(otherId, env), false)
  })
})
