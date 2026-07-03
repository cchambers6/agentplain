# Audit 5/10 — Connector setup + status (per-connector)

**Date:** 2026-07-02 · **Pinned:** `origin/main` @ `f928400` · **Worktree:** `C:\agentplain-wt-audit-5`
**Scope:** 14 customer-brought connectors (HubSpot, Salesforce, Notion, FUB, Sierra, Buildium, QuickBooks, TaxDome, Karbon, Clio, MyCase, kvCORE, BoldTrail, AppFolio) + 10 we-bring services (Anthropic, OpenAI embeddings, Vercel, Neon, Inngest, Resend, Twilio, ElevenLabs, agentplain.com, corpora) + the two-tab marketplace UI (#297), connection-time disclosure (#306), dispatch coverage (#277).
**Method:** 5 parallel read-only code auditors + gates and test suites run locally in the pinned worktree. **No live OAuth was exercised** (no credentials in this environment) — "OAuth works" claims below are static wiring verification plus the shipped test suites, not real-account round-trips.

## Verdict

**7 of 10 checklist items pass; 3 fail or partially fail.** The plumbing layers (dispatch routes, auth/tenancy, brand, voice, empty states) are in the best shape they've ever been — the #277 gate holds at 17/17 and is enforced at three chokepoints. The failures cluster in one place: **the api-key connector family and the disclosure path around it.** TaxDome and Karbon are advertised `available` but are unconnectable through any UI (customer or operator). The marketplace tile's primary Connect CTA bypasses the #306 disclosure entirely and dead-ends for every api-key connector. And the ratified two-bucket positioning single-sources never actually merged to main.

## Gate + test evidence (run in this audit)

| Check | Result |
|---|---|
| `node tools/connector-dispatch-coverage.mjs` | ✅ 26 entries, 17 available, 17/17 routed |
| `node tools/brand/voice-gate.mjs` | ✅ 0 new (30 baseline, **0 on connector surfaces** — verified by filtering baseline paths) |
| `node tools/brand/brand-gate.mjs` | ✅ 0 new (11 baseline) |
| `connection-catalog.test.ts` (classification + cost attribution) | ✅ 9/9 |
| `marketplace-smoke{,-wave2,-wave3}.test.ts` + `contract.test.ts` | ✅ 89 pass / 0 fail / 23 skipped (live-credential-gated) |

## Checklist scorecard

| # | Item | Verdict |
|---|---|---|
| 1 | Correct bucket (BYO vs we-bring) per #297 | **PASS** — all 25 tiles classify BYO, two-tab UI renders (`connections/sourcing/page.tsx:212-240`); we-bring registry is 8 entries covering 9 of 10 services (`agentplain.com` missing) |
| 2 | Connection-time disclosure per #306 | **FAIL** — `ConnectStorageDisclosure` exists and gates the detail page, but the primary tile Connect CTA and onboarding one-tap go straight to OAuth start, never showing it (P0-2) |
| 3 | OAuth flows end-to-end or graceful "not set up" | **PASS (static)** — 12 OAuth connectors have start branch + callback + `IntegrationCredential` upsert; missing env → calm `notice=not-configured` landing, no 500s. Not live-tested |
| 4 | MCP-dispatch routes for every `available` per #277 | **PASS** — 17/17, zero stub tool bodies, gate enforced in pre-push + CI + package script |
| 5 | Voice-gate on connector copy | **PASS** — 0 rule hits; caveat: the gate's scan set omits `lib/integrations/` so marketplace descriptions are structurally ungated (P2) |
| 6 | Model-vendor invisible | **FAIL** — "Claude (reasoning)" + "We hold the Anthropic account" render on `/connections/sourcing` and `/usage/connections` (P1-4) |
| 7 | Heritage Plains applied | **PASS** — zero raw hex / off-brand utilities on any connector surface; full token + Ap-component adoption, `moss`/`flag` status colors |
| 8 | Empty-state per connector | **PASS** — every tile carries the per-connector value proposition + trust line; unconnected detail page has a real "Not connected yet" state with CTA |
| 9 | Reconnect flow on token expiry | **PASS (OAuth) / PARTIAL (api-key)** — expiry→banner→reconnect→re-grant chain fully wired for OAuth; api-key tiles' Reconnect dead-ends (P1-5) |
| 10 | Cost attribution per #297 | **PARTIAL** — surface exists, navigable both ways, real data for the LLM row; all other we-bring rows read a Null meter (honest zeros, Twilio metering unfed) |

---

## P0 findings

### P0-1 · TaxDome + Karbon advertised `available` but unconnectable through any UI
`lib/integrations/marketplace.ts:382-400` (TaxDome) and `:402-416` (Karbon) declare `status:'available'` but omit `connectMode:'api-key'` (Buildium `:436`, FUB `:504`, Sierra `:570` all have it). Chain of consequence:
- `config-status.ts:70-73` has no `TAXDOME`/`KARBON` case → `default: return false` → both render "Request connection — your service partner wires this during onboarding".
- The connect endpoints **exist and are fully built** (`app/api/integrations/taxdome/connect/route.ts`, `karbon/connect/route.ts`) but have **zero UI call sites** (grep-verified), and no operator-side surface references them either (grep of `app/(operator)` — zero hits).
- Even if wired, the generic `ApiKeyConnectForm` posts `{workspaceId, apiKey}` while TaxDome's schema requires `portalSubdomain` (route `:38-46`) and Karbon requires `accessToken`+`accessKey` (route `:24-31`) → 400.

The "service partner wires it on the welcome call" promise is unfulfillable without engineering. This is the same silent-unconnectable class #277 fixed for Buildium. Both are CPA-vertical connectors — the vertical whose killer workflow (month-end close) reads through them.
**Fix shape:** add `connectMode:'api-key'` + `TAXDOME`/`KARBON` cases in `config-status.ts` + bespoke connect forms (mirror `BuildiumConnectForm`'s two-field pattern).

### P0-2 · Primary Connect path bypasses the #306 disclosure
`components/marketplace/IntegrationTile.tsx:162` links Connect straight to `oauthStartPath(entry, workspaceId)`; `onboarding/page.tsx:605` one-tap connect does the same. `ConnectStorageDisclosure` renders only on the integration detail page (`[integrationId]/page.tsx:214-218`) — a page the tile path never visits. A customer can complete an OAuth grant without ever seeing the Bucket-1/Bucket-2 stance the #306 architecture was built to disclose.
**Fix shape:** route tile + onboarding CTAs through the detail page, or inline a compact disclosure into those CTAs. (Same edit resolves P1-5 — same root cause.)

### P0-3 · Two-bucket positioning single-sources never merged
`lib/marketing/data-commitments.ts` and `lib/integrations/data-flow.ts` — the ratified single sources of truth for the two-bucket stance — **do not exist on main**. They live only on the still-open branch `feat/data-minimization-positioning-2026-06-18`. PR #306 (architecture companion) merged; the positioning layer did not. Policy currently points at files production doesn't have. Merge or formally abandon the branch.

## P1 findings

### P1-4 · "Claude (reasoning)" + "We hold the Anthropic account" on customer product surfaces
`lib/integrations/wb/registry.ts:75,77-78` render via `sourcing/page.tsx:300,310-312` and `usage/connections/page.tsx:256`. Violates the vendor-on-/privacy-only rule. **Nuance for Conner:** the SBM wrapper positioning explicitly permits "built on Claude, configured by us", and this surface exists to show the honest who-pays split — this may be a deliberate exception. Needs ratify-or-fix, not a silent pass. (OpenAI/ElevenLabs/Resend/Vercel/Neon/Inngest are all correctly abstracted; the classifier in `connection-catalog.ts:94-105` blocks these vendor names from marketplace tiles but never checks the we-bring registry's own rendered strings.)

### P1-5 · Api-key connectors' Connect/Reconnect CTAs dead-end in a false message
`IntegrationTile.tsx:162` (available) and `:112` (expired) always link to `oauthStartPath`. For FUB/Sierra/Buildium the start route passes the configured pre-check (`config-status.ts:40`), then `buildAuthorizeUrl` throws "OAuth start not implemented" (`oauth-urls.ts:229`), gets caught (`start/route.ts:171-175`), and lands on "isn't open for self-connect yet" — false; the paste form is one page away and the tile never links to it. Self-serve setup for the entire api-key family is a polite dead end from the marketplace index.

### P1-6 · Pass-through breadcrumb wired to inbox only — storage counter undercounts
`passThroughFetch`/`recordEphemeralFetch` has exactly one production call site (`inbox/mcp-inbox-fetcher.ts:76`). HubSpot/QuickBooks/FUB/Notion MCP reads are behaviorally pass-through (no persistence of fetched data found) but leave no breadcrumb — so the storage surface's "N pass-through reads logged — 0 stored" proof counter (`settings/data/storage/page.tsx:172-176`) counts only email reads. The evidence surface undercounts the very behavior it exists to prove.

### P1-7 · Cost attribution real for LLM only; pass-through metering unfed
`usage/connections/page.tsx:113` reads `NullWeBringUsageMeter` (`wb/meter.ts:101-111`, always `[]`) for everything but the LLM row. Honest zeros with a disclosing footer, but the row that most needs metering when it goes live (Twilio pass-through, the only row that ever charges the customer) has scaffolding (`wb/passthrough.ts`) and no feed.

### P1-8 · "MCP server scaffolding" in customer-facing BoldTrail copy
`marketplace.ts:584` — "The MCP server scaffolding is in place; the credential path opens with the enrollment." renders on the tile grid, the BoldTrail detail page, and the real-estate recommendations list. Pure engineer vocabulary (banned per the customer-vocab rule); the sibling waitlist entries (kvCORE `:515`, Lofty `:606`, Clio `:642`) phrase the same state without it. Cut the middle sentence.

### P1-9 · Customer "Test connection" over-claims health
`[integrationId]/health/route.ts:8-11` claims Gmail/Outlook get a real refresh round-trip; the implementation (`:118-124`) returns `ok:true` from the DB credential row alone for every provider except Buildium, then the flash says "Connection healthy. Your service partner can read this account" (`page.tsx:166-169`). That's the exact credential-status-≠-health pattern the daily sweep (`health-probe.ts:8-10`) was built to avoid. The sweep is honest; the button is decorative.

## P2 findings (grouped)

**Registry completeness (#297):** `agentplain.com` we-bring entry missing (unused `'Brand'` category at `wb/registry.ts:30` suggests it was planned); Vercel/Neon/Inngest collapsed into one `platform-infra` entry so the hub reads "8 services", diverging from the 10-service framing (defensible, disclosed only in non-rendered `rationale`). Twilio named customer-facing (`registry.ts:125`) — likely required pass-through billing disclosure; Conner call.

**Copy/vocab on connector surfaces:** "fleet" renders 7× (`integrations/page.tsx:175`, `DisconnectButton.tsx:44`, `usage/connections/page.tsx:157`, `marketplace/page.tsx:89`, `settings/data/page.tsx:152,279`, `storage/page.tsx:196`) — ratified replacement is "your service team". Marketplace page renders raw skill slugs + `vertical:`/`kind:`/`discipline:` taxonomy (`marketplace/page.tsx:177,197-201`). Raw `/approvals` route path in prose 7× (`marketplace.ts:281,450,488,557,681` + both connect forms) — detail page's "waits in your queue" link is the right pattern. Data pages render "OAuth tokens", "row-level security", "cascade", raw Prisma table names, raw OAuth scope strings ("granted scopes") — honest but engineer-grade. Disclosure over-claim "That token is the only thing we keep" (`ConnectStorageDisclosure.tsx:77-79`) vs Bucket-1 reality (drafts, audit trail, indexed docs); suggest "…from this connection".

**Gate coverage:** voice-gate's scan set (`voice-gate.mjs:80-103`) omits `lib/integrations/` — marketplace descriptions render verbatim on 3+ customer surfaces but are ungated. DocuSign (`category:'Documents'`) inherits files-and-indexing disclosure copy that doesn't describe e-signature; dead `Calendar` case in `ConnectStorageDisclosure.tsx:52`.

**Latent/hygiene:** BoldTrail connect form target `/api/integrations/boldtrail/connect` has no route (404 the day it flips available). `oauthConfigKey` is dead at runtime and drifted (gmail declares `GMAIL_OAUTH`, real vars are `GOOGLE_OAUTH_*`) — rename or drop. 4 coming-soon templates (paypal, canva, lofty, real-geeks) point at nonexistent routes — latent only; the gate blocks promotion. Stale wave2/wave3 smoke-test comments still claim hubspot/salesforce/notion/FUB/sierra "ship NO dispatch surface / 404 today" — false since #277. Auth seam duplicated between `mcp-core/route.ts` and the 5 gmail-family routes (no divergence today; drift risk). We-bring health: only LLM (env/sentinel), Neon, Inngest have real signals; embeddings/Resend/Twilio/ElevenLabs have none. 17 of 27 connectors lack per-connector data-flow docs (`docs/data-flow/per-connector/` covers 10). Raw `<a>` instead of `Link` on `usage/connections/page.tsx:202`; storage-surface pointer in the disclosure is plain text, not a link; `/settings/data` not linked from the connections hub. `/security` names Anthropic (`app/(marketing)/security/page.tsx:65,153`) — adjacent scope, previously flagged territory.

## What's genuinely good (keep)

- **Dispatch layer:** 17/17 routed, zero stubs, uniform mcp-core auth (shared-secret + membership fall-through), per-request workspace binding, structured `CREDENTIAL_NOT_FOUND`→404 / `APPROVAL_REQUIRED`→409. Gate at three chokepoints means the #277 bug class cannot recur silently.
- **OAuth family:** defense-in-depth missing-env handling (pre-check + try/catch → calm landing, "never strand the user on a raw JSON error"), sealed state nonces, membership checks in every callback, returnTo whitelisting.
- **Reconnect (OAuth):** renewal sweep → EXPIRED/REVOKED → universal banner + tile badge → re-grant → held retry actions flushed on recovery. Complete loop.
- **Brand + voice:** connector surfaces are 100% Heritage Plains tokens, zero off-brand utilities, exemplary state labels ("Connected — renewing soon", "Needs a look").
- **Honesty architecture:** null meters over fabricated numbers, coming-soon entries stay honest with waitlist CTAs, classification safety-net test asserts zero warnings.

## Conner decisions queued

1. **"Claude (reasoning)" on the we-bring tab** — ratify as the SBM-positioning exception or rename to vendor-blind ("Reasoning engine"). (P1-4)
2. **Twilio named in pass-through billing copy** — keep (billing disclosure) or abstract. (P2)
3. **Merge or abandon `feat/data-minimization-positioning-2026-06-18`.** (P0-3)

## Spend

Five parallel audit subagents: ~657k tokens (116k + 154k + 96k + 171k + 120k). Main loop (setup, gates, tests, verification, synthesis): ~100k. **Total ≈ 0.75M tokens.**
