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

/**
 * Parse marketplace entries into { slug, status } pairs. Within each entry
 * object `mcpEndpointTemplate` always appears before `status`, and no template
 * appears between an entry's template and its status — so "the next status
 * after each template" reliably pairs to the same entry.
 */
function parseEntries(src) {
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
    entries.push({ slug: slugMatch[1], status: s[1], template });
  }
  return entries;
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

  console.log(
    `connector-dispatch-coverage: ${entries.length} catalog entries, ${available.length} available, ${covered.length} with a dispatch route.`,
  );

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
