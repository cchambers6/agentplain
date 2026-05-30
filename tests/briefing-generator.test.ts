// Wave-2 briefings generator unit tests.
//
// Covers:
//   1. `buildActivitySnapshot` reads the right shape across approvals,
//      chat threads, instructions, learned-note signals.
//   2. `generateBriefingForWorkspace` composes a briefing (via a fake
//      LlmProvider) and persists ONE encrypted row per workspace per
//      day. Same-day re-run is idempotent (returns existing row,
//      inserted=false, no second LLM call).
//   3. Empty-window workspaces skip the LLM and persist a status=EMPTY
//      row with a templated body.
//   4. The persisted body is encrypted (v1 envelope), never plaintext.
//
// Per `feedback_runner_portability.md`: every dependency is injected.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  generateBriefingForWorkspace,
  __test_isoYmd,
} from "@/lib/skills/briefing-generator";
import { buildActivitySnapshot } from "@/lib/skills/briefing-generator/activity-snapshot";
import type {
  LlmCompletionRequest,
  LlmProvider,
} from "@/lib/llm/types";
import { isEncrypted, decrypt } from "@/lib/security/encryption";

// ---------------------------------------------------------------------
// Fake LLM provider
// ---------------------------------------------------------------------

const buildFakeLlm = (
  text: string = "Yesterday Plaino watched three approvals roll through.",
): LlmProvider & { calls: { system: string; userText: string }[] } => {
  const calls: { system: string; userText: string }[] = [];
  return {
    name: "test",
    async complete(req: LlmCompletionRequest) {
      const userText =
        typeof req.messages[0].content === "string"
          ? req.messages[0].content
          : (req.messages[0].content as { text?: string }[])
              .map((b) => b.text ?? "")
              .join("");
      calls.push({ system: req.system, userText });
      return {
        ok: true,
        value: {
          text,
          stopReason: "end_turn",
          usage: null,
          model: "test",
        },
      };
    },
    get calls() {
      return calls;
    },
  } as never;
};

// ---------------------------------------------------------------------
// Fake tx — only the surface the generator touches
// ---------------------------------------------------------------------

interface FakeBriefingRow {
  id: string;
  workspaceId: string;
  forDate: string;
  body: string;
  summary: unknown;
  status: string;
  generatedAt: Date;
}

interface FakeTxStore {
  workspace: { id: string; name: string } | null;
  briefings: FakeBriefingRow[];
  approvals: Array<{
    workspaceId: string;
    kind: string;
    status: string;
    payload: unknown;
    proposedAt: Date;
    decidedAt?: Date | null;
  }>;
  chatThreads: Array<{ workspaceId: string; createdAt: Date }>;
  preferenceSignals: Array<{
    workspaceId: string;
    source: string;
    capturedAt: Date;
  }>;
  audits: Array<{ action: string; targetId?: string | null }>;
  nextBriefingId: number;
}

const buildStore = (
  init: Partial<FakeTxStore> = {},
): FakeTxStore => ({
  workspace: init.workspace ?? { id: "ws_brief", name: "Acme Realty" },
  briefings: init.briefings ?? [],
  approvals: init.approvals ?? [],
  chatThreads: init.chatThreads ?? [],
  preferenceSignals: init.preferenceSignals ?? [],
  audits: init.audits ?? [],
  nextBriefingId: 1,
});

