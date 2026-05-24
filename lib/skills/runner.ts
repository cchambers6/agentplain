/**
 * lib/skills/runner.ts
 *
 * The skill-chain orchestrator. Composes the five skills (read,
 * categorize, coordinate, schedule, draft) into one pass over a
 * `WebhookEvent` row. The runner is the ONLY caller that knows the
 * conditional logic — skills don't know about each other.
 *
 * Chain logic:
 *
 *   read → categorize → switch (intent):
 *     noise | transactional | vendor   → mark processed, done
 *     lead                              → mark processed (lead surfaces to
 *                                        the operator queue without a draft)
 *     scheduling-needed                 → coordinate + schedule + draft
 *     draft-needed                      → coordinate + draft
 *
 * Per `feedback_cold_start_safe_agents.md`: the runner reads durable
 * state on every fire. There is no in-memory cache between runs.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this is the
 * functional acceptance test. When the chain produces a sensible
 * categorization + draft + scheduling proposal on Conner's real inbox,
 * the loop is functional. The mock-fixture e2e gives us the same shape
 * on synthetic data so we know the wiring is right before the live
 * Gmail data lands.
 *
 * Per `project_no_outbound_architecture.md`: every step here either
 * reads or writes a draft. Nothing sends.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Vertical, WebhookEvent, Workspace } from '@prisma/client';
import { loadCorpusFor, scanCorpus } from '../agents/sentinel';
import { getLlmProvider } from '../llm';
import type { LlmProvider } from '../llm/types';
import { CategorizeSkill } from './categorize';
import { CoordinateSkill } from './coordinate';
import { DraftSkill } from './draft';
import {
  asActionableAdminClassification,
  buildAdminApprovalPayload,
  classifyOfficeAdmin,
} from './office-admin';
import { getPromptBundleByEnum } from './prompts/index';
import { ReadSkill } from './read';
import { ScheduleSkill } from './schedule';
import {
  DraftPersister,
  Intent,
  MessageFetcher,
  ParsedMessage,
  SchedulingPreferences,
  SkillRunOutcome,
  SkillRunRecord,
  SkillStepRecord,
} from './types';

export interface RunChainArgs {
  workspace: Pick<Workspace, 'id' | 'slug' | 'name' | 'vertical'>;
  event: WebhookEvent;
  fetcher: MessageFetcher;
  persister: DraftPersister;
  llm?: LlmProvider;
  schedulingPreferences?: SchedulingPreferences;
  now?: Date;
  /** When true, write a JSONL log row to `agent-state/skill-runs/`.
   *  Default: true. */
  writeLog?: boolean;
  /** Override the log directory. Tests point this at a tmpdir. */
  logDir?: string;
}

export interface RunChainResult {
  record: SkillRunRecord;
  outcome: SkillRunOutcome;
}

const DEFAULT_LOG_DIR = path.join(process.cwd(), 'agent-state', 'skill-runs');

