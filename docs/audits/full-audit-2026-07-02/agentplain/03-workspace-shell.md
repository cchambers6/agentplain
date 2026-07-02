# Audit 3/10 — Workspace shell + 5-tab IA

- **Date:** 2026-07-02
- **Pinned ref:** `origin/main` @ `f928400` (merge of #316, Heritage Plains direction)
- **Worktree:** `C:\agentplain-wt-audit-3` (isolated, node_modules junctioned from main tree)
- **Scope:** Workspace shell (`app/(product)/app/workspace/[id]/layout.tsx`), 5-tab IA (Today / Plaino / Connections / Reports / Account), post-signin landing, nav chrome, empty/loading/error states, backward-compat redirects.
- **Method:** 5 parallel read-only code-audit passes (tab pages + states, redirects, nav chrome + touch targets, dead-link sweep, degraded-mode + persona + vendor invisibility), each load-bearing finding re-verified by hand against source before inclusion. One agent-reported P0 was disproven on verification and is documented in §5. Automated gates run in the worktree: voice-gate, brand-gate, `tsc --noEmit`, `next build`.

## 1. Verdict against the audit criteria

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | All 5 tabs render without errors | **PASS** | `tsc --noEmit` clean; `next build` compiles all workspace routes; every tab page null-guards its DB reads; all 5 tabs have designed empty states for a zero-data workspace. One hardening gap: `settings/page.tsx:46` silent `return null` (F3). |
| 2 | Old-tab URLs redirect correctly (301) | **PASS** (as 308) | `next.config.mjs:26–47`: `/help` → `/support/new`, `/fleet` → workspace root, both `permanent: true` = HTTP 308 (the modern 301 equivalent; method-preserving, cacheable). All other pre-collapse routes still render by design (Phase A phased migration) and each is reachable from its new hub — none orphaned. |
| 3 | Sidebar responsive on mobile (drawer) | **PASS with note** | There is no sidebar and no drawer by design: the shell is a top strip (`ApAppShell.tsx:88–111`) that stacks vertically below `md:` and gives the tab row `overflow-x-auto whitespace-nowrap scrollbar-thin`. At 375px the 5 tabs fit or scroll horizontally with no clipping. The criterion's "drawer" expectation does not match the shipped pattern; the shipped pattern is responsive and acceptable. |
| 4 | Touch targets 44×44 min | **FAIL** | Nav tabs, sign-out, and header links are unpadded small-text links (~15–20px effective height). See F4 — the one criterion that fails outright. |
| 5 | Heritage Plains styling | **PASS** | Shell chrome uses brand tokens exclusively (`bg-paper`/`bg-paper-deep`, `text-ink`, `border-rule`, `decoration-clay`); zero raw Tailwind grays in shell files; monospace eyebrows (`font-mono text-[11px] tracking-eyebrow uppercase`) on slug, header rail, footer; paper-grain via `--paper-grain` (globals.css:40–57). |
| 6 | Voice-gate on all copy | **PASS** | `npm run voice-gate` OK (0 new). All-mode scan: 30 total violations repo-wide, **0 on workspace or plaino files**. |
| 7 | Degraded-mode "Plaino's resting" banner per #276 | **PASS** | `checkDegradedMode()` (env-only) in `layout.tsx:95,152–159` renders `PlainoRestingBanner variant="strip"` on every workspace page; /talk's `variant="notice"` is complementary, not a double-render. Sleeping pose asset exists (`public/brand/plaino-system/poses/resting.png`; `PlainoStatus` maps `sleep → resting`). `operatorNotice` gated by `isOperator && Boolean(operatorNotice)` — cannot leak. All four trigger conditions covered (forced flag, missing ENCRYPTION_KEY, missing ANTHROPIC_API_KEY, PAUSED sentinel). Customer copy verified vendor-free for all four. |
| 8 | Model-vendor invisible | **PASS** | No vendor/model names in workspace JSX, aria-labels, alt text, or error copy. Vendor references exist only code-internally (`lib/env.ts`, `ratesForModel("claude-sonnet-4-5")` in `UsagePanel.tsx:60` for pricing math) and in operator-only `opsSummary` strings (`lib/plaino/turn-failure.ts` — brand-gate R1 baseline-accepted, never rendered to customers). Usage dashboard labels by agent role ("Plaino chat", "Reply drafter"), not by model. |
| 9 | Loading states use Plaino persona | **PASS with 2 gaps** | 28 `loading.tsx` files under the workspace, all `ApRootedLoader` (hairline-strip paper loader, contextual copy — e.g. "Opening your thread with Plaino…", "Tallying what Plaino did for you…"). No generic spinners anywhere. Gaps: the Connections and Reports **hub pages** — 2 of the 5 primary tabs — have no `loading.tsx` at all (F1, F2). |
| 10 | No dead links between tabs | **PASS** | Exhaustive sweep: 48 distinct internal link targets from the workspace surface (incl. layout banner links, `reconnectPath` from `lib/integrations/health-banner.ts`, hub grids, vertical-conditional links) — all resolve to existing pages/dynamic routes. `/fleet` appears only in the passive `match` array (tab-lighting), never as a link. |

**Post-signin landing (scope item):** correct. `app/(product)/app/verify/route.ts:82–99` — onboarding incomplete → `/onboarding`; complete → workspace root (Today); no default workspace → `/app` picker.

## 2. Findings — P1 (no P0s)

### F1 — Connections tab has no loading state (P1)
`app/(product)/app/workspace/[id]/connections/page.tsx` (server component, 2 awaited DB reads) has no sibling `loading.tsx`. Clicking the Connections tab gives zero pending feedback until the queries resolve — the previous page just sits there, and a hard load streams nothing for the segment. Every other primary tab (Today, Plaino, Account) ships `ApRootedLoader` with contextual copy; its own sub-pages (`/integrations`, `/marketplace`) have loaders while the hub above them does not. Fix: add `connections/loading.tsx` with `ApRootedLoader` (e.g. "Reading your connected tools…").

### F2 — Reports tab has no loading state (P1)
Same defect: `reports/page.tsx` (awaits `complianceFlag.count`) has no `loading.tsx`, while its child `reports/weekly/` does ("Tallying what Plaino did for you…"). Fix: add `reports/loading.tsx` with `ApRootedLoader`.

### F3 — Account tab renders fully blank if the workspace read misses (P1)
`app/(product)/app/workspace/[id]/settings/page.tsx:46` — `if (!workspace) return null;`. A null here (deleted-mid-request race, RLS misconfiguration) renders a blank content area and **bypasses** the segment's `error.tsx` (which has good customer copy: "we hit a snag · This view didn't load. The rest of your workspace is fine…"). Fix: `notFound()` or throw so the existing boundary renders. (The same pattern in `layout.tsx:40–42` is defensible — `requireWorkspaceMember` already redirects — but the settings page duplicates the read without that guarantee.)

### F4 — Shell chrome touch targets below 44×44 minimum (P1)
Interactive elements in the shell are unpadded small-text links:

| Element | File | Est. height | 44px | 24px (WCAG 2.5.8 AA) |
|---|---|---|---|---|
| 5 nav tab links | `WorkspaceNavLink.tsx:49–53` (`text-sm`, no `py-*`) | ~20px | FAIL | FAIL |
| Sign-out button | `layout.tsx:124–129` | ~15px | FAIL | FAIL |
| Operator link | `layout.tsx:115–121` | ~15px | FAIL | FAIL |
| Banner inline links (billing/usage/reconnect) | `layout.tsx:182–291` | ~18px | FAIL | FAIL |
| Passkey-nudge CTA | `PasskeyEnrollNudge.tsx:150` (`py-2`) | ~32px | FAIL | PASS |
| Passkey "not now"/"don't show again" | `PasskeyEnrollNudge.tsx:158,165` | ~15px | FAIL | FAIL |
| Tour primary button | `WelcomeTour.tsx` via `ApHeritageButton` | ~38px | FAIL | PASS |
| Tour back/skip links | `WelcomeTour.tsx:312–320` | ~18px | FAIL | FAIL |

The primary nav — the most-tapped controls in the product — fails even the 24px AA floor. Fix is additive padding (`py-2.5` on nav links brings them to ~40–44px; the strip already has `pb-3` slack), plus padded hit areas on the header rail and nudge/tour secondary actions. No layout rework needed.

## 3. Findings — P2 (polish, not queued to INBOX)

- **P2a** `WelcomeTour.tsx:231` — `aria-modal="false"` is invalid ARIA usage; omit the attribute on a non-modal spotlight dialog.
- **P2b** `WorkspaceNavLink.tsx:51` — active-state class suppresses the global clay focus outline (`focus:outline-none`) leaving only a color change; inconsistent with the rest of the app's focus treatment.
- **P2c** `PasskeyEnrollNudge` container uses `role="region"`; `role="status" aria-live="polite"` would match the other shell banners.
- **P2d** `app/(operator)/operator/support/page.tsx:8` — comment still references retired `/app/workspace/[id]/help`.
- **P2e** Brand-gate baseline violations sitting on workspace surfaces (all baseline-accepted, not new): R3 rounded/shadow drift at `approvals/ApprovalCard.tsx:100` and `disciplines/page.tsx:257,312,320` (deliberate `rounded-full` toggle switches), R1 vendor names in `lib/plaino/turn-failure.ts` `opsSummary` strings (operator-only). Worth either allowlisting explicitly or restyling so the baseline can shrink.
- **P2f** Spec/implementation drift: audit criteria (and possibly the IA spec) expect a mobile **drawer**; the shipped shell is a horizontally-scrolling top tab strip. Functionally fine — but the canonical expectation should be updated so future audits don't re-flag it.

## 4. Gate + build results

| Check | Result |
|---|---|
| `npm run voice-gate` (ratchet) | OK — 30 baseline, 0 new; 0 baseline items on workspace surface |
| `npm run brand-gate` (ratchet) | OK — 11 baseline, 0 new; 10 of 11 baseline items on workspace/plaino files (see P2e) |
| `tsc --noEmit` | clean |
| `next build` (against pre-generated Prisma client) | compiles; `prisma generate` itself EPERMs on the shared node_modules junction (known worktree limitation, not a product defect) |

## 5. Discarded finding (false positive)

An audit pass reported a P0 that the Today tab never activates at the workspace root, reading `WorkspaceNavLink`'s `exact` branch as comparing `pathname === ""`. Verified false: `layout.tsx:135` passes `href={base + item.href}` — the full `/app/workspace/{id}` path — so the exact comparison matches at the root. Active-state logic, including the absorbed-route `match` arrays, is correct.

## 6. Summary

The shell is in strong shape: the 5-tab IA is a single source of truth (`lib/workspace/nav.ts`) faithfully rendered, backward-compat is complete with permanent redirects and zero orphans, the degraded-mode banner is universal and leak-proof, brand voice and Heritage Plains tokens hold across the chrome, no vendor names reach customers, and there are no dead links. The defect cluster is small and mechanical: **0 P0, 4 P1** — two missing hub loading states, one silent-null blank page, and shell-wide sub-44px touch targets. All four are additive fixes with no architectural risk.

## 7. Spend

~570k tokens total this audit: 5 parallel audit subagents ≈ 380k, main-session verification + gates + build + synthesis ≈ 190k. Wall-clock ≈ 35 min.