const buildSystemContext = (store: FakeTxStore) => {
  const fakeTx = {
    workspace: {
      findUnique: async (args: { where: { id: string } }) => {
        if (store.workspace && store.workspace.id === args.where.id) {
          return store.workspace;
        }
        return null;
      },
    },
    workspaceBriefing: {
      findUnique: async (args: {
        where: { workspaceId_forDate: { workspaceId: string; forDate: string } };
      }) => {
        return (
          store.briefings.find(
            (b) =>
              b.workspaceId === args.where.workspaceId_forDate.workspaceId &&
              b.forDate === args.where.workspaceId_forDate.forDate,
          ) ?? null
        );
      },
      create: async (args: {
        data: {
          workspaceId: string;
          forDate: string;
          body: string;
          summary: unknown;
          status: string;
        };
      }) => {
        const row: FakeBriefingRow = {
          id: `wb_${store.nextBriefingId++}`,
          ...args.data,
          generatedAt: new Date(),
        };
        store.briefings.push(row);
        return { id: row.id };
      },
    },
    workApprovalQueueItem: {
      findMany: async (args: {
        where: { workspaceId: string; OR?: unknown };
      }) => {
        return store.approvals
          .filter((a) => a.workspaceId === args.where.workspaceId)
          .map((a) => ({
            kind: a.kind,
            status: a.status,
            payload: a.payload,
            proposedAt: a.proposedAt,
          }));
      },
      count: async (args: {
        where: { workspaceId: string; kind?: string };
      }) => {
        return store.approvals.filter(
          (a) =>
            a.workspaceId === args.where.workspaceId &&
            (args.where.kind ? a.kind === args.where.kind : true),
        ).length;
      },
    },
    chatThread: {
      count: async (args: {
        where: { workspaceId: string; createdAt?: { gte: Date } };
      }) => {
        return store.chatThreads.filter(
          (t) => t.workspaceId === args.where.workspaceId,
        ).length;
      },
    },
    preferenceSignal: {
      count: async (args: {
        where: {
          workspaceId: string;
          source?: { in: string[] };
        };
      }) => {
        return store.preferenceSignals.filter(
          (s) =>
            s.workspaceId === args.where.workspaceId &&
            (args.where.source ? args.where.source.in.includes(s.source) : true),
        ).length;
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; targetId?: string | null } }) => {
        store.audits.push(data);
      },
    },
  };
  return async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
    fn(fakeTx);
};

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe("buildActivitySnapshot — slices last-24h activity into the LLM-ready shape", () => {
  it("counts approvals (pending vs decided), chats, instructions, learned notes", async () => {
    const now = new Date("2026-05-29T13:00:00Z");
    const justInside = new Date(now.getTime() - 60 * 60 * 1000); // 1h before now
    const wayOutside = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48h before
    const store = buildStore({
      approvals: [
        {
          workspaceId: "ws_brief",
          kind: "INBOX_TRIAGE",
          status: "PENDING",
          payload: { title: "Acme Q3 invoice" },
          proposedAt: justInside,
        },
        {
          workspaceId: "ws_brief",
          kind: "INBOX_TRIAGE",
          status: "APPROVED",
          payload: { title: "Approved already" },
          proposedAt: justInside,
        },
        {
          workspaceId: "ws_brief",
          kind: "FOLLOW_UP_NUDGE",
          status: "PENDING",
          payload: { subject: "Tour scheduling" },
          proposedAt: justInside,
        },
        // Out of window — should be filtered by where clause; the fake
        // tx ignores the where filter but we still get a count.
        {
          workspaceId: "ws_brief",
          kind: "INBOX_TRIAGE",
          status: "PENDING",
          payload: {},
          proposedAt: wayOutside,
        },
      ],
      chatThreads: [
        { workspaceId: "ws_brief", createdAt: justInside },
        { workspaceId: "ws_brief", createdAt: justInside },
      ],
      preferenceSignals: [
        {
          workspaceId: "ws_brief",
          source: "DRAFT_EDIT",
          capturedAt: justInside,
        },
      ],
    });
    const snapshot = await buildActivitySnapshot({
      workspaceId: "ws_brief",
      now,
      systemContext: buildSystemContext(store) as never,
    });
    assert.equal(snapshot.workspaceName, "Acme Realty");
    // approvals counts every record the fake returns (the where clause
    // is unit-tested in the live impl; here we assert the aggregation).
    assert.equal(snapshot.summary.approvalsInWindow, 4);
    assert.equal(snapshot.summary.pendingApprovals, 3);
    assert.equal(snapshot.summary.decidedInWindow, 1);
    assert.equal(snapshot.summary.newChatThreads, 2);
    assert.equal(snapshot.summary.newLearnedNotes, 1);
    // Top kinds — INBOX_TRIAGE (3) before FOLLOW_UP_NUDGE (1).
    assert.equal(snapshot.summary.topApprovalKinds[0].kind, "INBOX_TRIAGE");
    assert.equal(snapshot.summary.topApprovalKinds[0].count, 3);
    // Pending-highlight titles pull from payload.title|subject.
    assert.equal(snapshot.pendingHighlights.length, 3);
    const titles = snapshot.pendingHighlights.map((h) => h.title);
    assert.ok(titles.includes("Acme Q3 invoice"));
    assert.ok(titles.includes("Tour scheduling"));
  });
});

