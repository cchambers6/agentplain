#!/usr/bin/env node
/**
 * tools/connector-dispatch-coverage.mjs
 *
 * Connector dispatch-coverage gate.
 *
 * WHY THIS EXISTS — click-path triage 2026-06-15:
 * HubSpot, Salesforce, Notion, Follow Up Boss, Sierra, and Buildium all
 * CONNECTED and background-synced successfully but had no interactive MCP
 * dispatch route, so every agent action through them silently 404'd — the
 * "card says connected, tool can't act" failure that made buttons feel broken.
 * This gate makes that class of regression impossible to ship again.
 *
 * THE INVARIANT: every marketplace entry that is customer-connectable
 * (`status: 'available'`) and resolves to an `/api/integrations/<slug>-mcp/...`
 * endpoint MUST have a live dispatch route file on disk at
 * `app/api/integrations/<slug>-mcp/[workspaceId]/route.ts`. `coming-soon` and
 * `beta` entries are exempt (no rows exist / not yet promised to work).
 *
 * Source of truth is `lib/integrations/marketplace.ts` — the same catalog the
 * UI reads — so the gate can never drift from what customers actually see.
 *
 * Dependency-free (Node built-ins only) so it runs in the pre-push hook and CI
 * without an install/compile step. Exit 0 = covered; exit 1 = a connectable
 * connector is missing its dispatch route (prints which + the expected path).
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MARKETPLACE = join(ROOT, 'lib', 'integrations', 'marketplace.ts');
const INTEGRATION_DETAIL_PAGE = join(
  ROOT,
  'app',
  '(product)',
  'app',
  'workspace',
  '[id]',
  'integrations',
  '[integrationId]',
  'page.tsx',
);

/**
 * Parse marketplace entries into { id, slug, status, connectMode } records.
 * Within each entry object `id` appears first and `mcpEndpointTemplate`
 * appears before `status`, and no template appears between an entry's
 * template and its status — so "the last id before each template" and "the
 * next status after each template" reliably pair to the same entry.
 * `connectMode` has no fixed position, so it is searched within the entry's
 * span (template → next entry's id).
 */
function parseEntries(src) {
  const idMatches = [...src.matchAll(/^\s{4}id: '([a-z0-9-]+)',$/gm)].map(
    (m) => ({ index: m.index, id: m[1] }),
  );
  const entries = [];
  const templateRe = /mcpEndpointTemplate:\s*'([^']+)'/g;
  const statusRe = /status:\s*'(available|coming-soon|beta)'/g;
  let m;
  while ((m = templateRe.exec(src)) !== null) {
    const template = m[1];
    statusRe.lastIndex = m.index;
    const s = statusRe.exec(src);
    if (!s) continue;
    // slug = the path segment after `/api/integrations/`
    const slugMatch = template.match(/\/api\/integrations\/([^/]+)\//);
    if (!slugMatch) continue;
    const entryId =
      idMatches.filter((i) => i.index < m.index).at(-1)?.id ?? null;
    const entryEnd =
      idMatches.find((i) => i.index > m.index)?.index ?? src.length;
    const connectMode = /connectMode: '([a-z-]+)'/.exec(
      src.slice(m.index, entryEnd),
    )?.[1];
    entries.push({
      id: entryId,
      slug: slugMatch[1],
      status: s[1],
      connectMode: connectMode ?? null,
      template,
    });
  }
  return entries;
}

/**
 * Parse the `API_KEY_CONNECT_URL` map on the integration detail page. Its own
 * doc comment promises every value exists as a Next route — this makes that
 * promise a gate instead of a comment (the boldtrail entry violated it
 * silently until 2026-07-19).
 */
