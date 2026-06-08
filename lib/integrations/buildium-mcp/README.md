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

## Family status (this recipe applied across the keystone audit finding)

| Vertical            | Skill port           | First vendor adapter                  |
| ------------------- | -------------------- | ------------------------------------- |
| Insurance           | `PolicyLookup`       | **EZLynx — live** (`lib/integrations/ezlynx-mcp/`, wave-1b) → `insurance-coi-request`. Next: HawkSoft, Applied Epic, AMS360. |
| Mortgage            | `LoanFileLookup`     | **Encompass — live** (`lib/integrations/encompass-mcp/`, wave-1b) → `mortgage-document-chase`. Next: LendingPad, Calyx. |
| Property management  | `RentRollLookup`     | **Buildium — live** (`lib/integrations/buildium-mcp/`, wave-1) → `property-management-rent-collection-chase`. Next: AppFolio, Yardi Breeze. |
| Title / escrow      | `ClosingFileFetcher` | **Qualia — live** (`lib/integrations/qualia-mcp/`, wave-1b) → `title-escrow-closing-doc-chase`. Next: SoftPro, RamQuest. |
| Real estate (lead)  | `LeadFetcher`        | **Follow Up Boss — already live** (`lib/integrations/follow-up-boss-mcp/`). Sierra + BoldTrail also live. |

> Note on real estate: contrary to the audit's "only QuickBooks runs live"
> framing, **Follow Up Boss was already fully wired** (MCP server,
> `LeadFetcher` adapter, hourly write-back sweep, tests). There is no separate
> "listing-coordinator" *runtime* port to wire — `realty-listing-coordinator`
> is an advisory `.claude/skills` agent, not a runtime skill with a
> `Fetcher` port + `JsonXxx` fixture; dotloop/Skyslope appear only as
> marketplace tile names in `lib/verticals/real-estate/content.ts`. Wiring a
> dotloop/Skyslope adapter would mean inventing a parallel path, which this
> recipe forbids — so that "family" is intentionally not built here.
>
> Wave 1b (this batch) completed the three genuine "port exists, adapter does
> not" gaps that remained — insurance, mortgage, title — each behind a
> per-vendor `<VENDOR>_ADAPTER_LIVE=on` flag (fixtures by default), read-only,
> with a `NOT_CONFIGURED` honesty seam and node:test coverage proving the
> skill drafts end-to-end from vendor-shaped fixtures.
