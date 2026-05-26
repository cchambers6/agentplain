# Fleet-architecture visuals — technical accuracy review

Audience: the visuals author (regenerator).
Scope: the five SVGs produced for the fleet-architecture handoff
(01-fleet-org-approval-chain, 02-value-loop-no-send-boundary,
03-memory-knowledge-architecture, 04-cron-substrates,
05-mcp-first-integration-topology), reviewed against the code as it
exists on the `docs/fleet-architecture-assessment-2026-05-26` branch.

Every fix below cites the file/line the diagram contradicts. Headings
map 1:1 to the five files; each finding is independently actionable so
the regenerator can pick them up without re-reading the whole doc.

---

## 01 · Fleet Org & Approval Chain

The shape (Conner → Class A CEOs → Tier 1 directors / tech-leads →
Tier 1.5 vertical heads → ICs) matches `docs/fleet-architecture.md:160-198`
and the SKILL.md anchors cited there. Fix list:

1. **"Class C — Shared services" box mislabels its members.** The
   diagram lists `Accounting`, `Social posting`, `Marketing`. The
   actual Class C agent in the org graph today is
   `flatsbo-attorney-firstpass` (per the SKILL list and
   `docs/fleet-architecture.md:194-195`). No Accounting / Social
   posting / Marketing seat exists at Class C. Replace the three
   labels with `Attorney first-pass (legal)` and a single placeholder
   tile reading `…future shared service` so the diagram doesn't fabricate
   seats that haven't been ratified.

2. **"10 more vertical heads + general on-ramp" overstates the head
   count.** The `Vertical` enum has 10 values total
   (`prisma/schema.prisma:39-50`); only one head is ACTIVE today
   (`b2b-head-of-realty`), two are LATENT (`b2b-head-of-insurance`,
   `b2b-head-of-home-services`). The other seven verticals have no
   Head — they have rosters in `lib/verticals/<slug>/content.ts` but
   no Tier-1.5 Head seat. Change the label to
   `9 more verticals — Heads activate on greenlight` or similar; do
   not imply 11 staffed Heads.

3. **"LIVE" badge on the Real Estate Head box — accurate.** Keep.

4. **The "AUTONOMY MANDATE" pull-quote** — accurate against
   `docs/fleet-architecture.md:204-216`. Keep.

5. **Approval cascade tiles `agent / IC → vertical head → CEO →
   FOUNDER`** — accurate against the cascade described at
   `docs/fleet-architecture.md:220-230`. Keep.

---

## 02 · The Value Loop & the No-Send Trust Boundary

The five-phase loop body (read → categorize → coordinate → schedule →
draft) matches `lib/skills/runner.ts:267-277` and the chain at
`docs/fleet-architecture.md:403-436`. Fix list:

1. **Panel (c) "no send-class scope is requested anywhere" is
   factually wrong.** The Gmail/Outlook OAuth scope sets exclude send
   — but `lib/integrations/marketplace.ts:114` requests
   `ChannelMessage.Send` for Teams, and `:238-239` requests
   `chat:write` and `im:write` for Slack. Both are send-class scopes.

   Rephrase panel (c) to one of:
   - `no send-class scope on the email loop` (Gmail/Outlook only —
     the no-outbound load-bearing path), or
   - `Gmail/Outlook OAuth scopes exclude *.send` (more precise; matches
     `lib/integrations/marketplace.ts:79, 95`).

   Do not say "anywhere" — the customer / regulator may verify and
   the claim does not survive a grep.

2. **The diagram omits two real phases.** The runner has 1.5
   (office-admin pre-pass, `lib/skills/runner.ts:198-234`) and 5.5
   (compliance-sentinel scanner over the draft,
   `lib/agents/sentinel/scanner.ts`). The office-admin pre-pass
   short-circuits before vertical categorize, so it is a real
   branch, not a footnote. The compliance scanner runs on every
   draft and can flag the draft for sentinel review.

   Two options — pick one:
   - Add two thin sub-boxes inside the Runner card: `1.5 · office-admin
     (pre-pass)` between `1 · read` and `2 · categorize`, and
     `5.5 · compliance` between `5 · draft` and the
     `WorkApprovalQueueItem` exit.
   - Footnote the diagram with `+ office-admin pre-pass · compliance
     scanner — see docs/fleet-architecture.md §4.`

