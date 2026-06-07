/**
 * tests/plaino-chat-flows.test.ts
 *
 * End-to-end flow coverage for the Plaino chatbot backbone, exercised at
 * the seam the /api/chat route composes: prompt → provider → reply, plus
 * the hand-off payload each mode produces.
 *
 * Why at the seam (not the HTTP route): the route's only non-pure work is
 * auth + Prisma persistence (withRls / withSystemContext), which needs a
 * live DB the test environment does not provide. The two-implementation
 * LLM seam (TestLlmProvider) lets us drive the exact prompt + role-mapping
 * + reply path the route runs, then assert the capture / draft payloads
 * validate through the same schemas the endpoints use. CI has no Playwright
 * harness or DB (see project memory), so this is the deepest honest flow
 * coverage available — a browser e2e is a follow-on once that harness lands.
 *
 * Flow 1 — anonymous marketing chat → lead capture:
 *   marketing prompt + visitor question → reply, then the lead-capture
 *   payload (email + intent + conversation link) validates.
 *
 * Flow 2 — authenticated support chat → draft into review:
 *   support prompt grounded in workspace context + knowledge → reply, then
 *   the draft payload validates against the SAME supportRequestSchema the
 *   /api/support/draft endpoint feeds into submitSupportRequest (which
 *   creates the SUPPORT_HANDLER_REPLY_DRAFT review item).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TestLlmProvider } from "@/lib/llm/test-provider";
import { buildMarketingSystemPrompt } from "@/lib/plaino/marketing-prompt";
import {
  buildSupportSystemPrompt,
  type SupportPromptContext,
} from "@/lib/plaino/support-prompt";
import { appendReply, toLlmMessages } from "@/lib/plaino/chat-turns";
import { leadCaptureSchema } from "@/lib/leads/types";
import { supportRequestSchema } from "@/lib/support/types";

describe("Plaino marketing flow → lead capture", () => {
  it("produces a reply and captures a valid lead", async () => {
    const question = "i want a demo for my brokerage";
    const provider = new TestLlmProvider({
      byLastUser: {
        [question]:
          "happy to set that up — leave your email and a person will reach out.",
      },
    });

    const messages = [{ role: "user" as const, body: question }];
    const result = await provider.complete({
      system: buildMarketingSystemPrompt({ sourcePage: "/pricing" }),
      messages: toLlmMessages(messages),
      model: "test",
      cacheSystem: true,
    });

    assert.ok(result.ok);
    assert.match(result.value.text, /leave your email/);

    // The transcript the route would persist.
    const turns = appendReply(messages, result.value.text, "2026-06-06T00:00:00.000Z");
    assert.equal(turns.length, 2);
    assert.equal(turns[1].role, "plaino");

    // The capture payload the widget posts to /api/leads/capture.
    const capture = leadCaptureSchema.safeParse({
      email: "owner@brokerage.com",
      intent: "wants a demo",
      sourcePage: "/pricing",
      conversationId: "22222222-2222-4222-8222-222222222222",
    });
    assert.ok(capture.success);
  });
});

describe("Plaino support flow → draft into review", () => {
  it("answers grounded in context and produces a valid draft payload", async () => {
    const question = "can a teammate approve drafts instead of me?";
    const ctx: SupportPromptContext = {
      workspaceName: "Peachtree Realty",
      verticalSlug: "real-estate",
      tierDisplayName: "Regular",
      connectedIntegrations: ["Gmail"],
      pendingApprovalsCount: 2,
      knowledge: [
        {
          title: "Approval routing",
          body: "A discipline head can be assigned as the required approver for a discipline.",
          sourceUrl: null,
        },
      ],
    };
    const provider = new TestLlmProvider({
      byLastUser: {
        [question]:
          "yes — you can name a discipline head as the required approver. from: approval routing.",
      },
    });

    const messages = [{ role: "user" as const, body: question }];
    const result = await provider.complete({
      system: buildSupportSystemPrompt(ctx),
      messages: toLlmMessages(messages),
      model: "test",
      cacheSystem: true,
      meta: { sourceSurface: "PLAINO_CHAT", workspaceId: "ws-1" },
    });

    assert.ok(result.ok);
    assert.match(result.value.text, /required approver/);
    // The system prompt the provider saw carried the workspace grounding.
    assert.match(provider.calls[0].request.system, /Peachtree Realty/);
    assert.match(provider.calls[0].request.system, /Approval routing/);

    // The draft payload the widget posts to /api/support/draft — must pass
    // the same schema submitSupportRequest validates.
    const draft = supportRequestSchema.safeParse({
      subject: "Can a teammate approve drafts?",
      body: question,
    });
    assert.ok(draft.success);
  });
});
