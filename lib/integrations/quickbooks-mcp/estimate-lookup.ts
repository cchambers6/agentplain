/**
 * lib/integrations/quickbooks-mcp/estimate-lookup.ts
 *
 * QuickBooks Online implementation of the `EstimateLookup` port defined in
 * `lib/skills/home-services-estimate-followup/types.ts`.
 *
 * Bridges the QB MCP surface (which returns raw `EstimateSummary` DTOs) to the
 * skill's `EstimateRecord` shape (which carries the homeowner contact, trade
 * label, and rep).  The adapter does the necessary field mapping + discards any
 * estimate whose status is not `Pending` or blank (i.e. already accepted,
 * rejected, or closed).
 *
 * Per `feedback_runner_portability.md` — the adapter is the ONLY place that
 * imports from `lib/integrations/quickbooks-mcp`.  The skill imports the
 * `EstimateLookup` port from its own `types.ts`; it has no QB dependency.
 *
 * Per `feedback_cold_start_safe_agents.md` — the adapter is stateless.
 * Every `fetchOpenEstimates` call constructs a fresh QB server instance (via
 * the injected factory) so credential resolution is re-run on each call.
 *
 * Trade detection: QB stores free-text memo fields, not structured trade
 * enums.  We scan `customerMemo` + `customerName` for keyword hints.  The
 * default is `'general-contractor'` — a safe fallback for any trade that
 * doesn't match.  Operators with a correctly-templated QB workflow will see
 * the correct trade label; others see "remodel" (the GC label), which is
 * accurate-enough for the nudge framing.
 *
 * Homeowner contact mapping: QBO Estimate exposes a `BillEmail` field which
 * becomes `customerEmail`.  The name comes from `CustomerRef.name`
 * (display-only, typically the billing name).  Phone is unavailable on the
 * Estimate object without a separate Customer lookup — we populate `null` so
 * the skill's cold-handoff still works; the rep can look up the phone number
 * from their QB customer record.
 */

import { skillError, skillOk, type SkillResult } from '@/lib/skills/types';
import type {
  EstimateLookup,
  EstimateRecord,
} from '@/lib/skills/home-services-estimate-followup/types';
import type { QuickbooksMcpServer } from './types';

const OPEN_STATUSES = new Set<string | null>(['Pending', null]);

export interface QuickbooksEstimateLookupOptions {
  /** Factory function so the adapter is testable with the TestQuickbooksMcpServer. */
  serverFactory: (args: { workspaceId: string }) => QuickbooksMcpServer;
  /** Rep (sales person / owner) for this workspace. The follow-up drafts are
   *  signed by this person.  Populated from the operator's workspace profile. */
  rep: { name: string; email: string; phone: string | null };
  /** Maximum open estimates to fetch in one pass (1..100, default 50).
   *  A shop with more than 50 open estimates should tune their QB workflow;
   *  the cap keeps the skill fast and avoids memory spikes. */
  maxCount?: number;
}

export class QuickbooksEstimateLookup implements EstimateLookup {
  readonly name = 'quickbooks' as const;

  constructor(private readonly opts: QuickbooksEstimateLookupOptions) {}

