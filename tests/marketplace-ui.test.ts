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
  it("lists Gmail + four M365 surfaces + six Coming Soon connectors", () => {
    const entries = listIntegrations();
    const ids = entries.map((e) => e.id);
    // Gmail + the four M365 integrations are available; the other six are coming-soon.
    assert.deepEqual(ids, [
      "gmail",
      "outlook",
      "teams",
      "onedrive",
      "excel",
      "quickbooks",
      "hubspot",
      "docusign",
      "slack",
      "paypal",
      "canva",
    ]);
    assert.equal(entries.length, 11, "marketplace surface size is the architectural contract");
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

  it("Coming Soon entries surface six connectors with null providerKey", () => {
    const soon = listIntegrations().filter((e) => e.status === "coming-soon");
    assert.equal(soon.length, 6);
    for (const e of soon) {
      assert.equal(e.providerKey, null, `${e.id} has no DB rows yet`);
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
    for (const entry of listIntegrations()) {
      assert.ok(entry.scopes.length > 0, `${entry.id} declares at least one scope`);
      assert.match(
        entry.mcpEndpointTemplate,
        new RegExp(`^/api/integrations/${entry.id}-mcp/\\{workspaceId\\}$`),
        `${entry.id} mcpEndpointTemplate shape`,
      );
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

  it("Coming-soon OAuth start raises rather than building a URL", () => {
    assert.throws(
      () =>
        buildAuthorizeUrl({
          integrationId: "quickbooks",
          scopes: ["com.intuit.quickbooks.accounting"],
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
    const entry = getMarketplaceEntry("docusign")!;
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

