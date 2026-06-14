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
  // Competitive-signal feed (lib/competitive-signals — Wave-8, audit theme #18).
  // `fixture` (default) runs the feed off the deterministic seed corpus with NO
  // network — correct for dev / preview / tests. `web` selects the live
  // web-research adapter (Bright Data MCP search port). The live adapter still
  // falls back to fixtures + names the gap until the MCP dispatch is wired, so
  // setting `web` without a dispatch is safe (never fabricates live claims).
  competitiveSignalProvider: () =>
    oneOf("COMPETITIVE_SIGNAL_PROVIDER", ["fixture", "web"] as const, "fixture"),
  // Optional internal fleet workspace the competitive-signal cron runs the
  // fire-gate against (vacation/PTO/schedule-window). When unset the cron
  // fails OPEN — the feed is internal GTM work, not customer-workspace work,
  // so there is no customer to pause by default.
  competitiveSignalFleetWorkspaceId: () =>
    optional("COMPETITIVE_SIGNAL_FLEET_WORKSPACE_ID"),

  // App
  appPublicOrigin: () => optional("APP_PUBLIC_ORIGIN") ?? "http://localhost:3000",
  sessionPassword: () => required("SESSION_PASSWORD"),
  sessionCookieName: () => optional("SESSION_COOKIE_NAME") ?? "agentplain_session",

  // WebAuthn / passkeys (feat/passkey-auth). The Relying Party ID is the
  // registrable domain the browser binds the credential to — NO scheme, NO
  // port (e.g. "agentplain.com" or "localhost"). When RP_ID is unset we derive
  // it from APP_PUBLIC_ORIGIN's hostname, which is correct for localhost dev.
  // In production, set RP_ID to the registrable apex (e.g. "agentplain.com")
  // so a single credential works across every subdomain the product is served
  // on (apex + www + app) — the browser only accepts an rpID equal to or a
  // registrable-domain suffix of the current host, so a subdomain-scoped rpID
  // breaks sign-in on sibling hosts. RP_NAME is the user-visible name shown
  // in the OS passkey prompt.
  webauthnRpId: () => optional("RP_ID"),
  webauthnRpName: () => optional("RP_NAME") ?? "agentplain",
  // WebAuthn expected-origins list — every host the product is served on.
  // Comma-separated full origins (scheme + host, no trailing slash):
  //   WEBAUTHN_ALLOWED_ORIGINS=https://agentplain.com,https://www.agentplain.com,https://app.agentplain.com
  // The server passes this array to verify*Response so an assertion from any
  // listed origin verifies. When unset we fall back to [APP_PUBLIC_ORIGIN]
  // — correct for single-host dev/preview, NOT correct for prod where the
  // marketing apex, www redirect, and app subdomain all serve sign-in.
  webauthnAllowedOrigins: (): string[] => {
    const raw = optional("WEBAUTHN_ALLOWED_ORIGINS");
    if (!raw) return [];
    return raw
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean);
  },

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
    optional("RESEND_FROM_EMAIL") ?? "agentplain <plaino@agentplain.com>",
  // CAN-SPAM physical postal address — REQUIRED by law in the footer of any
  // commercial/relationship bulk email (the weekly customer report). Set
  // COMPANY_POSTAL_ADDRESS to agentplain's real registered mailing address
  // before the weekly report cron is enabled in production. The placeholder
  // default keeps dev/preview rendering without passing off a fake address as
  // real — it is visibly a placeholder. CONNER ACTION: set this env var.
  companyPostalAddress: () =>
    optional("COMPANY_POSTAL_ADDRESS") ??
    "agentplain — set COMPANY_POSTAL_ADDRESS to your registered mailing address",

  // Stripe — Prices resolved by lookup_key (see lib/pricing/tiers.ts +
  // scripts/stripe/setup-products.ts). No per-tier Price-id env vars
  // (feedback_no_quick_fixes — lookup keys live on the Price inside
  // Stripe and survive Price archival; 15 hardcoded env vars are
  // brittle vendor lock).
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  // ── Master billing switch ──────────────────────────────────────────
  // THE one gate that turns the whole Stripe path on. Default FALSE so a
  // fresh deploy (and prod, pre-launch) makes ZERO Stripe calls: signup
  // completes, the workspace lands in the "trial, no card" state, and
  // nothing is ever charged. Flip `STRIPE_BILLING_ENABLED=true` (with the
  // STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET keys populated) to activate
  // billing the moment the four go-live decisions land. Every billing
  // side-effect (signup provisioning, dunning sweep, checkout) reads this
  // first — see app/(product)/app/actions.ts + lib/billing/dunning.ts.
  stripeBillingEnabled: (): boolean =>
    (optional("STRIPE_BILLING_ENABLED") ?? "false").toLowerCase() === "true",
  // Trial length in days. Default 14 (block-F trial-first mandate). Env-
  // configurable so Conner can move it without a deploy. Clamped to a
  // sane [0, 365] so a fat-fingered value can't create a decade-long
  // free trial. Consumed by lib/billing/provisioning.ts +
  // lib/billing/checkout.ts and surfaced in the billing-page copy.
  stripeTrialPeriodDays: (): number => {
    const raw = optional("STRIPE_TRIAL_PERIOD_DAYS");
    if (!raw) return 14;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 14;
    return Math.min(n, 365);
  },
  // Card-at-signup override. The block-F default is trial-first / NO card
  // at signup (frictionless trial start; capture the card before day-14
  // trial end). Setting `STRIPE_CHECKOUT_ENABLED=true` opts into the
  // wave-2 variant instead: signup routes through a Stripe Checkout
  // session that collects the card up front. Default FALSE → trial-first.
  // Only consulted when `stripeBillingEnabled()` is true.
  stripeCheckoutEnabled: (): boolean =>
    (optional("STRIPE_CHECKOUT_ENABLED") ?? "false").toLowerCase() === "true",
  // Stripe Billing Meter for token-usage emission. Two things must line
  // up before the cron actually POSTs anything:
  //   1. STRIPE_USAGE_METER_ENABLED=true (master switch).
  //   2. STRIPE_USAGE_METER_EVENT_NAME set to the `event_name` of a
  //      Meter you've created in the Stripe Dashboard. The Meter must
  //      be configured with:
  //        * customer_mapping.event_payload_key = "stripe_customer_id"
  //        * value_settings.event_payload_key  = "value"
  //        * default_aggregation.formula       = "sum"
  //      …and the Meter must be linked to a metered Price on each
  //      workspace's Subscription (Stripe Dashboard → Pricing →
  //      Add price → Recurring → Per package + meter).
  // Both vars are OPTIONAL so dev/preview don't fail at import. The
  // daily cron logs + skips when either is missing, and the customer
  // billing UI shows "tracked but not yet metered" — never fabricates.
  stripeUsageMeterEnabled: (): boolean =>
    optional("STRIPE_USAGE_METER_ENABLED") === "true",
  stripeUsageMeterEventName: () =>
    optional("STRIPE_USAGE_METER_EVENT_NAME"),

  // Inngest — trial-expiration cron + future skill scheduling. Local dev
  // mode auto-detects the dev server and signing is a no-op; production
  // needs both keys set.
  inngestEventKey: () => optional("INNGEST_EVENT_KEY"),
  inngestSigningKey: () => optional("INNGEST_SIGNING_KEY"),

  // Notion
  notionApiKey: () => required("NOTION_API_KEY"),
  // Briefings are an optional, additive feature — not part of the core
  // value loop. The non-throwing accessor lets the briefings factory fall
  // back to the empty/test provider when no key is configured, so a missing
  // NOTION_API_KEY degrades the briefings card to "no briefings yet" instead
  // of throwing and taking down the entire workspace overview. Mirrors the
  // OPENAI_API_KEY embedder fallback (see knowledgeEmbeddingProvider above).
  notionApiKeyOptional: () => optional("NOTION_API_KEY"),
  // Notion 2025-09 API: this is a data source id, not a database id.
  notionBriefingsDataSourceId: () =>
    optional("NOTION_BRIEFINGS_DATA_SOURCE_ID") ??
    optional("NOTION_BRIEFINGS_DB_ID"),

  // pfd-4 — leak-path auto-refund for unsupported-vertical workspaces.
  //
  // UNSUPPORTED_VERTICAL_AUTO_REFUND gates whether the daily cron actually
  // executes Stripe refunds. DEFAULT OFF — Stripe refunds are real money,
  // and the $500 cap + once-per-lifetime policy is PROPOSED, not ratified.
  // When OFF, the cron still runs in DETECT + PAGE-ONLY mode: it finds the
  // leaking workspaces and pages a human (so the surface still meets the
  // bar by self-routing), but moves no money. Flip to `on` only after
  // Conner ratifies the policy.
  unsupportedVerticalAutoRefundEnabled: (): boolean =>
    (optional("UNSUPPORTED_VERTICAL_AUTO_REFUND") ?? "off").toLowerCase() === "on",
  // Per-workspace refund cap in USD. Above this, the cron pages a human
  // instead of auto-refunding. Default $500.
  unsupportedVerticalRefundCapUsd: (): number => {
    const raw = optional("UNSUPPORTED_VERTICAL_REFUND_CAP_USD");
    if (!raw) return 500;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 500;
    return n;
  },

  // Operator allowlist (comma-separated emails)
  operatorEmailAllowlist: (): string[] => {
    const v = optional("OPERATOR_EMAIL_ALLOWLIST") ?? "";
    return v
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },

  // ── Self-healing credentials: the designated trusted human ──────────────
  // (lib/ops/page-human.ts). The single inbox every "page a human" call
  // routes to when the fleet detects a problem it cannot self-heal. This
  // is the "if Conner died tomorrow" address — set it to a monitored inbox
  // (or a small distribution list) that ISN'T Conner's personal account so
  // the alert survives him. When unset, pageHuman falls back to the first
  // OPERATOR_EMAIL_ALLOWLIST entry (Conner today) AND says in the email body
  // that no designated fallback human is configured — a loud nudge, never a
  // silent drop. Accepts a comma-separated list; all recipients are paged.
  fleetTrustedHumanEmails: (): string[] => {
    const v = optional("FLEET_TRUSTED_HUMAN_EMAIL") ?? "";
    return v
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  },
  // ── Anthropic key rotation (lib/llm/key-rotation-provider.ts) ───────────
  // The secondary Anthropic API key the LLM stack fails over to when the
  // primary returns 401/403/429. Sticky: once the stack is serving on the
  // secondary it stays there until the process restarts or the primary
  // verifies healthy again. When unset and the primary fails, the stack
  // degrades exactly like the paused-sentinel path AND pages a human.
  anthropicApiKeySecondary: () => optional("ANTHROPIC_API_KEY_SECONDARY"),

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

  // ── DocuSign (eSignature) OAuth — authorization-code grant ──────────────
  // Setup steps live in docs/integrations-setup-docusign-qbo-drive-slack.md.
  // The "client id" is DocuSign's Integration Key; the secret is a generated
  // Secret Key on that integration. `DOCUSIGN_OAUTH_BASE_URI` selects the
  // auth server: https://account-d.docusign.com (demo/sandbox, the default)
  // or https://account.docusign.com (production). The per-account REST base
  // URI is NOT an env var — it's discovered at connect time via /oauth/userinfo
  // and stored on the credential's accountId payload. Per
  // feedback_no_prod_secrets_in_dev: dev .env.local points at the demo tier.
  docusignOAuthClientId: () => optional("DOCUSIGN_OAUTH_CLIENT_ID"),
  docusignOAuthClientSecret: () => optional("DOCUSIGN_OAUTH_CLIENT_SECRET"),
  docusignOAuthBaseUri: () =>
    optional("DOCUSIGN_OAUTH_BASE_URI") ?? "https://account-d.docusign.com",
  // Shared secret on the DocuSign Connect webhook (HMAC key configured in the
  // DocuSign admin Connect settings). Every inbound Connect POST is verified
  // against this before we write a WebhookEvent row.
  docusignConnectHmacKey: () => optional("DOCUSIGN_CONNECT_HMAC_KEY"),

  // ── QuickBooks Online (Intuit) OAuth — authorization-code grant ─────────
  // The "client id"/secret are the Intuit app's keys. `QUICKBOOKS_ENVIRONMENT`
  // selects the API base: `sandbox` (sandbox-quickbooks.api.intuit.com, the
  // default) vs `production` (quickbooks.api.intuit.com). The company file is
  // identified by a realmId returned on the OAuth callback, NOT an env var —
  // it's persisted on the credential. Intuit rotates refresh tokens on every
  // refresh; the auth resolver always persists the returned refresh token.
  quickbooksOAuthClientId: () => optional("QUICKBOOKS_OAUTH_CLIENT_ID"),
  quickbooksOAuthClientSecret: () => optional("QUICKBOOKS_OAUTH_CLIENT_SECRET"),
  quickbooksEnvironment: () =>
    oneOf("QUICKBOOKS_ENVIRONMENT", ["sandbox", "production"] as const, "sandbox"),

  // ── Slack OAuth (v2) ────────────────────────────────────────────────────
  // We request USER-token scopes (user_scope) so search works (Slack's search
  // API is user-token-only) and any post acts as the customer. Slack user
  // tokens do not expire unless token rotation is enabled on the app, so the
  // credential is stored with a far-future expiry and no refresh token.
  slackOAuthClientId: () => optional("SLACK_OAUTH_CLIENT_ID"),
  slackOAuthClientSecret: () => optional("SLACK_OAUTH_CLIENT_SECRET"),

  // ── HubSpot OAuth — authorization-code grant ────────────────────────────
  // Wave 7 universal CRM. HubSpot uses long-lived refresh tokens (NOT
  // rotated on refresh). The hub id (portal id) is captured from
  // /oauth/v1/access-tokens/{token} at connect time and persisted on
  // `IntegrationCredential.accountId` + `providerMetadata.hubId`.
  hubspotOAuthClientId: () => optional("HUBSPOT_OAUTH_CLIENT_ID"),
  hubspotOAuthClientSecret: () => optional("HUBSPOT_OAUTH_CLIENT_SECRET"),

  // ── Salesforce OAuth — authorization-code grant ─────────────────────────
  // Wave 7 universal CRM. Salesforce returns an `instance_url` on the
  // token response (e.g. https://yourorg.my.salesforce.com); we persist
  // it on `providerMetadata.instanceUrl` so the MCP server hits the
  // right org host. Refresh tokens are long-lived.
  // Per the honest-concession bar: customers using their own Connected
  // App for production sharing/distribution need partner-program
  // enrollment; sandbox + customer-installed dev apps work without it.
  salesforceOAuthClientId: () => optional("SALESFORCE_OAUTH_CLIENT_ID"),
  salesforceOAuthClientSecret: () => optional("SALESFORCE_OAUTH_CLIENT_SECRET"),
  /** Login host. Defaults to production login.salesforce.com; tests +
   *  sandbox use test.salesforce.com. */
  salesforceLoginHost: () =>
    optional("SALESFORCE_LOGIN_HOST") ?? "https://login.salesforce.com",

  // ── Notion OAuth ────────────────────────────────────────────────────────
  // Wave 7 universal knowledge surface. Notion uses public-OAuth where
  // the customer authorizes a workspace; access token is workspace-scoped
  // and DOES NOT EXPIRE (no refresh path), so we store with a sentinel
  // far-future expiresAt and null refresh token.
  notionOAuthClientId: () => optional("NOTION_OAUTH_CLIENT_ID"),
  notionOAuthClientSecret: () => optional("NOTION_OAUTH_CLIENT_SECRET"),

  // ── Wave-1b vertical adapter OAuth — EZLynx (insurance AMS) + Encompass
  // (ICE Mortgage LOS) ────────────────────────────────────────────────────
  // Both are OAuth2 vendors whose API access is partner-gated (the agency /
  // lender enrolls in the vendor's developer program to obtain a client
  // id + secret). The per-workspace refresh token is stored on the
  // credential; these are the app-level client credentials used to refresh.
  // Live calls only fire when EZLYNX_ADAPTER_LIVE / ENCOMPASS_ADAPTER_LIVE is
  // `on` AND a connected credential exists — fixtures by default.
  ezlynxOAuthClientId: () => optional("EZLYNX_OAUTH_CLIENT_ID"),
  ezlynxOAuthClientSecret: () => optional("EZLYNX_OAUTH_CLIENT_SECRET"),
  /** EZLynx OAuth token host. Defaults to the documented production host. */
  ezlynxTokenHost: () =>
    optional("EZLYNX_TOKEN_HOST") ?? "https://api.ezlynx.com",
  encompassOAuthClientId: () => optional("ENCOMPASS_OAUTH_CLIENT_ID"),
  encompassOAuthClientSecret: () => optional("ENCOMPASS_OAUTH_CLIENT_SECRET"),
  /** Encompass (ICE) OAuth token host. Defaults to the documented host. */
  encompassTokenHost: () =>
    optional("ENCOMPASS_TOKEN_HOST") ?? "https://api.elliemae.com",

  // Custom-inquiry destination. Submissions from `/custom`'s contact form
  // are emailed to this address. Defaults to the public hello@ inbox so
  // dev/preview submissions don't silently disappear when the var is unset.
  customInquiryTo: () =>
    optional("CUSTOM_INQUIRY_TO") ?? "hello@agentplain.com",

  // Customer-support destination (feat/support-routing). In-app support
  // messages are emailed here so a customer's first question lands in a
  // shared inbox, not a personal Gmail. Defaults to the public hello@ inbox
  // when unset so dev/preview submissions still arrive somewhere.
  supportEmail: () => optional("SUPPORT_EMAIL") ?? "hello@agentplain.com",

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

  // Compliance corpus go-live gate (lib/agents/sentinel). A vertical's
  // counsel-reviewed rules only fire live when its slug appears in this
  // comma-separated allow-list — e.g.
  // COMPLIANCE_CORPUS_COUNSEL_REVIEWED="mortgage,insurance". This is a
  // production kill-switch on TOP of the per-rule `unverified` gate: even
  // after counsel flips a rule to `reviewed` in code, the vertical stays
  // advisory-only until ops sets the flag. real-estate is baseline-live in
  // sentinel and does not depend on this var. Slugs are lowercased; unknown
  // slugs are ignored. See lib/agents/sentinel/index.ts.
  complianceCounselReviewedVerticals: (): string[] =>
    (optional("COMPLIANCE_CORPUS_COUNSEL_REVIEWED") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),

  // Native mobile app (feat/mobile-app-v2-polish).
  //
  // Expo push: the Expo push service accepts unauthenticated sends, but an
  // EXPO_ACCESS_TOKEN (enhanced-security mode in the Expo dashboard) is the
  // recommended posture — when set we send it as a bearer. Optional so the
  // send path works in dev/preview without it.
  expoAccessToken: () => optional("EXPO_ACCESS_TOKEN"),
  // Override the Expo push endpoint (tests / self-hosted). Defaults to Expo's
  // hosted service.
  expoPushUrl: () =>
    optional("EXPO_PUSH_URL") ?? "https://exp.host/--/api/v2/push/send",

  // Sign in with Apple: the audience the identity token must be issued for.
  // For a native iOS app this is the app's bundle id. Defaults to the
  // committed bundle id in apps/mobile/app.json; override only if the bundle
  // id changes or a services-id (web) flow is added later. A comma-separated
  // list is accepted so the native app + a future web service id can both
  // validate.
  appleAllowedAudiences: (): string[] =>
    (optional("APPLE_BUNDLE_ID") ?? "com.agentplain.app")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),

  // Web-search grounding (wave-5, theme #11 / ratif #8). The research
  // skill grounds briefs on live web sources behind IWebSearchPort.
  // `provider` selects the adapter: `tavily` / `brightdata` reach a live
  // provider when a key is set; `fixture` (the default) serves the
  // committed corpus so dev + CI run with no live creds. We do NOT throw
  // when a live provider is selected without a key — the factory falls
  // back to the fixture adapter and the brief names the gap honestly,
  // mirroring the LLM provider's heuristic-fallback posture.
  webSearchProvider: () =>
    oneOf(
      "WEB_SEARCH_PROVIDER",
      ["fixture", "tavily", "brightdata"] as const,
      "fixture",
    ),
  tavilyApiKey: () => optional("TAVILY_API_KEY"),
  brightDataApiKey: () => optional("BRIGHTDATA_API_KEY"),
};
