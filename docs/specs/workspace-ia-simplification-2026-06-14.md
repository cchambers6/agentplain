# Workspace IA simplification — 13 tabs → 5 customer-job tabs

**Date:** 2026-06-14
**Status:** Planning spec — NO code in this PR. For Conner's approval before any build wave.
**Branch:** `audit/workspace-ia-simplification-2026-06-14`
**Method:** 13 parallel Opus 4.8 subagents, one per top-level workspace nav tab, each reading exact `origin/main` source (fc900bc, incl. PR #257). Per-tab findings: `docs/specs/ia-audit/<tab>.md`.

> Conner's framing: *"Agentplain simplifies how AI helps local businesses and right now we have 10 tabs people have to navigate that are pretty duplicative. Let's audit and simplify."* The real count on `origin/main` is **13 top-level nav tabs** (14 nav entries — "Get help" is a second door to `/support/new`). The audit confirms the duplication is worse than "pretty duplicative": **the agent roster is rendered three different ways, the activity feed three ways, and the pending-approval set three ways.**

---

## Section A — Current state map

The source of truth is the `NAV` array in `app/(product)/app/workspace/[id]/layout.tsx`:

| # | Tab | Route | What it is today | Primary data |
|---|-----|-------|------------------|--------------|
| 1 | **Overview** | `""` | Default landing. Today's work preview, today's briefing, decisions-waiting card, loop preview, next-action. | `handoffLogEntry`, `WorkApprovalQueueItem`, briefing provider |
| 2 | **Talk to Plaino** | `/talk` | The in-app conversational surface with Plaino (+ `/talk/memory`). | `runPlainoTurn`, `PersistedChatMessage`, memory store |
| 3 | **Disciplines** | `/disciplines` | Agent roster grouped by business discipline + per-discipline detail + on/off activation. | `listDisciplines()`, `AGENT_DISCIPLINE` |
| 4 | **Fleet** | `/fleet` | "Mission control": fleet map, activity stream, skill-fires feed, todo board, talk-to-fleet composer. | handoff log, skill fires, approval queue |
| 5 | **Activity** | `/activity` | Full feed of what the fleet did, with outcome classification. | `handoffLogEntry` + `classifyOutcome` |
| 6 | **Approvals** | `/approvals` | The queue of drafts/actions Plaino needs the owner to OK. The human-in-the-loop gate. | `WorkApprovalQueueItem` + audit log + preferences |
| 7 | **Agents** | `/agents` | Flat grid of individual agents + per-agent detail (`/agents/[slug]`). | agent roster, connector status |
| 8 | **Compliance** | `/compliance` | Customer view of compliance flags/triage (real-estate fires live). | `complianceFlag`, Sentinel |
| 9 | **Briefings** | `/briefings` | Plaino's periodic briefs (daily/weekly) + feedback-loop ("what we learned from your edits"). | `WorkspaceBriefing` cron rows |
| 10 | **Weekly report** | `/reports/weekly` | In-app twin of the Friday value email. "Did I get my money's worth." | `computeWeeklyReportData` (shared with email/cron) |
| 11 | **Integrations** | `/integrations` | Connection marketplace + connect/disconnect flows. | integration registry, OAuth tokens |
| 12 | **Settings** | `/settings` | The chrome bucket: billing, passkeys, data, pause, schedule, autonomy, work-thresholds, skills, voice, discipline-heads, demo. | per-domain |
| 13 | **Support** | `/support` (+ `/support/new` = "Get help") | Support chat (Plaino `mode=support`) + ticket intake + threads. | `Ticket`, `/api/chat` |

**Non-nav routes that exist** (reachable only by deep link — orphans): `/marketplace` (skill catalog), `/rent-collection` (vertical workflow), `/help` (dead predecessor of `/support/new`), `/onboarding`, `/welcome`.

---

## Section B — Customer Jobs framework

A local-business owner does not come to agentplain to "manage a fleet." They come to do **five jobs**:

| Job | The owner's words | Current tabs serving it (the duplication) |
|-----|-------------------|--------------------------------------------|
| **J1 — "What needs me right now?"** | *"I've got 5 minutes. What did Plaino do, and what's waiting on my OK?"* | Overview + **Approvals** + Activity + Fleet (TodoBoard) — **4 tabs** |
| **J2 — "Let me just talk to Plaino."** | *"I have a question / a task. Let me ask my partner."* | **Talk to Plaino** + Support chat + Fleet (TalkToFleet) — **3 chat surfaces** |
| **J3 — "What can Plaino do, and is it wired into my tools?"** | *"What does my service cover, and is my Gmail/QuickBooks connected so it actually works?"* | **Integrations** + Agents + Disciplines + Marketplace — **4 tabs** |
| **J4 — "Did I get my money's worth, and is everything safe?"** | *"Show me the value this week, and tell me nothing slipped through (compliance)."* | **Weekly report** + Briefings + Compliance — **3 tabs** |
| **J5 — "Manage my account."** | *"Billing, sign-in, pause, get a human."* | **Settings** + Support tickets + Help — **3 tabs** |

**The headline finding:** 13 tabs collapse to **5 jobs**. Every job is currently spread across 3–4 tabs. Nobody is missing a job — they're drowning in **redundant doors to the same job.**

---

## Section C — Proposed new IA (5 tabs)

### 1. **Today** — *J1: "What needs me right now?"*  → default landing
- **Spine:** the **Approvals queue** (the #1 daily reason to open the app). Approvals is promoted from a buried tab to the action-spine of the landing surface.
- **Also contains:** today's briefing (the morning "catch me up"), the recent-activity feed ("what Plaino did"), a compliance-triage CTA when flags are open, and any live vertical-outcome cards (e.g. rent-collection).
- **Migrates in:** Overview (becomes this shell), Approvals (spine), Activity (the feed, with a "see all" deep view), Fleet's **TodoBoard** model (drafting → ready for you → done), the daily half of Briefings.
- **Default view:** "Needs you" (pending approvals) on top, "What Plaino did" feed below, daily brief collapsible at top.
- **Mobile:** primary bottom-tab; the approvals list is the first scroll.

### 2. **Plaino** — *J2: "Let me talk to Plaino."*
- **Contains:** the `/talk` chat surface (+ memory as a visible sub-view), the support chat folded in (same `/api/chat` backbone), and the voice/persona setting.
- **Migrates in:** Talk + `/talk/memory`, the **conversational** half of Support, `settings/voice`. Fleet's TalkToFleet write-path folds here as the "give Plaino a job" intake.
- **Default view:** the conversation thread with a persistent composer.
- **Mobile:** bottom-tab; full-height chat.
- **Brand note:** keeping Plaino as its own named tab is a deliberate brand bet (Plaino = THE partner). See Section's hardest-call discussion.

### 3. **Connections** — *J3: "What can Plaino do + is it wired in?"*
- **Contains:** integrations (connect/disconnect), the skill/agent **marketplace** (promoted out of orphan status), and a single "what Plaino covers" roster view — disciplines become an in-surface filter, not a tab.
- **Migrates in:** Integrations (anchor), `/marketplace`, Agents (roster collapses to one view; per-agent detail grid killed), Disciplines (folds to a filter + the activation toggle), `settings/skills`, `settings/discipline-heads`.
- **Default view:** "Your setup" — connected tools first (with honest "Connect X to activate" states), then what Plaino can do.
- **Mobile:** bottom-tab; connection cards.

### 4. **Reports** — *J4: "Money's worth + safety."*
- **Contains:** the weekly value report (promoted `/reports/weekly` → `/reports`, weekly as default, extensible to monthly), a compliance-assurance section ("N items checked, 0 issues" — moat stays visible), and a value-vs-spend summary (the value half today, plus a token-free spend line pulled from billing).
- **Migrates in:** Weekly report (anchor), Briefings' weekly digest + the feedback-loop section, Compliance (as a prominent named section, full detail behind it).
- **Default view:** this week's value card + trust line.
- **Mobile:** bottom-tab.

### 5. **Account** — *J5: "Manage my account."*
- **Contains:** billing, passkeys, data/closure, pause, schedule, autonomy (autonomy + work-thresholds merged into one "how much Plaino does on its own" control), and Support **tickets/threads** + get-a-human.
- **Migrates in:** Settings (minus the product-controls that move to Plaino/Connections), Support ticket intake + threads, `/help` killed.
- **Default view:** account home with billing + plan status.
- **Mobile:** bottom-tab → drawer for sub-routes.

**Mobile navigation pattern:** exactly **5 bottom tabs** (Today / Plaino / Connections / Reports / Account) — 5 is the proven ceiling for a bottom tab bar; sub-routes use in-tab drawers. Desktop keeps the top `ApWorkspaceStrip` but with 5 items instead of 14. This is the structural payoff: 14 nav entries do not fit a phone; 5 do.

---

## Section D — What gets killed

| Killed | Why | Salvage first |
|--------|-----|---------------|
| **Fleet tab** | Engineer-built mission-control. All 5 panels duplicate other tabs (ActivityStream→Activity, SkillFiresFeed→Activity, TodoBoard→Approvals, TalkToFleet→Talk, FleetMap→Agents) and the page even links to each. Most jargon-prone surface in the product. | **TodoBoard's drafting→ready→done model** → Today. TalkToFleet write-path → Plaino. |
| **Disciplines tab** | A lens over data four other tabs own; Agents already renders disciplines as filter chips off the same `listDisciplines()`. "Disciplines" is org-chart vocab an owner doesn't think in. | The **per-area on/off activation toggle** (its one unique atom) → Connections. The `lib/disciplines` module stays (real data axis). |
| **Activity tab** | Three renderings of one substrate; folds into Today's feed. | `classifyOutcome` + failure-surfacing banner (closes audit P1-4) → Today. |
| **Briefings tab** | Same "what happened" JTBD as Weekly report (weekly) and Overview (daily). | Daily brief → Today; weekly digest + **feedback-loop section** → Reports. |
| **Agents per-agent detail grid** (`/agents/[slug]`) | It's just Approvals + Activity filtered by one agent. Exposes raw agent slugs, contradicting "Plaino is ONE partner." | The `liveRequiresSatisfied`/connector status ladder → Connections cards. |
| **Legacy `/help` route** | Dead predecessor of `/support/new` using a different, untracked data model (`SupportRequest` note). Not in nav; reached only by onboarding deep links. | Repoint onboarding `StuckHelpLink` → `/support/new`; redirect `/help`. |
| **"Get help" as a separate nav entry** | It's literally `/support/new` — one job, two doors. | Collapse into one "Help & support" item in Account. |

---

## Section E — Migration plan

**Phase A — IA shell + redirects (1 wave, low risk).** Build the 5-tab nav (`NAV` array → 5 entries; add the mobile bottom-bar). Each new tab initially **redirects to / embeds the existing pages** so nothing breaks. Keep every old route reachable via redirect. Also land the two zero-risk wins now: kill `/help` (redirect to `/support/new`) and collapse "Get help" into the Support entry. **No content moves yet.**

**Phase B — content moves (per-bucket waves, isolated worktrees).** Each bucket is one wave:
- **Today** — merge Overview + Approvals (spine) + Activity feed + daily brief + TodoBoard model. *Largest wave.*
- **Connections** — merge Integrations + Marketplace + Agents roster + Disciplines filter + skills + discipline-heads.
- **Reports** — promote `/reports/weekly` → `/reports`; fold in Briefings weekly + compliance-assurance section + spend-vs-value line. **Keep `/reports/weekly` as a redirect** (the Friday email's one-click-unsubscribe targets its `#email-preferences` anchor — breaking it breaks unsubscribe).
- **Plaino** — Talk + memory + support chat + voice; unify `runPlainoTurn` vs `/api/chat` backbones as a follow-up (not blocking the IA move).
- **Account** — consolidate Settings (merge autonomy + work-thresholds); move Support tickets/threads in; finish `/help` kill.

**Phase C — remove old routes (1 wave + QA).** Delete the dissolved routes (Fleet, Disciplines, standalone Activity/Briefings, `/agents/[slug]`), keeping redirects for any externally-linked URL for one release.

**Customer-facing comms:** **quiet migration.** This is a done-for-you service for non-technical owners; a "we reorganized your dashboard" announcement creates anxiety where none is warranted. Land redirects so no bookmark breaks; surface one calm in-product note ("We simplified your workspace to 5 areas") on first post-migration visit, dismissible. No email blast.

**Carry-through guardrail (every wave):** the per-tab audits flagged that the *most-seen* future surfaces (Today, Connections) currently carry the *worst* PR #249 engineer-vocab leaks ("rooting", "live", "skill fires", raw agent slugs, `kind·agentSlug`, `relatedSubjectTable:Id`, "Sentinel", "ratification"). **Each content-move wave must include the customer-vocab cleanup for the surfaces it touches** — do not move a leak into a more-visible home.

---

## Section F — Per-consolidation customer-value self-score

*"Did this simplify, or just hide complexity?" (1 = hid it / moved the mess; 5 = genuine simplification)*

| Consolidation | Score | Rationale |
|---------------|:---:|-----------|
| Kill **Fleet**, dissolve into Today/Plaino/Connections | **5** | Removes a pure-redundant hub; nothing unique lost once TodoBoard model is salvaged. |
| **Activity** → Today feed | **4** | Real simplify; risk is losing full-history depth — mitigate with "see all" in Today. |
| **Briefings** → split (daily→Today, weekly→Reports) | **3** | The split adds a seam, and the daily brief currently pulls from a *different data source* than Overview's brief (live drift hazard) — must unify on the move or it hides complexity. |
| **Disciplines + Agents** → Connections | **4** | Collapses 3 roster renderings to 1; risk = dropping the activation toggle. Carry it. |
| **Compliance** → Reports section | **3** | Simplifies nav but risks burying a moat; only a 5 if the word stays visible and the triage CTA stays on Today. Execution-dependent. |
| Support "Get help" + `/help` + Support → one | **5** | Three skins of one intake → one. Clean win, zero downside. |
| Settings **autonomy + work-thresholds** → one control | **4** | Two pages, one job ("does it run on its own or wait for me?"). |
| **Overview + Approvals** → Today (approvals = spine) | **4** | Merges the two daily surfaces; the only risk is regressing the approval action-layer — which must move untouched. |

**Net:** no consolidation scores below 3, and the two highest-traffic merges (Fleet-kill, Support-collapse) are the cleanest 5s. The 3s are the *watch items* — they simplify only if executed with the named guardrails.

---

## Section G — Implementation effort + sequencing

Rough engineering hours (planning estimate; one developer-equivalent fleet wave):

| Phase | Scope | Est. hours |
|-------|-------|:---:|
| **A** | 5-tab nav + mobile bottom-bar + redirects + kill `/help` + collapse Get-help + first vocab-leak sweep | 8–12 |
| **B — Today** | Merge Overview+Approvals+Activity+brief+TodoBoard; carry audit-log + classifyOutcome | 16–24 |
| **B — Connections** | Merge Integrations+Marketplace+Agents+Disciplines; carry disconnect teardown + status ladder | 16–20 |
| **B — Reports** | Promote `/reports`; fold Briefings+compliance summary+spend line; preserve `#email-preferences` anchor | 10–14 |
| **B — Plaino** | Talk+memory+support-chat+voice; preserve degraded-mode honesty seam | 8–12 |
| **B — Account** | Settings consolidation + support tickets + finish `/help` kill | 8–12 |
| **C** | Remove dissolved routes + redirect QA + mobile QA | 4–6 |

**Week 1 (ship low-risk wins):** Phase A shell + redirects, kill `/help`, collapse Get-help, vocab-leak fixes on the soon-to-be-most-seen surfaces (Approvals, Activity, Fleet panels). Customer sees a cleaner 5-tab nav with everything still working via redirects.

**Week 2 (the two big merges):** Today + Connections — these absorb the most tabs and carry the load-bearing action/connection layers.

**Week 3 (value + chrome + cleanup):** Reports + Plaino + Account, then Phase C route removal and full mobile pass.

---

## Appendix — Load-bearing machinery that must survive untouched

The audits surfaced six pieces that **look** like they live in redundant tabs but are load-bearing — do not drop them while killing their host tab:

1. **Approvals `actions.ts`** — writes immutable audit logs AND feeds `lib/preferences` (reject/edit signals tune every future draft *fleet-wide*). `renderApprovalPayload`'s 23-kind exhaustive switch is the JSON-leak firewall.
2. **Talk `actions.ts` degraded-mode seam** — `checkDegradedMode()` + SILENT-FAIL-LOUD wiring is what caught the 2026-06-13 paused-key outage class.
3. **Compliance** — live `complianceFlag` reads, firing-vs-draft split, fail-closed counsel gate. Demote the tab, never the capability.
4. **Integrations disconnect** (`[integrationId]/actions.ts`) — three-phase RLS-guarded teardown + data purge + dual audit.
5. **Reports `#email-preferences` anchor + shared `computeWeeklyReportData`** — the email unsubscribe target and the email/dashboard parity guarantee.
6. **Fleet TodoBoard's drafting→ready→done model** — the one genuinely good idea in Fleet; carry it into Today.

## Appendix — Bugs found during the audit (file separately)

- **Support chat ignores the paused-LLM `degraded` flag** — signed-in owners see "leave your email below" marketing copy with no email field and no nudge to the working ticket path (`support/page.tsx`).
- **Briefings daily brief vs Overview daily brief read different data sources** (legacy Notion provider vs `WorkspaceBriefing` cron rows) — live drift hazard.
- **`/marketplace` and `/rent-collection` are orphaned** (not in `NAV`) — rent-collection (a real killer workflow) exists only on the unmerged `buildium/adapter-and-killer-workflow` branch and will be lost if not landed.
- **Overview "see fleet →" link mis-points at `/agents`.**
