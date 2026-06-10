/**
 * lib/skills/month-end-close-cpa/karbon-close-fetcher.ts
 *
 * Fifth implementation of `CloseFetcher` — production wiring that speaks
 * to Karbon HQ via the workspace-scoped Karbon MCP
 * (`lib/integrations/karbon-mcp`). The skill code does not change; per
 * `feedback_runner_portability.md`'s two-implementation rule the port is
 * already real, so this impl is purely additive.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the ONLY place
 * (besides `enrichment.ts`) the month-end-close skill touches Karbon.
 * The skill itself sees `CloseFetcher` only.
 *
 * Per `project_no_outbound_architecture.md`: read-only. We `listWorkflows`
 * + `listJobs`; there is no write path on the Karbon contract today.
 *
 * Per `feedback_cold_start_safe_agents.md`: nothing is cached on the
 * instance — every fetch goes back through the MCP.
 *
 * ── HONESTY BAR — what the Karbon read contract covers vs. what it cannot
 *    (verified against `lib/integrations/karbon-mcp/types.ts`, `tools.ts`,
 *    the smoke test, and the Karbon API docs note in `types.ts`) ─────────
 *
 *   ENGAGEMENT — derived from the active workflow + its client.
 *     `listWorkflows({ clientId, status: 'active' })` gives the in-flight
 *     engagement (`KarbonWorkflowSummary` = id, title, clientId, status,
 *     daysSinceLastActivity); `getClient` gives the contact (id, name,
 *     email, kind). HONEST GAPS:
 *       - No contact-role field → `role: 'owner'` default (same as the
 *         QuickBooks + TaxDome fetchers).
 *       - No cc-contact list → `ccContacts: []`.
 *       - No engagement scope → caller-supplied `scope` is used ONLY to
 *         label the fallback engagement; the real checklist comes from
 *         jobs, not scope.
 *       - `partnerSignoff` — Karbon has no sign-off boolean on this read
 *         surface. We infer NOTHING about sign-off and leave it `false`.
 *         (A workflow with every job `done` still returns
 *         `partnerSignoff: false`; the human flips that.)
 *       - When the client has no email, we return NOT_APPLICABLE.
 *
 *   CHECKLIST — THIS is Karbon's real strength, and the honest win of this
 *     wave. Karbon jobs ARE the checklist. Each `KarbonJobSummary` on the
 *     active workflow becomes one `ChecklistItem`:
 *       - label   = job.title (the firm's own task wording — REAL, not a
 *                   template)
 *       - dueAt    = job.dueAt when present; falls back to the derived
 *                   internal close deadline when Karbon has no due date
 *                   (HONEST: we do not invent a tighter deadline than the
 *                   contract gives us)
 *       - category = best-effort keyword map from the title to the close
 *                   checklist categories; `other` when no confident match
 *                   (HONEST: we never fabricate a category)
 *       - required = a `done`/`todo`/`in-progress`/`review`/`blocked` job
 *                   is a real engagement task → required. Karbon exposes no
 *                   "optional task" flag, so we do NOT guess optionality.
 *
 *   RECEIVED DOCS — NOT in the Karbon contract. Karbon tracks task STATE,
 *     not document receipt — there is no doc-portal surface here (that is
 *     TaxDome's job). Rather than return an empty array and lose the
 *     job-completion signal, we honestly translate job COMPLETION into a
 *     synthetic receipt: a `job.status === 'done'` becomes a
 *     `ReceivedDoc { source: 'karbon' }` satisfying that job's checklist
 *     item. This is honest because in Karbon "the bank-rec job is done" IS
 *     the firm's record that the underlying doc is in hand — there is no
 *     separate doc event to read. The synthetic receipt's filename names
 *     the job + "(marked complete in Karbon)" so the operator sees the
 *     provenance and is never misled into thinking a PDF was attached.
 */

import { buildKarbonMcpServer } from '@/lib/integrations/karbon-mcp';
import type {
  KarbonJobSummary,
  KarbonMcpServer,
  KarbonWorkflowSummary,
} from '@/lib/integrations/karbon-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import { deriveInternalDeadline, translateCpaMcpError } from './pm-fetcher-shared';
import type {
  ChecklistCategory,
  ChecklistItem,
  ClientEngagement,
  CloseFetcher,
  EngagementScope,
  ReceivedDoc,
} from './types';

