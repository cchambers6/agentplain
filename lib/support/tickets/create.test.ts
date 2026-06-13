/**
 * lib/support/tickets/create.test.ts
 *
 * Exercises the create orchestrator over fake ports — no DB, no email. Covers:
 *   - validation (loud field errors, never a silent drop),
 *   - the SLA + priority + assignee a created ticket carries,
 *   - the initial thread (customer message + SYSTEM ack + internal note),
 *   - the LOUD-fail signal when staff routing falls to the baked-in fallback,
 *   - persist failure surfaced (not swallowed).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createSupportTicket } from "./create";
import type {
  CreatedTicket,
  NewTicketRecord,
  StaffNotifyArgs,
  StaffNotifyResult,
  TicketContextSnapshot,
  TicketNotifier,
  TicketStore,
} from "./types";

const CONTEXT: TicketContextSnapshot = {
  vertical: "real_estate",
  plan: "REGULAR",
  integrationsConnected: ["GOOGLE"],
  recentQueueItems: [],
  plainoState: "Active.",
  capturedAt: "2026-06-12T00:00:00.000Z",
};

function fakeStore(over: Partial<TicketStore> = {}): {
  store: TicketStore;
  created: NewTicketRecord[];
} {
  const created: NewTicketRecord[] = [];
  const store: TicketStore = {
    name: "fake",
    async createTicket(record): Promise<CreatedTicket> {
      created.push(record);
      return { id: "tkt_1", number: 1042 };
    },
    async addMessage() {
      throw new Error("not used");
    },
    async updateTicket() {},
    async loadTicketForCustomer() {
      return null;
    },
    async loadTicketForStaff() {
      return null;
    },
    async listTicketsForWorkspace() {
      return [];
    },
    async listTicketsForStaff() {
      return [];
    },
    ...over,
  };
  return { store, created };
}

function fakeNotifier(staff: Partial<StaffNotifyResult> = {}): {
  notifier: TicketNotifier;
  staffCalls: StaffNotifyArgs[];
} {
  const staffCalls: StaffNotifyArgs[] = [];
  const notifier: TicketNotifier = {
    name: "fake",
    async notifyStaffNewTicket(args): Promise<StaffNotifyResult> {
      staffCalls.push(args);
      return {
        delivered: true,
        recipients: ["staff@agentplain.com"],
        usedHardcodedFallback: false,
        persisted: true,
        ...staff,
      };
    },
    async confirmToCustomer() {
      return { delivered: true };
    },
  };
  return { notifier, staffCalls };
}

const BASE_INPUT = {
  workspaceId: "ws_1",
  userId: "user_1",
  fromEmail: "owner@shop.com",
  fromName: "Owner",
  workspaceName: "Shop",
  subject: "Sync stopped working",
  category: "INTEGRATION" as const,
  description: "My QuickBooks sync stopped this morning and invoices aren't pulling in.",
};

describe("createSupportTicket", () => {
  it("rejects empty subject + description with field errors", async () => {
    const { store } = fakeStore();
    const { notifier } = fakeNotifier();
    const r = await createSupportTicket(
      { ...BASE_INPUT, subject: "  ", description: "" },
      { store, notifier, context: CONTEXT, partnerName: "Plaino", env: {} as NodeJS.ProcessEnv },
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "VALIDATION");
    assert.ok(r.fieldErrors?.subject);
    assert.ok(r.fieldErrors?.description);
  });

  it("creates a ticket with SLA, priority, assignee, and the initial thread", async () => {
    const { store, created } = fakeStore();
    const { notifier } = fakeNotifier();
    const now = new Date("2026-06-12T00:00:00.000Z");
    const r = await createSupportTicket(BASE_INPUT, {
      store,
      notifier,
      context: CONTEXT,
      partnerName: "Plaino",
      env: { FLEET_TRUSTED_HUMAN_EMAIL: "staff@agentplain.com" } as NodeJS.ProcessEnv,
      now,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    // INTEGRATION floor → P1 → 4h SLA.
    assert.equal(r.value.priority, "P1");
    assert.equal(r.value.number, 1042);
    assert.equal(r.value.slaWindowLabel, "within 4 hours");
    assert.equal(r.value.firstResponseDueAt.toISOString(), "2026-06-12T04:00:00.000Z");
    assert.equal(r.value.assignedTo, "staff@agentplain.com");

    const rec = created[0];
    assert.equal(rec.initialMessages.length, 3);
    assert.equal(rec.initialMessages[0].author, "CUSTOMER");
    assert.equal(rec.initialMessages[0].internal, false);
    assert.equal(rec.initialMessages[1].author, "SYSTEM");
    assert.equal(rec.initialMessages[1].internal, false); // customer-visible ack
    assert.equal(rec.initialMessages[2].author, "SYSTEM");
    assert.equal(rec.initialMessages[2].internal, true); // internal classification note
  });

  it("surfaces the LOUD signal when staff routing fell to the baked-in fallback", async () => {
    const { store } = fakeStore();
    const { notifier } = fakeNotifier({
      usedHardcodedFallback: true,
      recipients: ["connerchambers6@gmail.com"],
    });
    const r = await createSupportTicket(BASE_INPUT, {
      store,
      notifier,
      context: CONTEXT,
      partnerName: "Plaino",
      env: {} as NodeJS.ProcessEnv, // no FLEET_TRUSTED_HUMAN_EMAIL, no allowlist
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.staffNotified.usedHardcodedFallback, true);
    // The page still resolved a recipient — never "nobody".
    assert.ok(r.value.staffNotified.recipients.length > 0);
    // And the ticket is still assigned (to the fallback inbox).
    assert.ok(r.value.assignedTo && r.value.assignedTo.length > 0);
  });

  it("surfaces a persist failure instead of swallowing it", async () => {
    const { store } = fakeStore({
      async createTicket(): Promise<CreatedTicket> {
        throw new Error("db down");
      },
    });
    const { notifier } = fakeNotifier();
    const r = await createSupportTicket(BASE_INPUT, {
      store,
      notifier,
      context: CONTEXT,
      partnerName: "Plaino",
      env: {} as NodeJS.ProcessEnv,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "PERSIST_FAILED");
    assert.match(r.message, /db down/);
  });
});
