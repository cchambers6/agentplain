# Audit 4/10 — Approvals queue + Plaino chat

**Date:** 2026-07-02
**Pinned to:** `origin/main` @ `f928400` (post-#320 Heritage rollout, post-#321 plan)
**Scope:** The two trust-lives-here surfaces — the customer approvals queue and Plaino chat — plus the approval-gate seam on outgoing connector writes.
**Method:** Static code audit in an isolated worktree (`C:\agentplain-wt-audit-4`). Four parallel exploration passes (queue surface, chat surface, gate coverage, brand/voice/mobile), every load-bearing claim re-verified by hand against source. No fixes applied, no prod touched.

---

## Verdict

**Both surfaces are structurally sound. Zero P0s.** Approval-gate coverage on mutating connector actions is 100% at the factory seam — including DocuSign, despite a stale smoke test that claims otherwise. Chat retention defaults to account lifetime as ratified. Vendor names never reach a customer. Heritage tokens are used throughout, primary touch targets meet 44px.

The gaps are around the edges of trust, not the core: most approval-creation paths never notify anyone, the queue silently truncates at 50, the web reject flow can't capture *why* (so the learning loop starves on the primary surface), and one test + two comments/copy strings assert things about the product that are no longer true.

**5 × P1, 5 × P2. Score for these surfaces: 4/5** — the draft→decide→audit spine is genuinely well built; the notification and scale edges keep it from a 5.

---

## Verify checklist (from the audit mandate)

| Check | Result | Evidence |
|---|---|---|
| Approval-gate coverage 100% on mutating actions | **PASS** (with one stale-test caveat, F-4) | All 10 connectors wrap mutations at the factory seam; see coverage table below |
| Voice-gate on all copy, Plaino persona in chat | **PASS** | 0 new voice-gate violations on either surface; per-vertical persona in `lib/plaino/vertical-voice.ts` |
| Model-vendor invisible | **PASS** | No vendor names in customer copy; identity-deflection block in both system prompts; ban enforced by `lib/plaino/degraded-mode.test.ts:162` |
| Heritage Plains styling | **PASS** | Both surfaces use brand tokens exclusively (`bg-paper`/`text-ink`/`border-rule`/`clay`/`moss`); zero hardcoded hexes found |
| Mobile: approve/reject touch targets 44×44 | **PASS** | Approve/edit/reject/feedback all `min-h-[44px]` or larger (`ApprovalsList.tsx:554–581`); filter/sort chips are 36px but secondary (note N-1) |
| Chat retention default = account-lifetime (#311) | **PASS** | `lib/plaino/chat-retention.ts` — null retention = never expired; cleanup cron deletes opt-in windows only. One stale comment contradicts this (F-9) |
| Data-minimization framing visible in this surface | **FAIL** | Neither surface references the two-bucket story or `ConnectStorageDisclosure` (F-5) |
| Notifications when new work lands | **PARTIAL** | Push exists but fires on one creation path out of ~8 (F-1) |
| Audit log per approve/reject | **PASS** | `work_approval.approved/rejected/edited` + `draft_feedback.captured` in `lib/approvals/decisions.ts:104–113,180–189,274–283`; post-approval connector writes logged via `lib/integrations/approval/audit.ts` |
| Empty state | **PASS** | "Nothing waiting on you." + Plaino herding copy (`approvals/page.tsx:69–73`); chat has per-vertical empty state with example asks |
| Full state (100+ pending) | **FAIL** | Hard `take: 50`, no count, no pagination; oldest items become invisible (F-2) |

---

## P1 findings

### F-1 · Most approval-creation paths never notify anyone
Push notification infrastructure exists and is well built (`lib/push/notify.ts` — `notifyApprovalQueued`, resolves ACTIVE BROKER_OWNERs, "New approval ready" copy, taps route to the approvals tab). But it fires from exactly one place: `persistSkillRunArtifacts` (`lib/skills/persist-artifacts.ts:184–188`), which is called only from the webhook-event pipeline (`lib/inngest/functions/process-webhook-event.ts:317`).

Paths that create `WorkApprovalQueueItem` rows **silently** (verified: no push import in any of them):
- ~15 per-skill `prisma-approval-sink.ts` files used by cron sweeps (invoice-chase, follow-up-chaser, finance-pulse, compliance-watch, month-end-close, lead-triage, law-intake, home-services, rent-collection, analytics-pulse, content-calendar, process-doc, support-handler…)
- The connector write gate (`lib/integrations/approval/approval-gate-prisma.ts` — `CONNECTOR_WRITE_ACTION`, the highest-stakes kind)
- The DocuSign gate (`lib/integrations/docusign-mcp/approval-gate-prisma.ts`)
- Voice transcript action items (`lib/voice/transcript-actions.ts`)
- Chat-originated drafts and instructions (`lib/plaino/prisma-chat-store.ts`)
- Portal client messages (`lib/portal/owner-approval-gate-prisma.ts`)

Impact: an agent attempts a CRM write, gets `APPROVAL_REQUIRED`, queues the item — and the work stalls until the owner happens to open the app. The product promise ("7am push → tap approve") holds for inbox-triage-style runs only. The fix shape is small: the push trigger is already post-commit, best-effort, and self-contained; it wants to be called from the gate and sink seams too (or centralized on queue-item creation).

### F-2 · Queue truncates at 50 with no signal, and it's the *oldest* items that vanish
`approvals/page.tsx:30–36`: `findMany({ where: PENDING, orderBy: proposedAt desc, take: 50 })`. No total count is queried, there is no pagination or "N more" affordance (web and mobile both — mobile route caps at 50 too). Because the sort is newest-first, at 100+ pending the items that fall off the bottom are the oldest — exactly the ones most at risk of going stale. A backed-up week (vacation + active fleet) makes older drafts unreachable and invisible: the customer can't act on them, can't see that they exist, and nothing expires them (see F-10). Minimum fix: query the count, show "50 of 214 — oldest first" and flip default sort or add a pager.

### F-3 · Web reject can't capture a reason, so the learning loop starves on the primary surface
The mobile reject API accepts `{ reason }` (max 2000 chars) and `decideApproval` feeds any non-empty reason into `captureDraftRejectSignal` — the preference-learning loop (`lib/approvals/decisions.ts:116–128`). The web reject confirm (`ApprovalsList.tsx:505–524`) has no reason field at all — just "Reject this draft? / keep it". Every web rejection lands with `decisionReason: null`: the customer can't say *why*, Plaino never learns, and the audit trail records a bare rejection. This also contradicts the queue's own feedback philosophy ("Doesn't sound like us" exists precisely to capture the why). Fix shape: an optional "tell Plaino why (optional)" textarea in the existing `ApHeritageConfirm`.

### F-4 · Wave-2 smoke test pins DocuSign send/void as UNGATED — production is gated; the pin is stale and actively misleading
`lib/integrations/__tests__/marketplace-smoke-wave2.test.ts:170–195` declares `send_envelope` + `void_envelope` as `ungatedWrites` with a "KNOWN GAP … their arg schemas have no token field and the server fires immediately" comment. All three claims are now false on main:
- Both tool schemas carry `pendingApprovalId` (`docusign-mcp/tools.ts:43,54`)
- Both methods gate through `gate.check()` in `GatedDocuSignMcpServer` (`with-approval.ts:197–217`)
- The factory wraps *both* prod and test servers — "it is impossible to obtain an ungated DocuSign server" (`docusign-mcp/index.ts:24–35`) — and the HTTP route builds through the factory (`app/api/integrations/docusign-mcp/[workspaceId]/route.ts:22`)

The smoke test only sees ungated behavior because it constructs raw inner servers directly (`buildTest: (id) => new TestDocuSignMcpServer(...)`, test line 160), bypassing the factory. So the fleet's coverage test asserts the *opposite* of production truth on the highest-stakes connector. It misled one of this audit's own exploration passes into reporting a P0 gate hole. Fix: build via `buildDocuSignMcpServer` with the in-memory gate override the factory already accepts, move send/void to `gatedWrites`, delete the KNOWN GAP comment.

### F-5 · Data-minimization framing is absent from both surfaces
Neither the approvals queue nor Plaino chat carries any of the two-bucket data story (`lib/marketing/data-commitments.ts`, `ConnectStorageDisclosure` — both exist, both unused here). Chat is the one surface where the customer's own words are stored for account lifetime, and it says nothing about that (the storage story lives two tabs away at `/settings/data/storage`). The approvals card for `CONNECTOR_WRITE_ACTION` is the natural home for the pass-through breadcrumb ("we read this in-flight; your system of record is what stores it") and doesn't show it. The approvals header *does* carry the adjacent trust line ("Nothing leaves agentplain on its own") — the storage half of the story is just missing. This was an explicit verify item for this audit and it fails.

---

## P2 findings (report-only, not filed to INBOX)

### F-6 · Approvals header promises "the threshold you set" — customers can't set one
`approvals/page.tsx:53–58`: "Routine, low-stakes work clears in a quieter lane; anything above the threshold you set waits here for your yes." Auto-execute is controlled by `BOUNDED_AUTO_EXECUTE_MASTER` (env, fail-closed OFF) plus per-class `AUTO_EXEC_*` OpsFlags (`lib/skills/bounded-execute.ts:69–75`) — operator-controlled, no customer-facing threshold control exists. Truth-Wave class copy drift: either soften the copy ("the thresholds we agree with you") or ship the setting.

### F-9 · Cleanup cron self-describes with the banned framing
`lib/inngest/functions/conversation-cleanup.ts:5–7`: "chat is session-scoped by default and only kept longer when the customer opts in." That is the exact framing ratified out in the two-bucket correction (default is account-lifetime; deletion is the opt-in). The *code* is correct — null retention deletes nothing — but the enforcement arm's own header states the pre-correction policy and will steer a future editor wrong. One-line comment fix.

### F-10 · Pending items never expire and never escalate
Only the DocuSign/connector *grants* carry a 24h TTL (checked at use time). A PENDING queue item of any kind sits forever: no SLA, no "overdue" badge, no expiry to `EXPIRED`, no escalation past `requiredApproverUserId` (the Wave-6 field exists in the schema but the queue query doesn't filter or route on it — `approvals/page.tsx:31–35` shows everything to any BROKER_OWNER). Compounds with F-1 (nobody was told) and F-2 (past 50, nobody can see it).

### F-11 · Batch mode is approve-only
No batch-reject. Defensible bias (bulk-reject invites carelessness less than bulk-approve does — and the eligibility rails on batch-approve are genuinely good: stakes-kinds excluded, low-confidence excluded, `lib/approvals/presentation.ts:172–185`). Noting it because a spam-burst of bad drafts currently means N taps × confirm each.

### F-12 · No operator-side approvals view
All approval surfaces are customer-facing. An operator diagnosing "why didn't this send" has no queue view short of the database. Low urgency; worth a line in the operator-console backlog.

---

## Notes (not defects)

- **N-1** Filter/sort chips are `min-h-[36px]` (`ApprovalsList.tsx:642,670`) — secondary controls, acceptable under WCAG target-size guidance; primaries all clear 44px.
- **N-2** The 11 pre-existing brand-gate R1 "Anthropic" hits in `lib/plaino/turn-failure.ts` are internal ops/Sentry copy, never customer-rendered; known main debt, unchanged by anything in scope.
- **N-3** Batch approve loops `decideApproval` per item and skips already-decided rows — race-safe by construction (`approvals/actions.ts:35–64`).

---

## What's healthy (verified, worth protecting)

- **The gate seam pattern held.** All 10 connectors (DocuSign, HubSpot, Salesforce, Notion, FUB, Sierra, Buildium, Gmail, Google Calendar, QuickBooks) wrap mutating actions at the factory; SHA-256 fingerprint binds each grant to the exact payload; 24h TTL; `CONNECTOR_WRITE_ACTION` is hard-excluded from the bounded auto-execute allowlist, so a connector mutation can never auto-fire regardless of OpsFlags.
- **Chat retention matches the ratified positioning.** Null = account lifetime, opt-in finite windows only, cleanup cron enforces exactly that, AES-256-GCM at rest, RLS-scoped threads.
- **Degraded mode is honest and vendor-neutral on every path** — four distinct causes, four customer notices, composer disabled with calm copy, ban enforced by tests.
- **Audit trail is complete for decisions**: approve, reject, edit, and feedback each write an `AuditLog` row; post-approval connector writes log connector/action/outcome/fingerprint.
- **The queue UX has real care in it**: confidence chips, urgency sort, discipline filters, swipe gestures with 44px targets, first-draft coach on the `?focus=` deep link, "Doesn't sound like us" feedback that doesn't burn the draft.

---

## INBOX items filed

5 × P1 (F-1 … F-5), tagged `audit-2026-07-02 agentplain approvals-chat severity:P1`, appended to `~/.claude/projects/C--agentplain/memory/INBOX.md`. No P0s.

## Spend

Four exploration subagents (~375k subagent tokens) + main-loop verification. Estimated total ~$35–45 of Fable-class usage for this audit.
