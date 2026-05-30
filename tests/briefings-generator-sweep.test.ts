// Wave-2 briefings generator sweep — Inngest cron coverage.
//
// Covers:
//   1. Sweep iterates workspaces, calls the generator once per, sends
//      the notification email once per newly-written briefing.
//   2. Workspaces with `briefingsMutedAt != null` are skipped — no
//      generator call, no email.
//   3. Idempotent-retry: when the generator returns inserted=false
//      (same-day row exists), the sweep does NOT re-send the email.
//   4. Per-workspace failure is isolated — one workspace's error
//      does not abort the sweep for the rest.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runBriefingsSweep } from "@/lib/inngest/functions/briefings-generator-sweep";

describe("runBriefingsSweep — wave-2 daily briefings cron", () => {
  it("fans out generator + notify across active, non-muted workspaces", async () => {
    const calls: { workspaceId: string }[] = [];
    const emails: { to: string; workspaceId: string }[] = [];

    const result = await runBriefingsSweep({
      listCandidates: async () => [
        {
          id: "ws_a",
          name: "Acme",
          brokerOwnerEmail: "a@acme.test",
          briefingsMutedAt: null,
        },
        {
          id: "ws_b",
          name: "Bell",
          brokerOwnerEmail: "b@bell.test",
          briefingsMutedAt: null,
        },
      ],
      generate: async ({ workspaceId }) => {
        calls.push({ workspaceId });
        return {
          briefingId: `wb_${workspaceId}`,
          body: "today",
          summary: {
            approvalsInWindow: 1,
            pendingApprovals: 1,
            decidedInWindow: 0,
            newChatThreads: 0,
            newInstructions: 0,
            newLearnedNotes: 0,
            topApprovalKinds: [],
          },
          forDate: "2026-05-29",
          status: "READY",
          inserted: true,
        };
      },
      notify: async (input) => {
        emails.push({
          to: input.brokerOwnerEmail,
          workspaceId: input.workspaceId,
        });
        return { messageId: `msg_${input.workspaceId}` };
      },
      now: new Date("2026-05-29T13:00:00Z"),
      appOrigin: "https://app.test",
    });

    // Sweep ran generator + notify for both workspaces.
    // (Notify also tries to UPDATE emailedAt; the default systemContext
    // path uses the real Prisma client, which would throw without a DB.
    // To keep the test focused we capture the failure but assert
    // notification was DISPATCHED — the row count + the email
    // assertions below pin the behavior.)
    assert.equal(calls.length, 2);
    assert.equal(calls[0].workspaceId, "ws_a");
    assert.equal(calls[1].workspaceId, "ws_b");
    assert.equal(emails.length, 2);
    assert.equal(emails[0].to, "a@acme.test");
    assert.equal(emails[1].to, "b@bell.test");
    assert.equal(result.workspacesConsidered, 2);
    assert.equal(result.briefingsWritten, 2);
  });

  it("skips muted workspaces — no generator call, no email", async () => {
    const calls: string[] = [];
    const emails: string[] = [];
    const result = await runBriefingsSweep({
      listCandidates: async () => [
        {
          id: "ws_muted",
          name: "Muted",
          brokerOwnerEmail: "m@muted.test",
          briefingsMutedAt: new Date("2026-05-28T13:00:00Z"),
        },
      ],
      generate: async ({ workspaceId }) => {
        calls.push(workspaceId);
        throw new Error("generator must NOT be called for muted workspace");
      },
      notify: async (input) => {
        emails.push(input.brokerOwnerEmail);
        return { messageId: null };
      },
    });
    assert.equal(calls.length, 0);
    assert.equal(emails.length, 0);
    assert.equal(result.workspacesMuted, 1);
    assert.equal(result.briefingsWritten, 0);
  });

  it("idempotent — inserted=false (same-day row exists) → no notify", async () => {
    const emails: string[] = [];
    const result = await runBriefingsSweep({
      listCandidates: async () => [
        {
          id: "ws_a",
          name: "Acme",
          brokerOwnerEmail: "a@acme.test",
          briefingsMutedAt: null,
        },
      ],
      generate: async () => ({
        briefingId: "wb_existing",
        body: "",
        summary: {
          approvalsInWindow: 0,
          pendingApprovals: 0,
          decidedInWindow: 0,
          newChatThreads: 0,
          newInstructions: 0,
          newLearnedNotes: 0,
          topApprovalKinds: [],
        },
        forDate: "2026-05-29",
        status: "READY",
        inserted: false,
      }),
      notify: async (input) => {
        emails.push(input.brokerOwnerEmail);
        return { messageId: null };
      },
    });
    assert.equal(emails.length, 0, "no re-send on idempotent retry");
    assert.equal(result.briefingsAlreadyExisted, 1);
    assert.equal(result.notificationsSent, 0);
  });

  it("per-workspace failure does not abort the rest of the sweep", async () => {
    const calls: string[] = [];
    const result = await runBriefingsSweep({
      listCandidates: async () => [
        {
          id: "ws_explode",
          name: "Boom",
          brokerOwnerEmail: "x@boom.test",
          briefingsMutedAt: null,
        },
        {
          id: "ws_ok",
          name: "OK",
          brokerOwnerEmail: "o@ok.test",
          briefingsMutedAt: null,
        },
      ],
      generate: async ({ workspaceId }) => {
        calls.push(workspaceId);
        if (workspaceId === "ws_explode") {
          throw new Error("DB timeout");
        }
        return {
          briefingId: `wb_${workspaceId}`,
          body: "ok",
          summary: {
            approvalsInWindow: 0,
            pendingApprovals: 0,
            decidedInWindow: 0,
            newChatThreads: 0,
            newInstructions: 0,
            newLearnedNotes: 0,
            topApprovalKinds: [],
          },
          forDate: "2026-05-29",
          status: "READY",
          inserted: false,
        };
      },
      notify: async () => ({ messageId: null }),
    });
    assert.equal(calls.length, 2, "second workspace still attempted");
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].workspaceId, "ws_explode");
  });

  it("no broker-owner email — generator runs, notify is skipped, sweep does not crash", async () => {
    const result = await runBriefingsSweep({
      listCandidates: async () => [
        {
          id: "ws_no_email",
          name: "Stranded",
          brokerOwnerEmail: null,
          briefingsMutedAt: null,
        },
      ],
      generate: async () => ({
        briefingId: "wb_x",
        body: "x",
        summary: {
          approvalsInWindow: 0,
          pendingApprovals: 0,
          decidedInWindow: 0,
          newChatThreads: 0,
          newInstructions: 0,
          newLearnedNotes: 0,
          topApprovalKinds: [],
        },
        forDate: "2026-05-29",
        status: "READY",
        inserted: true,
      }),
      notify: async () => {
        throw new Error("notify must NOT be called when no broker-owner email");
      },
    });
    assert.equal(result.briefingsWritten, 1);
    assert.equal(result.notificationsSent, 0);
  });
});