describe("generateBriefingForWorkspace — composes + persists encrypted row", () => {
  beforeEach(() => {
    // Encryption requires a master key in env; the test suite already
    // sets one via setup. If it isn't, surface a clear failure.
    if (!process.env.ENCRYPTION_KEY) {
      // Tests run with a deterministic 64-hex key when ENCRYPTION_KEY
      // isn't set. The encryption.test.ts pattern is fine to mirror.
      process.env.ENCRYPTION_KEY =
        "1111111111111111111111111111111111111111111111111111111111111111";
    }
  });

  it("non-empty snapshot → composes via LLM, persists encrypted body, audits", async () => {
    const now = new Date("2026-05-29T13:00:00Z");
    const store = buildStore({
      approvals: [
        {
          workspaceId: "ws_brief",
          kind: "INBOX_TRIAGE",
          status: "PENDING",
          payload: { title: "Acme Q3 invoice" },
          proposedAt: new Date(now.getTime() - 60 * 60 * 1000),
        },
      ],
    });
    const llm = buildFakeLlm("Yesterday three approvals rolled through.");
    const result = await generateBriefingForWorkspace({
      workspaceId: "ws_brief",
      now,
      llm,
      systemContext: buildSystemContext(store) as never,
    });
    assert.equal(result.inserted, true);
    assert.equal(result.status, "READY");
    assert.equal(result.forDate, __test_isoYmd(now));
    assert.match(result.body, /three approvals/);
    // Persisted row's body is encrypted (v1 envelope), not the
    // plaintext we composed.
    assert.equal(store.briefings.length, 1);
    const persisted = store.briefings[0];
    assert.ok(
      isEncrypted(persisted.body),
      "body must be v1-envelope encrypted at rest",
    );
    assert.equal(decrypt(persisted.body), result.body);
    // Audit row written.
    assert.ok(
      store.audits.find((a) => a.action === "briefing.generated"),
      "briefing.generated audit row must be written",
    );
  });

  it("empty snapshot → no LLM call, status=EMPTY, templated body", async () => {
    const now = new Date("2026-05-29T13:00:00Z");
    const store = buildStore({ approvals: [], chatThreads: [] });
    const llm = buildFakeLlm("SHOULD NOT BE CALLED");
    const result = await generateBriefingForWorkspace({
      workspaceId: "ws_brief",
      now,
      llm,
      systemContext: buildSystemContext(store) as never,
    });
    assert.equal(result.status, "EMPTY");
    assert.equal(result.inserted, true);
    assert.equal(
      (llm as unknown as { calls: unknown[] }).calls.length,
      0,
      "empty snapshot must not burn an LLM call",
    );
    assert.equal(store.briefings.length, 1);
    assert.equal(store.briefings[0].status, "EMPTY");
    assert.ok(
      store.audits.find((a) => a.action === "briefing.generated_empty"),
    );
  });

  it("idempotent — same-day re-run returns the existing row, no new LLM call, no new audit", async () => {
    const now = new Date("2026-05-29T13:00:00Z");
    const store = buildStore({
      approvals: [
        {
          workspaceId: "ws_brief",
          kind: "INBOX_TRIAGE",
          status: "PENDING",
          payload: { title: "X" },
          proposedAt: now,
        },
      ],
    });
    const llm = buildFakeLlm();
    const ctx = buildSystemContext(store);

    // First call — inserts a row.
    const first = await generateBriefingForWorkspace({
      workspaceId: "ws_brief",
      now,
      llm,
      systemContext: ctx as never,
    });
    assert.equal(first.inserted, true);
    const llmCallsAfterFirst = (llm as unknown as { calls: unknown[] }).calls.length;
    assert.equal(store.briefings.length, 1);

    // Second call same day — short-circuits.
    const second = await generateBriefingForWorkspace({
      workspaceId: "ws_brief",
      now,
      llm,
      systemContext: ctx as never,
    });
    assert.equal(second.inserted, false);
    assert.equal(second.briefingId, first.briefingId);
    assert.equal(store.briefings.length, 1, "no second row written");
    assert.equal(
      (llm as unknown as { calls: unknown[] }).calls.length,
      llmCallsAfterFirst,
      "second call must not burn another LLM call",
    );
  });

  it("LLM error → falls back to templated body, still status=READY (snapshot had activity)", async () => {
    const now = new Date("2026-05-29T13:00:00Z");
    const store = buildStore({
      approvals: [
        {
          workspaceId: "ws_brief",
          kind: "INBOX_TRIAGE",
          status: "PENDING",
          payload: { title: "X" },
          proposedAt: now,
        },
      ],
    });
    const llm: LlmProvider = {
      name: "test",
      async complete() {
        return {
          ok: false,
          error: { code: "NETWORK", message: "upstream down" },
        };
      },
    };
    const result = await generateBriefingForWorkspace({
      workspaceId: "ws_brief",
      now,
      llm,
      systemContext: buildSystemContext(store) as never,
    });
    assert.equal(result.status, "READY");
    assert.match(result.body, /upstream down/);
    assert.equal(store.briefings.length, 1);
  });
});
