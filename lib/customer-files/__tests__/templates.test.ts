/**
 * Unit tests for the /settings/voice read model (pure helpers only —
 * the DB-backed `listWorkspaceTemplates` is exercised through the page
 * + the ingestion e2e). Covers:
 *   - categorizeTemplate bucketing + precedence
 *   - stripChunkSuffix
 *   - foldChunkRows: per-chunk rows collapse to one row per source file,
 *     chunkCount + most-recent timestamp aggregate correctly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  categorizeTemplate,
  stripChunkSuffix,
  foldChunkRows,
} from '../templates';

describe('categorizeTemplate', () => {
  it('buckets by filename keyword, most-specific first', () => {
    assert.equal(categorizeTemplate('Past deal — 1842 Riverbend (closed)', null), 'Deals & contracts');
    assert.equal(categorizeTemplate('Carter Realty Listing Playbook', null), 'Playbook & process');
    assert.equal(categorizeTemplate('123 Main St listing description', null), 'Listing');
    assert.equal(categorizeTemplate('Buyer follow-up email', null), 'Email & replies');
    assert.equal(categorizeTemplate('random notes', null), 'Other');
  });

  it('falls back to mime type for message-shaped files', () => {
    assert.equal(categorizeTemplate('untitled', 'message/rfc822'), 'Email & replies');
    assert.equal(categorizeTemplate('untitled', 'text/plain'), 'Other');
  });
});

describe('stripChunkSuffix', () => {
  it('removes the "(part n/m)" suffix ingest appends to multi-chunk titles', () => {
    assert.equal(stripChunkSuffix('Listing Playbook (part 3/7)'), 'Listing Playbook');
    assert.equal(stripChunkSuffix('Listing Playbook'), 'Listing Playbook');
    assert.equal(stripChunkSuffix('Deal (closed 2026-02)'), 'Deal (closed 2026-02)');
  });
});

describe('foldChunkRows', () => {
  it('collapses per-chunk rows into one template per fileId', () => {
    const folded = foldChunkRows([
      {
        title: 'Playbook (part 1/2)',
        sourceUrl: 'https://drive/playbook',
        metadata: { fileId: 'f1', source: 'drive', mimeType: 'text/plain' },
        updatedAt: new Date('2026-06-01T10:00:00Z'),
      },
      {
        title: 'Playbook (part 2/2)',
        sourceUrl: 'https://drive/playbook',
        metadata: { fileId: 'f1', source: 'drive', mimeType: 'text/plain' },
        updatedAt: new Date('2026-06-01T10:05:00Z'),
      },
      {
        title: 'Past deal summary',
        sourceUrl: null,
        metadata: { fileId: 'f2', source: 'drive', mimeType: 'text/markdown' },
        updatedAt: new Date('2026-06-02T09:00:00Z'),
      },
    ]);

    assert.equal(folded.length, 2);
    // Newest-ingested first.
    assert.equal(folded[0].fileId, 'f2');
    const playbook = folded.find((t) => t.fileId === 'f1');
    assert.ok(playbook);
    assert.equal(playbook!.title, 'Playbook');
    assert.equal(playbook!.chunkCount, 2);
    assert.equal(playbook!.category, 'Playbook & process');
    // Most-recent timestamp wins for the folded row.
    assert.equal(playbook!.lastIngestedAt, '2026-06-01T10:05:00.000Z');
  });

  it('folds by stripped title when a row has no fileId', () => {
    const folded = foldChunkRows([
      {
        title: 'Notes (part 1/2)',
        sourceUrl: null,
        metadata: {},
        updatedAt: new Date('2026-06-01T10:00:00Z'),
      },
      {
        title: 'Notes (part 2/2)',
        sourceUrl: null,
        metadata: {},
        updatedAt: new Date('2026-06-01T10:01:00Z'),
      },
    ]);
    assert.equal(folded.length, 1);
    assert.equal(folded[0].chunkCount, 2);
    assert.equal(folded[0].title, 'Notes');
  });
});
