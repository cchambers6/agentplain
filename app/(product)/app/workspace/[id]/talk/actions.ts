"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  buildCapabilitySnapshot,
  checkDegradedMode,
  InngestEventEmitter,
  PrismaChatStore,
  PrismaMemoryStore,
  runPlainoTurn,
  triagePlainoTurnFailure,
  type PersistedChatMessage,
} from "@/lib/plaino";
import { CustomerFilesKnowledgeSubstrate } from "@/lib/skills/support-handler";
import { MODEL_HAIKU } from "@/lib/llm/model-tiers";
import { reportMessage } from "@/lib/observability";
import { pageHuman } from "@/lib/ops/page-human";
import type { SkillError } from "@/lib/skills/types";

/** Stable source tag for this surface's pages + Sentry events. */
const PLAINO_CHAT_SOURCE = "plaino-chat-dispatcher";

// The dispatcher is happy with anything up to its internal cap; the
// form cap is friendlier on the client side and matches the visible
// HelpForm pattern.
const MAX_FORM_CHARS = 4_000;

const composerSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Tell Plaino what you need.")
    .max(MAX_FORM_CHARS, `Trim to under ${MAX_FORM_CHARS} characters.`),
});

export interface TalkActionResult {
  ok: boolean;
  /** Field-level errors keyed by form field name. */
  fieldErrors?: { body?: string };
  formError?: string;
}

export async function sendPlainoMessageAction(
  workspaceId: string,
  _prev: TalkActionResult | undefined,
  form: FormData,
): Promise<TalkActionResult> {
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const raw = form.get("body");
  const parsed = composerSchema.safeParse({
    body: typeof raw === "string" ? raw : "",
  });
  if (!parsed.success) {
    const fieldErrors: TalkActionResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "body" && !fieldErrors.body) {
        fieldErrors.body = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }
  const body = parsed.data.body;

  // Phase-1 honesty: if a load-bearing env var is missing, do NOT call
  // runPlainoTurn (which would throw at the first encrypt() call inside
  // PrismaChatStore.appendMessage, or silently fall through to the
  // TestLlmProvider heuristic stub). Return the operator-resolvable
  // notice as a formError so the customer sees an honest message under
  // the composer. The page renderer also surfaces this state inline so
  // they don't have to send to find out. No DB write, no plaintext
  // customer content persisted. See lib/plaino/degraded-mode.ts.
  const degraded = checkDegradedMode();
  if (degraded.degraded) {
    return { ok: false, formError: degraded.customerNotice };
  }

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, vertical: true },
    }),
  );
  if (!workspace) {
    return {
      ok: false,
      formError: "Workspace not found. Reload and try again.",
    };
  }

  const ctx = {
    userId: member.userId,
    workspaceId,
    isOperator: member.isOperator,
  } as const;

  const store = new PrismaChatStore(workspaceId, { ctx });
  const memory = new PrismaMemoryStore(workspaceId, { ctx });
  const events = new InngestEventEmitter();
  const substrate = new CustomerFilesKnowledgeSubstrate();
  const capabilities = await buildCapabilitySnapshot({ workspaceId, ctx });

  const thread = await store.ensureWorkspaceThread({ workspaceId });
  const existingMessages = await store.listMessages({
    threadId: thread.id,
    workspaceId,
    limit: 50,
  });
  const history = lastHistory(existingMessages);

  const fromName =
    (member.email.split("@")[0] ?? "").trim() || null;

  const result = await runPlainoTurn({
    workspaceId,
    workspaceName: workspace.name,
    vertical: workspace.vertical,
    fromUserId: member.userId,
    fromEmail: member.email,
    fromName,
    customerMessage: body,
    history,
    capabilities,
    substrate,
    events,
    store,
    memory,
  });

  // Re-render the page even on dispatcher error — the placeholder
  // Plaino reply has been persisted so the customer never sees an
  // empty chat.
  revalidatePath(`/app/workspace/${workspaceId}/talk`);

  if (!result.ok) {
    // SILENT-FAIL-LOUD (PR #239 pattern, finally wired into chat): a failed
    // turn used to collapse into one opaque customer line with NO operator
    // signal — exactly how the 2026-06-13 outage (paused Anthropic key) went
    // unnoticed. Now we (a) triage to an HONEST customer line, (b) always
    // emit a structured Sentry event, and (c) page a human for the
    // credential-class failures that take the whole surface down.
    await surfaceTurnFailure({
      error: result.error,
      workspaceId,
      messageBody: body,
    });
    return {
      ok: false,
      formError: triagePlainoTurnFailure(result.error).customerNotice,
    };
  }
  return { ok: true };
}

