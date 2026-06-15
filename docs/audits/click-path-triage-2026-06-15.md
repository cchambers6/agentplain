# Click-Path Triage — every customer button inventoried (2026-06-15)

**Tier-1 immediate audit.** Conner: *"almost every single button I've pressed has something wrong with it… look at every clickable button and everything it can do and ensure they are all performing exactly the way they should."*

- **Method:** static analysis / code trace of every clickable on every customer-facing surface. App not run (prod `ANTHROPIC_API_KEY` is intentionally paused; this audit does **not** recommend restoring it).
- **Baseline:** `origin/main @ ec89853` (HEAD = PR #270 "stay-signed-in-30-day"). **This is the deployed surface customers actually experience.**
- **Scope:** marketing (unauth), auth flow, workspace core, settings, agents/disciplines/fleet/marketplace/compliance, and the full connector/integrations surface. Internal dispatch/agent surfaces excluded per mandate.
- **Coverage:** ≈265 clickables and flow-steps across 40+ route/component files, audited by five parallel deep-trace passes, then **every material finding re-verified against `main`** (not the working branch).

---

## Executive summary

**≈265 clickables audited. On `main`, 0 are truly broken (404 / 500 / no-op / wrong destination). 6 genuine imperfections remain, none of them dead buttons.**

The headline is a correction to the premise. The cluster passes initially surfaced ~16 issues, but they ran against the stale working branch `plan/production-growth-2026-06-03` (built on an older `main`, carrying untracked WIP). **Re-verification against `main` showed the large majority were already fixed:**

| Initially flagged | State on `main @ ec89853` |
|---|---|
| 30-day "stay signed in" cookie dropped on redirect | ✅ **Fixed** — `verify/route.ts:101` sets cookie on the redirect response (PR #270) |
| Chrome cross-device passkey picker collapsed (`hints:[]`) | ✅ **Fixed** — `simplewebauthn-provider.ts:78,138` inject `["client-device","hybrid","security-key"]` (PR #268) |
| `?focus=<id>` approval deep-link never consumed (3 CTAs dead-ended) | ✅ **Fixed** — `approvals/page.tsx:24-25,80` + `ApprovalsList.tsx:59-72` read it, scroll-to, highlight, coach-banner, and gracefully drop if cleared |
| `overview-view.tsx` / `talk-view.tsx` dead/divergent modules | ✅ **Wired** — `page.tsx:7,88` and `talk/page.tsx:19` import and render them on main |

**So why does it feel like "every button is wrong"?** The buttons are wired. What is missing is the *result behind the button*, from two systemic causes — both "the click works, the outcome never arrives":

1. **The LLM key is paused.** Plaino chat, agent fires, and draft generation all return an honest "offline" notice instead of doing work. Every interactive product surface therefore *looks* like it does nothing. This is intentional and out of scope to fix here, but it is almost certainly the dominant driver of the felt experience. **→ Conner business decision, not a code bug.**
2. **Connector MCP-dispatch drift.** Five connectors connect and background-sync fine, but have no interactive MCP dispatch route, so agent actions *through* a connected tool 404. The tool says "connected," then can't act. **→ real, fixable (item #2 below).**

The remaining items are polish. **There is no broken signup, no broken sign-in, no dead pricing CTA, no dead footer grid, no broken approve/reject/billing/export button.** The conversion path and the daily-use path are both intact.

---

## Ranked findings (real-on-`main` only)

> Honest labeling: there are **no true P0 code defects** on the customer click-path on `main`. The two highest-severity entries are a paused-key business decision and a dispatch-layer drift; the rest are P2 polish. I have not invented P0s to fill a Top-10.

### 1. ⚑ SYSTEMIC (experience-P0, business decision) — Interactive surfaces produce no output while the LLM key is paused
- **Surfaces:** Plaino chat (`talk/actions.ts` degraded path), agent/skill fires, onboarding first-fire, draft generation everywhere.
- **Behavior:** buttons submit correctly; the system returns a calm "offline / wired on welcome call" notice; no draft/reply is produced.
- **Why it matters:** this is the single most likely root of "every button has something wrong" — the click is fine, the work never comes.
- **Action:** **not a code fix and explicitly not a key-restore recommendation here.** Flag for Conner: decide the pause posture, or add a louder, universal "Plaino is paused — here's what resumes when it's on" banner so the degraded state reads as *intentional* rather than *broken*.

### 2. P1 (medium) — Connector MCP-dispatch drift: 5 connectors connect but can't be acted through
- **Connectors:** HubSpot, Salesforce, Notion, **Follow Up Boss**, **Sierra Interactive** (the last two are headline real-estate connectors).
- **Behavior:** OAuth/connect succeeds and Inngest cron sync runs (lib servers exist, e.g. `lib/integrations/follow-up-boss-mcp/server.ts`), but there is **no `app/api/integrations/<name>-mcp/[workspaceId]/route.ts`** dispatch route — so interactive/agent MCP calls through the connected tool 404. The card shows "connected" while real-time actions silently fail.
- **Fix:** add the ~30-line dispatch route wrapper per connector **and** a CI gate asserting "every connector advertised as connectable has a matching `-mcp` dispatch route" so this can't recur. (11 connectors already have the route: docusign, excel, gmail, google-drive, karbon, onedrive, outlook, quickbooks, slack, taxdome, teams.)
- **Severity rationale:** customer-visible symptom (connected tool doesn't act), but background value loop still functions via cron, so not P0.

### 3. P1 (compliance/trust) — DocuSign `send_envelope` / `void_envelope` are ungated
- **Location:** `lib/integrations/docusign-mcp/tools.ts:75,88`; documented as a **KNOWN GAP** in `types.ts:13` and `__tests__/marketplace-smoke-wave2.test.ts:170`.
- **Behavior:** the `requiresApproval` field exists on the tool type but nothing sets it and dispatch never enforces it, so an outbound signature request or envelope void can fire through the customer's DocuSign without an approval gate — a no-outbound-architecture violation.
- **Scope note:** this is a dispatch-layer hole rather than a customer clickable; included because it is a genuine outbound-safety gap worth queueing.
- **Fix:** set `requiresApproval: true` on both tools and enforce it in the MCP dispatch path; add a smoke test asserting they refuse to fire without an approval token.

### 4. P2 (medium, high-leverage) — Passkey enrollment is undiscoverable → the passkey sign-in button is effectively dead for new users
- **Location:** enrollment exists only at `settings/page.tsx` → "sign-in & security"; **no nudge after signup or in onboarding** (verified absent on main).
- **Behavior:** `/app/sign-in` shows a prominent "sign in with a passkey" button (`PasskeySignInButton.tsx`), but ~no real user has enrolled a credential, so it opens an OS prompt with nothing to assert and quietly resets. The feature is built; only the acquisition funnel is missing.
- **Fix:** add a one-tap "add a passkey to this device" nudge in onboarding or first dashboard visit.

### 5. P2 (low) — Manually-created memory entries hide their body at rest
- **Location:** `talk/memory/page.tsx:158-160` — the standalone body `<p>` is gated on `entry.sourceChatMessageId`, so entries with no source message (i.e. ones the user typed) render their body **only inside the collapsed `<details>` edit form**; at rest only the title shows.
- **Impact:** low — most memories are chat-sourced (Plaino-written) and display correctly; only manually-typed entries are affected.
- **Fix:** always render the body paragraph; remove or invert the `sourceChatMessageId` gate.

### 6. P2 (low) — Polish cluster (label-only CTAs + missing affordances)
- **Schedule window has no delete button** — `removeSkillScheduleWindow` action exists but no UI row triggers it; a window can only be overwritten, not removed (`settings/schedule/page.tsx:92-113`).
- **"connect to activate" agent badge is label-only** — `AgentsFleetGrid.tsx:89-96` tells the customer to connect a tool but isn't a link to `/integrations`.
- **"install from /marketplace" is plain copy**, not a link (`disciplines/[disciplineId]/page.tsx:277`).
- **Memory "· from chat" anchor dangles** — targets `/talk#msg-<id>` but chat bubbles render no matching `id` (`talk/memory/page.tsx:108` vs `talk/page.tsx`); link lands at top of thread.
- **Fix:** wire each to its existing target / render the missing `id` / add the delete button. All cosmetic; none mislead destructively.

---

## Per-surface breakdown

| Surface | Clickables audited | Broken on `main` | Verdict |
|---|---:|---:|---|
| **Marketing (unauth)** — home, 10 verticals, /verticals, /pricing, /custom, /about, /privacy, /terms, /security, /inquiry-received, nav, footer, ROI calc, custom-inquiry form | 78 | 0 | ✅ Healthy. Every signup/pricing/vertical CTA, the full footer grid, all anchor targets, all `mailto:` resolve. No FlatSBO route bleed (`/sell`,`/homes`,`/financing`,`/instant-offer` absent). Sales-led tiers correctly avoid self-checkout. |
| **Auth** — sign-in, sign-up, checkout-success, verify, passkey reg/auth, Google OAuth, "keep me signed in" | 29 | 0 | ✅ Healthy on main. Magic-link + passkey wired; enumeration-safe; 30-day cookie ✅ (PR #270); cross-device passkey hints ✅ (PR #268). No "forgot password" by design (passwordless). Gap: passkey enrollment discoverability (item #4). |
| **Workspace core** — overview, talk/chat, memory, activity, approvals, briefings, onboarding, help, 12 nav tabs | 62 | 0 | ✅ Healthy on main. All 12 tabs resolve; approve/edit/reject + chat-send wired to audited server actions; `?focus=` deep-link fully implemented (scroll+highlight+coach banner). Degraded-mode honesty done well. Only item: memory body gate (#5). |
| **Settings + agents/disciplines/fleet/marketplace/compliance** — billing portal, payment, cancel, seats, data export, pause, schedule, skills, thresholds, discipline toggles, marketplace install | 48 | 0 | ✅ Healthy. Stripe portal/checkout/cancel/export all reach real implementations and are subscription-gated + BROKER_OWNER-gated + audit-logged. "Coming soon" rows are disabled non-links, not `#` dead-ends. Only items: schedule-delete + label-only CTAs (#6). |
| **Integrations / connectors** — connect/disconnect/reconnect/settings + OAuth start/callback + MCP dispatch | ≈48 | 0 dead-end | ⚠️ Connect surface is solid (config-status → tile → OAuth start prevents 503 dead-ends; no connector is fully dead). Real issue is dispatch drift (item #2) + DocuSign gating (item #3). |

**Connector functional tiers (on `main`):**
- **Fully functional (connect → act):** Gmail, Google Drive, OneDrive, Outlook, Teams, Excel, QuickBooks, Slack, DocuSign (read), Karbon, TaxDome — all have OAuth/connect **and** an HTTP `-mcp` dispatch route.
- **Connect + cron-sync but no interactive dispatch (item #2):** HubSpot, Salesforce, Notion, Follow Up Boss, Sierra — connect succeeds, background sync works, agent MCP actions 404.
- **Dead (connect 404/503):** none.

---

## Patterns noticed

1. **The biggest "bug" is a perception gap, not a code defect.** Paused LLM + connector dispatch drift both manifest as "I clicked, nothing useful happened." Fixing the *felt* problem is mostly (a) a Conner decision on the key + a clearer paused-state banner, and (b) item #2. Neither is a dead button.
2. **Audit hygiene matters: audit `main`, not the working branch.** ~10 of ~16 initial findings were already fixed on `main`; they only appeared because the cluster passes read a stale branch with untracked WIP. Any future click-path sweep should pin to `origin/main` first. (This is why the Tier-2 Playwright suite should run against a deploy of `main`.)
3. **Honesty seams are a genuine strength.** Live/saved badges, schema-only badges, "connect to activate" degradation, OAuth-not-configured guards, and disabled "coming soon" rows are systematic — the product almost never dead-ends a click silently; it explains itself. This is the opposite of the feared failure mode.
4. **Registry/route drift has no CI gate.** The 5-connector dispatch miss would have been caught by one test asserting "every connectable connector has a `-mcp` route." Same class of gap as the DocuSign `requiresApproval` that's typed but unenforced. Add assertion-level gates, not just feature code.
5. **Producer/consumer features land in pieces across PRs.** `?focus=` was a dead deep-link on the older branch and complete on main — it shipped producer-first, consumer-later. Worth a convention: deep-link consumers land in the same PR as their producers.

---

## Recommended fix order

1. **(Conner decision)** Resolve the paused-LLM posture and/or add a universal, explicit "Plaino is paused" state so degraded ≠ broken. *Highest felt-impact, zero code risk.*
2. **Item #2** — add the 5 missing `-mcp` dispatch routes + a CI gate (catches the whole class). *Restores real connected-tool value, esp. FUB/Sierra for real estate.*
3. **Item #3** — gate DocuSign `send_envelope`/`void_envelope` behind approval. *Closes the one outbound-safety hole.*
4. **Item #4** — passkey enrollment nudge in onboarding. *Makes the passkey sign-in button real; high leverage, small change.*
5. **Items #5–#6** — memory body render + schedule-delete + linkify label-only CTAs + chat `id` anchors. *Polish pass; batch in one PR.*

---

*Generated by Tier-1 click-path triage, 2026-06-15. Tier-2 (Playwright E2E + audit-queue seeder) and Tier-3 (org kaizen retros) ran in parallel. Top P1/P2 items are queued to the audit-queue INBOX for the 5pm/9pm auto-fire. No PR merged by this pass.*
