# Audit 2/10 — Auth, Passkey & Session

**Date:** 2026-07-02
**Scope:** signup · signin · passkey enrollment + login · magic-link · email verification · sign-out · session persistence (30-day remember-me) · multi-device · account settings · delete account
**Pinned to:** `origin/main` @ `f928400` (worktree `C:\agentplain-wt-audit-2`)
**Method:** 4 read-only sub-audits (session / passkey / signup+magic-link / PII+settings) + voice-gate + brand-gate + live preview walk of `/app/sign-in` at 375px.

---

## Verdict

**No P0.** The auth layer is cryptographically sound and the three headline prior fixes (PR #270 cookie-on-redirect, PR #171 rpId, PR #268 WebAuthn hints) are all present and verified. There is **no unauthenticated PII leak** across all 83 API routes and **no IDOR** — every workspace-scoped route re-verifies membership. Token hygiene, enumeration resistance, and provider gating are all solid.

The real gaps are **architectural, not broken**: the stateless sealed-cookie session model has **no revocation path** (sign-out, operator-demotion, and lost-device all leave a valid credential live for up to 30 days), there is **zero inbound rate limiting** on any auth endpoint, magic links are **GET-consumable** (email-scanner prefetch burns them), and passkey **userVerification is never required**. One copy claim ("delete everything we hold") **overclaims** vs. the mechanism.

**Counts: 7 P1 · 11 P2.** (Plus 1 connector-adjacent P1 — DocuSign webhook fail-open — cross-referenced to audit 5.)

---

## P1 findings

### P1-1 — Sign-out does not invalidate the session; a stolen seal stays valid up to 30 days
`lib/auth/session.ts:1-8` states the design: *"There is NO Prisma Session row — the sealed cookie IS the session record."* `clearSession()` (`session.ts:122-128`) only overwrites the **client's** cookie (`maxAge: 0`); the sealed token itself remains cryptographically valid until its embedded iron-session TTL (30 days). `signOutAction` (`app/(product)/app/actions.ts:341-344`) calls only `clearSession()` + redirect — no server-side invalidation, because none is possible in this model.

This is not academic: the **same seal** is handed to mobile clients as a bearer credential (`lib/auth/mobile-session.ts:11-15` — *"A compromised seal is identical in blast radius to a stolen web cookie"*), and there is **no revocation path short of rotating `SESSION_PASSWORD`** (which is a global logout of every user). Notably the **portal** got this right — `lib/portal/identity.ts:143-156` `revokePortalSession()` stamps `revokedAt` on a DB-backed `PortalSession` row; the main app has no equivalent.
**Fix (best, not cheap):** introduce a server-side session/`tokenVersion` record (or a `sessionId` claim checked against a revocation list / per-user version counter) so sign-out, device-loss, and credential compromise have a real kill switch. This also unlocks P1-2 and P1-3.

### P1-2 — Operator privilege is baked into the seal; demotion doesn't take effect for up to 30 days
`isOperator` lives in the session payload (`session.ts:17`) and the operator surface authorizes purely on the cookie value: `app/(operator)/layout.tsx:44-46` and `app/api/auth/oauth/google/callback/route.ts:132` both read `session.isOperator`, and `requireUser()` reads only the cookie (`lib/auth/server.ts:26-30`). Flipping `User.isOperator=false` in the DB has **no effect** on any already-issued session until seal expiry. (Workspace membership is *not* affected — `requireWorkspaceMember` re-checks the row per request, `server.ts:59-71`; it's the operator bit that's stale-privileged.) Same root cause as P1-1.

### P1-3 — No multi-device session management: no device list, no per-device revoke, no "sign out everywhere"
Concurrent sessions are unlimited and nothing records them. The only thing under Account → settings is a **passkeys** manager (`settings/passkeys/PasskeysManager.tsx`) — that manages login *methods*, not live *sessions*. A user who loses a laptop has **zero** remediation (can't revoke, can't even see the session; and per P1-1 sign-out wouldn't help). Consequence of the stateless design; resolved by the same server-side session record as P1-1.

### P1-4 — No rate limiting on any auth endpoint (per-IP or per-email)
Grepping `rate|limiter|ratelimit|upstash|throttle|429` across `lib/` and `app/api/` returns only **outbound** connector 429 handling — there is **zero inbound** rate limiting. `middleware.ts:47-53` explicitly leaves `/api/*` unguarded and throttles nothing. Exposed unauthenticated endpoints:
- `app/api/auth/magic-link/route.ts:25` and `app/(product)/app/actions.ts:255` — unlimited Resend sends (email-bomb against any *registered* address + unbounded Resend cost).
- `app/(product)/app/actions.ts:59` `signUpAction` — unlimited workspace + demo-seed + Stripe-customer creation, no CAPTCHA (junk-workspace resource abuse against *any* email).
- `app/api/auth/magic-link/exchange/route.ts:31` — unlimited token-guess attempts.
- `app/api/auth/passkey/authenticate/{options,verify}/route.ts` and `app/api/auth/apple/route.ts:47` — unlimited (Apple path re-hits Apple JWKS).
Mitigating fact: the magic-link *send* path returns early for unknown emails (`lib/auth/flows.ts:254-258`), so the email-bomb is limited to registered addresses; signup has no such guard.
**Fix:** per-IP + per-email sliding-window limiter (Upstash or DB-token-bucket) on send/exchange/signup/passkey-verify; add a challenge (Turnstile/hCaptcha) to signup.

### P1-5 — Magic link is consumed by a bare GET; email-scanner prefetch burns the token and receives the session cookie
`app/(product)/app/verify/route.ts:43` — `GET` consumes the token immediately (`verifyMagicLink`, :57) and sets the session cookie on the **fetching** client (:100-101). Corporate email security scanners (Safe Links, Mimecast) that GET-prefetch links will (a) burn the single-use token so the real user lands on `sign-in?reason=used`, and (b) receive the `Set-Cookie` session themselves. The native twin `magic-link/exchange/route.ts` is correctly **POST-only** with the token in the body (:11-12), which highlights the web route's exposure.
**Fix:** interstitial "confirm sign-in" page that POSTs to consume the token (kills prefetch consumption and mis-delivery).

### P1-6 — Passkey `userVerification` is never required; a no-UV assertion mints a 30-day (operator) session
`lib/auth/webauthn/simplewebauthn-provider.ts:69` (`userVerification: "preferred"`), and `requireUserVerification: false` on **both** registration (:92) and authentication (:151). Combined with `app/api/auth/passkey/authenticate/verify/route.ts:52` (`writeSession(session, { remember: true })` — hardcoded) and `passkey.ts:201` (`isOperator: credential.user.isOperator`), a passkey assertion where the authenticator skipped biometric/PIN (uv=0 — e.g. a PIN-less security key) is accepted and yields a **30-day persistent** session, operator-privileged if the user is an operator. This is the weakest link in the passkey chain.
**Fix:** require UV at least for operator accounts (`requireUserVerification: user.isOperator`), ideally globally with `userVerification: "required"`.

### P1-7 — "Delete everything we hold for you" overclaims: the User row, email, and passkeys survive account closure
The data-rights page (`app/(product)/app/workspace/[id]/data-rights/page.tsx:157`) promises *"Delete everything we hold for you"* / *"a clean, GDPR-style erasure"*, but the closure mechanism (`lib/customer-files/deletion.ts`) **retains** the `User` row (email), passkeys, magic-link history, `Membership` rows, and the billing shell (Subscription/Invoice — kept for tax). The code itself concedes *"a future full hard-delete of the Workspace/Membership/billing shell … is out of scope"*. So a true GDPR erasure request against the user identity is currently **operator/manual-only** — the copy promises more than the button delivers.
**Fix:** either scope the copy to workspace-data erasure, or add a real user-identity hard-delete path (with the tax-retention carve-out stated honestly).

> **P1-8 (connector-adjacent — cross-ref audit 5):** `app/api/integrations/docusign/connect/route.ts:46-62` **fails open** when `DOCUSIGN_CONNECT_HMAC_KEY` is unset — it accepts and persists unverified webhook payloads (confirmed: when `hmacKey` is falsy the verify block is skipped and execution proceeds to `JSON.parse` + persist). Peers fail closed (Twilio transcript `app/api/voice/twilio/transcript/route.ts:30`). Write-spoofing risk (forged envelope status), not a read leak. Filed here because it surfaced in the PII sweep; belongs to the connectors surface.

---

## P2 findings

| # | Location | Defect |
|---|---|---|
| P2-1 | `lib/auth/session.ts:37-42` | `Secure` flag is derived from `APP_PUBLIC_ORIGIN` (defaults to `http://localhost:3000`, `env.ts:70`) on the `writeSession`/`clearSession` paths — a prod deploy that forgets the env var silently emits a **non-Secure** session cookie. The magic-link path hardcodes `secure:true` (`session.ts:60-69`); the two doors are inconsistent. |
| P2-2 | `app/api/auth/passkey/authenticate/verify/route.ts:52` | Passkey login hardcodes `remember:true` (always 30-day); magic-link users get a remember-me checkbox, passkey users cannot opt out. |
| P2-3 | `register/verify/route.ts:21`, `passkey.ts:104,230-231` | Passkey `label` API exists but **no UI ever sets or renames it** — `PasskeysManager.tsx:52` + `PasskeyEnrollNudge.tsx:79` POST attestation only. A user with phone + laptop + key sees rows distinguishable only by "added &lt;date&gt;". Delete works; rename doesn't exist. |
| P2-4 | `lib/auth/webauthn/challenge.ts:64-72` | Challenge is a stateless sealed cookie; single-use is **client-enforced only** (`clearChallenge()` overwrites the cookie but the seal stays valid its full 5-min TTL). Bounded in-flight replay window — weaker than the DB-backed single-use magic-link token it claims parity with. |
| P2-5 | `lib/auth/webauthn/types.ts:83-87`, `passkey.ts:179-182` | `backedUp`/`deviceType` captured at registration but **never refreshed** on auth, so the settings list can show stale backup state after a device-bound key joins a sync fabric. |
| P2-6 | `lib/integrations/mcp-core/route.ts:106`, `gmail-mcp/[workspaceId]/route.ts:143`, `knowledge/mcp/route.ts:99` | `MCP_API_KEY` shared secret compared with `!==` (not `timingSafeEqual`) in 3+ copies — timing side-channel on a fleet-wide secret. Webhooks correctly use `timingSafeEqual`. |
| P2-7 | `app/api/voice/numbers/route.ts:56`, `integrations/buildium/sync/route.ts:34`, `workspaces/[id]/export/route.ts:51` | JSON API routes use `requireUser()` which **redirects (307)** instead of returning 401 — wrong semantics for `fetch()` callers (no leak). `onboarding/first-fire-status/route.ts:115` shows the correct inline pattern. |
| P2-8 | Account → settings surface | No **email change**, no **profile/name** management, no **session/device** UI. (Session UI is the P1-3 remediation surface.) |
| P2-9 | `lib/auth/apple.ts:160`, `app/api/auth/apple/route.ts:64-66` | Apple nonce is checked only when the client supplies it, and the server passes the client-sent nonce as `expectedNonce` — a **client-controlled tautology**, no replay protection. Practical risk is token-replay only (Apple signature still verified). |
| P2-10 | `middleware.ts:3-4` vs `:25-45` | Comment claims *"Force HTTPS on production hosts"* but the body contains **no protocol check** — comment/code drift (harmless on Vercel's platform TLS redirect, but the stated defense-in-depth doesn't exist). |
| P2-11 | `lib/auth/webauthn/challenge.ts:19` | One shared challenge cookie holds the single latest challenge — two open tabs (e.g. sign-in + settings-enroll) silently invalidate each other's ceremony with a misleading "request expired". Cosmetic/UX. |

---

## Verified working (stated plainly for the record)

**Prior fixes — all present:**
- **PR #270 (cookie-on-redirect):** `app/(product)/app/verify/route.ts:100-102` sets the cookie on the `NextResponse.redirect` object directly, with the Next.js-14 bug documented at :71-76. **No login path** uses `cookies().set()` before a redirect — passkey/exchange/apple all return JSON bodies; Google callback is integration-connect, not login.
- **PR #171 (rpId):** behavior intact — apex + `app.` + `www.` all verify, preview/localhost self-host. The *mechanism* evolved: `resolveRpId` was refactored away (regressed twice), replaced by `deriveRpId` from `APP_PUBLIC_ORIGIN` (`webauthn/config.ts:83-120`) with a regression-pinning unit test.
- **PR #268 (WebAuthn hints):** `["client-device","hybrid","security-key"]` injected on **both** registration (`simplewebauthn-provider.ts:72-79`) and authentication (:134-139) — Chrome cross-device/QR, iCloud Keychain, and security keys all surface.

**Session & token hygiene:**
- Cookie attrs correct on every set: `agentplain_session`, `HttpOnly`, `SameSite=lax`, `path=/`, `maxAge=2592000` (30d) when remember, browser-session otherwise (24h seal cap so a restored cookie can't outlive 24h) — `session.ts:37-51,60-69,82`.
- Magic-link token: 256-bit `crypto.randomBytes` base64url, only SHA-256 hash persisted, 15-min TTL, strictly single-use inside the verify transaction — `token.ts:9-21`, `flows.ts:266,317-323`.
- No session fixation (seal minted server-side post-verification, fresh per login, fails closed to null on tamper).
- **No password auth exists** anywhere (`schema.prisma` User model has no password column) — no reset flow needed, correct.
- `test-provider` gated off in prod (`AUTH_PROVIDER` defaults to `resend`, `env.ts:39`); no mint-session backdoor route.

**Access control:**
- **No unauthenticated PII leak** across 83 API routes; **no IDOR** — every workspaceId-parameterized route re-verifies active membership. Most PII-dense route (`workspaces/[id]/export`) is `BROKER_OWNER`-gated + RLS.
- Enumeration-resistant: magic-link request returns identical `{delivered:false}` for unknown emails; passkey `authenticate/options` takes no identity input and is identical for everyone.
- Registration requires an authenticated session; challenge bound to `session.userId`.

**Product surfaces:**
- **Sign-out UI** wired (`workspace/[id]/layout.tsx:123-130` → `signOutAction`).
- **Delete/close account** is real and works end-to-end: `BROKER_OWNER`-gated, typed-name confirmation, 7-day grace + cancel, hourly Inngest cron hard-purge across ~25 tables including the customer's own AuditLog (`lib/customer-data/closure.ts`, `deletion.ts`). (The gap is user-*identity* deletion — see P1-7.)
- **Post-signin passkey nudge** present and upgraded to in-place enrollment (`PasskeyEnrollNudge`, mounted at `workspace/[id]/layout.tsx:151`).
- Conditional-UI autofill present (`SignInForm.tsx:34` `autoComplete="email webauthn"`; mount-time conditional ceremony); passkey errors surfaced (not swallowed) with magic-link fallback always rendered.

**Brand / voice / mobile:**
- **voice-gate: 0 new violations** (30 known baseline, none on auth surfaces). **brand-gate: 0 new violations** (11 baseline, none on auth surfaces).
- **Heritage Plains styling applied** — sign-in/sign-up use the same token vocabulary as the marketing home (`text-ink`, `border-rule`, `bg-paper-deep`, `font-display`, `ApEyebrow`, `PlainoScene`); paper-grain + letterpress inherited globally. No stale classnames, no hardcoded hexes.
- **No model-vendor leak** on unauthenticated error pages (`global-error.tsx`, `sign-up/error.tsx` show a digest id, no "Anthropic"/"Claude", no stack trace).
- **Mobile 375px (live-verified):** sign-in renders `max-w-md` in `container-wide`; passkey button `w-full` above the fold, "OR USE EMAIL" divider, email form, remember-me checkbox, all stack cleanly — **no horizontal overflow**, passkey works.

---

## Recommended sequencing (value-per-effort)

1. **P1-4 rate limiting** — cheapest real security win; caps Resend cost + email-bomb + junk-signup abuse today.
2. **P1-1/P1-2/P1-3 as one change** — a server-side session/`tokenVersion` record is the single fix that gives sign-out teeth, makes operator-demotion instant, and unlocks the device-list/revoke UI.
3. **P1-5 magic-link interstitial** — small, kills the scanner-prefetch class outright.
4. **P1-6 require UV for operators** — one-line config change, closes the passkey privilege gap.
5. **P1-7 copy vs. mechanism** — decide erasure scope; either soften the promise or build the user-identity delete.
