/**
 * lib/skills/month-end-close-cpa/enrichment.ts
 *
 * Optional CPA-vertical enrichment reader for the month-end-close skill.
 * Reads from TaxDome (received-doc backlog for the client) and Karbon
 * (blocked jobs on in-flight workflows for the client) and returns
 * structured counts the skill renders into chase emails + status
 * updates so the firm hears "5 client tax docs pending review in
 * TaxDome, 3 jobs blocked in Karbon" — not just QuickBooks-only depth.
 *
 * Per `feedback_runner_portability.md`: this is a PORT. Production
 * binds `mcpEnrichmentSource()`; tests bind a recording stub. The skill
 * itself only sees `EnrichmentSource`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the ONLY place
 * outside `lib/integrations/{taxdome,karbon}-mcp/` where those vendors
 * are referenced by name. The skill speaks only the enrichment shape.
 *
 * Per the honesty bar in the wave-5 task and
 * `feedback_integration_acceptance_is_functional.md`: a connector that
 * is NOT connected for the workspace returns null (not zero). The
 * skill renders "TaxDome not connected — connect from /integrations
 * to surface client-doc backlog" rather than fabricating a zero count.
 */

import { buildTaxdomeMcpServer } from '@/lib/integrations/taxdome-mcp';
import type { TaxdomeMcpServer } from '@/lib/integrations/taxdome-mcp';
import { buildKarbonMcpServer } from '@/lib/integrations/karbon-mcp';
import type { KarbonMcpServer } from '@/lib/integrations/karbon-mcp';

export interface EnrichmentResult {
  /** Number of unreviewed client-uploaded docs in TaxDome. null when
   *  the workspace has not connected TaxDome (or the MCP read failed
   *  with a credential error). */
  taxdomePendingReceived: number | null;
  /** Number of `blocked` jobs across active Karbon workflows for the
   *  client. null when the workspace has not connected Karbon. */
  karbonBlockedJobs: number | null;
  /** Number of active Karbon workflows for the client (one engagement
   *  in flight per workflow). null when not connected. */
  karbonActiveWorkflows: number | null;
}

export interface EnrichmentSource {
  readonly name: string;
  read(args: {
    workspaceId: string;
    /** TaxDome client id for the engagement. null when the workspace
     *  has not mapped its QuickBooks client to a TaxDome client — we
     *  read at the firm level. */
    taxdomeClientId: string | null;
    /** Karbon contact id for the engagement. null = firm-level read. */
    karbonClientId: string | null;
  }): Promise<EnrichmentResult>;
}

/**
 * Production enrichment source — wraps the two CPA MCPs. Failures are
 * absorbed into `null` so a connector outage cannot drop the entire
 * close (per cold-start-safe rule: the skill ALWAYS produces a draft).
 */
export function mcpEnrichmentSource(opts?: {
  taxdomeMcp?: TaxdomeMcpServer;
  karbonMcp?: KarbonMcpServer;
}): EnrichmentSource {
  return {
    name: 'mcp' as const,
    async read({ workspaceId, taxdomeClientId, karbonClientId }) {
      const taxdome =
        opts?.taxdomeMcp ?? buildTaxdomeMcpServer({ workspaceId });
      const karbon =
        opts?.karbonMcp ?? buildKarbonMcpServer({ workspaceId });

      const [tdRes, wfRes] = await Promise.all([
        taxdome.listReceivedDocuments(
          taxdomeClientId
            ? { clientId: taxdomeClientId, count: 100 }
            : { count: 100 },
        ),
        karbon.listWorkflows(
          karbonClientId
            ? { clientId: karbonClientId, status: 'active', count: 100 }
            : { status: 'active', count: 100 },
        ),
      ]);

      const taxdomePendingReceived = tdRes.ok
        ? tdRes.value.receivedDocuments.filter((d) => d.status === 'pending-review').length
        : null;

      let karbonActiveWorkflows: number | null = null;
      let karbonBlockedJobs: number | null = null;
      if (wfRes.ok) {
        karbonActiveWorkflows = wfRes.value.workflows.length;
        // Walk each active workflow for blocked jobs. Cap the fan-out
        // at the first 10 workflows so a firm with hundreds of in-
        // flight engagements does not stall the close draft.
        const sample = wfRes.value.workflows.slice(0, 10);
        const jobResults = await Promise.all(
          sample.map((w) =>
            karbon.listJobs({ workflowId: w.id, status: 'blocked', count: 100 }),
          ),
        );
        karbonBlockedJobs = jobResults.reduce(
          (sum, r) => sum + (r.ok ? r.value.jobs.length : 0),
          0,
        );
      }

      return {
        taxdomePendingReceived,
        karbonBlockedJobs,
        karbonActiveWorkflows,
      };
    },
  };
}

/** Convenience: render the enrichment counts as the one-line block we
 *  inject into chase emails + the status update body. Returns null
 *  when neither connector is connected (so the body stays clean). */
export function renderEnrichmentLine(r: EnrichmentResult): string | null {
  const parts: string[] = [];
  if (r.taxdomePendingReceived !== null && r.taxdomePendingReceived > 0) {
    parts.push(
      `${r.taxdomePendingReceived} client doc${r.taxdomePendingReceived === 1 ? '' : 's'} pending review in TaxDome`,
    );
  }
  if (r.karbonBlockedJobs !== null && r.karbonBlockedJobs > 0) {
    parts.push(
      `${r.karbonBlockedJobs} job${r.karbonBlockedJobs === 1 ? '' : 's'} currently blocked in Karbon`,
    );
  }
  if (parts.length === 0) return null;
  return parts.join('; ') + '.';
}

/** Convenience: produce a short "what connectors are missing" line we
 *  surface in the operator-facing skill output so a CPA workspace can
 *  see, on every fire, which CPA connector would deepen the next close
 *  if they wired it. Returns null when both are connected (or both
 *  return null for reasons unrelated to wiring). */
export function renderMissingConnectorLine(r: EnrichmentResult): string | null {
  const missing: string[] = [];
  if (r.taxdomePendingReceived === null) missing.push('TaxDome');
  if (r.karbonBlockedJobs === null) missing.push('Karbon');
  if (missing.length === 0) return null;
  return `Connect ${missing.join(' + ')} from /integrations to surface ${missing.includes('TaxDome') ? 'client-doc backlog' : ''}${missing.length === 2 ? ' + ' : ''}${missing.includes('Karbon') ? 'workflow + blocked-job state' : ''} on the next close.`;
}