3. **"DraftPersister has no `send()` method" — accurate.** Keep.
   Reference: `lib/skills/types.ts:218-228`.

4. **"Gmail MCP exposes only `drafts.create`" — accurate.** Keep.
   Reference: `lib/integrations/gmail-mcp/server.ts:16-19`.

5. **"Approval item created unconditionally on every single run" —
   accurate.** Keep. Reference: `lib/skills/persist-artifacts.ts:1-25`.

6. **"Inbound signal / webhook" → "Inngest cron process-webhook-event"
   — accurate but tighten the trigger.** Gmail uses Cloud Pub/Sub
   push (`app/api/webhooks/google/route.ts`); M365 uses Graph
   notifications (`app/api/webhooks/microsoft/route.ts`). The cron
   doesn't fire on the webhook — the cron drains
   `WebhookEvent` rows every 5 minutes
   (`lib/inngest/functions/process-webhook-event.ts:54-57`). Two
   triggers: `cron + on-demand event` (`process-webhook-event.ts:253-255`).

   Suggested label edit: `Inbound webhook → WebhookEvent row · drained
   every 5 min by Inngest cron`.

---

## 03 · Memory & Knowledge Architecture

Three-layer framing (pgvector + MCP / markdown memory / instructions)
maps to `docs/fleet-architecture.md:683-872`. Fix list:

1. **"Every kind is workspace_id RLS-isolated" overclaims.** Per
   `prisma/schema.prisma:228-234` and the validation rule at
   `lib/knowledge/types.ts:114-130`, only the `CUSTOMER` context-kind
   has `workspaceId` set. `SKILL`, `VERTICAL`, `CROSS_CUSTOMER`, and
   `COMPLIANCE` carry `workspaceId = NULL` and are readable across
   workspaces (subject to the kind-level rules). RLS still applies;
   workspace isolation does not.

   Rephrase to `RLS-isolated · CUSTOMER scoped by workspace_id; others
   global per context-kind` or split the lock-icon row into two — one
   green ("workspace_id-scoped") next to CUSTOMER, one grey
   ("kind-scoped, global") next to the other four.

2. **"user.md / feedback.md / project.md / reference.md" — wrong file
   shape.** Per `~/.claude/CLAUDE.md` ("auto memory" section) and
   `~/.claude/projects/C--agentplain/memory/MEMORY.md`, memories are
   stored as one file per entry with the type in the frontmatter —
   not as four monolithic files. Filenames are
   `feedback_<slug>.md`, `project_<slug>.md`, etc.

   Suggested rewrite: change the four boxes to read
   `user_<slug>.md`, `feedback_<slug>.md`, `project_<slug>.md`,
   `reference_<slug>.md` — i.e. show the file pattern, not a single
   filename. Or: make the boxes type-labels (`user`, `feedback`,
   `project`, `reference`) with a footnote "one file per memory entry."

3. **"SKILL.md per-skill procedures (registered per vertical)"
   misleads.** SKILL.md files (78 of them per
   `docs/fleet-architecture.md:97`) are not "registered per
   vertical." Skills register in `lib/skills/registry.ts:62-731` with
   a `vertical` field that is one of `all | real-estate | cpa | …`.
   Some are shared (`vertical: 'all'`); some are vertical-specific.

   Rephrase to `SKILL.md per-skill procedures · registered with vertical
   binding` or `SKILL.md per-agent procedures · vertical and shared
   skills`.

4. **"Preference loop: capture → store → wrapped into the prompt on
   the next run"** — accurate against `lib/preferences/capture.ts:1-29`,
   `lib/preferences/render.ts:1-25`, and the cold-start-safe re-read
   at `process-webhook-event.ts:129-132`. Keep.

5. **Layer 1 box "pgvector + MCP knowledge server" — accurate.**
   Reference: `app/api/knowledge/mcp/route.ts:1-28`,
   `lib/knowledge/pgvector-store.ts`. Keep.

---

## 04 · Cron Substrates — Two Engines

Two-engine framing matches `docs/fleet-architecture.md:244-393`. Major
fix:

