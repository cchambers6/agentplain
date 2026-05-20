# Operator setup: DocuSign, QuickBooks, Google Drive, Slack

**Audience:** Conner. One-time per-provider setup before the first OAuth connect.
**Status:** All four connectors ship `available` in the marketplace. Each is
independently connectable per workspace. Until the env vars below are set in
Vercel, the connect button returns `503 oauth_not_configured` (the catalog
still lists the tile).

These four follow the MCP-first integration pattern: each is a per-workspace
MCP server at `/api/integrations/<slug>-mcp/{workspaceId}`, OAuth-connected,
registered in `lib/integrations/marketplace.ts`. Tokens are encrypted at rest;
the per-account routing data (DocuSign base_uri, QuickBooks realmId, Slack team)
lives in the non-secret `IntegrationCredential.providerMetadata` column.

> **`.env.example` note:** the repo's `.env.example` is protected from edits in
> the build sandbox, so the variable names below could not be appended there.
> They are also documented inline in `lib/env.ts`. Set the real secrets in
> Vercel (Production) — never commit them. Per the no-prod-secrets-in-dev rule,
> use each vendor's sandbox/demo tier in `.env.local`.

A migration (`prisma/migrations/20260520000000_add_docusign_qbo_slack_providers/`)
adds the `DOCUSIGN`/`QUICKBOOKS`/`SLACK` provider enum values and the
`providerMetadata` column. Run `prisma migrate deploy` (the normal `build`
script already does) before connecting.

---

## 1. DocuSign (highest vertical value — real estate / title-escrow)

**Tools:** `list_envelopes`, `get_envelope_status`, `send_envelope` (from a
template or raw documents), `get_recipient_status`, `download_completed_document`,
`void_envelope`.

**OAuth scopes Conner adds on the integration:** `signature`, `extended`
(the `extended` scope is what yields a refresh token).

### Setup
1. Go to https://developers.docusign.com → **My Apps & Keys** (start in the
   **Demo** environment; switch to Production after go-live review).
2. **Add app and integration key.** Note the **Integration Key** (this is the
   OAuth client id).
3. Under **Authentication**, choose **Authorization Code Grant** and add a
   **Secret Key** (the OAuth client secret).
4. Add the **Redirect URI**: `https://agentplain.com/api/integrations/docusign/oauth/callback`
   (and `http://localhost:3000/...` for local dev).
5. **DocuSign Connect (webhook)** — Admin → **Connect** → add a custom
   configuration:
   - URL: `https://agentplain.com/api/integrations/docusign/connect`
   - Format: **JSON**, include envelope + recipient data.
   - Enable **HMAC** and copy the signing key into `DOCUSIGN_CONNECT_HMAC_KEY`.
   - Trigger on envelope status changes (sent/delivered/completed/declined/voided).

### Env vars
| Var | Value |
|-----|-------|
| `DOCUSIGN_OAUTH_CLIENT_ID` | the Integration Key |
| `DOCUSIGN_OAUTH_CLIENT_SECRET` | the generated Secret Key |
| `DOCUSIGN_OAUTH_BASE_URI` | `https://account-d.docusign.com` (demo) or `https://account.docusign.com` (prod) — defaults to demo |
| `DOCUSIGN_CONNECT_HMAC_KEY` | the Connect HMAC signing key (optional; if unset, Connect events are accepted but flagged `verified:false`) |

> The per-account REST base (e.g. `https://demo.docusign.net`) is discovered at
> connect time via `/oauth/userinfo` and stored on the credential — not an env var.

---

## 2. QuickBooks Online (accounting backbone)

**Tools:** `list_invoices`, `create_invoice`, `get_invoice`, `list_customers`,
`record_payment` (**approval-gated** — never auto-fires; requires an
`approvalToken` from the approval queue), `get_profit_and_loss`, `list_expenses`.

**OAuth scope:** `com.intuit.quickbooks.accounting`.

### Setup
1. Go to https://developer.intuit.com → **My Apps** → create an app, select the
   **Accounting** scope.
2. Under **Keys & OAuth**, copy the **Client ID** and **Client Secret** for the
   environment you're wiring (**Development/Sandbox** keys are distinct from
   **Production** keys).
3. Add the **Redirect URI**: `https://agentplain.com/api/integrations/quickbooks/oauth/callback`
   (and the localhost variant for dev).
4. **Sandbox vs production realm IDs:** the OAuth callback receives a `realmId`
   (the company id) and we store it on the credential. A *sandbox* realmId only
   works against the sandbox API base, and a *production* realmId only against
   the production base. `QUICKBOOKS_ENVIRONMENT` selects the base
   (`sandbox-quickbooks.api.intuit.com` vs `quickbooks.api.intuit.com`) — keep it
   consistent with which app's keys you set, or every API call 401s.

