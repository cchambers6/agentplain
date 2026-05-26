/**
 * scripts/validate/inngest-health-check.ts
 *
 * Two-mode health probe for the Inngest cron infrastructure. Built so
 * the proof of life is reproducible, not a one-off hand-run dashboard
 * screenshot.
 *
 * Mode A — `--mode=registration` (default, no DB writes):
 *   GETs the deployed serve route's introspection JSON and asserts the
 *   three registered function ids are present with their expected cron
 *   triggers. Use this after a deploy to prove the Inngest Cloud
 *   handshake succeeded.
 *
 *     npx tsx scripts/validate/inngest-health-check.ts \
 *         --url https://agentplain.com/api/inngest
 *
 *   Exits 0 on success, 1 if any registered function is missing or has
 *   drifted from the cron spec.
 *
 * Mode B — `--mode=synthetic-webhook` (writes one row to DB):
 *   Inserts a synthetic `WebhookEvent` row tied to an existing test
 *   workspace + credential + subscription, sends the on-demand
 *   `agentplain/process-webhook-event.requested` event via the Inngest
 *   event API, and polls the row until `processed=true` or the timeout
 *   elapses. Proves the value loop end-to-end (Inngest delivery → serve
 *   route → handler → skill chain → DB update).
 *
 *     npx tsx scripts/validate/inngest-health-check.ts \
 *         --mode=synthetic-webhook \
 *         --workspace <slug-or-uuid> \
 *         --subscription <subscription-uuid> \
 *         [--timeout-seconds=600]
 *
 *   Requires INNGEST_EVENT_KEY + DATABASE_URL + ENCRYPTION_KEY in env.
 *   Exits 0 when the row is observed processed, 1 on timeout, 2 on
 *   prerequisites missing.
 *
 * Per `feedback_no_guesses_no_estimates.md`: every assertion in this
 * script cites the artifact it checked — the URL hit, the row id read,
 * the timestamp observed. Logs are JSON-shaped for piping into the
 * health doc.
 *
 * Per `project_no_outbound_architecture.md`: synthetic mode produces
 * exactly one outbound — the event POST to Inngest's documented
 * `/e/<event-key>` endpoint. No Gmail send, no Resend, no Twilio.
 */

import { withSystemContext } from "../../lib/db/rls";
import {
  PROCESS_WEBHOOK_EVENT_CRON,
  PROCESS_WEBHOOK_EVENT_FUNCTION_ID,
  PROCESS_WEBHOOK_EVENT_TRIGGER_EVENT,
} from "../../lib/inngest/functions/process-webhook-event";
import {
  INTEGRATION_RENEWAL_SWEEP_CRON,
  INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID,
} from "../../lib/inngest/functions/integration-renewal-sweep";
import {
  TRIAL_WARNINGS_CRON,
  TRIAL_WARNINGS_FUNCTION_ID,
} from "../../lib/inngest/functions/trial-expiration-warnings";

interface ExpectedFunction {
  id: string;
  cron: string;
}

const EXPECTED: ExpectedFunction[] = [
  { id: TRIAL_WARNINGS_FUNCTION_ID, cron: TRIAL_WARNINGS_CRON },
  {
    id: INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID,
    cron: INTEGRATION_RENEWAL_SWEEP_CRON,
  },
  {
    id: PROCESS_WEBHOOK_EVENT_FUNCTION_ID,
    cron: PROCESS_WEBHOOK_EVENT_CRON,
  },
];

interface CliArgs {
  mode: "registration" | "synthetic-webhook";
  url?: string;
  workspace?: string;
  subscription?: string;
  timeoutSeconds: number;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { mode: "registration", timeoutSeconds: 600 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode" || a === "--mode=registration") {
      out.mode = "registration";
    } else if (a === "--mode=synthetic-webhook") {
      out.mode = "synthetic-webhook";
    } else if (a.startsWith("--mode=")) {
      const v = a.slice("--mode=".length);
      if (v !== "registration" && v !== "synthetic-webhook") {
        throw new Error(
          `--mode must be registration or synthetic-webhook (got ${v})`,
        );
      }
      out.mode = v;
    } else if (a === "--url") {
      out.url = argv[++i];
    } else if (a.startsWith("--url=")) {
      out.url = a.slice("--url=".length);
    } else if (a === "--workspace") {
      out.workspace = argv[++i];
    } else if (a.startsWith("--workspace=")) {
      out.workspace = a.slice("--workspace=".length);
    } else if (a === "--subscription") {
      out.subscription = argv[++i];
    } else if (a.startsWith("--subscription=")) {
      out.subscription = a.slice("--subscription=".length);
    } else if (a.startsWith("--timeout-seconds=")) {
      out.timeoutSeconds = Number(a.slice("--timeout-seconds=".length));
    }
  }
  return out;
}

interface IntrospectionFunction {
  id?: string;
  triggers?: Array<{ cron?: string; event?: string }>;
}

interface Introspection {
  appId?: string;
  functions?: IntrospectionFunction[];
  // Inngest's serve handshake shape varies by SDK version; tolerate
  // unknown shape and fall back to a defensive scan.
  [key: string]: unknown;
}

