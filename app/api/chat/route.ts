// POST /api/chat — the Plaino front-door, shared by BOTH surfaces.
//
//   mode: "marketing" → anonymous site widget. Sales-tuned prompt, no
//         workspace context, can hand off to lead capture.
//   mode: "support"   → authenticated in-app help chat. Loads the
//         workspace's vertical / tier / integrations / approval count +
//         the knowledge substrate, and answers grounded in them. The
//         draft-into-review hand-off is a separate endpoint
//         (/api/support/draft) the UI calls when the customer wants the
//         team — this route never sends anything (project_no_outbound_architecture).
//
// Both modes log the exchange to PlainoConversation (encrypted turns) for
// the drift sweep + voice fingerprinting.
//
// Vendor coupling stays behind lib/llm/getLlmProvider per
// feedback_no_silent_vendor_lock — this route never imports the Anthropic
// SDK. Model routing follows the wave-8 calibration (docs/skill-model-
// routing-2026-05-29): customer-facing READS get the top tier, marketing
// (anonymous, pre-revenue, sales-tuned) gets the moderate tier.

import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth/session";
import { withSystemContext } from "@/lib/db/rls";
import { getLlmProvider } from "@/lib/llm";
import { MODEL_OPUS, MODEL_SONNET } from "@/lib/llm/model-tiers";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { buildCapabilitySnapshot } from "@/lib/plaino/capabilities";
import { buildMarketingSystemPrompt } from "@/lib/plaino/marketing-prompt";
import { buildSupportSystemPrompt } from "@/lib/plaino/support-prompt";
import { persistConversation } from "@/lib/plaino/conversation-log";
import {
  appendReply,
  latestUserMessage,
  toLlmMessages,
} from "@/lib/plaino/chat-turns";
import { getKnowledgeStore } from "@/lib/knowledge";
import { tierDisplayName, tierFromVerticalTier } from "@/lib/pricing/tiers";
import { LlmPausedError } from "@/lib/llm/paused";
import {
  PLAINO_PAUSED_REPLY,
  PLAINO_TRANSIENT_REPLY,
} from "@/lib/plaino/degraded-copy";
import { getLogger } from "@/lib/observability/logger";

export const runtime = "nodejs";

const turnSchema = z.object({
  role: z.enum(["user", "plaino"]),
  body: z.string().trim().min(1).max(4000),
});

const chatSchema = z.object({
  mode: z.enum(["marketing", "support"]),
  messages: z.array(turnSchema).min(1).max(50),
  conversationId: z.string().uuid().optional(),
  // Anonymous browser session id (marketing). Support uses the user id.
  sessionId: z.string().trim().min(1).max(200).optional(),
  sourcePage: z.string().trim().max(200).optional(),
  verticalSlug: z.string().trim().max(60).optional(),
  workspaceId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = chatSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid chat request." },
      { status: 400 },
    );
  }
  const input = parsed.data;

  return input.mode === "marketing"
    ? handleMarketing(input)
    : handleSupport(input);
}

type ChatInput = z.infer<typeof chatSchema>;

async function handleMarketing(input: ChatInput) {
  const system = buildMarketingSystemPrompt({
    sourcePage: input.sourcePage ?? null,
    verticalSlug: input.verticalSlug ?? null,
  });
  // Anonymous, high-volume, pre-revenue: moderate tier (wave-8 calibration).
  const reply = await complete(system, input.messages, MODEL_SONNET, {
    skill: "plaino-marketing",
  });

  // Anonymous session id: stable per browser session, supplied by the
  // widget. Fall back to "anon" so a missing id never drops the log.
  const sessionId = input.sessionId ?? "anon";
  let conversationId: string | null = input.conversationId ?? null;
  try {
    conversationId = await persistConversation({
      mode: "MARKETING",
      workspaceId: null,
      sessionId,
      sourcePage: input.sourcePage ?? null,
      conversationId,
      turns: appendReply(input.messages, reply.text, new Date().toISOString()),
    });
  } catch {
    // Logging is best-effort — never fail the customer's chat on a log write.
  }

  const { expandLeadCapture } = degradedResponseExtras(reply, {
    mode: "marketing",
  });
  return NextResponse.json(
    {
      ok: true,
      reply: reply.text,
      conversationId,
      degraded: reply.degraded,
      expandLeadCapture,
    },
    { status: 200 },
  );
}

