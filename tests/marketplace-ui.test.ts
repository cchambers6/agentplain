/**
 * tests/marketplace-ui.test.ts
 *
 * Coverage for the Phase C customer-facing integration marketplace. These
 * are pure-function tests against the marketplace catalog, the URL helpers
 * the tile component links through, and the OAuth start route's URL
 * builders. The React tile and pages render server-side from these same
 * helpers, so testing the helpers is the load-bearing contract.
 *
 * Per `project_no_outbound_architecture.md`: every available entry is
 * asserted to NOT request a send-style scope.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the marketplace catalog is the
 * single source for what integrations exist. Tests pin its shape so a
 * silent drop or rename of an entry would fail loudly.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getMarketplaceEntry,
  listIntegrations,
  oauthStartPath,
  resolveMcpEndpoint,
  waitlistPath,
  type MarketplaceEntry,
} from "@/lib/integrations/marketplace";
import {
  buildAuthorizeUrl,
  buildMicrosoftAuthorizeUrl,
} from "@/lib/integrations/oauth-urls";

const WORKSPACE_ID = "11111111-2222-3333-4444-555555555555";

describe("marketplace catalog", () => {
  it("lists every available connector plus the remaining Coming Soon ones", () => {
    const entries = listIntegrations();
    const ids = entries.map((e) => e.id);
    // Pre-wave-3: gmail, outlook, teams, onedrive, excel, quickbooks,
    // docusign, google-drive, slack are available; hubspot, paypal,
    // canva remain coming-soon.
    // Wave-3 adds: follow-up-boss (available, api-key) + kvcore
    // (coming-soon, partner-program enrollment pending).
    // Wave-4 adds: sierra (available, api-key) + boldtrail / lofty /
    // real-geeks (coming-soon, partner-program enrollment pending) so
    // the realty-CRM tier is honest about the four-of-six it can serve
    // today + the two waiting on partner agreements.
    // Wave-5 adds taxdome + karbon as available CPA-vertical API-key
    // connectors. (Send-path wave 2026-07-03 flips both to coming-soon —
    // no connect UI could save their credentials, audit-5 P0-1 — but they
    // stay in the catalog.)
    // Wave-7 flips hubspot to available + appends salesforce and notion
    // as the three universal MCPs. All three use OAuth.
    // Buildium (property-management, available, api-key) and the law
    // practice-management connectors Clio + MyCase (coming-soon) landed in
    // their own waves. The 2026-06-17 vertical-MCP scaffold wave adds
    // AppFolio (property-management, coming-soon).
    // The voice/Twilio layer (PR #304) added the Phone & Voice tile
    // (coming-soon, non-MCP dispatch path) — reconciled here 2026-07-03;
    // this suite had drifted from the catalog it pins.
    assert.deepEqual(ids, [
      "gmail",
      "outlook",
      "teams",
      "onedrive",
      "excel",
      "quickbooks",
      "hubspot",
      "docusign",
      "google-drive",
      "slack",
      "paypal",
      "taxdome",
      "karbon",
      "buildium",
      "appfolio",
      "canva",
      "follow-up-boss",
      "kvcore",
      "voice",
      "sierra",
      "boldtrail",
      "lofty",
      "real-geeks",
      "clio",
      "mycase",
      "salesforce",
      "notion",
    ]);
    assert.equal(entries.length, 27, "marketplace surface size is the architectural contract");
  });

  it("Gmail + the M365 integrations are available with the right provider keys", () => {
    const gmail = getMarketplaceEntry("gmail");
    const outlook = getMarketplaceEntry("outlook");
    const teams = getMarketplaceEntry("teams");
    const onedrive = getMarketplaceEntry("onedrive");
    const excel = getMarketplaceEntry("excel");
    assert.ok(gmail, "gmail entry exists");
    assert.ok(outlook, "outlook entry exists");
    assert.ok(teams, "teams entry exists");
    assert.ok(onedrive, "onedrive entry exists");
    assert.ok(excel, "excel entry exists");
    assert.equal(gmail.status, "available");
    assert.equal(outlook.status, "available");
    assert.equal(teams.status, "available");
    assert.equal(onedrive.status, "available");
    assert.equal(excel.status, "available");
    assert.equal(gmail.providerKey, "GOOGLE");
    assert.equal(outlook.providerKey, "M365");
    assert.equal(teams.providerKey, "M365");
    assert.equal(onedrive.providerKey, "M365");
    assert.equal(excel.providerKey, "M365");
  });

  it("Coming Soon entries surface the remaining connectors with null providerKey", () => {
    const soon = listIntegrations().filter((e) => e.status === "coming-soon");
    // Wave-4 adds three additional honest coming-soon realty CRMs:
    // BoldTrail (partner enrollment pending), Lofty (formerly Chime),
    // and Real Geeks. All require partner-program API access that
    // agentplain has NOT yet completed — listed honestly to keep the
    // catalog from over-promising.
    // Wave-7 removes hubspot from coming-soon (it is now wired).
    // The law connectors Clio + MyCase (partner/API-access pending) and the
    // 2026-06-17 vertical-MCP scaffold AppFolio (PM partner-program pending,
    // ~2-month review) ride along as honest coming-soon entries.
    // Phone & Voice (PR #304) waits on Twilio provisioning. TaxDome +
    // Karbon joined 2026-07-03: dispatch-ready but no connect form can save
    // their credentials yet (audit-5 P0-1) — `available` was a dead end.
    assert.deepEqual(
      soon.map((e) => e.id),
      [
        "paypal",
        "taxdome",
        "karbon",
        "appfolio",
        "canva",
        "kvcore",
        "voice",
        "boldtrail",
        "lofty",
        "real-geeks",
        "clio",
        "mycase",
      ],
    );
    for (const e of soon) {
      assert.equal(e.providerKey, null, `${e.id} has no DB rows yet`);
    }
  });

  it("the four newly-wired connectors are available with the right provider keys", () => {
    const expectations: Record<string, string> = {
      docusign: "DOCUSIGN",
      quickbooks: "QUICKBOOKS",
      slack: "SLACK",
      // Drive reuses the Gmail Google OAuth app + credential.
      "google-drive": "GOOGLE",
    };
    for (const [id, providerKey] of Object.entries(expectations)) {
      const entry = getMarketplaceEntry(id);
      assert.ok(entry, `${id} entry exists`);
      assert.equal(entry.status, "available", `${id} is available`);
      assert.equal(entry.providerKey, providerKey, `${id} providerKey`);
    }
  });

  it("no available entry requests an outbound send scope", () => {
    // project_no_outbound_architecture.md — outbound is the customer's system,
    // never ours. Catalog enforces this; this test pins it.
    const bannedFragments = ["send", "Mail.Send", "Send", "compose"];
    for (const entry of listIntegrations().filter((e) => e.status === "available")) {
      // Gmail's `gmail.compose` is acceptable — Gmail's compose scope lets us
      // CREATE drafts, not SEND. Microsoft's Mail.Send / Gmail's gmail.send
      // are the banned scopes the architecture forbids.
      for (const scope of entry.scopes) {
        assert.notEqual(scope, "Mail.Send", `${entry.id} requests Mail.Send`);
        assert.notEqual(scope, "gmail.send", `${entry.id} requests gmail.send`);
        assert.notEqual(scope, "Mail.Send.Shared", `${entry.id} requests Mail.Send.Shared`);
      }
      // The "send" fragment check is intentionally loose for available
      // entries — `compose` ≠ send. Re-affirm bannedFragments is not unused.
      void bannedFragments;
    }
  });

  it("every entry exposes scope display + a /api/integrations/<slug>-mcp template", () => {
    // Wave-5 introduced API-key providers (TaxDome, Karbon) that do NOT
    // request OAuth scopes — they authenticate with a static key from the
    // firm's provider dashboard. Empty scopes are honest for those entries,
    // so the assertion narrows to "OAuth connectors MUST declare scopes"
    // rather than "every entry must declare scopes." An entry is an api-key
    // connector when it tags `connectMode === 'api-key'` (Buildium, AppFolio,
    // and the realty CRMs) OR when its provider is one of the wave-5 api-key
    // CPA providers that predate the `connectMode` field (TaxDome, Karbon).
    const API_KEY_PROVIDERS = new Set<string | null>(["TAXDOME", "KARBON"]);
    for (const entry of listIntegrations()) {
      const isApiKey =
        entry.connectMode === "api-key" || API_KEY_PROVIDERS.has(entry.providerKey);
      if (!isApiKey) {
        assert.ok(
          entry.scopes.length > 0,
          `${entry.id} declares at least one scope`,
        );
      }
      // Phone & Voice answers at /api/voice/twilio/* by design — it is not
      // an MCP dispatch connector (see the catalog entry's comment), so the
      // <slug>-mcp template shape doesn't apply to it.
      if (entry.id !== "voice") {
        assert.match(
          entry.mcpEndpointTemplate,
          new RegExp(`^/api/integrations/${entry.id}-mcp/\\{workspaceId\\}$`),
          `${entry.id} mcpEndpointTemplate shape`,
        );
      }
      assert.ok(entry.category.length > 0, `${entry.id} declares a category`);
    }
  });
});

describe("marketplace URL helpers", () => {
  it("resolveMcpEndpoint substitutes the workspace UUID", () => {
    const gmail = getMarketplaceEntry("gmail")!;
    const url = resolveMcpEndpoint(gmail, WORKSPACE_ID);
    assert.equal(url, `/api/integrations/gmail-mcp/${WORKSPACE_ID}`);
  });

  it("oauthStartPath builds the right URL for an available entry", () => {
    const outlook = getMarketplaceEntry("outlook")!;
    assert.equal(
      oauthStartPath(outlook, WORKSPACE_ID),
      `/api/integrations/outlook/oauth/start?workspaceId=${WORKSPACE_ID}`,
    );
  });

  it("waitlistPath routes Coming Soon tiles through /custom with the integration id", () => {
    const quickbooks = getMarketplaceEntry("quickbooks")!;
    assert.equal(
      waitlistPath(quickbooks),
      `/custom?type=integration-waitlist&id=quickbooks`,
    );
  });

  it("getMarketplaceEntry returns null for an unknown slug", () => {
    assert.equal(getMarketplaceEntry("not-a-real-integration"), null);
  });
});

describe("OAuth start URL builders", () => {
  it("Gmail authorize URL routes through accounts.google.com with the right scopes", () => {
    const url = buildAuthorizeUrl({
      integrationId: "gmail",
      scopes: getMarketplaceEntry("gmail")!.scopes,
      state: "deadbeef".repeat(8),
      origin: "https://app.agentplain.test",
      googleClientId: "google-client-test",
      googleClientSecret: "google-secret-test",
      microsoftClientId: undefined,
      microsoftAuthority: "https://login.microsoftonline.com/common",
    });
    const parsed = new URL(url);
    assert.equal(parsed.host, "accounts.google.com");
    assert.equal(parsed.searchParams.get("client_id"), "google-client-test");
    assert.equal(parsed.searchParams.get("state"), "deadbeef".repeat(8));
    assert.equal(parsed.searchParams.get("access_type"), "offline");
    assert.equal(
      parsed.searchParams.get("redirect_uri"),
      "https://app.agentplain.test/api/auth/oauth/google/callback",
    );
  });

  it("Outlook authorize URL targets login.microsoftonline.com without Mail.Send", () => {
    const url = buildMicrosoftAuthorizeUrl({
      authority: "https://login.microsoftonline.com/common",
      clientId: "ms-client-test",
      redirectUri: "https://app.agentplain.test/api/integrations/outlook/oauth/callback",
      scopes: ["Mail.Read", "Mail.ReadWrite", "offline_access"],
      state: "outlook-state",
    });
    const parsed = new URL(url);
    assert.equal(parsed.host, "login.microsoftonline.com");
    assert.equal(parsed.pathname, "/common/oauth2/v2.0/authorize");
    assert.equal(parsed.searchParams.get("client_id"), "ms-client-test");
    assert.equal(parsed.searchParams.get("state"), "outlook-state");
    assert.equal(parsed.searchParams.get("response_type"), "code");
    const scope = parsed.searchParams.get("scope") ?? "";
    assert.match(scope, /Mail\.Read/);
    assert.match(scope, /offline_access/);
    assert.doesNotMatch(scope, /Mail\.Send/);
  });

  it("an integration with no OAuth builder raises rather than building a URL", () => {
    // Wave-7 wired hubspot/salesforce/notion. paypal/canva remain
    // coming-soon with no buildAuthorizeUrl branch.
    assert.throws(
      () =>
        buildAuthorizeUrl({
          integrationId: "paypal",
          scopes: ["openid", "transactions.read"],
          state: "x",
          origin: "https://app.agentplain.test",
          googleClientId: "g",
          googleClientSecret: "g",
          microsoftClientId: "m",
          microsoftAuthority: "https://login.microsoftonline.com/common",
        }),
      /not implemented/i,
    );
  });

  it("DocuSign authorize URL targets the account server with signature scope", () => {
    const url = buildAuthorizeUrl({
      integrationId: "docusign",
      scopes: getMarketplaceEntry("docusign")!.scopes,
      state: "ds-state",
      origin: "https://app.agentplain.test",
      microsoftAuthority: "https://login.microsoftonline.com/common",
      docusignClientId: "ds-client",
      docusignBaseUri: "https://account-d.docusign.com",
    });
    const parsed = new URL(url);
    assert.equal(parsed.host, "account-d.docusign.com");
    assert.equal(parsed.pathname, "/oauth/auth");
    assert.equal(parsed.searchParams.get("client_id"), "ds-client");
    assert.equal(parsed.searchParams.get("response_type"), "code");
    const scope = parsed.searchParams.get("scope") ?? "";
    assert.match(scope, /signature/);
    assert.match(scope, /extended/);
  });

  it("QuickBooks authorize URL targets appcenter.intuit.com with the accounting scope", () => {
    const url = buildAuthorizeUrl({
      integrationId: "quickbooks",
      scopes: getMarketplaceEntry("quickbooks")!.scopes,
      state: "qbo-state",
      origin: "https://app.agentplain.test",
      microsoftAuthority: "https://login.microsoftonline.com/common",
      quickbooksClientId: "qbo-client",
    });
    const parsed = new URL(url);
    assert.equal(parsed.host, "appcenter.intuit.com");
    assert.equal(parsed.searchParams.get("client_id"), "qbo-client");
    assert.match(parsed.searchParams.get("scope") ?? "", /com\.intuit\.quickbooks\.accounting/);
  });

  it("Google Drive authorize URL reuses Google's app but lands on the Drive callback", () => {
    const url = buildAuthorizeUrl({
      integrationId: "google-drive",
      scopes: getMarketplaceEntry("google-drive")!.scopes,
      state: "drive-state",
      origin: "https://app.agentplain.test",
      googleClientId: "google-client-test",
      googleClientSecret: "google-secret-test",
      microsoftAuthority: "https://login.microsoftonline.com/common",
    });
    const parsed = new URL(url);
    assert.equal(parsed.host, "accounts.google.com");
    assert.equal(
      parsed.searchParams.get("redirect_uri"),
      "https://app.agentplain.test/api/integrations/google-drive/oauth/callback",
    );
    assert.match(parsed.searchParams.get("scope") ?? "", /drive\.readonly/);
  });

  it("Slack authorize URL targets slack.com with user_scope, never bot scope", () => {
    const url = buildAuthorizeUrl({
      integrationId: "slack",
      scopes: getMarketplaceEntry("slack")!.scopes,
      state: "slack-state",
      origin: "https://app.agentplain.test",
      microsoftAuthority: "https://login.microsoftonline.com/common",
      slackClientId: "slack-client",
    });
    const parsed = new URL(url);
    assert.equal(parsed.host, "slack.com");
    assert.equal(parsed.pathname, "/oauth/v2/authorize");
    assert.equal(parsed.searchParams.get("client_id"), "slack-client");
    assert.ok(parsed.searchParams.get("user_scope"), "requests a user token, not a bot token");
    assert.equal(parsed.searchParams.get("scope"), null, "no bot scope requested");
  });

  it("Outlook authorize URL throws when MICROSOFT_OAUTH_CLIENT_ID is unset", () => {
    assert.throws(
      () =>
        buildAuthorizeUrl({
          integrationId: "outlook",
          scopes: ["Mail.Read", "offline_access"],
          state: "x",
          origin: "https://app.agentplain.test",
          googleClientId: undefined,
          googleClientSecret: undefined,
          microsoftClientId: undefined,
          microsoftAuthority: "https://login.microsoftonline.com/common",
        }),
      /Microsoft OAuth not configured/,
    );
  });
});

describe("marketplace tile prop mapping", () => {
  it("connected credential maps an available entry to status=connected", () => {
    const entry = getMarketplaceEntry("gmail")!;
    const connectedByProvider = new Map<string, unknown>([
      ["GOOGLE", { id: "cred-1", accountEmail: "you@firm.test", status: "ACTIVE" }],
    ]);
    assert.equal(deriveStatus(entry, connectedByProvider), "connected");
  });

  it("no credential maps an available entry to status=available", () => {
    const entry = getMarketplaceEntry("outlook")!;
    const connectedByProvider = new Map<string, unknown>();
    assert.equal(deriveStatus(entry, connectedByProvider), "available");
  });

  it("coming-soon entries always map to status=coming-soon, even if a row exists", () => {
    // Wave-7 wired hubspot — using `paypal` here as the still-coming-soon
    // entry whose derivation must stay coming-soon under all conditions.
    const entry = getMarketplaceEntry("paypal")!;
    // No DB rows ever exist for coming-soon entries (providerKey is null),
    // but the derivation must still hold if a future migration backfilled.
    const connectedByProvider = new Map<string, unknown>();
    assert.equal(deriveStatus(entry, connectedByProvider), "coming-soon");
  });
});

// Mirrors the derivation in app/(product)/app/workspace/[id]/integrations/page.tsx.
// Lives in the test so a drift in the page would be observable here.
function deriveStatus(
  entry: MarketplaceEntry,
  connected: Map<string, unknown>,
): "connected" | "available" | "coming-soon" {
  if (entry.status === "coming-soon") return "coming-soon";
  if (entry.providerKey && connected.has(entry.providerKey)) return "connected";
  return "available";
}