/** Honest message when Karbon isn't connected yet for this workspace. */
export const KARBON_NOT_CONNECTED_MESSAGE =
  'Karbon is not yet connected for this workspace. Connect it from /integrations and Plaino will build the close checklist from your Karbon jobs on the next fire.';

const DEFAULT_SCOPE: EngagementScope = 'full-stack-monthly';
const DEFAULT_WORKFLOW_COUNT = 100;
const DEFAULT_JOB_COUNT = 100;

export interface KarbonCloseFetcherOptions {
  /** Override the MCP server — tests pass a fixture/mock KarbonMcpServer. */
  mcp?: KarbonMcpServer;
  /** Scope label for the fallback engagement; the real checklist comes
   *  from jobs, not scope. Defaults to `full-stack-monthly`. */
  scope?: EngagementScope;
  /** Cap on workflows pulled per fire. Defaults to 100 (MCP max). */
  workflowCount?: number;
  /** Cap on jobs pulled per workflow. Defaults to 100 (MCP max). */
  jobCount?: number;
}

export class KarbonCloseFetcher implements CloseFetcher {
  readonly name = 'karbon' as const;
  private readonly workspaceId: string;
  private readonly opts: Required<
    Pick<KarbonCloseFetcherOptions, 'scope' | 'workflowCount' | 'jobCount'>
  > & { mcp?: KarbonMcpServer };

