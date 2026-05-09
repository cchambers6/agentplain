import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TestAuthProvider, ResendAuthProvider } from "@/lib/auth";

describe("TestAuthProvider", () => {
  it("captures sent magic links", async () => {
    const p = new TestAuthProvider();
    await p.sendMagicLink({
      email: "owner@example.com",
      purpose: "sign_in",
      verifyUrl: "https://example.test/app/verify?token=abc",
      displayName: "Owner",
    });
    const last = p.lastSent();
    assert.ok(last);
    assert.equal(last.email, "owner@example.com");
    assert.equal(last.purpose, "sign_in");
    assert.equal(last.verifyUrl, "https://example.test/app/verify?token=abc");
  });

  it("drainSent returns and clears", async () => {
    const p = new TestAuthProvider();
    await p.sendMagicLink({
      email: "a@x",
      purpose: "sign_in",
      verifyUrl: "u1",
    });
    await p.sendMagicLink({
      email: "b@x",
      purpose: "sign_in",
      verifyUrl: "u2",
    });
    const drained = p.drainSent();
    assert.equal(drained.length, 2);
    assert.equal(p.drainSent().length, 0);
  });

  it("identifies provider name", () => {
    const p = new TestAuthProvider();
    assert.equal(p.providerName, "test");
  });
});

describe("ResendAuthProvider", () => {
  it("delivers via injected Resend client", async () => {
    interface Captured {
      from: string;
      to: string | string[];
      subject: string;
      html: string;
      text?: string;
    }
    let captured: Captured | null = null;

    const stubClient = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      send: async (args: any) => {
        captured = args as Captured;
        return { data: { id: "stub_id_1" }, error: null } as never;
      },
    };

    const p = new ResendAuthProvider({
      apiKey: "test",
      fromEmail: "noreply@agentplain.com",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: stubClient as any,
    });

    const result = await p.sendMagicLink({
      email: "owner@example.com",
      purpose: "sign_up",
      verifyUrl: "https://app.agentplain.com/app/verify?token=abc",
      displayName: "Owner",
    });

    assert.equal(result.messageId, "stub_id_1");
    const c = captured as Captured | null;
    assert.ok(c, "captured");
    if (!c) return;
    assert.equal(c.to, "owner@example.com");
    assert.match(c.subject, /workspace/i);
    assert.match(c.html, /\?token=abc/);
    assert.match(c.text ?? "", /\?token=abc/);
  });

  it("throws when Resend returns error", async () => {
    const stubClient = {
      send: async () =>
        ({ data: null, error: { message: "rate_limited" } }) as never,
    };
    const p = new ResendAuthProvider({
      apiKey: "test",
      fromEmail: "noreply@agentplain.com",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: stubClient as any,
    });
    await assert.rejects(
      () =>
        p.sendMagicLink({
          email: "x@x",
          purpose: "sign_in",
          verifyUrl: "https://x.example/v?token=t",
        }),
      /rate_limited/,
    );
  });
});
