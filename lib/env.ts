// Environment variable access. Centralized so adapter selection and tier
// discipline (no prod secrets in dev) are visible in one place.
//
// Per feedback_no_prod_secrets_in_dev: callers must NOT default a missing
// production-tier secret to a sentinel — they should fail loudly.

export type AdapterMode<T extends string> = T;

const optional = (key: string): string | undefined => {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
};

const required = (key: string): string => {
  const v = optional(key);
  if (!v) throw new Error(`Required environment variable ${key} is not set`);
  return v;
};

const oneOf = <T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T => {
  const v = optional(key);
  if (!v) return fallback;
  if (!allowed.includes(v as T)) {
    throw new Error(
      `Environment variable ${key}="${v}" — expected one of ${allowed.join(", ")}`,
    );
  }
  return v as T;
};

export const env = {
  // Adapter selection
  authProvider: () => oneOf("AUTH_PROVIDER", ["resend", "test"] as const, "resend"),
  billingProvider: () => oneOf("BILLING_PROVIDER", ["stripe", "test"] as const, "stripe"),
  briefingsProvider: () =>
    oneOf("BRIEFINGS_PROVIDER", ["notion", "test"] as const, "notion"),
  // Knowledge substrate (project_knowledge_substrate.md). `pgvector` is the
  // prod store; `test` is the in-memory store used by unit tests + previews
  // without a DB. Embedding provider defaults to `openai` when
  // `OPENAI_API_KEY` is set, otherwise falls back to the deterministic test
  // embedder — mirrors the LLM provider's heuristic-fallback pattern.
  knowledgeStore: () =>
    oneOf("KNOWLEDGE_STORE", ["pgvector", "test"] as const, "pgvector"),
  knowledgeEmbeddingProvider: () =>
    oneOf("KNOWLEDGE_EMBEDDING_PROVIDER", ["openai", "test"] as const, "openai"),
  knowledgeEmbeddingModel: () =>
    optional("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small",

  // App
  appPublicOrigin: () => optional("APP_PUBLIC_ORIGIN") ?? "http://localhost:3000",
  sessionPassword: () => required("SESSION_PASSWORD"),
  sessionCookieName: () => optional("SESSION_COOKIE_NAME") ?? "agentplain_session",

  // DB
  databaseUrl: () => required("DATABASE_URL"),
  databasePoolUrl: () => optional("DATABASE_POOL_URL") ?? required("DATABASE_URL"),
  // Neon direct (non-pooled) connection string. Used by `prisma migrate deploy`
  // because pooled connections can't run DDL. Production-only required: Preview
  // may set its own preview-tier Neon branch direct URL if a preview-side
  // migration path is desired; otherwise leave unset there. Per
  // feedback_no_prod_secrets_in_dev — never default to DATABASE_URL.
  databaseUrlDirect: () => required("DATABASE_URL_DIRECT"),

  // Resend
  resendApiKey: () => required("RESEND_API_KEY"),
  resendFromEmail: () =>
    optional("RESEND_FROM_EMAIL") ?? "agentplain <noreply@agentplain.com>",

  // Stripe — Prices resolved by lookup_key (see lib/pricing/tiers.ts +
  // scripts/stripe/setup-products.ts). No per-tier Price-id env vars.
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),

  // Inngest — trial-expiration cron + future skill scheduling. Local dev
  // mode auto-detects the dev server and signing is a no-op; production
  // needs both keys set.
  inngestEventKey: () => optional("INNGEST_EVENT_KEY"),
  inngestSigningKey: () => optional("INNGEST_SIGNING_KEY"),

  // Notion
  notionApiKey: () => required("NOTION_API_KEY"),
  // Notion 2025-09 API: this is a data source id, not a database id.
  notionBriefingsDataSourceId: () =>
    optional("NOTION_BRIEFINGS_DATA_SOURCE_ID") ??
    optional("NOTION_BRIEFINGS_DB_ID"),

  // Operator allowlist (comma-separated emails)
  operatorEmailAllowlist: (): string[] => {
    const v = optional("OPERATOR_EMAIL_ALLOWLIST") ?? "";
    return v
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },

  // Google integration (PR-B Gmail OAuth + Pub/Sub).
  // Setup steps live in docs/operator-integrations-setup.md. Per
  // feedback_no_prod_secrets_in_dev: use a dev-tier Google Cloud Project
  // in .env.local; production values in Vercel Production only.
  googleOAuthClientId: () => optional("GOOGLE_OAUTH_CLIENT_ID"),
  googleOAuthClientSecret: () => optional("GOOGLE_OAUTH_CLIENT_SECRET"),
  googlePubsubTopic: () => optional("GOOGLE_PUBSUB_TOPIC"),
  gmailWebhookOidcAudience: () => optional("GMAIL_WEBHOOK_OIDC_AUDIENCE"),
  gmailWebhookServiceAccountEmail: () =>
    optional("GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL"),
  // Microsoft (M365 / Outlook) OAuth — companion to the Outlook MCP shipped
  // in feat/outlook-mcp-phase-b. The /common authority accepts both work/
  // school accounts and personal Microsoft accounts; tenant lockdown happens
  // at app-registration time (Azure portal), not in code. Per
  // feedback_no_prod_secrets_in_dev: dev .env.local uses a dev-tier app
  // registration; production values live in Vercel Production only.
  microsoftOAuthClientId: () => optional("MICROSOFT_OAUTH_CLIENT_ID"),
  microsoftOAuthClientSecret: () => optional("MICROSOFT_OAUTH_CLIENT_SECRET"),
  microsoftOAuthAuthority: () =>
    optional("MICROSOFT_OAUTH_AUTHORITY") ?? "https://login.microsoftonline.com/common",
  // Shared secret echoed back on every Microsoft Graph webhook notification.
  // Set to a 32-byte random hex string in Vercel Production. The Graph
  // subscription create call carries this as `clientState`; every inbound
  // notification's value[].clientState must match. Forging a notification
  // requires knowing this secret — keep it out of logs.
  microsoftWebhookClientState: () => optional("MICROSOFT_WEBHOOK_CLIENT_STATE"),
  encryptionKey: () => required("ENCRYPTION_KEY"),

  // Custom-inquiry destination. Submissions from `/custom`'s contact form
  // are emailed to this address. Defaults to the public hello@ inbox so
  // dev/preview submissions don't silently disappear when the var is unset.
  customInquiryTo: () =>
    optional("CUSTOM_INQUIRY_TO") ?? "hello@agentplain.com",

  // Knowledge substrate (project_knowledge_substrate.md).
  // OPENAI_API_KEY enables the OpenAI embedding provider; when absent the
  // factory falls back to the deterministic test embedder so the chain
  // stays runnable in environments without a paid key (mirrors LLM
  // provider behavior in lib/llm/index.ts). Per
  // feedback_no_prod_secrets_in_dev: dev should use a dev-tier key.
  openaiApiKey: () => optional("OPENAI_API_KEY"),

  // Observability (runtime error reporting). Sentry is the default
  // implementation; the noop provider runs when no DSN is configured so
  // dev / preview don't try to ship to a real project. Per
  // feedback_no_prod_secrets_in_dev: the DSN ships in Production Vercel
  // only initially. See docs/runtime-alerting-2026-05-18.md.
  observabilityProvider: (): "sentry" | "noop" => {
    const explicit = optional("OBSERVABILITY_PROVIDER");
    if (explicit) {
      return oneOf(
        "OBSERVABILITY_PROVIDER",
        ["sentry", "noop"] as const,
        "noop",
      );
    }
    return optional("SENTRY_DSN") ? "sentry" : "noop";
  },
  sentryDsn: () => optional("SENTRY_DSN"),
  // Public DSN exposed to the browser bundle. Sentry DSNs are public-by-
  // design (ingest-only), so this can equal SENTRY_DSN — kept separate so
  // we can disable client-side reporting without taking down server-side.
  sentryClientDsn: () => optional("NEXT_PUBLIC_SENTRY_DSN"),
  sentryEnvironment: () =>
    optional("SENTRY_ENVIRONMENT") ??
    optional("VERCEL_ENV") ??
    process.env.NODE_ENV ??
    "development",
  // Release tag for Sentry's "first seen in / regression detection" logic.
  // Vercel injects VERCEL_GIT_COMMIT_SHA on every deploy.
  sentryRelease: () =>
    optional("SENTRY_RELEASE") ?? optional("VERCEL_GIT_COMMIT_SHA"),
};
