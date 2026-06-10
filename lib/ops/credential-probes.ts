/**
 * lib/ops/credential-probes.ts
 *
 * Read-only credential health probes for the fleet's GLOBAL keys — the
 * single-tenant env credentials whose silent expiry breaks EVERY customer at
 * once (Stripe primary, Resend, Anthropic). Per-workspace customer credentials
 * (Buildium, Qualia, Gmail, …) are NOT global keys — they're covered by the
 * per-credential renewal sweep + REVOKED detection — so they're reported here
 * as "not a fleet key" rather than probed, honestly.
 *
 * Each probe issues the CHEAPEST authenticated read the vendor offers, so the
 * quarterly cron verifies the key without spending, sending, or mutating:
 *   - Stripe: `balance.retrieve()` — a free authenticated GET.
 *   - Resend: `domains.list()` — the cheapest authenticated read. We do NOT
 *     verify Resend by sending an email (self-referential: the very channel
 *     we'd use to PAGE about a dead Resend key is Resend itself).
 *   - Anthropic: handled by the LLM key-rotation layer at call time, not here
 *     (the primary is sentinel-paused; a probe would just confirm the pause).
 *     The cron reports its configured/paused state without burning a call.
 *
 * Two implementations (feedback_runner_portability): `LiveCredentialProbes`
 * (real vendor SDKs, behind the same adapter packages the app already uses)
 * and `TestCredentialProbes` (scriptable, no network) for the cron's tests.
 *
 * Per feedback_no_silent_vendor_lock: the Stripe + Resend SDK imports live
 * ONLY in the live implementation here; the cron speaks the probe interface.
 */

import Stripe from "stripe";
import { Resend } from "resend";
import { STRIPE_API_VERSION } from "../billing/stripe-provider";

/** The fleet-global keys the cron checks. */
export type ProbeProvider = "STRIPE" | "RESEND" | "ANTHROPIC";

export type ProbeOutcome =
  /** Key present and the read succeeded. */
  | { status: "healthy"; provider: ProbeProvider }
  /** Key present but the vendor rejected it (401/invalid). Actionable. */
  | { status: "invalid"; provider: ProbeProvider; detail: string }
  /** Key not set in this environment — skip cleanly, report, don't page. */
  | { status: "not_configured"; provider: ProbeProvider }
  /** A transient/non-auth error (network, 5xx). Not a key problem; the cron
   *  logs but does not auto-disable or page critical on this. */
  | { status: "transient"; provider: ProbeProvider; detail: string };

export interface CredentialProbes {
  probeStripe(): Promise<ProbeOutcome>;
  probeResend(): Promise<ProbeOutcome>;
  probeAnthropic(): Promise<ProbeOutcome>;
}

/** Classify a thrown vendor error into invalid (auth) vs transient. */
function classify(provider: ProbeProvider, err: unknown): ProbeOutcome {
  const status =
    typeof err === "object" && err !== null && "statusCode" in err
      ? (err as { statusCode?: number }).statusCode
      : typeof err === "object" && err !== null && "status" in err
        ? (err as { status?: number }).status
        : undefined;
  const message = err instanceof Error ? err.message : String(err);
  if (status === 401 || status === 403) {
    return { status: "invalid", provider, detail: `HTTP ${status}: ${message}` };
  }
  // Resend returns { name: 'validation_error' | 'missing_api_key', ... } shapes
  // on bad keys without always setting a numeric status.
  if (/invalid api key|unauthor|api key is invalid|restricted/i.test(message)) {
    return { status: "invalid", provider, detail: message };
  }
  return { status: "transient", provider, detail: `${status ?? "?"}: ${message}` };
}

/**
 * Live probes. Constructed with the env snapshot so it reads keys at
 * call time (cold-start safe). The Stripe/Resend clients are built lazily
 * per probe so an unset key never constructs a client.
 */
export class LiveCredentialProbes implements CredentialProbes {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async probeStripe(): Promise<ProbeOutcome> {
    const key = this.env.STRIPE_SECRET_KEY;
    if (!key || key.length === 0) {
      return { status: "not_configured", provider: "STRIPE" };
    }
    try {
      const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
      // Cheapest authenticated read — a free GET that 401s on a dead key.
      await stripe.balance.retrieve();
      return { status: "healthy", provider: "STRIPE" };
    } catch (err) {
      return classify("STRIPE", err);
    }
  }

  async probeResend(): Promise<ProbeOutcome> {
    const key = this.env.RESEND_API_KEY;
    if (!key || key.length === 0) {
      return { status: "not_configured", provider: "RESEND" };
    }
    try {
      const resend = new Resend(key);
      // Cheapest authenticated read. NOT an email send — that would be
      // self-referential (we'd be using the channel we're testing).
      const res = await resend.domains.list();
      if ("error" in res && res.error) {
        return classify("RESEND", res.error);
      }
      return { status: "healthy", provider: "RESEND" };
    } catch (err) {
      return classify("RESEND", err);
    }
  }

  async probeAnthropic(): Promise<ProbeOutcome> {
    const key = this.env.ANTHROPIC_API_KEY;
    if (!key || key.length === 0) {
      return { status: "not_configured", provider: "ANTHROPIC" };
    }
    // A sentinel-paused key is an intentional state (spend paused), not a dead
    // credential. Report it as not_configured-for-probe so the cron neither
    // pages critical nor burns a doomed 401 round-trip — the LLM key-rotation
    // layer owns Anthropic health at call time.
    if (key.startsWith("sk-ant-PAUSED-")) {
      return { status: "not_configured", provider: "ANTHROPIC" };
    }
    // A live Anthropic key's health is verified by the rotation layer on real
    // traffic; we deliberately do NOT burn a paid model call here.
    return { status: "healthy", provider: "ANTHROPIC" };
  }
}

/** Scriptable in-memory probes for tests — no network. */
export class TestCredentialProbes implements CredentialProbes {
  constructor(
    private readonly outcomes: Partial<Record<ProbeProvider, ProbeOutcome>> = {},
  ) {}
  private get(p: ProbeProvider): ProbeOutcome {
    return this.outcomes[p] ?? { status: "not_configured", provider: p };
  }
  async probeStripe() {
    return this.get("STRIPE");
  }
  async probeResend() {
    return this.get("RESEND");
  }
  async probeAnthropic() {
    return this.get("ANTHROPIC");
  }
}