### Env vars
| Var | Value |
|-----|-------|
| `QUICKBOOKS_OAUTH_CLIENT_ID` | the Intuit app Client ID |
| `QUICKBOOKS_OAUTH_CLIENT_SECRET` | the Intuit app Client Secret |
| `QUICKBOOKS_ENVIRONMENT` | `sandbox` (default) or `production` |

---

## 3. Google Drive (reuses the Gmail Google OAuth app — cheapest)

**Tools:** `list_files`, `get_file_metadata`, `download_file` (exports
Google-native docs to PDF), `upload_file`, `create_folder`, `search_files`,
`share_file` (**approval-gated** — sharing changes who can access a file, so it
requires an `approvalToken`; without it the call returns `APPROVAL_REQUIRED`).

**OAuth scopes Conner adds to the existing Google OAuth consent screen:**
`https://www.googleapis.com/auth/drive.file`,
`https://www.googleapis.com/auth/drive.readonly`.

### Setup
Drive reuses the **same Google OAuth client** as Gmail (see
`operator-integrations-setup.md`). You only need to:
1. In the existing Google Cloud project, **enable the Google Drive API**
   (APIs & Services → Library → Drive API → Enable).
2. On the OAuth consent screen, **add the two Drive scopes** above.
3. Add the redirect URI `https://agentplain.com/api/integrations/google-drive/oauth/callback`
   to the OAuth client (Drive lands on its OWN callback, not the Gmail one — the
   Gmail callback forces a Gmail watch that a Drive-only grant can't satisfy).

### Env vars
**None new.** Drive reuses `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.

> **Shared-credential behavior:** Gmail and Drive share one `GOOGLE`
> `IntegrationCredential` row per Google account (scopes merge via Google's
> `include_granted_scopes`). Because the integrations page keys connected-status
> off the provider, connecting one Google connector marks both tiles
> "connected" — expected, since the underlying grant is the same account.

---

## 4. Slack (read + approval-gated post)

**Tools:** `list_channels`, `read_channel_history`, `search_messages`,
`post_message` (**approval-gated**), `send_dm` (**approval-gated**). Posting acts
as the customer via their own token and routes through the approval queue — it
never auto-fires.

**OAuth scopes (requested as USER scopes via `user_scope`, not bot scopes):**
`channels:read`, `channels:history`, `groups:read`, `groups:history`,
`chat:write`, `im:write`, `users:read`, `search:read`.

> We request a **user token** (not a bot token) because Slack's `search.messages`
> API is user-token-only and any post should act as the customer. Slack user
> tokens don't expire unless token rotation is enabled, so the credential is
> stored with a far-future expiry and no refresh token.

### Setup
1. Go to https://api.slack.com/apps → **Create New App** (from scratch).
2. **OAuth & Permissions** → under **User Token Scopes** add the eight scopes
   above. (Leave Bot Token Scopes empty.)
3. Add the **Redirect URL**: `https://agentplain.com/api/integrations/slack/oauth/callback`
   (and the localhost variant).
4. Copy the **Client ID** and **Client Secret** from **Basic Information**.

### Env vars
| Var | Value |
|-----|-------|
| `SLACK_OAUTH_CLIENT_ID` | the Slack app Client ID |
| `SLACK_OAUTH_CLIENT_SECRET` | the Slack app Client Secret |

---

## Approval-gated actions (cross-cutting)

Per the platform's no-outbound + prohibited-actions rules, three actions never
auto-fire — they require a non-empty `approvalToken` argument that only a human
approval step supplies. Without it, the tool returns `APPROVAL_REQUIRED` (HTTP
409 / JSON-RPC -32004) **before any network call**:

- **QuickBooks `record_payment`** — moving money.
- **Google Drive `share_file`** — changing who can access a file.
- **Slack `post_message` / `send_dm`** — posting on the customer's behalf.

`create_invoice` (drafting), all reads, file uploads, and folder creation are
ungated.

## Verifying a connection (smoke)

```
# Discovery (tool list) for a connected workspace:
curl -s -H "x-agentplain-mcp-key: $MCP_API_KEY" \
  https://agentplain.com/api/integrations/docusign-mcp/<workspaceId> | jq .tools

# Invoke a read tool:
curl -s -X POST -H "x-agentplain-mcp-key: $MCP_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"docusign.list_envelopes","params":{}}' \
  https://agentplain.com/api/integrations/docusign-mcp/<workspaceId>
```