async function handleSupport(input: ChatInput) {
  if (!input.workspaceId) {
    return NextResponse.json(
      { ok: false, error: "workspaceId is required for support chat." },
      { status: 400 },
    );
  }
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  const workspaceId = input.workspaceId;
  const membership = await withSystemContext((tx) =>
    tx.membership.findFirst({
      where: { userId: session.userId, workspaceId, status: "ACTIVE" },
      select: { id: true },
    }),
  );
  if (!membership) {
    return NextResponse.json({ ok: false, error: "Not a member." }, { status: 403 });
  }

  const ctx = { userId: session.userId, workspaceId, isOperator: false };
  const latestQuestion = latestUserMessage(input.messages);

  // Load workspace context + knowledge in parallel.
  const [workspace, pendingApprovalsCount, snapshot, knowledge] =
    await Promise.all([
      withSystemContext((tx) =>
        tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true, vertical: true, verticalTier: true },
        }),
      ),
      withSystemContext((tx) =>
        tx.workApprovalQueueItem.count({
          where: { workspaceId, status: "PENDING" },
        }),
      ),
      buildCapabilitySnapshot({ workspaceId, ctx }).catch(() => null),
      searchKnowledge(ctx, latestQuestion),
    ]);

  const verticalSlug = workspace
    ? verticalSlugFromEnum(workspace.vertical)
    : null;
  const tier = workspace?.verticalTier
    ? tierDisplayName(tierFromVerticalTier(workspace.verticalTier))
    : "Regular";

  const system = buildSupportSystemPrompt({
    workspaceName: workspace?.name ?? "your workspace",
    verticalSlug,
    tierDisplayName: tier,
    connectedIntegrations: (snapshot?.connectedIntegrations ?? []).map((i) => i.name),
    pendingApprovalsCount,
    knowledge,
  });

  // Customer-facing READ by a paying customer → top tier (wave-8 calibration).
  const reply = await complete(system, input.messages, MODEL_OPUS, {
    skill: "plaino-support",
    workspaceId,
    sourceSurface: "PLAINO_CHAT",
    verticalSlug: verticalSlug ?? undefined,
  });

  let conversationId: string | null = input.conversationId ?? null;
  try {
    conversationId = await persistConversation({
      mode: "SUPPORT",
      workspaceId,
      sessionId: session.userId,
      conversationId,
      turns: appendReply(input.messages, reply.text, new Date().toISOString()),
    });
  } catch {
    // Best-effort log.
  }

  const { expandLeadCapture } = degradedResponseExtras(reply, {
    mode: "support",
    workspaceId,
  });
  return NextResponse.json(
    {
      ok: true,
      reply: reply.text,
      conversationId,
      degraded: reply.degraded,
      expandLeadCapture,
    },
    { status: 200 },
  );
}

// ── helpers ────────────────────────────────────────────────────────────

interface CompleteMeta {
  skill: string;
  workspaceId?: string;
  sourceSurface?: "PLAINO_CHAT";
  verticalSlug?: string;
}

interface CompletionOutcome {
  text: string;
  /** True for any state where Plaino couldn't answer (paused or transient). */
  degraded: boolean;
  /** True only for the deliberate paused-spend sentinel — distinct copy +
   *  a same-day human-follow-up promise rather than "try again". */
  paused: boolean;
}

/** Run one completion through the provider. Maps the chat turns to the
 *  provider's role shape and degrades gracefully — a provider error
 *  returns a calm in-voice reply rather than a 500, so the widget never
 *  shows a stack trace. The `PAUSED` result (spend paused; no network call
 *  was made) gets its own copy so the customer hears "resting, a person
 *  will follow up" instead of a generic transient error. */
async function complete(
  system: string,
  messages: ChatInput["messages"],
  model: string,
  meta: CompleteMeta,
): Promise<CompletionOutcome> {
  const result = await getLlmProvider().complete({
    system,
    messages: toLlmMessages(messages),
    model,
    maxTokens: 700,
    temperature: 0.4,
    cacheSystem: true,
    meta,
  });
  if (!result.ok) {
    if (result.error.code === "PAUSED") {
      return { text: PLAINO_PAUSED_REPLY, degraded: true, paused: true };
    }
    return { text: PLAINO_TRANSIENT_REPLY, degraded: true, paused: false };
  }
  const text = result.value.text.trim();
  return text.length > 0
    ? { text, degraded: false, paused: false }
    : { text: PLAINO_TRANSIENT_REPLY, degraded: true, paused: false };
}

/** Treat every failed turn as a lead-capture opportunity: tell the widget
 *  to auto-expand the email hand-off so the customer doesn't have to find
 *  it. Paused turns additionally emit a structured log so we can see the
 *  sentinel state firing in the logs / Sentry. */
function degradedResponseExtras(
  outcome: CompletionOutcome,
  meta: { mode: "marketing" | "support"; workspaceId?: string },
): { expandLeadCapture: boolean } {
  if (outcome.paused) {
    getLogger().warn("plaino.api_paused_returned_lead_offer", {
      mode: meta.mode,
      workspace_id: meta.workspaceId ?? null,
      error_name: new LlmPausedError().name,
    });
  }
  return { expandLeadCapture: outcome.degraded };
}

async function searchKnowledge(
  ctx: { userId: string; workspaceId: string; isOperator: boolean },
  query: string,
): Promise<Array<{ title: string; body: string; sourceUrl: string | null }>> {
  if (query.trim().length === 0) return [];
  try {
    const store = getKnowledgeStore(ctx);
    const result = await store.search({
      query,
      k: 5,
      contextKinds: ["SKILL", "CUSTOMER", "VERTICAL", "COMPLIANCE"],
    });
    if (!result.ok) return [];
    return result.value.map((hit) => ({
      title: hit.title,
      body: hit.body,
      sourceUrl: hit.sourceUrl,
    }));
  } catch {
    // A substrate miss must not break the chat — Plaino just answers
    // without grounding and leans on the honest "I don't know yet" path.
    return [];
  }
}
