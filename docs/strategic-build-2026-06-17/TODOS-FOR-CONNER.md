# TODOs for Conner — Strategic Build 2026-06-17

Account-gated and credential-gated follow-ups parked here by the build waves.
Code is shipped and ready; each item below is the human/account step that
activates it. Other waves append their own sections to this file.

---

## Vertical-MCP adapter scaffolds (7 connectors)

PR: `feat(integrations): adapter scaffolds for 7 new vertical-specific MCPs`.

Each connector ships its typed client, auth shape, zod tool registry, and
workspace-scoped MCP dispatch route. All are registered `coming-soon` in the
marketplace (they will NOT trip the #277 coverage gate until activated). Read
tools return `CREDENTIAL_NOT_FOUND` until a credential lands; every mutating
tool (create / send / charge / update) is approval-gated and returns
`APPROVAL_REQUIRED` — nothing fires from an autonomous run.

To activate a connector: obtain the credential below, add the
`IntegrationProvider` row, flip the marketplace entry to `available` + set its
`providerKey`, and (for OAuth) wire the connect/callback routes + token-refresh
adapter. TaxDome and Karbon already shipped in a prior wave and are NOT in this PR.

- [ ] **TaxDome** (CPA): sign up for partner account, get API key.
- [ ] **Karbon** (CPA): register OAuth app at developer.karbonhq.com, get client ID + secret.
- [ ] **Clio** (Law): register OAuth app at app.clio.com/api/v4/documentation, get credentials. Then set `CLIO_OAUTH_CLIENT_ID`/`CLIO_OAUTH_CLIENT_SECRET`, add a Clio token-exchange adapter (mirror `lib/integrations/hubspot/oauth.ts`) + the connect/callback routes.
- [ ] **MyCase** (Law): contact MyCase support for API access (some plans require enterprise tier). Token-auth — paste the token at connect time.
- [ ] **kvCORE** (RE): API key from kvCORE account settings (Inside Real Estate parent).
- [ ] **BoldTrail** (RE): API key from BoldTrail account or OAuth registration (Real Geeks parent). Verify the base URL + auth scheme at enrollment (`lib/integrations/boldtrail-mcp/client.ts` carries a placeholder base).
- [ ] **AppFolio** (PM): submit partner program application — ~2 month approval process. **Highest priority for the PM vertical.** Basic-auth (client-id + client-secret) + per-tenant subdomain on `providerMetadata.subdomain`.

---

## Item A — API costs at scale (per-workspace budgets + routing + caching)

- [ ] **Sign off on per-tier token budgets.** Recommended starting caps
  (`docs/scaling/api-cost-projection-2026-06-17.md` §6), targeting COGS ≤ 30%
  of revenue:
  - Regular ($199/seat): **monthly $60 / daily $6**
  - Partner ($299/seat): **monthly $90 / daily $9**
  - Max ($499/seat): **monthly $150 / daily $15** (or per-engagement)

  These are stored per-workspace in `Workspace.settings`
  (`tokenBudgetUsdMonthly` / `tokenBudgetUsdDaily`) and can be raised on any
  single account without a deploy. **They are not applied automatically** — no
  workspace has a cap until you (or an operator) set one. Say the word and the
  fleet will write these defaults per tier.

- [ ] **Confirm: auto-pause vs hard-fail at the budget cap.** Current behavior
  at 100% of cap is **graceful auto-pause** — the budget gate
  (`BudgetEnforcingLlmProvider`) returns `OVER_BUDGET` *before* the model call
  (no tokens spent), the workspace sees a calm "Plaino paused new work — you've
  reached your budget" banner, queued work resumes on period reset or a raised
  cap, and the owner got 50/75/90% email warnings on the way up. The
  alternative (hard-fail with a visible error) is worse UX and we did **not**
  build it. **Confirm auto-pause is the behavior you want**, or tell us if a
  heavy workspace should instead keep running and just alert you to reprice.

  **Strategic flag:** the modeled *heavy* Regular workspace (~$106/mo COGS)
  exceeds a $60 monthly cap. Options (§6): (1) throttle — caps pause heavy
  users near month-end; (2) reprice — usage add-on or nudge to Partner;
  (3) route harder — a little more Sonnet on lower-stakes surfaces. Your call.

### Context links
- Cost math + scaling table: `docs/scaling/api-cost-projection-2026-06-17.md`
- Budget seam (daily + monthly): `lib/billing/budget.ts`
- Alerts (pure logic): `lib/billing/budget-alerts.ts` +
  sweep `lib/inngest/functions/budget-alert-sweep.ts`
- Per-skill model tiers: `lib/skills/model-assignment.ts`
- Customer usage dashboard: `/app/workspace/[id]/usage`

### Follow-ups the fleet can do without a decision (noted, not blocking)
- Verify every Inngest sync sweep no-ops before any LLM call when there's no
  new work (delta-check before dispatch) — the cheap polling-cost win.
- Wire the already-defined `*_TRIGGER_EVENT` webhooks (HubSpot / Salesforce /
  FUB) so hourly polling drops to a daily reconciliation backstop.
- Calibrate the §2 workload model against real `LlmUsageRecord` aggregates once
  the prod key is unpaused (~2 weeks of data).
