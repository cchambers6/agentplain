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

  // App
  appPublicOrigin: () => optional("APP_PUBLIC_ORIGIN") ?? "http://localhost:3000",
  sessionPassword: () => required("SESSION_PASSWORD"),
  sessionCookieName: () => optional("SESSION_COOKIE_NAME") ?? "agentplain_session",

  // DB
  databaseUrl: () => required("DATABASE_URL"),
  databasePoolUrl: () => optional("DATABASE_POOL_URL") ?? required("DATABASE_URL"),

  // Resend
  resendApiKey: () => required("RESEND_API_KEY"),
  resendFromEmail: () =>
    optional("RESEND_FROM_EMAIL") ?? "agentplain <noreply@agentplain.com>",

  // Stripe
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  stripePriceTier1: () => required("STRIPE_PRICE_TIER_1"),
  stripePriceTier2: () => required("STRIPE_PRICE_TIER_2"),
  stripePriceTier3: () => required("STRIPE_PRICE_TIER_3"),
  stripePriceTier1Annual: () => optional("STRIPE_PRICE_TIER_1_ANNUAL"),
  stripePriceTier2Annual: () => optional("STRIPE_PRICE_TIER_2_ANNUAL"),
  stripePriceTier3Annual: () => optional("STRIPE_PRICE_TIER_3_ANNUAL"),

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
};
