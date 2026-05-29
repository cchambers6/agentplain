/**
 * lib/plaino/preference-memory.test.ts
 *
 * Round-trip + edge-case tests for the preference body wire format.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreferenceMemoryBody,
  parsePreferenceMemoryBody,
  preferenceScopeFromTitle,
  PREFERENCE_MEMORY_TITLE_PREFIX,
} from './preference-memory';

describe('preference-memory wire format', () => {
  it('round-trips scope + rule', () => {
    const body = buildPreferenceMemoryBody({
      scope: 'inbox-triage',
      rule: 'Flag mail from county clerks as high priority',
    });
    const parsed = parsePreferenceMemoryBody(body);
    assert.ok(parsed);
    assert.equal(parsed?.scope, 'inbox-triage');
    assert.equal(parsed?.rule, 'Flag mail from county clerks as high priority');
  });

  it('returns null on a body that is not a preference', () => {
    assert.equal(parsePreferenceMemoryBody(''), null);
    assert.equal(parsePreferenceMemoryBody('just some text'), null);
    assert.equal(
      parsePreferenceMemoryBody('scope: only\nbut no rule line'),
      null,
    );
  });

  it('rejects an unknown scope', () => {
    const parsed = parsePreferenceMemoryBody(
      'scope: made-up\nrule: do something',
    );
    assert.equal(parsed, null);
  });

  it('extracts scope from the pref:<scope> title shape', () => {
    assert.equal(
      preferenceScopeFromTitle(`${PREFERENCE_MEMORY_TITLE_PREFIX}email-draft`),
      'email-draft',
    );
    assert.equal(preferenceScopeFromTitle('plain title'), null);
    assert.equal(
      preferenceScopeFromTitle(`${PREFERENCE_MEMORY_TITLE_PREFIX}made-up`),
      null,
    );
  });
});