1. **Wrapper order is REVERSED from the actual code.** The SVG shows:
   ```
   withInngestErrorReporting(   ← outer
     withCronMonitor(
       runWithDisableGate(      ← inner
         cron function body
       )
     )
   )
   ```
   Every Inngest function in the repo uses the opposite order
   (`process-webhook-event.ts:259-283`,
   `customer-files-ingestion-sweep.ts:216-228`,
   `trial-expiration-warnings.ts:180-186`,
   `integration-renewal-sweep.ts:310-317`):
   ```
   runWithDisableGate(           ← outer (paused fn doesn't ping monitor)
     withCronMonitor(            ← middle (pulse around the body)
       withInngestErrorReporting( ← inner (throws → Sentry + monitor.error)
         cron function body
       )
     )
   )
   ```
   `docs/fleet-architecture.md:295, 1162-1167` is correct; the
   diagram is wrong. The order MATTERS — putting
   `runWithDisableGate` outside ensures a paused function doesn't
   ping the cron monitor (which would make the dashboard look like a
   silent failure). Swap the three nested boxes in the SVG to match
   the code.

2. **"GitHub App token mint" → "push output → repo" path** — accurate
   against `docs/fleet-architecture.md:371-384` and
   `C:\flatsbo\lib\github\commit-cron-output.ts:1-40`. Keep.

3. **"Trigger: webhook + schedule"** on the
   `process-webhook-event` tile — accurate (the function is
   registered with both `{ cron: '*/5 * * * *' }` and
   `{ event: 'agentplain/process-webhook-event.requested' }` at
   `process-webhook-event.ts:253-256`). Keep.

4. **"Both engines are cold-start-safe"** — accurate against the
   evidence in `docs/fleet-architecture.md:314-330` and §2 of the
   assessment doc. Keep.

5. **Engine A "… other scheduled functions" tile — fine but
   under-specifies.** There are exactly three other Inngest functions
   today (trial-warnings, integration-renewal-sweep,
   customer-files-ingestion-sweep). Optional improvement: replace
   the generic tile with three named sub-tiles to anchor the diagram
   to the actual function set. Not required.

---

## 05 · MCP-First Integration Topology

The headline (`skill / agent → mcp.call(server, tool, args) → per-
workspace MCP servers behind OAuth`) matches the architecture in
`docs/fleet-architecture.md:874-921`. Adapter folder labels are the
problem:

1. **The middle column's folder labels are mostly wrong.** The
   diagram shows `lib/email/`, `lib/storage/`, `lib/signing/`,
   `lib/billing/`, `lib/chat/`. The actual layout
   (`docs/fleet-architecture.md:38-62`) is:
   - **`lib/email/`** — EXISTS, but it's the Resend adapter for
     agentplain's own transactional billing email
     (`lib/email/resend.ts`). It does NOT back Gmail or Outlook.
     Gmail lives at `lib/integrations/google/gmail-provider.ts` +
     `lib/integrations/gmail-mcp/`. Outlook at
     `lib/integrations/microsoft/outlook-provider.ts` +
     `lib/integrations/outlook-mcp/`.
   - **`lib/storage/`** — does NOT exist. Drive lives at
     `lib/integrations/google/` (SDK wrapper) +
     `lib/integrations/google-drive-mcp/` (MCP server).
   - **`lib/signing/`** — does NOT exist. DocuSign lives at
     `lib/integrations/docusign/` + `lib/integrations/docusign-mcp/`.
   - **`lib/billing/`** — EXISTS, but it's the Stripe adapter for
     agentplain's own subscription billing (`lib/billing/stripe-provider.ts`).
     It does NOT back QuickBooks. QuickBooks lives at
     `lib/integrations/quickbooks/` + `lib/integrations/quickbooks-mcp/`.
   - **`lib/chat/`** — does NOT exist. Slack lives at
     `lib/integrations/slack/` + `lib/integrations/slack-mcp/`.

   The diagram conflates "business-domain naming" with the actual
   folder structure. **Fix:** replace the middle column with the
   actual layout:
   ```
   lib/integrations/google/        — Google SDK adapter (Gmail, Drive)
   lib/integrations/microsoft/     — Graph SDK adapter (Outlook, Teams, OneDrive, Excel)
   lib/integrations/docusign/      — DocuSign SDK adapter
   lib/integrations/quickbooks/    — Intuit SDK adapter
   lib/integrations/slack/         — Slack SDK adapter
   ```
   and pair each with the matching MCP-server folder
   (`gmail-mcp/`, `outlook-mcp/`, `docusign-mcp/`, …) on the right.

   Per `docs/fleet-architecture.md:884-895` the canonical inventory is
   nine MCP server folders. Reflect those, not a fabricated "business
   domain" list.

