"use server";

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
  type PersistedChatMessage,
} from "@/lib/plaino";
import { CustomerFilesKnowledgeSubstrate } from "@/lib/skills/support-handler";

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
      select: { id: true, name: true },
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
    return {
      ok: false,
      formError:
        "We saved your note but had trouble drafting a reply. Try again or post a fresh message.",
    };
  }
  return { ok: true };
}

function lastHistory(
  messages: PersistedChatMessage[],
): Array<{ role: "customer" | "plaino"; body: string }> {
  return messages.slice(-12).map((m) => ({ role: m.role, body: m.body }));
}
