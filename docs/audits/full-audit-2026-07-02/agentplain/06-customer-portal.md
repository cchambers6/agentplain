# Audit 6/10 — Customer portal (end-client surface)

**Date:** 2026-07-02 · **Pinned:** `origin/main` @ `f928400` · **Scope:** the branded per-customer portal end-clients see (`app/portal/[customerSlug]`, `lib/portal/*`, `components/portal/*`, `/api/portal/*`), shipped by PR #299 (merged 2026-06-19).

**Method:** exhaustive read of all 24 portal files (2,381 lines) + trace of every claim through the approval core (`lib/approvals/decisions.ts`), the degraded-mode seam, the gates (`tools/brand/*-gate.mjs`), schema + migration, and a full run of the three portal test suites. **Not live-verified:** no DB credentials exist in this environment, so the mobile-375 upload lens and any browser walk ran as static analysis only — stated per-finding.

---

## Verdict

The portal's **security core is genuinely good** — and the surface around it fails its own promise in five places. Token hygiene, tenant scoping, fail-closed scanning, encryption at rest, and 100% approval-gate coverage on outgoing Plaino messages all check out. But the feature's central promise — *"nothing reaches your client without you seeing and approving exactly it"* — is broken by the edit path (owners' edits are silently discarded), and the client-side promise — *"your message/document reached the business"* — is broken by the degraded path and the default storage config. On top of that, the portal is **not activatable from the product at all** (API-only setup/invite, no case authoring anywhere), so today it is a well-built surface no customer can reach.

**Counts: 5 × P0 · 9 × P1 · 7 × P2 · 11 explicit passes.**

---

## P0 findings

### PORTAL-1 · Owner's edits to a drafted reply are silently discarded — the client receives the pre-edit text

The /approvals card for `PORTAL_CLIENT_MESSAGE` deliberately offers the draft for editing (`renderApprovalPayload.ts:1259` sets `editableBody`; the edit sheet says "Saving rewrites the drafted body"). But `editApprovalDraft` (`lib/approvals/decisions.ts:142`) rewrites only the **approval row's encrypted payload**. The text the client actually sees is `PortalMessage.body` — written once at draft time (`lib/portal/chat.ts:219-231`) and never touched again. Visibility is a passive read gated only on the approval row's *status* (`loadVisibleMessages` → `isPortalMessageVisibleToClient`); nothing re-reads the payload body, and unlike the DocuSign gate this flow never re-calls `check()` at delivery time, so even the fingerprint mismatch that edits create (payload body changes, `fingerprint` field doesn't) is never consulted.

**Failure:** owner reads Plaino's draft, fixes a wrong statement, saves, approves → the **original, unedited** message becomes visible to their client. The owner believes they sent the corrected text. This inverts the surface's entire reason to exist, on regulated verticals (law/CPA) where the edit is most likely to be a compliance fix.

**Fix shape (best, not cheapest):** make the approval payload the single source of the deliverable text — on APPROVED, materialize `PortalMessage.body` from the payload (re-encrypt), or have the read path decrypt the payload body for APPROVED messages. Add a unit test: edit → approve → `loadVisibleMessages` returns the edited text.

### PORTAL-2 · Cross-tenant / cross-client document injection via unvalidated `caseId` on upload

`POST /api/portal/[customerSlug]/upload` takes `caseId` straight from the form (`route.ts:46`) and `ingestPortalUpload` persists it unchecked (`documents.ts:101-115`) — no verification that the case belongs to this portal, let alone this client. The FK only requires that *some* `PortalCase` exists. On the read side, `getClientCase` fetches case documents with `where: { caseId: found.id, scanStatus: "CLEAN" }` (`clients.ts:87-90`) — **no `portalConfigId` or client filter**.

**Failure:** any invited client of portal A can attach files (attacker-controlled filenames included) to a case in portal B — or to another client's case in the same portal — and they'll render in the victim's document list once scanning is live. Today's default (no scanner → nothing ever turns CLEAN) keeps the display latent, but the write-layer hole exists now and the corrupted rows will surface retroactively the day `PORTAL_VIRUS_SCAN` is wired.

**Fix shape:** in the upload route, resolve the case with `{ id: caseId, portalConfigId, OR: [{clientId}, {clientId: null}] }` and 404 on miss; add `portalConfigId` to the document query in `getClientCase` as defense-in-depth.

### PORTAL-3 · Degraded mode silently drops the client's message — and shows end-clients owner-voiced "Plaino / model spend / deployment" copy

`runPortalChatTurn` checks degraded mode **before** persisting the client's message (`chat.ts:166-173`) and returns early — nothing is written. The server action then returns `{ ok: true, notice: degraded.customerNotice }` (`actions.ts:63`), and `ok: true` **clears the composer** (`PortalChatComposer.tsx:26`). The comment in `actions.ts:62` — "the client's message WAS saved" — is false on this path.

Worse, `degraded.customerNotice` is the /talk copy written for the **owner**: *"Plaino's resting right now — model spend is paused on this deployment, so I can't draft a reply yet…"* (`lib/plaino/degraded-mode.ts:159+`). End-clients don't know who Plaino is — the chat page consistently presents the counterpart as the owner's brand ("Message Daly Law", replies labeled with `brandName`). This leaks the agent persona, near-vendor vocabulary ("model spend"), and engineer vocabulary ("deployment", "workspace credential") onto the white-label surface, violating both model-vendor invisibility and the customer-vocab rule.

**Failure:** ANTHROPIC key paused (the historically common state) → a client types a question to their lawyer, the box clears, a message about a robot resting appears, and the question is gone forever. Nobody is ever told.

**Fix shape:** persist the CLIENT message *before* the degraded check (their message needs no LLM); skip only the draft step when degraded; give the portal its own brand-voiced notice ("{brandName} has your message and will reply here") — never reuse /talk's owner-facing copy on the end-client surface.

### PORTAL-4 · Client messages have no owner-facing surface — blind approvals, and orphaned messages when drafting fails

There is no owner UI (or API) that lists portal threads or client messages — `grep` confirms nothing outside `lib/portal/chat.ts` ever reads `PortalMessage`. The owner's only window is the approval card, whose payload carries **only Plaino's draft + recipient** (`owner-approval-gate-prisma.ts:44-52`) — not the client's question. So:

- **Every approval is blind.** The owner approves a reply without being able to see what the client asked. For the surface whose premise is informed sign-off, the decision is structurally uninformed.
- **When drafting fails** (LLM error, provider hiccup — `draftReply` returns null on any failure), no approval row is created at all. The client's message sits in a table no human can see, while the client is told *"Thanks — {brandName} has your message and will follow up with you here shortly"* (`chat.ts:199-200`). That promise has no mechanism behind it.

**Fix shape:** include the client's latest message (and short thread tail) in the approval payload + card; add a minimal owner thread view (or route DRAFT_FAILED turns into a `WorkApprovalQueueItem` of an "needs your reply" kind so the queue is the guaranteed catch-all).

### PORTAL-5 · On today's default config, uploaded documents' bytes are discarded while the UI promises safekeeping

Default storage is `RefStorage`: it computes a hash and **persists nothing** (`storage.ts:48-57`). Default scanner is none. The upload UX tells the client: *"Received — we're checking your document and it'll appear here once it clears"* (`DocUpload.tsx:45`). With defaults, it will never clear, never appear, and — decisively — **the bytes no longer exist anywhere**, so wiring blob storage later cannot recover documents clients already "shared" with their CPA/lawyer.

The TODOS-FOR-CONNER item frames this as "records uploads, keeps them quarantined" — the quarantine posture is real and correct, but "records" is only a metadata row; the framing doesn't cover the byte loss or the copy that tells the client the document was received. A client who uploads a W-2 believes the business has it; the business never will.

**Fix shape (pick one, both honest):** (a) gate the upload UI on `durable` storage being configured — show "document sharing isn't enabled yet" instead of accepting bytes we discard; or (b) ship blob storage as a prerequisite of enabling any portal. Never accept-and-discard behind "received."

---

## P1 findings

### PORTAL-6 · The portal cannot be activated from the product — setup and invites are raw API calls
`POST /api/portal/setup` and `POST /api/portal/invite` have **zero callers** in the codebase (no settings screen, no button). The TODO parks "Owner setup UI" as *(Optional)* — it is not optional; it is the adoption gate. As shipped, portal activation requires the owner (or an operator) to hand-craft authenticated JSON requests. Effective reachable-customer count: 0.

### PORTAL-7 · Nothing anywhere creates `PortalCase` or `PortalCaseEvent` — the status surface is dead code
No route, action, skill, seed, or script writes cases or events (repo-wide grep). `listClientCases` always returns `[]`; the status/timeline page — the headline "status page per case/matter/property/tenant" — is unreachable end-to-end. The portal in practice reduces to chat + (byte-discarding) upload.

### PORTAL-8 · Unassigned cases are visible to every client in the portal
`listClientCases`/`getClientCase` match `OR: [{ clientId }, { clientId: null }]` (`clients.ts:57,75`). Any case created before invite-linking is visible — title, reference, full event timeline, documents — to **all** clients of that portal. For a law/CPA portal, another client's matter title alone is a confidentiality breach. Comment calls it deliberate; the design is unsafe at exactly the moment it activates (multi-client portal + pre-linked cases). Require explicit linking, or a per-case `shared` flag.

### PORTAL-9 · Portal unit test fails on `origin/main` — and no CI workflow runs the portal suites
`tests/portal-units.test.ts` "rejects a non-hex brand color" expects fallback `#B65D3A`; Heritage (#316) retuned `PortalShell.sanitizeColor` to `#B85540`. Run result: **24/25 pass, 1 fail on pinned main.** It hides because CI runs only `auth-tests`, `connector-dispatch-coverage`, and nightly e2e — no workflow executes `tests/portal-*.test.ts`. Fix the assertion to the canonical token and wire the portal suites into CI.

### PORTAL-10 · Voice-gate never scans the portal — end-client copy and the invite email are ungated
`voice-gate.mjs` scans `app/(marketing)`, `app/(product)`, `components/`, `lib/verticals`, `lib/plaino`, plus a hand-kept 6-file email list. `app/portal/**` and `lib/portal/**` (including the invite email HTML in `invite.ts`) are absent. Components sneak in via `components/`, but the pages and the only email an end-client ever gets from us are unscanned. Same root cause as the weekly-BI audit's gate-gap finding: hand-maintained surface lists. The end-client register ("Plaino speaks differently to end-clients") has no gate at all today.

### PORTAL-11 · No audit rows for invite sends, uploads, or client messages
Approve/reject/edit are audited via `decideApproval`/`editApprovalDraft` ✓ (so the *release* of each Plaino message has an audit row — the spec's "audit log every send" passes for outbound). But invite emails (an outbound send to a third party), document ingestion, and inbound client messages write no `AuditLog`. For a surface handling third-party PII in regulated verticals, all three belong in the trail.

### PORTAL-12 · Magic-link invites are consumed on GET — corporate email scanners will burn them before the human clicks
`/api/portal/[slug]/enter` consumes the single-use token on a bare GET (`enter/route.ts:43`). Outlook SafeLinks / Gmail prefetch / security appliances follow GET links; the real user then lands on "invite=expired". This is the classic magic-link footgun — the fix is an interstitial page with a "Continue" button that POSTs the consumption.

### PORTAL-13 · No rate limiting on portal chat or uploads
Every client message triggers an LLM call on the owner's account (`chat.ts:277`) with no throttle; uploads accept unlimited 25 MB bodies. An invited end-client (or anyone holding a session) can burn spend/storage mechanically. All other LLM surfaces sit behind owner auth; this is the only third-party-triggerable one. Add per-session and per-portal rate limits.

### PORTAL-14 · Upload control likely unreadable; iOS focus-zoom on inputs (mobile-375 lens — static-only)
`DocUpload.tsx:60-65`: the file input styles the pseudo-button with `file:text-white` but sets **no** `file:bg-*` — the `--file-bg` custom property is defined and never consumed. "Choose File" renders white-on-OS-default-light on desktop and iOS. Also `text-sm` (14px) inputs/textareas trigger iOS Safari's focus zoom, and portal buttons are ~36px tall vs the 44px target the app's own approvals surface uses. **Not live-verified** (no DB env available); the missing `file:bg` is deterministic from the class list.

---

## P2 findings

1. **Dead `?invite=expired|missing` params** — `enter` sets them; the portal home never reads them. Expired-invite handling is graceful only via the generic signed-out copy ("Didn't get a link, or has it expired?"). Render a specific notice.
2. **`PortalMessage.deliveryStatus` never flips after decision** — stays `PENDING_APPROVAL` forever post-approve (and `REJECTED` is never written). Schema comment admits it's denormalized; today nothing reads it, i.e. it's drift waiting for its first consumer.
3. **Pre-Heritage clay in inline fallbacks** — `page.tsx:47` and `status/[caseId]/page.tsx:60` use `var(--portal-accent, #B65D3A)`; canonical clay is `#B85540`. Fallback never fires (shell always sets the var) — consistency fix alongside PORTAL-9.
4. **CLEAN documents render with no link** — `DocumentList` shows filename + "Ready" but never an anchor, and the owner has no document surface either; once storage+scanner are live, "Ready" documents are still unopenable by anyone. (Kept P2 only because PORTAL-5/6/7 gate it today.)
5. **Vercel Blob adapter uses `access: "public"`** — when blob storage is enabled, document URLs become unauthenticated-by-URL (random suffix only). Fine for a launch posture; wrong for law/CPA docs long-term — plan signed/short-lived URLs before enabling.
6. **`consumePortalInvite` TOCTOU** — findFirst-then-update lets two concurrent requests both consume one invite (two sessions from one link). Use an atomic `updateMany({ where: { consumedAt: null } })` count check.
7. **Case-scoped chat unused** — `ensurePortalThread` supports `caseId` but the chat page always passes null; the case page links to the generic thread. Fine for V1; noted so the schema affordance doesn't rot.

---

## What passes (verified, not assumed)

| Lens | Verdict |
|---|---|
| Owner PII never exposed to end-clients | **PASS** — every client-facing read returns only `PortalBrand` + the client's own rows; `PortalContext.signedIn` carries client identity only; no owner User/email/workspace internals on any portal payload. |
| Cross-tenant read isolation | **PASS** — every `lib/portal` query is `portalConfigId`-scoped; sessions/invites resolve only within their portal; cookie from portal A cannot resolve against portal B. (Write-side exception = PORTAL-2.) |
| Approval-gate coverage on outgoing | **PASS (100%)** — `chat.ts` is the only `PortalMessage` writer; every PLAINO write flows through `gate.check()`; gate never auto-approves; fresh drafts cannot short-circuit to DELIVERED (approved-row reuse requires a presented token). |
| Visibility invariant | **PASS** — client visibility decided against the approval row's **live** status (`isPortalMessageVisibleToClient`), single-sourced, so a drifted `deliveryStatus` can't leak an unapproved message. Reject → never visible. |
| Token & session hygiene | **PASS** — sha256-only at rest for invites and sessions, single-use invites with TTL, revocable sessions, httpOnly/secure/lax cookie, Max-Age set on the redirect response per the Next-14 fix. |
| Fail-closed virus scanning | **PASS (design)** — PENDING at rest; CLEAN requires real scanner verdict AND durable storage; unparseable scanner output → ERROR, never CLEAN. Good port + tests. |
| Encryption at rest | **PASS** — message bodies AES-256-GCM, approval payloads encrypted, decode degrades to placeholder instead of crashing. |
| Heritage Plains + owner-brand overrides | **PASS** — paper/ink/rule/font-display tokens with a sanitized per-owner accent (`--portal-accent`); hex-only validation blocks CSS injection (unit-tested). Quiet "Secured by agentplain" footer. |
| Model-vendor invisible | **PASS with one hole** — no vendor names anywhere on the surface; draft prompt forbids AI/vendor mention; the hole is the degraded notice (PORTAL-3). |
| Empty states | **PASS** — home ("{brand} will add your work as it gets going"), timeline ("You'll see progress here as it happens"), chat, and documents all have warm brand-voiced empties. |
| Search-engine posture | **PASS** — `robots: noindex, nofollow` on the whole portal. |

---

## Spend

Fable 5, single session, no subagent fan-out (surface small enough to read exhaustively): roughly **~180k tokens** (≈150k in / ≈30k out) across worktree setup, 24-file read, cross-seam traces, test runs, and deliverables.
