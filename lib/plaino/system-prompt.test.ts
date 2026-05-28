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