  async fetchOpenEstimates(args: {
    workspaceId: string;
  }): Promise<SkillResult<EstimateRecord[]>> {
    const server = this.opts.serverFactory({ workspaceId: args.workspaceId });
    const count = this.opts.maxCount ?? 50;

    // Fetch only Pending estimates — these are the quotes waiting on the
    // homeowner.  The filter is server-side (QB SQL WHERE clause) so we
    // don't over-fetch and discard.
    const res = await server.listEstimates({ status: 'Pending', count });
    if (!res.ok) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `QuickBooks listEstimates failed: ${res.error.message}`,
        res.error.code,
      );
    }

    const records: EstimateRecord[] = [];
    for (const est of res.value.estimates) {
      // Belt-and-suspenders: skip any estimate that slipped through with a
      // non-open status (e.g. the status field was null and the QB SQL WHERE
      // didn't filter it — rare but defensive).
      if (!OPEN_STATUSES.has(est.txnStatus)) continue;

      // QBO requires a customer name and a send date to be actionable.
      if (!est.customerName || !est.txnDate) continue;

      // Derive a send date from txnDate (ISO YYYY-MM-DD string).
      const sentAt = parseTxnDate(est.txnDate);
      if (!sentAt) continue;

      // Homeowner contact from QB fields.  Phone is unavailable on the
      // Estimate entity without a second Customer lookup — set null.
      const homeownerEmail = est.customerEmail ?? `unknown-${est.id}@placeholder.invalid`;
      const homeowner = {
        name: est.customerName,
        email: homeownerEmail,
        phone: null as string | null,
      };

      // Service address is often encoded in the memo or is implicit from the
      // Customer record — QB Estimate has no dedicated address field for the
      // job site.  Fall back to the doc number as a minimal identifier.
      const serviceAddress = extractServiceAddress(est.customerMemo) ?? est.docNumber ?? est.id;

      const record: EstimateRecord = {
        estimateId: est.id,
        homeowner,
        serviceAddress,
        trade: detectTrade(est.customerMemo, est.customerName),
        sentAt,
        insuranceClaim: detectInsuranceClaim(est.customerMemo),
        homeownerAcknowledged: false, // QB has no read-receipt; default false.
        rep: this.opts.rep,
        // Carry the QB dollar amount so the approval sink can write it to the
        // payload for the value-ledger display.
        amountUsd: est.totalAmount ?? 0,
      };
      records.push(record);
    }

    return skillOk(records);
  }
}

// ── Field helpers ────────────────────────────────────────────────────────────

function parseTxnDate(txnDate: string): Date | null {
  // QB txnDate is YYYY-MM-DD.  Parse as UTC midnight so day-math is consistent
  // across timezones.
  const ms = Date.parse(`${txnDate}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

const TRADE_KEYWORDS: Array<{
  trade: EstimateRecord['trade'];
  patterns: RegExp[];
}> = [
  { trade: 'roofing', patterns: [/roof/i, /shingle/i, /gutter/i, /fascia/i, /soffit/i] },
  { trade: 'hvac', patterns: [/hvac/i, /ac\b/i, /heat/i, /air.cond/i, /furnace/i, /duct/i, /carrier/i, /trane/i, /lennox/i] },
  { trade: 'plumbing', patterns: [/plumb/i, /water.heater/i, /drain/i, /pipe/i, /leak/i, /sewer/i, /toilet/i, /faucet/i] },
  { trade: 'electrical', patterns: [/electr/i, /panel/i, /wir/i, /outlet/i, /circuit/i, /breaker/i] },
];

function detectTrade(
  memo: string | null,
  customerName: string | null,
): EstimateRecord['trade'] {
  const haystack = `${memo ?? ''} ${customerName ?? ''}`.toLowerCase();
  for (const { trade, patterns } of TRADE_KEYWORDS) {
    if (patterns.some((p) => p.test(haystack))) return trade;
  }
  return 'general-contractor';
}

function detectInsuranceClaim(memo: string | null): boolean {
  if (!memo) return false;
  return /insurance|claim|adjuster|storm|hail|damage/i.test(memo);
}

/** Extract a street address pattern from a memo if present.
 *  Many QB users prefix the job address in the memo: "123 Oak St — roof replacement".
 *  Returns null when no address-like pattern is found. */
function extractServiceAddress(memo: string | null): string | null {
  if (!memo) return null;
  // Look for a US street-address prefix: digits + words before a separator
  // or the end of the first line.
  const m = memo.match(/^(\d+\s+[A-Za-z0-9 .,#-]+?)(?:\s*[—–\-|,]\s*|$)/m);
  if (m) return m[1].trim();
  return null;
}