  constructor(args: { workspaceId: string } & KarbonCloseFetcherOptions) {
    if (!args.workspaceId) {
      throw new Error('KarbonCloseFetcher: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.opts = {
      mcp: args.mcp,
      scope: args.scope ?? DEFAULT_SCOPE,
      workflowCount: args.workflowCount ?? DEFAULT_WORKFLOW_COUNT,
      jobCount: args.jobCount ?? DEFAULT_JOB_COUNT,
    };
  }

  private mcp(): KarbonMcpServer {
    return (
      this.opts.mcp ?? buildKarbonMcpServer({ workspaceId: this.workspaceId })
    );
  }

  async fetchEngagement(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ClientEngagement>> {
    const guard = this.guard(args);
    if (guard) return guard;
    const res = await this.mcp().getClient({ clientId: args.clientId });
    if (!res.ok) {
      return translateCpaMcpError(res.error.code, res.error.message, {
        provider: 'Karbon',
        notConnectedMessage: KARBON_NOT_CONNECTED_MESSAGE,
      });
    }
    const client = res.value.client;
    if (!client.email || client.email.trim().length === 0) {
      return skillError(
        'NOT_APPLICABLE',
        `Karbon client ${args.clientId} has no email on file — month-end-close needs a primary contact`,
        'NO_EMAIL',
      );
    }
    return skillOk({
      clientId: client.id,
      clientName: client.name,
      primaryContact: {
        name: client.name,
        email: client.email,
        phone: null,
        role: 'owner',
      },
      ccContacts: [],
      periodMonth: args.periodMonth,
      scope: this.opts.scope,
      internalDeadline: deriveInternalDeadline(args.periodMonth),
      partnerSignoff: false,
    });
  }

  async fetchChecklist(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ChecklistItem[]>> {
    const guard = this.guard(args);
    if (guard) return guard;
    const jobsRes = await this.activeJobsForClient(args.clientId);
    if (!jobsRes.ok) return jobsRes;
    const fallbackDue = deriveInternalDeadline(args.periodMonth);
    // HONEST WIN: the checklist is the firm's REAL jobs, not a template.
    const checklist: ChecklistItem[] = jobsRes.value.jobs.map((job) =>
      jobToChecklistItem(job, fallbackDue),
    );
    return skillOk(checklist);
  }

  async fetchReceivedDocs(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ReceivedDoc[]>> {
    const guard = this.guard(args);
    if (guard) return guard;
    const jobsRes = await this.activeJobsForClient(args.clientId);
    if (!jobsRes.ok) return jobsRes;
    // HONEST: Karbon has no doc-portal. A `done` job IS the firm's record
    // the underlying work/doc is in hand — translate completion into a
    // synthetic receipt whose filename names the provenance so nobody is
    // misled into thinking a file was attached.
    const received: ReceivedDoc[] = jobsRes.value.jobs
      .filter((job) => job.status === 'done')
      .map((job) => ({
        id: `karbon-job-${job.id}`,
        satisfiesChecklistItemId: jobChecklistId(job),
        receivedAt: job.dueAt ? new Date(job.dueAt) : new Date(),
        filename: `${job.title} (marked complete in Karbon)`,
        source: 'karbon' as const,
      }));
    return skillOk(received);
  }

  /** Resolve the client's active workflows, then fan out to their jobs.
   *  Cold-start safe: every call re-reads from the MCP. */
  private async activeJobsForClient(
    clientId: string,
  ): Promise<SkillResult<{ jobs: KarbonJobSummary[]; workflows: KarbonWorkflowSummary[] }>> {
    const wfRes = await this.mcp().listWorkflows({
      clientId,
      status: 'active',
      count: this.opts.workflowCount,
    });
    if (!wfRes.ok) {
      return translateCpaMcpError(wfRes.error.code, wfRes.error.message, {
        provider: 'Karbon',
        notConnectedMessage: KARBON_NOT_CONNECTED_MESSAGE,
      });
    }
    const workflows = wfRes.value.workflows;
    if (workflows.length === 0) {
      // HONEST: no active workflow for the client = nothing in flight to
      // close. NOT_APPLICABLE names the gap rather than emitting an empty
      // close that chases phantom items.
      return skillError(
        'NOT_APPLICABLE',
        `Karbon has no active workflow for client ${clientId} — nothing in flight to close`,
        'NO_ACTIVE_WORKFLOW',
      );
    }
    const jobResults = await Promise.all(
      workflows.map((w) =>
        this.mcp().listJobs({ workflowId: w.id, count: this.opts.jobCount }),
      ),
    );
    const jobs: KarbonJobSummary[] = [];
    for (const r of jobResults) {
      if (r.ok) jobs.push(...r.value.jobs);
    }
    return skillOk({ jobs, workflows });
  }

  private guard(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): SkillResult<never> | null {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `KarbonCloseFetcher bound to ${this.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    if (!args.clientId) {
      return skillError('INVALID_INPUT', 'clientId is required');
    }
    if (!/^\d{4}-\d{2}$/.test(args.periodMonth)) {
      return skillError(
        'INVALID_INPUT',
        `periodMonth must be YYYY-MM, got ${args.periodMonth}`,
      );
    }
    return null;
  }
}

/** Stable checklist-item id for a Karbon job — shared by the checklist and
 *  the synthetic-receipt mapping so a `done` job's receipt links to its
 *  own checklist item. */
function jobChecklistId(job: KarbonJobSummary): string {
  return `karbon-${job.id}`;
}

function jobToChecklistItem(job: KarbonJobSummary, fallbackDue: Date): ChecklistItem {
  return {
    id: jobChecklistId(job),
    label: job.title,
    category: categoryForJobTitle(job.title),
    // HONEST: use Karbon's due date when present; fall back to the derived
    // close deadline only when the contract gives us no date.
    dueAt: job.dueAt ? new Date(job.dueAt) : fallbackDue,
    required: true,
  };
}

/** Map a Karbon job title to a close checklist category. `other` when no
 *  confident keyword match — we never fabricate a category. */
function categoryForJobTitle(title: string): ChecklistCategory {
  const t = title.toLowerCase();
  if (/(bank|checking|savings|reconcil)/.test(t)) return 'bank-statement';
  if (/(credit\s?card|amex|visa|mastercard)/.test(t)) return 'credit-card-statement';
  if (/(loan|line.of.credit|mortgage)/.test(t)) return 'loan-statement';
  if (/(payroll|wage|gusto|adp|paychex)/.test(t)) return 'payroll-register';
  if (/(sales.?tax)/.test(t)) return 'sales-tax-filing';
  if (/(ar |ap |aging|receivable|payable)/.test(t)) return 'ar-ap-detail';
  if (/(fixed.asset|depreciation)/.test(t)) return 'fixed-asset-changes';
  if (/(distribution|owner.?draw|contribution)/.test(t)) return 'owner-distributions';
  if (/(inventory|stock.count)/.test(t)) return 'inventory-count';
  return 'other';
}
