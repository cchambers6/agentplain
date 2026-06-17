/**
 * lib/plaino/system-prompt.test.ts
 *
 * Pins the Plaino system prompt:
 *   - V1 version marker is the first line (so the prompt cache key
 *     is stable + tests can detect drift).
 *   - The capability section is composed from the supplied snapshot —
 *     no hard-coded capability claims in the prompt.
 *   - The decline-honestly directive is present.
 *   - The no-outbound rule is named explicitly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildCapabilitySnapshotSync } from './capabilities';
import {
  buildSystemPrompt,
  PLAINO_SYSTEM_PROMPT_VERSION,
} from './system-prompt';

describe('plaino system prompt', () => {
  it('starts with the V1 version marker', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set(),
    });
    const prompt = buildSystemPrompt({
      workspaceName: 'Acme Brokerage',
      capabilities: snapshot,
    });
    assert.ok(
      prompt.startsWith(PLAINO_SYSTEM_PROMPT_VERSION),
      `expected prompt to start with ${PLAINO_SYSTEM_PROMPT_VERSION}`,
    );
  });

  it('names the no-outbound rule and the decline-honestly directive', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set(),
    });
    const prompt = buildSystemPrompt({
      workspaceName: 'Acme Brokerage',
      capabilities: snapshot,
    });
    assert.match(prompt, /NO OUTBOUND/);
    assert.match(prompt, /DECLINE_HONESTLY/);
    assert.match(prompt, /service partner/);
    // The word "heritage" appears in the brand-voice block, and the
    // word "tone" appears on the next line in the rendered prompt;
    // assert both independently rather than requiring them adjacent.
    assert.match(prompt, /heritage/);
    assert.match(prompt, /tone\./);
  });

  it('lists ONLY the connected integrations under "WIRED IN THIS WORKSPACE"', () => {
    const connectedOnlyGoogle = buildCapabilitySnapshotSync({
      connectedProviders: new Set(['GOOGLE']),
    });
    const prompt = buildSystemPrompt({
      workspaceName: 'Acme Brokerage',
      capabilities: connectedOnlyGoogle,
    });
    // Gmail is connected — must appear under the wired section.
    assert.match(prompt, /WIRED IN THIS WORKSPACE[\s\S]*Gmail/);
    // Outlook is M365 and not connected — must appear under available
    // but not connected, not under wired.
    const wiredSection = prompt.split('INTEGRATIONS AVAILABLE BUT NOT YET CONNECTED')[0];
    assert.ok(wiredSection.includes('Gmail'));
    assert.ok(!wiredSection.includes('Outlook'), 'Outlook should not appear in the wired section when M365 is unconnected');
  });

  it('renders "none connected yet" when the workspace has wired nothing', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set(),
    });
    const prompt = buildSystemPrompt({
      workspaceName: 'Acme Brokerage',
      capabilities: snapshot,
    });
    assert.match(prompt, /none connected yet/);
  });

  it('threads the persona verbs (fetch, herd, sit/wait) through the prompt', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set(),
    });
    const prompt = buildSystemPrompt({
      workspaceName: 'Acme Brokerage',
      capabilities: snapshot,
    });
    // The persona is encoded as VERBS, not as a literal mascot. Each
    // of the three behaviors must appear in the prompt — the dispatcher
    // routes ANSWER/REGISTER/DECLINE_HONESTLY using fetch/herd/sit
    // language respectively.
    assert.match(prompt, /\bfetch\b/i, 'expected FETCH verb in prompt');
    assert.match(prompt, /\bherd\b/i, 'expected HERD verb in prompt');
    assert.match(prompt, /\bwait\b/i, 'expected SIT/WAIT framing in prompt');
  });

  it('NEVER literalizes the persona metaphor to the customer', () => {
    // The internal scaffold is a working sheepdog on the plains. The
    // prompt's instructions to the model MUST forbid disclosure of the
    // animal/dog metaphor to customers. This test pins the no-leak rule
    // — if it ever softens, a customer-visible "I am a dog" answer
    // becomes possible and brand integrity breaks.
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set(),
    });
    const prompt = buildSystemPrompt({
      workspaceName: 'Acme Brokerage',
      capabilities: snapshot,
    });
    assert.match(
      prompt,
      /DO NOT DISCLOSE/,
      'expected an explicit DO NOT DISCLOSE directive for the persona scaffolding',
    );
    assert.match(
      prompt,
      /never literalize/i,
      'expected the prompt to forbid literalizing the persona to customers',
    );
    // And the explicit forbidden phrases must be named in the prompt so
    // the model has no ambiguity about what counts as a leak.
    assert.match(prompt, /NEVER[\s\S]*?say you are a dog/);
    assert.match(prompt, /robot dog/);
  });

  it('injects a vertical voice block ONLY when a vertical is supplied', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set(),
    });
    const withoutVertical = buildSystemPrompt({
      workspaceName: 'Acme Firm',
      capabilities: snapshot,
    });
    assert.doesNotMatch(withoutVertical, /WHO THIS WORKSPACE SERVES/);

    const cpa = buildSystemPrompt({
      workspaceName: 'Acme Firm',
      capabilities: snapshot,
      vertical: 'CPA',
    });
    assert.match(cpa, /WHO THIS WORKSPACE SERVES/);
    assert.match(cpa, /CPA \/ accounting firm/);
    // Tone, not capability — the block must say so explicitly.
    assert.match(cpa, /NOT what[\s\S]*you claim to do/);

    // The block is vertical-specific: a law workspace reads differently.
    const law = buildSystemPrompt({
      workspaceName: 'Acme Firm',
      capabilities: snapshot,
      vertical: 'LAW',
    });
    assert.match(law, /law firm/);
    assert.notEqual(cpa, law);
    // Adding the block must NOT disturb the version marker / cache key.
    assert.ok(cpa.startsWith(PLAINO_SYSTEM_PROMPT_VERSION));
  });

  it('includes the 8 disciplines from the catalog', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set(),
    });
    const prompt = buildSystemPrompt({
      workspaceName: 'Acme Brokerage',
      capabilities: snapshot,
    });
    for (const name of [
      'Analytics',
      'Research',
      'Legal',
      'Marketing',
      'Sales enablement',
      'Customer success',
      'Finance',
      'Operations',
    ]) {
      assert.ok(
        prompt.includes(name),
        `expected discipline name "${name}" to appear in the system prompt`,
      );
    }
  });
});
