# Vertical integration adapter seam — the keystone recipe

This directory (`lib/integrations/buildium-mcp/`) is the reference
implementation for the keystone audit finding: **"the port exists, the
adapter does not."** Many skills already define a provider-neutral *port*
(an interface) plus a `JsonXxx` fixture impl, but had **no real vendor
adapter** behind it. Buildium → `RentRollLookup` (property-management
rent-collection) is the first family wired the full way; the other families
follow this exact recipe.

## The pattern (copy this for every remaining family)

1. **Find the port** the skill already defines. It's an interface in the
   skill's `types.ts` with a `JsonXxx` second impl in `json-fetcher.ts` and
   a TODO comment naming the vendor(s). Do **not** invent a parallel path —
   implement the existing port.

2. **Build the vendor MCP** under `lib/integrations/<vendor>-mcp/`:
   - `types.ts` — provider-neutral DTOs + the `XxxMcpServer` interface.
   - `auth.ts` — `resolveXxxCredential` via `mcp-core`. Use
     `resolveApiKeyCredential` for key-based vendors (Buildium, FUB,
     TaxDome, Karbon) or `resolveWorkspaceCredential` + a `RefreshFn` for
     OAuth vendors (QuickBooks, HubSpot). Non-secret routing data
     (client-id, subdomain, instance URL) goes in `providerMetadata`.
   - `server.ts` — the **only** place that calls the vendor REST API
     (`feedback_no_silent_vendor_lock.md`). Plain `fetch`, raw→DTO mappers,
     `mapRestError` → `McpError` codes. Cold-start safe: re-resolve the
     credential every method (`feedback_cold_start_safe_agents.md`).
   - `test-server.ts` — fixture impl of the same interface, realistic
     vendor-shaped fixtures spanning every code path (the
     two-implementation rule, `feedback_runner_portability.md`).
   - `index.ts` — `buildXxxMcpServer` that returns the fixture server when
     `INTEGRATIONS_PROVIDER=test` **or** the live flag is off, else the
     prod server. Add an `isXxxLive()` reading `XXX_ADAPTER_LIVE=on`.

3. **Add the provider enum** value in `prisma/schema.prisma` +
   `lib/integrations/types.ts`' `DecryptedCredential.provider` union, with a
   one-line `ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS` enum
   migration. (Enum-add migrations need **no** drift-baseline entry — only
   raw-SQL index migrations do.)

4. **Wire the consuming adapter** in the skill dir
   (`lib/skills/<skill>/<vendor>-lookup.ts` or `<vendor>-fetcher.ts`):
   implement the skill's port, build the MCP fresh per call (cold-start
   safe), map vendor DTOs → the skill's record shape. Translate auth-class
   MCP errors to a calm `NOT_CONFIGURED` skill error (honesty seam — never
   fake data). Document any field the vendor doesn't carry with an
   operator-merge placeholder or a fail-safe default; **do not fabricate**.

5. **Test** with the fixture impl (node:test, colocated `*.test.ts`):
   prove (a) the fixture path returns real-shaped categorized data,
   (b) the skill produces its artifact from that data end-to-end,
   (c) the flag-off builder uses fixtures, (d) the honesty seam surfaces
   `NOT_CONFIGURED` rather than a fabricated result.

6. **Flag + credentials.** Live calls are off by default; flipping
   `XXX_ADAPTER_LIVE=on` (plus a connected credential) goes live. The
   customer-facing connect tile / marketplace registration
   (`lib/integrations/marketplace.ts`, `app/api/integrations/.../connect`)
   is a separate productization step — the adapter + skill wiring is
   complete and tested without it.

## Remaining families (same recipe, each its own PR)

| Vertical            | Skill port           | Vendor adapter(s) to build           |
| ------------------- | -------------------- | ------------------------------------- |
| Insurance           | `PolicyLookup`       | EZLynx, HawkSoft → `insurance-coi-request` |
| Mortgage            | `LoanFileLookup`     | Encompass, LendingPad → `mortgage-document-chase` |
| Property management  | `RentRollLookup`     | **Buildium (this PR)**, AppFolio, Yardi Breeze → `property-management-rent-collection-chase` |
| Title / escrow      | `ClosingFileFetcher` | SoftPro, Qualia → `title-escrow-closing-doc-chase` |
| Real estate (lead)  | `LeadFetcher`        | **Follow Up Boss — already live** (`lib/integrations/follow-up-boss-mcp/`), dotloop/Skyslope → listing-coordinator |

> Note on real estate: contrary to the audit's "only QuickBooks runs live"
> framing, **Follow Up Boss was already fully wired** (MCP server,
> `LeadFetcher` adapter, hourly write-back sweep, tests). This PR therefore
> targets the next genuine gap — property management / Buildium — and
> establishes this recipe so the other four ports get their first adapter.
