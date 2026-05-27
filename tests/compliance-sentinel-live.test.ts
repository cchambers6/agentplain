/**
 * tests/compliance-sentinel-live.test.ts
 *
 * Pins the proof that the Compliance Sentinel is LIVE for real-estate:
 *
 *   - The realty corpus ships a literal-match rule with non-empty
 *     `triggers` so `scanCorpus()` fires deterministically.
 *   - The realty roster's `realty-compliance-sentinel` card is
 *     `runtime: "live"` and owns `compliance-check`.
 *   - When the runner produces a draft containing a HUD trigger phrase
 *     (seeded into the test LLM), `persistSkillRunArtifacts` writes a
 *     COMPLIANCE_FLAG approval row attributed to that sentinel slug AND
 *     emits a handoff log row where `fromAgent === sentinel slug` so the
 *     /agents card's groupBy(fromAgent) count resolves to real activity.
 *
 * This is the "prove live counts with tests" rule from the vertical-depth
 * brief — Sentinel does not flip from rooting → live without this test.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Payload-crypto: persistSkillRunArtifacts writes encrypted payloads.
// Set a deterministic key so the chain can encrypt without throwing.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

import { loadCorpusFor, scanCorpus } from "@/lib/agents/sentinel";
import { RecordingDraftPersister } from "@/lib/skills/draft";
import { FixtureMessageFetcher } from "@/lib/skills/fixture-fetcher";
import { persistSkillRunArtifacts } from "@/lib/skills/persist-artifacts";
import { runSkillChain } from "@/lib/skills/runner";
import type { SkillRunRecord } from "@/lib/skills/types";
import { TestLlmProvider } from "@/lib/llm/test-provider";
import { getVerticalContent } from "@/lib/verticals";
import { loadAllFixtures } from "./fixtures/webhook-events/_loader";

const WORKSPACE = {
  id: "00000000-0000-0000-0000-realestate0",
  slug: "test-realty",
  name: "Test realty workspace",
  vertical: "REAL_ESTATE" as const,
};

function makeStubTx() {
  const handoffRows: Array<Record<string, unknown>> = [];
  const approvalRows: Array<Record<string, unknown>> = [];
  let nextId = 1;
  const tx = {
    handoffLogEntry: {
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        for (const row of args.data) handoffRows.push(row);
        return { count: args.data.length };
      },
    },
    workApprovalQueueItem: {
      create: async (args: {
        data: Record<string, unknown>;
        select?: { id?: boolean };
      }) => {
        const id = `approval-${nextId++}`;
        const row = { ...args.data, id };
        approvalRows.push(row);
        if (args.select?.id) return { id };
        return row;
      },
    },
  };
  return { tx, handoffRows, approvalRows };
}

describe("compliance sentinel — corpus shape proves the matcher will fire", () => {
  it("real-estate corpus carries at least one literal-match rule with non-empty triggers", () => {
    const corpus = loadCorpusFor("real-estate");
    assert.ok(corpus, "real-estate corpus must be registered");
    const literalRules = corpus!.rules.filter(
      (r) => r.purpose === "literal-match",
    );
    assert.ok(
      literalRules.length > 0,
      "real-estate corpus must contain at least one literal-match rule",
    );
    const totalTriggers = literalRules.reduce(
      (sum, r) => sum + (r.triggers?.length ?? 0),
      0,
    );
    assert.ok(
      totalTriggers >= 30,
      `real-estate literal-match triggers must total ≥ 30 (HUD phrase port); got ${totalTriggers}`,
    );
  });

  it("scanner fires on a realty HUD trigger phrase", () => {
    const corpus = loadCorpusFor("real-estate")!;
    const scan = scanCorpus({
      subject: "Open house — great for families!",
      body: "Welcome to a quiet community, perfect for empty nesters.",
      corpus,
    });
    const phrases = scan.flags.map((f) => f.matchedPhrase).sort();
    assert.ok(
      phrases.includes("great for families"),
      `expected 'great for families' flag, got ${phrases.join(", ")}`,
    );
    assert.ok(
      phrases.includes("empty nesters"),
      `expected 'empty nesters' flag, got ${phrases.join(", ")}`,
    );
  });
});

describe("compliance sentinel — realty roster card is LIVE", () => {
  it("realty-compliance-sentinel is runtime=live and owns compliance-check", () => {
    const roster = getVerticalContent("real-estate")?.agentRoster ?? [];
    const sentinel = roster.find((a) => a.slug === "realty-compliance-sentinel");
    assert.ok(sentinel, "realty-compliance-sentinel missing from roster");
    assert.equal(sentinel!.runtime, "live");
    assert.ok(sentinel!.owns?.includes("compliance-check"));
  });
});

describe("compliance sentinel — runner→persist contract end-to-end", () => {
  it("a draft containing a HUD trigger writes a COMPLIANCE_FLAG attributed to the sentinel slug", async () => {
    const fixtures = await loadAllFixtures();
    const fixture = fixtures.find((f) => f.id === "re-01-buyer-inquiry");
    assert.ok(fixture, "re-01-buyer-inquiry fixture missing");

    // Seed the test LLM so the draft step returns a body containing a
    // HUD literal-trigger phrase. The runner's compliance-check step
    // scans the draft and must surface the flag.
    const draftJson = JSON.stringify({
      subject: "Re: Showing this weekend",
      body: "Hi, this is a great for families home — happy to set up a Saturday showing.",
      tone: "casual",
      confidence: 0.72,
    });
    const baseLlm = new TestLlmProvider();
    // Wrap the LLM: respond with the canned HUD-trigger draft when the
    // draft skill calls in; defer every other skill call (categorize,
    // coordinate, office-admin) to the heuristic so we exercise the
    // real chain wiring around the seeded draft.
    const { DRAFT_PROMPT_MARKER } = await import(
      "@/lib/skills/prompts/markers"
    );
    const wrappedLlm = {
      name: "test" as const,
      async complete(request: import("@/lib/llm/types").LlmCompletionRequest) {
        if (request.system.includes(DRAFT_PROMPT_MARKER)) {
          return {
            ok: true as const,
            value: {
              text: draftJson,
              stopReason: "end_turn" as const,
              usage: { inputTokens: 1, outputTokens: 1 },
              model: "test-stub",
            },
          };
        }
        return baseLlm.complete(request);
      },
    };

    const { buildWebhookEventFromFixture } = await import(
      "@/lib/skills/fixture-fetcher"
    );
    const event = buildWebhookEventFromFixture(fixture!);
    const { record } = await runSkillChain({
      workspace: WORKSPACE,
      event,
      fetcher: new FixtureMessageFetcher(fixture!),
      persister: new RecordingDraftPersister(),
      llm: wrappedLlm,
      writeLog: false,
    });

    // Compliance step should have fired and produced ≥ 1 flag.
    const complianceStep = record.steps.find(
      (s) => s.step === "compliance-check",
    );
    assert.ok(complianceStep, "compliance-check step missing from record");
    assert.ok(
      (record.outcome.complianceFlags?.length ?? 0) > 0,
      "expected ≥ 1 compliance flag against a HUD-trigger draft",
    );

    // Persist and check the rows.
    const { tx, handoffRows, approvalRows } = makeStubTx();
    await persistSkillRunArtifacts({
      workspaceId: WORKSPACE.id,
      record,
      client: tx as never,
    });

    // Approval rows: one BUYER_INQUIRY_REPLY_DRAFT + one COMPLIANCE_FLAG.
    const complianceApproval = approvalRows.find(
      (r) => r.kind === "COMPLIANCE_FLAG",
    );
    assert.ok(complianceApproval, "expected a COMPLIANCE_FLAG approval row");
    assert.equal(
      complianceApproval!.agentSlug,
      "realty-compliance-sentinel",
      "COMPLIANCE_FLAG must be attributed to the live sentinel slug",
    );

    // Handoff log: at least one row where fromAgent is the sentinel slug
    // so the /agents page's groupBy(fromAgent) lights up the card.
    const sentinelOriginated = handoffRows.filter(
      (r) => r.fromAgent === "realty-compliance-sentinel",
    );
    assert.ok(
      sentinelOriginated.length > 0,
      "expected ≥ 1 HandoffLogEntry with fromAgent=realty-compliance-sentinel so the /agents card count resolves",
    );
  });

  it("a draft with no trigger phrases writes NO COMPLIANCE_FLAG approval", async () => {
    // Synthesize a record by hand — no flags, no row.
    const record: SkillRunRecord = {
      startedAt: "2026-05-22T15:00:00.000Z",
      finishedAt: "2026-05-22T15:00:01.000Z",
      durationMs: 1000,
      workspaceId: WORKSPACE.id,
      workspaceSlug: WORKSPACE.slug,
      verticalSlug: "real-estate",
      webhookEventId: `evt-${randomUUID()}`,
      llmProviderName: "test",
      fetcherName: "fixture",
      persisterName: "recording",
      steps: [
        { step: "read", ok: true, summary: "one msg", durationMs: 1 },
        {
          step: "categorize",
          ok: true,
          summary: "intent=draft-needed",
          durationMs: 1,
        },
        { step: "coordinate", ok: true, summary: "no prior", durationMs: 1 },
        { step: "draft", ok: true, summary: "tone=casual", durationMs: 1 },
        {
          step: "compliance-check",
          ok: true,
          summary: "flags=0",
          durationMs: 0,
        },
        { step: "mark-processed", ok: true, summary: "done", durationMs: 0 },
      ],
      outcome: {
        category: "draft-needed",
        threadId: "thr-x",
        scheduledProposal: null,
        draft: {
          draftId: "d-1",
          providerDraftId: null,
          subject: "Re: hi",
          body: "Hi, thanks for the note. Happy to help.",
          tone: "casual",
          confidence: 0.7,
          persisted: false,
        },
        markedProcessed: true,
        officeAdmin: null,
        officeAdminPayload: null,
        complianceFlags: [],
      },
    };
    const { tx, approvalRows } = makeStubTx();
    await persistSkillRunArtifacts({
      workspaceId: WORKSPACE.id,
      record,
      client: tx as never,
    });
    const complianceApproval = approvalRows.find(
      (r) => r.kind === "COMPLIANCE_FLAG",
    );
    assert.equal(
      complianceApproval,
      undefined,
      "no COMPLIANCE_FLAG row expected when scanner found no matches",
    );
  });
});
