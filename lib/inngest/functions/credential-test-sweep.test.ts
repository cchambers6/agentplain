/**
 * lib/inngest/functions/credential-test-sweep.test.ts
 *
 * Quarterly credential-test sweep. Bar: a dead fleet-global key pages a human
 * (critical, 24h) AND auto-disables via a health OpsFlag (the operator-UI +
 * reconnect-prompt trigger), with the Resend-dead case recorded as a flag row
 * because paging-by-email is impossible then.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runCredentialTestSweep,
  credentialHealthFlagName,
} from "./credential-test-sweep";
import { TestCredentialProbes } from "@/lib/ops/credential-probes";
import { InMemoryOpsFlagStore } from "@/lib/ops/flag-store";
import type { PageHumanInput } from "@/lib/ops/page-human";

function fakePager() {
  const pages: PageHumanInput[] = [];
  const fn = async (input: PageHumanInput) => {
    pages.push(input);
    return {
      delivered: true,
      recipients: ["ops@agentplain.com"],
      usedFallbackRecipient: false,
      persisted: true,
      auditLogId: "audit_1",
    };
  };
  return { pages, fn };
}

const NOW = new Date("2026-06-10T00:00:00Z");

describe("runCredentialTestSweep — all healthy", () => {
  it("clears stale flags and pages no one", async () => {
    const probes = new TestCredentialProbes({
      STRIPE: { status: "healthy", provider: "STRIPE" },
      RESEND: { status: "healthy", provider: "RESEND" },
      ANTHROPIC: { status: "healthy", provider: "ANTHROPIC" },
    });
    const flagStore = new InMemoryOpsFlagStore({
      [credentialHealthFlagName("STRIPE")]: "invalid", // stale from a prior outage
    });
    const pager = fakePager();

    const report = await runCredentialTestSweep({
      probes,
      flagStore,
      page: pager.fn as any,
      now: NOW,
    });

    assert.equal(pager.pages.length, 0);
    assert.deepEqual(report.paged, []);
    // Stale STRIPE flag flipped back to healthy (un-disabled on recovery).
    assert.equal(flagStore.peek(credentialHealthFlagName("STRIPE"))?.value, "healthy");
  });
});

describe("runCredentialTestSweep — Stripe key invalid", () => {
  it("pages critical with a 24h deadline + sets the disable flag", async () => {
    const probes = new TestCredentialProbes({
      STRIPE: { status: "invalid", provider: "STRIPE", detail: "HTTP 401: Invalid API Key" },
      RESEND: { status: "healthy", provider: "RESEND" },
      ANTHROPIC: { status: "not_configured", provider: "ANTHROPIC" },
    });
    const flagStore = new InMemoryOpsFlagStore();
    const pager = fakePager();

    const report = await runCredentialTestSweep({
      probes,
      flagStore,
      page: pager.fn as any,
      now: NOW,
    });

    assert.deepEqual(report.paged, ["STRIPE"]);
    assert.deepEqual(report.disabled, ["STRIPE"]);

    // Paged: critical, 24h deadline, names the customer impact + restore steps.
    assert.equal(pager.pages.length, 1);
    const page = pager.pages[0];
    assert.equal(page.severity, "critical");
    assert.match(page.summary, /STRIPE key invalid/);
    assert.match(page.details, /Billing is down/);
    assert.match(page.details, /STRIPE_SECRET_KEY/);
    assert.equal(page.source, "credential-test-sweep");
    assert.ok(page.deadline);
    assert.equal(
      page.deadline!.getTime() - NOW.getTime(),
      24 * 60 * 60 * 1000,
    );

    // Auto-disabled: the health flag the operator UI + reconnect prompt read.
    assert.equal(flagStore.peek(credentialHealthFlagName("STRIPE"))?.value, "invalid");
  });
});

describe("runCredentialTestSweep — Resend key dead (the self-referential case)", () => {
  it("writes the OpsFlag artifact + pages (email may not arrive) with the honest caveat", async () => {
    const probes = new TestCredentialProbes({
      STRIPE: { status: "healthy", provider: "STRIPE" },
      RESEND: { status: "invalid", provider: "RESEND", detail: "invalid api key" },
      ANTHROPIC: { status: "healthy", provider: "ANTHROPIC" },
    });
    const flagStore = new InMemoryOpsFlagStore();
    const pager = fakePager();

    await runCredentialTestSweep({
      probes,
      flagStore,
      page: pager.fn as any,
      now: NOW,
    });

    // The loud-fail artifact: a flag row, independent of email working.
    assert.equal(flagStore.peek(credentialHealthFlagName("RESEND"))?.value, "invalid");
    // The page body is honest that this very email may not have arrived.
    assert.match(pager.pages[0].details, /THIS email itself may not/i);
    assert.match(pager.pages[0].details, /OPS_CREDENTIAL_HEALTH_RESEND/);
  });
});

describe("runCredentialTestSweep — not configured + transient", () => {
  it("skips unset keys cleanly and does not page on a transient blip", async () => {
    const probes = new TestCredentialProbes({
      STRIPE: { status: "not_configured", provider: "STRIPE" },
      RESEND: { status: "transient", provider: "RESEND", detail: "503 upstream" },
      ANTHROPIC: { status: "not_configured", provider: "ANTHROPIC" },
    });
    const flagStore = new InMemoryOpsFlagStore();
    const pager = fakePager();

    const report = await runCredentialTestSweep({
      probes,
      flagStore,
      page: pager.fn as any,
      now: NOW,
    });

    assert.equal(pager.pages.length, 0, "no page for unset or transient");
    assert.deepEqual(report.paged, []);
    // No flag writes for not_configured / transient.
    assert.equal(flagStore.peek(credentialHealthFlagName("STRIPE")), undefined);
    assert.equal(flagStore.peek(credentialHealthFlagName("RESEND")), undefined);
    // Honest report names the per-workspace creds it did NOT probe.
    assert.ok(report.perWorkspaceNotProbed.some((s) => /QUALIA/.test(s)));
    assert.ok(report.perWorkspaceNotProbed.some((s) => /BUILDIUM/.test(s)));
  });
});
