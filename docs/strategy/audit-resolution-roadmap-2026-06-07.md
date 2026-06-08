# Audit Resolution Plan — wave roadmap

**Date:** 2026-06-07 · **Orchestrator goal (Conner):** "solve every single item our agents identified."
**Inputs:** Fleet Pride Audit (PR #174, 120 YAMLs, ~363 improvement items) + Visual Gap Audit (PR #173, 52 visual slots, 50 needing work).
**Method:** cluster every actionable item into themed waves, sequence by dependency, execute each wave as an isolated worktree subagent that owns code+tests+docs+PR.

---

## CRITICAL RE-BASELINE (read first — changes the scope)

**Both audits were run against checkouts that predate the #166–#172 brand/fix wave merging to `main`.** Verified against `origin/main` @ `b6b48ce` on 2026-06-07:

| Audit claim (stale) | Actual state on `main` | Source |
|---|---|---|
| Favicon = serif "a" (P0-2) | **8-bit Plaino pixel-art** already shipped | `app/icon.svg` (embedded 8bit PNG), `public/favicon.svg` |
| No plaino-system assets | **Full set present** — 8bit, head-icon, heritage, poses/, reference-sheet | `public/brand/plaino-system/` (PR #169) |
| Root OG says "independent brokerage" (P0-4) | **Fixed** — "Intelligence rooted in reality" | `app/opengraph-image.tsx:103` |
| `app/icon.png` missing | **Exists** | `git ls-tree origin/main app/icon.png` |
| `LogoLockup` not built | **Component exists** | `components/brand/LogoLockup.tsx` |

**Net effect:** ~6–8 of the visual audit's P0 items are already resolved. The pride audit's *architectural* core finding ("the port exists, the adapter does not," 42 agents) is **unaffected** — brand PRs didn't touch integration seams, so that work stands in full.

**→ CONNER DECISION #1 surfaced:** the audits over-count open work. This plan resolves the *re-baselined* set, not the stale set. Wave-FINAL re-runs the pride audit against post-resolution `main` for a true delta.

**Genuinely still-open visual items (assets already exist, just unwired):**
- `PlainoAvatar` is *still* the SVG scaffold — `components/ui/ap/PlainoAvatar.tsx:8` "purely a visual scaffold… TODO: swap to `<img>`." `head-icon.png` exists; the swap was never done. (P0-5)
- `app/apple-icon.png`, maskable PWA icon, web `manifest` — all MISSING.
- Header head-icon lockup — `LogoLockup` exists but wiring into the site header unconfirmed.

---

## Scope ledger

| Source | Raw items | After re-baseline / clustering |
|---|---|---|
| Pride audit | ~363 improvement lines across 120 YAMLs | collapse into 7 functional themes (the audit itself: "not 121 improvements — ~8 adapters and a cron switch") |
| Visual audit | 52 slots (50 needing work) | ~8 already done · ~6 fleet-wireable now · ~30 need ChatGPT heritage art (wire-slot + CONNER ACTION) · rest low-priority motifs |
| **Total addressed** | **~413 actionable** | **9 themed waves + FINAL** |

The pride audit's own thesis governs sequencing: *"What turns this around is not 121 improvements. It is ~8 adapters and a cron switch."* Waves 1–3 are that thesis.

---

## Wave roadmap (dependency-sequenced)

Legend: 🟥 revolutionary · 🟧 high-impact enabler · 🟨 hygiene/activation · ⛔ external dependency

### WAVE 0 — Brand-wiring finish + audit re-baseline 🟨
**Prereq:** none. **Parallel-safe:** yes. **Fleet-resolvable:** 100%.
Original Wave-0 ("land prerequisite PRs") is **moot** — #169/#171/#170/#172/#166 are all MERGED. Redefined as: finish the wiring #169 left undone.
- Swap `PlainoAvatar` SVG scaffold → `<img>` consuming `public/brand/plaino-system/head-icon.png` (P0-5). Cold-start-safe, node:test renderToStaticMarkup safe (plain `<img>`, per `Plaino` component precedent).
- Generate `apple-icon.png` (180), maskable PWA icon, web `manifest.ts` via `tools/brand/gen-8bit.mjs` from the 8bit pose.
- Confirm/​wire header `LogoLockup` (head-icon + wordmark).
- Append re-baseline note to ledger.
**Solves:** visual P0-2 (finish), P0-5, MISSING apple/maskable/manifest, P0-1 (header).

### WAVE 1 — KEYSTONE: vertical integration adapters 🟥 ⛔
**Prereq:** none (critical path). **Parallel-safe with Wave 2/4/6.** **Fleet-resolvable to the line; live needs credentials.**
The 42-agent finding. Wire real adapters behind **existing ports**, dev fixtures, feature-flagged, ready for first onboarding:
- **Follow Up Boss** → invoice-chasing + lead-triage (real-estate, highest leverage — do first)
- **EZLynx / HawkSoft** → insurance-COI behind `PolicyLookup`
- **Encompass / LendingPad** → mortgage-chase behind `LoanFileLookup`
- **AppFolio / Buildium** → rent-collection behind `RentRollLookup`
- **SoftPro / Qualia** → title-escrow behind `ClosingFileFetcher`
- **dotloop / Skyslope** → listing-coordinator
Shares the MCP/OAuth seam (only QuickBooks runs live today: `lib/integrations/quickbooks-mcp/server.ts`) — **sequence, don't fan out**, one adapter per PR.
**Solves:** pride themes #1, #2, part of #3; ratification #1. ~17 Customer-discipline score-2 skills become live-data.
**⛔ CONNER DECISION #2:** sandbox credentials + (some) partner agreements + OAuth app registrations. Fleet builds behind flag with fixtures; live flip needs Conner. Recommend FUB first.

### WAVE 2 — Real inbox + per-message intelligence 🟧 ⛔
**Prereq:** none. **Parallel-safe with Wave 1.**
- Wire Gmail/M365 behind the fetcher seam into `chief-of-staff-scheduler` + `inbox-triage` (both default empty today).
- Per-message LLM classification replacing the 15-cue keyword classifier (use existing `LlmProvider` seam unconditionally).
- Auto-push first-touch drafts to Gmail Drafts for hot/warm leads — remove `persister:null` in `lead-triage` `run-for-event.ts`.
**Solves:** pride themes #3, #6, #10; ratification #3, #4, #5.
**⛔** Gmail/M365 OAuth scopes already partially present (Google OAuth verification branch exists) — confirm consent-screen status.

### WAVE 3 — Bounded auto-execute under $-threshold 🟥
**Prereq:** Waves 1–2 seams (needs real data/draft to act on). **Policy engine buildable in parallel.**
- `office-admin` + invoice replies + scheduling confirmations: execute pre-approved action classes below a $/risk line without owner approval (book the call, push the draft, send the reminder, cancel a trial via browser agent).
- Reuse `gateSkillFire` pattern; add a bounded-execute policy layer.
**Solves:** pride theme #5; ratification #2 — the autonomy leap from "drafts work" to "does work."
**⛔ CONNER DECISION #3:** the $/risk threshold and which action classes may fire unattended. Conner's risk tolerance is the input; fleet ships the mechanism + a conservative default.

### WAVE 4 — Compliance rewrite-and-stage 🟥 ⛔
**Prereq:** none. **Parallel-safe.**
- On a flagged match, `compliance-watch-general` + per-vertical corpora draft the **compliant replacement sentence in place**, not just a flag. Extend in `lib/agents/sentinel/` (NOT `lib/verticals/*/compliance/` — see memory).
- Counsel-feedback redline loop (learn from 5+ red-lines → embed alternative clause language).
**Solves:** pride themes #9, #14; ratification #6. No SMB compliance tool does this.
**⛔** Go-live gated on `COMPLIANCE_CORPUS_COUNSEL_REVIEWED`; build to the line, surface counsel handoff.

### WAVE 5 — Briefing/approval as control surface 🟧
**Prereq:** Wave 2 (inbox). **Parallel-safe with 3/4.**
- One-click action embedded in the daily briefing/approval card (pre-stage top pending approval).
- `GmailCloseFetcher` for `month-end-close` (auto-detect docs from client email attachments).
- Real web-search grounding behind `IResearchSubstratePort` (BrightData/Tavily).
- Daily pre-call brief cron (b2b-sales-rep).
**Solves:** pride themes #7, #8, #11, #12, #15; ratification #7, #8, #9, #10.

### WAVE 6 — Visual: heritage illustration slots 🟧 ⛔
**Prereq:** Wave 0 (asset conventions). **Parallel-safe with all code waves.**
Wire every illustration slot + ship fallbacks + commit the ChatGPT prompt + open `CONNER ACTION` for the raster:
- Homepage heritage hero + 3 home scenes · 11 vertical heroes · per-vertical OG heritage motifs (×11) · root OG heritage bg · auth welcome Plainos (sign-in/up/checkout) · in-app empty-state scenes (talk/approvals/activity/onboarding/sentinel) · about/custom/pricing/legal/inquiry motifs.
- Heritage hero can use the existing `heritage.png` from the pose sheet as an immediate fallback; net-new scenes need ChatGPT generation.
**Solves:** the visual audit's PLACEHOLDER set (25) + remaining WEAK slots.
**⛔ CONNER ACTION:** paste ChatGPT outputs (per PR #173 prompt pack) into the pre-wired slots. Fleet cannot generate final heritage illustrations — wiring + prompts + fallbacks ship; raster is Conner's paste.

### WAVE 7 — Activate dormant agents + cron wiring 🟨
**Prereq:** Waves 1–2 (activation only matters once agents have real data). **Sequence near-last.**
- Flip the daily-loop switch on charters that now have live data; wire `gateSkillFire` into every new skill caller; schema-drift auto-heal in pre-push (kill the `HUSKY=0` jailbreak).
**Solves:** pride themes #4, #19.

### WAVE 8 — Internal/org-chart honesty (decision wave) 🟨 ⛔
**Prereq:** none. Mostly a CONNER DECISION.
The audit's own guidance: Media (13) + Insights (7) + internal directors are "modeling departments we don't staff yet — they dilute the median; they can wait." Options: (a) build a real competitive-signal feed for vertical heads (#18), (b) formally mark the org-chart charters deferred, (c) leave as-is.
**⛔ CONNER DECISION #4:** activate, defer, or prune the 20+ org-chart charters? Recommend defer + one real competitive-signal feed.

### WAVE FINAL — Re-run pride audit, measure delta 🟨
Re-run the pride audit against post-resolution `main`. Target: median 1 → 3. Write a results memo: before/after median, items resolved, items blocked + the specific external blocker (credentials/counsel/partner/asset).

---

## Sequencing summary

```
Wave 0  ───────────────────────────────────────────────►  (now)
Wave 1 (adapters)  ════════════════════════►   ┐
Wave 2 (inbox)     ════════════►               │ parallel
Wave 4 (compliance)════════════►               │
Wave 6 (visual)    ════════════════════════════►  (runs throughout)
                          Wave 3 (auto-exec) ════►  (after 1+2)
                          Wave 5 (briefing)  ════►  (after 2)
                                   Wave 7 (activate) ══►  (after 1+2)
                                   Wave 8 (org decision) ══►
                                            Wave FINAL ►
```

## Fleet-resolvable vs externally-blocked

| Wave | Fleet-resolvable today | External dependency |
|---|---|---|
| 0 | 100% | — |
| 1 | adapter code + fixtures + flag | ⛔ credentials/partner/OAuth (Conner) |
| 2 | classifier + draft push | ⛔ Gmail/M365 consent screen |
| 3 | mechanism + conservative default | ⛔ threshold + action classes (Conner) |
| 4 | rewrite-and-stage logic | ⛔ counsel sign-off for go-live |
| 5 | 100% | — |
| 6 | slot wiring + prompts + fallbacks | ⛔ ChatGPT raster paste (Conner) |
| 7 | 100% (post 1–2) | — |
| 8 | competitive feed | ⛔ activate/defer call (Conner) |

## Top CONNER DECISIONS (surfaced upfront)
1. **Audits are stale-baselined** — ~8 visual P0s already shipped; plan resolves re-baselined set. Confirm before funding Wave 6 raster work.
2. **Adapter credentials & partner agreements** — which adapter first (recommend FUB), and supply sandbox creds / sign partner agreements to flip live.
3. **Bounded auto-execute $/risk threshold** — set the dollar line and unattended action classes (the autonomy leap).
4. **Org-chart charters (Media/Insights/directors)** — activate, defer, or prune the 20+ that dilute the median.

## Execution constraints (baked into every wave subagent)
- `git worktree add C:\agentplain-wave-<N> <branch>` — isolation.
- NO AskUserQuestion; blockers surface as `CONNER DECISION:`/`CONNER ACTION:` at PR top.
- NO `HUSKY=0`; use `PRISMA_GENERATE_NO_ENGINE=true` when the shared Prisma engine DLL is locked.
- Push via `.claude/worktrees/mint-fleet-token.mjs` (plain node), absolute token paths.
- PR title: `wave-<N>: <theme> — solves <X> audit items`. Body lists every resolved item by skill + improvement title.
- CI green + Vercel preview confirmed before "done."
- Cold-start-safe; adapter pattern; no silent vendor lock-in (every SDK call behind `lib/<domain>/`).
- Conner merges from mobile — orchestrator never merges.

## Live tracking
Progress ledger: `~/memory/audit_resolution_progress.md` — updated on every PR open / merge / wave completion.