function parseApiKeyConnectUrls(src) {
  const block = /const API_KEY_CONNECT_URL[^=]*=\s*\{([\s\S]*?)\};/.exec(src);
  if (!block) return null;
  return [...block[1].matchAll(/['"]?([a-z0-9-]+)['"]?:\s*['"]([^'"]+)['"]/g)].map(
    (m) => ({ id: m[1], url: m[2] }),
  );
}

function main() {
  if (!existsSync(MARKETPLACE)) {
    console.error(`❌ connector-dispatch-coverage: cannot find ${MARKETPLACE}`);
    process.exit(2);
  }
  const src = readFileSync(MARKETPLACE, 'utf8');
  const entries = parseEntries(src);
  if (entries.length === 0) {
    console.error('❌ connector-dispatch-coverage: parsed zero marketplace entries — parser or catalog drift.');
    process.exit(2);
  }

  const available = entries.filter((e) => e.status === 'available');
  const missing = [];
  const covered = [];

  for (const entry of available) {
    const routePath = join(ROOT, 'app', 'api', 'integrations', entry.slug, '[workspaceId]', 'route.ts');
    if (existsSync(routePath)) {
      covered.push(entry.slug);
    } else {
      missing.push({ slug: entry.slug, expected: `app/api/integrations/${entry.slug}/[workspaceId]/route.ts` });
    }
  }

  // Invariant B — an `available` api-key connector MUST have a connect route,
  // or the paste-key form either 404s on submit or (when its
  // API_KEY_CONNECT_URL entry is absent) never renders: "available" +
  // unconnectable, the silent-dead-end class audit-2026-07-02 dept-5 flagged.
  const missingConnect = [];
  for (const entry of available) {
    if (entry.connectMode !== 'api-key' || entry.id === null) continue;
    const connectRoute = join(ROOT, 'app', 'api', 'integrations', entry.id, 'connect', 'route.ts');
    if (!existsSync(connectRoute)) {
      missingConnect.push({ id: entry.id, expected: `app/api/integrations/${entry.id}/connect/route.ts` });
    }
  }

  // Invariant C — every entry in the detail page's API_KEY_CONNECT_URL map
  // MUST resolve to a real connect route (the map's own documented contract).
  const staleConnectUrls = [];
  if (!existsSync(INTEGRATION_DETAIL_PAGE)) {
    console.error(`❌ connector-dispatch-coverage: cannot find ${INTEGRATION_DETAIL_PAGE}`);
    process.exit(2);
  }
  const pageSrc = readFileSync(INTEGRATION_DETAIL_PAGE, 'utf8');
  const connectUrls = parseApiKeyConnectUrls(pageSrc);
  if (connectUrls === null || connectUrls.length === 0) {
    console.error('❌ connector-dispatch-coverage: parsed zero API_KEY_CONNECT_URL entries — parser or page drift.');
    process.exit(2);
  }
  for (const { id, url } of connectUrls) {
    const rel = url.replace(/^\//, '').split('/');
    const routePath = join(ROOT, 'app', ...rel, 'route.ts');
    if (!existsSync(routePath)) {
      staleConnectUrls.push({ id, expected: `app/${url.replace(/^\//, '')}/route.ts` });
    }
  }

  console.log(
    `connector-dispatch-coverage: ${entries.length} catalog entries, ${available.length} available, ${covered.length} with a dispatch route, ${connectUrls.length} api-key connect URLs checked.`,
  );

  if (missingConnect.length > 0 || staleConnectUrls.length > 0) {
    console.error('');
    for (const { id, expected } of missingConnect) {
      console.error(`❌ ${id} is status:"available" with connectMode:"api-key" but has no connect route. Add: ${expected}`);
    }
    for (const { id, expected } of staleConnectUrls) {
      console.error(`❌ API_KEY_CONNECT_URL["${id}"] points at a route that does not exist: ${expected}`);
    }
    console.error('');
    console.error('   An api-key connector the catalog advertises as connectable must have a live');
    console.error('   connect route, and the detail page map must never point at a missing one —');
    console.error('   otherwise the paste-key form 404s or never renders ("available" + unconnectable).');
    process.exit(1);
  }

  if (missing.length > 0) {
    console.error('');
    console.error(`❌ ${missing.length} connectable connector(s) have NO interactive dispatch route:`);
    for (const { slug, expected } of missing) {
      console.error(`   • ${slug} — agent actions will 404. Add: ${expected}`);
    }
    console.error('');
    console.error('   A connector marked status:"available" in lib/integrations/marketplace.ts MUST have a');
    console.error('   workspace-scoped MCP dispatch route, or mark it status:"coming-soon" until it does.');
    console.error('   Otherwise the card says "connected" but every agent action 404s — the');
    console.error('   "every button feels broken" failure this gate exists to prevent.');
    process.exit(1);
  }

  console.log(`✅ Every available connector has a live dispatch route: ${covered.sort().join(', ')}`);
  process.exit(0);
}

main();