2. **"2 impls" badge on `lib/email/`** — accurate for the agentplain
   Resend adapter (prod Resend + test). NOT accurate for Gmail/Outlook,
   which have one prod impl each (the MCP server) plus a test/fixture
   impl. After the folder-label fix above, the "2 impls" badge can
   stay on the relevant rows (every MCP server pairs with a
   `test-server.ts` or fixture) — but anchor it to where it's true.

3. **"LIVE ✓ reference server" on Gmail** — accurate. Reference:
   `lib/integrations/gmail-mcp/server.ts`. Keep.

4. **"Switches on when connected" on Outlook / Drive / DocuSign /
   QuickBooks / Slack** — under-specifies. All five of these MCP
   servers are **built and in the repo today**
   (`lib/integrations/outlook-mcp/`, `google-drive-mcp/`,
   `docusign-mcp/`, `quickbooks-mcp/`, `slack-mcp/`). Per
   `lib/integrations/marketplace.ts` each has
   `status: 'available'` — they require an OAuth credential row
   to fire, but the code path is live.

   Suggested rephrase per row: `available · awaiting OAuth in this
   workspace` (more accurate than "switches on when connected"
   which reads as "not built yet"). The "coming-soon" tiles in
   `marketplace.ts` (HubSpot, PayPal, Canva) are a separate set and
   are not in the SVG today — fine to leave them out.

5. **Teams MCP is missing entirely.** The repo has
   `lib/integrations/teams-mcp/` + an MCP route. If the diagram
   shows six provider tiles, Teams should be one. Optional —
   include it for parity, with the note that it has no approval
   gate on `sendChatMessage`/`postToChannel` today (see assessment
   N3).

6. **"OAuth" lock icon + "workspace_id" tag at top** — accurate.
   Each MCP server takes `workspaceId` in its constructor and re-
   resolves credentials per call
   (`gmail-mcp/server.ts:65-70`, ditto for every other MCP server).
   Keep.

7. **Bottom strip "Gmail is the live reference today. Other tiles
   stay disabled until OAuth credentials are set; Drive/Gmail
   ingestion also needs an encryption key."** Tighten the
   second clause: every integration needs `ENCRYPTION_KEY` for
   credential storage (`lib/security/encryption.ts:isEncryptionConfigured`
   gates all of them), not just Drive/Gmail. The "needs an encryption
   key" qualifier should apply globally, not per-integration.

   Suggested edit: `Gmail is the live reference. Outlook, Drive,
   DocuSign, QuickBooks, Slack, Teams ship enabled — each requires an
   OAuth row + ENCRYPTION_KEY set at deploy time.`

---

## Cross-diagram

- **Consistency on "live" vs "available."** Diagrams 02 and 05 use
  "LIVE" as a state. The marketplace catalog uses
  `status: 'available' | 'coming-soon' | 'beta'`. Pick one
  taxonomy; "LIVE" is fine as long as it maps clearly to "an
  in-tree MCP server + provider impl + marketplace `available`
  status." A footnote next to the first "LIVE" badge would close
  the gap.
- **No PII / no secrets visible.** All five diagrams clean. No
  fix needed.
- **Branding consistency** — Fraunces title, Inter body, IBM Plex
  Mono labels. Consistent across the five. Keep.

---

## Priority for regeneration

1. **04 wrapper-order fix** (correctness-critical — the diagram
   contradicts the code, and the order is load-bearing for the
   pause-without-flapping-the-monitor invariant).
2. **02 panel (c) "no send-class scope anywhere" fix** (overclaim
   that the codebase contradicts — Slack/Teams scopes).
3. **05 middle-column folder labels** (the diagram fabricates folder
   names that aren't on disk; the regeneration should reflect the
   real `lib/integrations/<vendor>/` + `lib/integrations/<vendor>-mcp/`
   layout).
4. **01 Class C labels** (don't fabricate Accounting / Social
   posting / Marketing seats; the only Class C seat ratified today
   is `flatsbo-attorney-firstpass`).
5. **03 RLS/file-shape labels** (CUSTOMER-only workspace scoping;
   one-file-per-memory shape).
6. **Everything else** is a polish pass.