export async function runSkillChain(args: RunChainArgs): Promise<RunChainResult> {
  const llm = args.llm ?? getLlmProvider();
  const prompts = getPromptBundleByEnum(args.workspace.vertical as Vertical);
  const startedAt = args.now ?? new Date();
  const steps: SkillStepRecord[] = [];
  const outcome: SkillRunOutcome = {
    category: null,
    threadId: null,
    scheduledProposal: null,
    draft: null,
    markedProcessed: false,
    officeAdmin: null,
    officeAdminPayload: null,
    complianceFlags: null,
  };

  // ── 1. Read ─────────────────────────────────────────────────────────
  const readSkill = new ReadSkill(args.fetcher);
  const tRead = Date.now();
  const readRes = await readSkill.run({ event: args.event });
  steps.push({
    step: 'read',
    ok: readRes.ok,
    summary: readRes.ok ? readRes.value.summary : readRes.error.message,
    durationMs: Date.now() - tRead,
    errorCode: readRes.ok ? undefined : readRes.error.code,
  });
  if (!readRes.ok || readRes.value.messages.length === 0) {
    // No usable message — record the run and bail. The webhook event
    // is left unprocessed=false so the next sweep can retry once
    // history catches up (sometimes Gmail's history.list lags Pub/Sub
    // by a few hundred ms).
    return finalize({ startedAt, steps, outcome, args, llm, prompts });
  }
  const newestMessage = pickNewest(readRes.value.messages);
  outcome.threadId = newestMessage.threadId;

  // ── 1.5 Office-admin classify ──────────────────────────────────────
  // Runs BEFORE vertical categorize so admin email (verification codes,
  // password resets, billing notices, security alerts) gets routed to
  // the admin queue without going through lead/scheduling/draft. When
  // the classifier returns `not-admin`, the vertical chain proceeds as
  // before.
  const tAdmin = Date.now();
  const adminRes = await classifyOfficeAdmin({ message: newestMessage, llm });
  steps.push({
    step: 'office-admin-classify',
    ok: adminRes.ok,
    summary: adminRes.ok
      ? `category=${adminRes.value.category} conf=${adminRes.value.confidence.toFixed(2)} — ${adminRes.value.reason}`
      : adminRes.error.message,
    durationMs: Date.now() - tAdmin,
    errorCode: adminRes.ok ? undefined : adminRes.error.code,
  });
  if (adminRes.ok) {
    outcome.officeAdmin = adminRes.value;
    const actionable = asActionableAdminClassification(adminRes.value);
    if (actionable) {
      // Short-circuit — admin item lands in the approval queue via
      // persist-artifacts. We do NOT run vertical categorize / draft /
      // schedule on admin email; that would burn LLM cost and risk
      // composing a real-looking reply to a no-reply automated sender.
      outcome.officeAdminPayload = buildAdminApprovalPayload({
        message: newestMessage,
        classification: actionable,
        now: args.now,
      });
      outcome.markedProcessed = true;
      steps.push({
        step: 'mark-processed',
        ok: true,
        summary: `office-admin=${adminRes.value.category} terminates loop without vertical categorize`,
        durationMs: 0,
      });
      return finalize({ startedAt, steps, outcome, args, llm, prompts });
    }
  }
  // adminRes.ok=false is a soft-fail: log it but continue with the
  // vertical chain. Better to miss an admin classification than to drop
  // the whole loop.

  // ── 2. Categorize ───────────────────────────────────────────────────
  const categorizeSkill = new CategorizeSkill(llm);
  const tCat = Date.now();
  const catRes = await categorizeSkill.run({ message: newestMessage, prompts });
  steps.push({
    step: 'categorize',
    ok: catRes.ok,
    summary: catRes.ok
      ? `intent=${catRes.value.intent} conf=${catRes.value.confidence.toFixed(2)} — ${catRes.value.reason}`
      : catRes.error.message,
    durationMs: Date.now() - tCat,
    errorCode: catRes.ok ? undefined : catRes.error.code,
  });
  if (!catRes.ok) {
    return finalize({ startedAt, steps, outcome, args, llm, prompts });
  }
  outcome.category = catRes.value.intent;

  // Low-confidence: demote to noise.
  let intent: Intent = catRes.value.intent;
  if (catRes.value.confidence < 0.6 && intent !== 'noise') {
    intent = 'noise';
    steps.push({
      step: 'categorize',
      ok: true,
      summary: `confidence ${catRes.value.confidence.toFixed(2)} below 0.6 — demoted to noise`,
      durationMs: 0,
    });
    outcome.category = 'noise';
  }

  // Branch on intent.
  if (intent === 'noise' || intent === 'transactional' || intent === 'vendor' || intent === 'lead') {
    outcome.markedProcessed = true;
    steps.push({
      step: 'mark-processed',
      ok: true,
      summary: `intent=${intent} terminates loop without draft`,
      durationMs: 0,
    });
    return finalize({ startedAt, steps, outcome, args, llm, prompts });
  }

  // ── 3. Coordinate (always for scheduling-needed + draft-needed) ─────
  const coordinateSkill = new CoordinateSkill(llm);
  const tCoord = Date.now();
  const coordRes = await coordinateSkill.run({
    message: newestMessage,
    fetcher: args.fetcher,
    prompts,
  });
  steps.push({
    step: 'coordinate',
    ok: coordRes.ok,
    summary: coordRes.ok
      ? `summary len=${coordRes.value.summary.length} refs=${coordRes.value.referencedThreadIds.length} prior=${coordRes.value.priorMessages.length}`
      : coordRes.error.message,
    durationMs: Date.now() - tCoord,
    errorCode: coordRes.ok ? undefined : coordRes.error.code,
  });

  // ── 4. Schedule (scheduling-needed only) ────────────────────────────
  if (intent === 'scheduling-needed') {
    const scheduleSkill = new ScheduleSkill(llm);
    const tSched = Date.now();
    const schedRes = await scheduleSkill.run({
      message: newestMessage,
      prompts,
      preferences: args.schedulingPreferences,
    });
    steps.push({
      step: 'schedule',
      ok: schedRes.ok,
      summary: schedRes.ok
        ? `slots=${schedRes.value.proposedSlots.length} needsResponse=${schedRes.value.needsResponse}`
        : schedRes.error.message,
      durationMs: Date.now() - tSched,
      errorCode: schedRes.ok ? undefined : schedRes.error.code,
    });
    if (schedRes.ok) outcome.scheduledProposal = schedRes.value;
  }

  // ── 5. Draft ────────────────────────────────────────────────────────
  const draftSkill = new DraftSkill(llm);
  const tDraft = Date.now();
  const draftRes = await draftSkill.run({
    message: newestMessage,
    prompts,
    workspaceId: args.workspace.id,
    thread: coordRes.ok ? coordRes.value : undefined,
    schedule: outcome.scheduledProposal ?? undefined,
    persister: args.persister,
  });
  steps.push({
    step: 'draft',
    ok: draftRes.ok,
    summary: draftRes.ok
      ? `tone=${draftRes.value.tone} conf=${draftRes.value.confidence.toFixed(2)} persisted=${draftRes.value.persisted}`
      : draftRes.error.message,
    durationMs: Date.now() - tDraft,
    errorCode: draftRes.ok ? undefined : draftRes.error.code,
  });
  if (draftRes.ok) outcome.draft = draftRes.value;

  // ── 5.5 Compliance sentinel (literal-match scan over draft) ────────
  // Runs only when a corpus is registered for the vertical AND that
  // corpus carries at least one literal-match rule AND a draft was
  // produced — sentinel scans the draft body + subject deterministically
  // (no LLM). Per `project_no_outbound_architecture.md`: sentinel ADVISES;
  // it does not block. Flags ride alongside the draft into /approvals.
  //
  // Verticals whose corpus is currently counsel-reference only (mortgage,
  // cpa, law, ria, insurance, title-escrow, recruiting, home-services,
  // property-management — as of 2026-05-22) do NOT emit a compliance-
  // check step: nothing meaningful ran, so the sentinel card stays
  // honestly rooting.
  if (outcome.draft) {
    const corpus = loadCorpusFor(prompts.verticalSlug);
    if (corpus) {
      const hasLiteralMatchRule = corpus.rules.some(
        (r) => r.purpose === 'literal-match' && !r.unverified && (r.triggers?.length ?? 0) > 0,
      );
      if (hasLiteralMatchRule) {
        const tScan = Date.now();
        const scan = scanCorpus({
          subject: outcome.draft.subject,
          body: outcome.draft.body,
          corpus,
        });
        outcome.complianceFlags = scan.flags;
        steps.push({
          step: 'compliance-check',
          ok: true,
          summary: `flags=${scan.flags.length} rulesScanned=${scan.rulesScanned.length} phrases=${scan.phrasesChecked}`,
          durationMs: Date.now() - tScan,
        });
      }
    }
  }

  // ── 6. Mark processed ───────────────────────────────────────────────
  outcome.markedProcessed = true;
  steps.push({
    step: 'mark-processed',
    ok: true,
    summary: 'loop complete',
    durationMs: 0,
  });
  return finalize({ startedAt, steps, outcome, args, llm, prompts });
}