/** Hash the customer message instead of logging it — the body is customer
 *  content and must never land in Sentry / an ops email / an AuditLog
 *  payload in plaintext. The hash lets ops correlate repeat failures of the
 *  same message without exposing it. */
function hashMessage(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
}

interface SurfaceTurnFailureArgs {
  error: SkillError;
  workspaceId: string;
  messageBody: string;
}

/**
 * Make a failed Plaino turn loud + observable. Never throws — instrumentation
 * must not itself become a new failure mode on the customer's hot path.
 *
 *   - Sentry (always): structured `reportMessage` with indexed tags
 *     (workspace, model, error code, downstream LLM code, category) so the
 *     failure is queryable and alertable. Carries only the message HASH.
 *   - pageHuman (credential-class only): a dead/paused key takes chat down
 *     for everyone — a person must know now. `pageHuman` resolves a recipient
 *     even when no operator routing is configured (baked-in admin fallback),
 *     so the alert can never reach nobody. Transient/parse failures stay
 *     Sentry-only so we don't desensitize the on-call.
 */
async function surfaceTurnFailure(args: SurfaceTurnFailureArgs): Promise<void> {
  const { error, workspaceId, messageBody } = args;
  const triage = triagePlainoTurnFailure(error);
  const messageHash = hashMessage(messageBody);

  const sentryLevel =
    triage.severity === "critical"
      ? "error"
      : triage.severity === "warn"
        ? "warning"
        : "info";

  try {
    reportMessage(`plaino chat turn failed: ${triage.opsSummary}`, {
      level: sentryLevel,
      tags: {
        surface: PLAINO_CHAT_SOURCE,
        workspace_id: workspaceId,
        model: MODEL_HAIKU,
        error_code: error.code,
        llm_error_code: error.reference ?? "none",
        failure_category: triage.category,
      },
      extra: {
        message_hash: messageHash,
        error_message: error.message,
      },
    });
  } catch {
    // reportMessage is no-throw by contract, but belt-and-suspenders: never
    // let instrumentation crash the customer's request.
  }

  if (!triage.shouldPage) return;

  try {
    await pageHuman({
      severity: triage.severity,
      summary: triage.opsSummary,
      details: [
        `Plaino in-app chat (/talk) could not draft a reply.`,
        ``,
        `Workspace: ${workspaceId}`,
        `Model: ${MODEL_HAIKU}`,
        `Skill error: ${error.code}`,
        `LLM error: ${error.reference ?? "n/a"}`,
        `Message hash: ${messageHash} (body withheld — customer content)`,
        ``,
        `Detail: ${error.message}`,
        ``,
        triage.category === "credential"
          ? "Likely fix: the production ANTHROPIC_API_KEY is paused/invalid. " +
            "Restore a live key (`vercel env add ANTHROPIC_API_KEY production`) " +
            "and redeploy. Until then every workspace's chat returns no replies."
          : "Investigate via the Sentry event tagged surface=plaino-chat-dispatcher.",
      ].join("\n"),
      source: PLAINO_CHAT_SOURCE,
      workspaceId,
    });
  } catch {
    // pageHuman is no-throw by contract; this catch is defense-in-depth so a
    // paging failure can never surface as a customer-facing 500.
  }
}

function lastHistory(
  messages: PersistedChatMessage[],
): Array<{ role: "customer" | "plaino"; body: string }> {
  return messages.slice(-12).map((m) => ({ role: m.role, body: m.body }));
}