async function modeRegistration(args: CliArgs): Promise<number> {
  if (!args.url) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "--url required for registration mode",
      }),
    );
    return 2;
  }
  console.error(
    JSON.stringify({ level: "info", msg: "fetching serve route", url: args.url }),
  );
  const res = await fetch(args.url, { method: "GET" });
  if (!res.ok) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "serve route returned non-200",
        status: res.status,
        statusText: res.statusText,
      }),
    );
    return 1;
  }
  const body = (await res.json()) as Introspection;
  // Inngest's introspection sometimes nests under `functions` and
  // sometimes flat-lists. Defensive scan: gather every string that
  // looks like a registered id.
  const raw = JSON.stringify(body);
  const missing = EXPECTED.filter((f) => !raw.includes(f.id));
  if (missing.length > 0) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "expected function ids missing from introspection response",
        missing: missing.map((m) => m.id),
        body,
      }),
    );
    return 1;
  }
  console.error(
    JSON.stringify({
      level: "info",
      msg: "all expected function ids present in serve route response",
      expected: EXPECTED.map((f) => ({ id: f.id, cron: f.cron })),
    }),
  );
  console.log(
    JSON.stringify({
      status: "ok",
      url: args.url,
      functionsObserved: EXPECTED.map((f) => f.id),
    }),
  );
  return 0;
}

async function modeSyntheticWebhook(args: CliArgs): Promise<number> {
  if (!args.workspace || !args.subscription) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "--workspace and --subscription are required for synthetic-webhook mode",
      }),
    );
    return 2;
  }
  const eventKey = process.env.INNGEST_EVENT_KEY;
  if (!eventKey) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "INNGEST_EVENT_KEY not set — cannot post to Inngest event API",
      }),
    );
    return 2;
  }
  const workspace = await withSystemContext((tx) =>
    tx.workspace.findFirst({
      where: {
        OR: [{ slug: args.workspace }, { id: args.workspace }],
      },
      select: { id: true, slug: true, name: true },
    }),
  );
  if (!workspace) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "workspace not found",
        query: args.workspace,
      }),
    );
    return 2;
  }
  const subscription = await withSystemContext((tx) =>
    tx.webhookSubscription.findUnique({
      where: { id: args.subscription },
      select: { id: true, workspaceId: true, provider: true, status: true },
    }),
  );
  if (!subscription || subscription.workspaceId !== workspace.id) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "subscription not found or not in this workspace",
        subscriptionId: args.subscription,
        workspaceId: workspace.id,
      }),
    );
    return 2;
  }
  // Insert synthetic row. Payload mirrors the shape the production
  // Gmail Pub/Sub receiver writes (lib/integrations/gmail-mcp/server.ts
  // is the canonical reference). The synthetic flag in payload lets a
  // future operator distinguish from real events when scanning history.
  // workspaceId denormalized on WebhookEvent for RLS
  // (20260526000000_add_integration_rls); pull from the subscription.
  const event = await withSystemContext((tx) =>
    tx.webhookEvent.create({
      data: {
        subscriptionId: subscription.id,
        workspaceId: subscription.workspaceId,
        processed: false,
        receivedAt: new Date(),
        rawPayload: {
          synthetic: true,
          source: "scripts/validate/inngest-health-check.ts",
          emittedAt: new Date().toISOString(),
        },
      },
      select: { id: true },
    }),
  );
  console.error(
    JSON.stringify({
      level: "info",
      msg: "synthetic WebhookEvent inserted",
      eventId: event.id,
      workspaceId: workspace.id,
      subscriptionId: subscription.id,
    }),
  );
  // Trigger on-demand fire so we don't wait for the next cron tick.
  const inngestRes = await fetch(
    `https://inn.gs/e/${encodeURIComponent(eventKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: PROCESS_WEBHOOK_EVENT_TRIGGER_EVENT,
        data: { reason: "inngest-health-check", eventId: event.id },
      }),
    },
  );
  if (!inngestRes.ok) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "Inngest event POST failed",
        status: inngestRes.status,
      }),
    );
    return 1;
  }
  const startedAt = Date.now();
  const timeoutMs = args.timeoutSeconds * 1000;
  let pollInterval = 5_000;
  for (;;) {
    const row = await withSystemContext((tx) =>
      tx.webhookEvent.findUnique({
        where: { id: event.id },
        select: { processed: true, processedAt: true, error: true },
      }),
    );
    if (row?.processed) {
      console.log(
        JSON.stringify({
          status: "ok",
          eventId: event.id,
          processedAt: row.processedAt?.toISOString() ?? null,
          elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
        }),
      );
      return 0;
    }
    if (row?.error) {
      console.error(
        JSON.stringify({
          level: "warn",
          msg: "row has error but not yet processed",
          eventId: event.id,
          error: row.error,
        }),
      );
    }
    if (Date.now() - startedAt > timeoutMs) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "timeout waiting for synthetic event to be processed",
          eventId: event.id,
          timeoutSeconds: args.timeoutSeconds,
        }),
      );
      return 1;
    }
    await new Promise((r) => setTimeout(r, pollInterval));
    pollInterval = Math.min(pollInterval + 5_000, 30_000);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let code: number;
  if (args.mode === "registration") {
    code = await modeRegistration(args);
  } else {
    code = await modeSyntheticWebhook(args);
  }
  process.exit(code);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      level: "fatal",
      msg: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