function pickNewest(messages: ParsedMessage[]): ParsedMessage {
  return messages.reduce((newest, m) =>
    newest.receivedAt >= m.receivedAt ? newest : m,
  );
}

interface FinalizeArgs {
  startedAt: Date;
  steps: SkillStepRecord[];
  outcome: SkillRunOutcome;
  args: RunChainArgs;
  llm: LlmProvider;
  prompts: { verticalSlug: string };
}

async function finalize(f: FinalizeArgs): Promise<RunChainResult> {
  const finishedAt = new Date();
  const record: SkillRunRecord = {
    startedAt: f.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - f.startedAt.getTime(),
    workspaceId: f.args.workspace.id,
    workspaceSlug: f.args.workspace.slug,
    verticalSlug: f.prompts.verticalSlug,
    webhookEventId: f.args.event.id,
    llmProviderName: f.llm.name,
    fetcherName: f.args.fetcher.name,
    persisterName: f.args.persister.name,
    steps: f.steps,
    outcome: f.outcome,
  };
  const shouldLog = f.args.writeLog !== false;
  if (shouldLog) {
    await appendSkillRunLog(record, f.args.logDir ?? DEFAULT_LOG_DIR);
  }
  return { record, outcome: f.outcome };
}

async function appendSkillRunLog(record: SkillRunRecord, dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
    const day = record.startedAt.slice(0, 10).replace(/-/g, '');
    const file = path.join(dir, `${day}.jsonl`);
    await fs.appendFile(file, JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    // Logging is best-effort — never fail the loop because we couldn't
    // write a log row. Surface to console for ops triage.
    console.warn(`runSkillChain: failed to append skill-run log: ${err instanceof Error ? err.message : String(err)}`);
  }
}
