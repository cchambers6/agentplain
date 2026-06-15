# Passkey / WebAuthn authentication

How passkeys are wired in agentplain, the invariants that keep them working
across `agentplain.com` / `www.` / `app.`, and the regression that bit us twice
(2026-05-27 and 2026-06-15) so it doesn't bite a third time.

## The one rule that breaks everything if you get it wrong

**The Relying Party ID (`rpID`) must be the registrable apex (`agentplain.com`),
not the app subdomain (`app.agentplain.com`).**

A browser only accepts an `rpID` that is **equal to, or a parent of**, the host
the page is served on. `app.agentplain.com` is a *child* of `agentplain.com`, so:

| Page host              | rpID served      | Result                      |
| ---------------------- | ---------------- | --------------------------- |
| `app.agentplain.com`   | `agentplain.com` | ✅ parent — accepted        |
| `agentplain.com`       | `agentplain.com` | ✅ equal — accepted         |
| `www.agentplain.com`   | `agentplain.com` | ✅ parent — accepted        |
| any host               | `app.agentplain.com` | ❌ child of apex/www → `SecurityError` |

Binding the credential to the apex also means **one passkey works on every
subdomain** we serve. Binding it to `app.` would strand any sign-in attempt on
the apex or www, and would break across subdomains.

## rpID derivation rule (correct-by-default)

`lib/auth/webauthn/config.ts` derives `rpID` from `APP_PUBLIC_ORIGIN` with **no
env var required**:

- `deriveRpId(host)` strips a leading `app.` / `www.` label → the registrable
  apex. `app.agentplain.com` → `agentplain.com`.
- `localhost`, IPs, and preview hosts (`*.vercel.app`) are returned **verbatim**
  — a preview deploy is its own self-consistent RP, and collapsing
  `branch.vercel.app` → `vercel.app` (a public suffix) would be rejected.
- `RP_ID` is an **optional override** for topologies the heuristic can't infer
  (a non-`app`/`www` production subdomain, or a multi-part public suffix like
  `*.co.uk` where "last two labels" would be a public suffix).

> Why correct-by-default instead of "just set `RP_ID` in Vercel": the bug
> returned in 2026-06-15 precisely because correctness lived in an unset env
> var. The earlier fix (PR #171) derived rpID request-side; a later refactor
> replaced it with static env-config whose *default* was the literal host, and
> `RP_ID` was never set in production — so prod silently served
> `rpId: app.agentplain.com` on every host. Keeping the apex derivation in code
> means env drift can no longer reintroduce it.

## expectedOrigins rule

`verifyRegistrationResponse` / `verifyAuthenticationResponse` are passed the
full list of origins we serve, so an assertion produced on any of them verifies:

- `WEBAUTHN_ALLOWED_ORIGINS` (comma-separated) is an **optional override**.
- When unset, `config.ts` derives the list from `APP_PUBLIC_ORIGIN`: for a
  production host it accepts `https://{apex}`, `https://www.{apex}`,
  `https://app.{apex}`; for localhost / preview it accepts only the single
  canonical origin.

## Cookie / session rule

- **Challenge cookie** (`agentplain_webauthn_chal`): sealed (iron-session,
  `SESSION_PASSWORD`), `httpOnly`, `sameSite=lax`, 5-minute TTL. Holds the
  challenge across the two-step ceremony. See `lib/auth/webauthn/challenge.ts`.
- **Session cookie** (`agentplain_session`): sealed, `httpOnly`,
  `sameSite=lax`, 30-day `maxAge` when "remember" is set (the default for
  passkey + magic-link sign-in). See `lib/auth/session.ts`.
- The session cookie is intentionally **host-only** (no `Domain` attribute):
  sign-in completes on `app.agentplain.com` and the session lives there. This is
  deliberate, not the passkey bug — the passkey ceremony fails *before* any
  session is issued, so a cross-subdomain `Domain=.agentplain.com` cookie would
  not have fixed it. If we ever need a session shared across subdomains, that's
  a separate, deliberate change (set `Domain` + re-test CSRF posture).

## Browser-specific quirks discovered

- **Silent `SecurityError`**: the rpID mismatch surfaces as a thrown
  `SecurityError` (Chrome + Safari). The client (`PasskeySignInButton.tsx`)
  must NOT swallow it as "user cancelled" — only `NotAllowedError` (genuine
  dismiss/timeout/no-credential) is quiet; everything else surfaces. Swallowing
  is what made the apex regression invisible to users *and* to us.
- **Discoverable credentials**: registration uses `residentKey: "preferred"`
  so sign-in needs no typed email; `/authenticate/options` sends an empty
  `allowCredentials`.
- **iOS autofill**: conditional-UI mediation is the path to passkey autofill on
  iOS; keep `browserSupportsWebAuthn()` gating so non-WebAuthn browsers fall
  back cleanly to magic-link.

## How to test locally

```bash
# Unit guard (no DB, no browser) — runs in CI on every auth PR:
node --import tsx --test tests/auth-webauthn-config.test.ts

# Full browser ceremony against a running app (Chromium virtual authenticator):
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
# Against prod (rpId assertion only — needs no session):
E2E_BASE_URL=https://app.agentplain.com npm run test:e2e
# Full register→signin→persist (needs a valid signed-in session cookie value):
E2E_BASE_URL=... E2E_SESSION_COOKIE=<sealed agentplain_session value> npm run test:e2e
```

Quick prod sanity check (what caught the 2026-06-15 regression):

```bash
curl -s -X POST https://agentplain.com/api/auth/passkey/authenticate/options | grep -o '"rpId":"[^"]*"'
# MUST print "rpId":"agentplain.com"  (NOT app.agentplain.com)
```

## What the regression guards catch

- **`tests/auth-webauthn-config.test.ts`** (CI, DB-free, the real gate): pins
  that with the *production env shape* (only `APP_PUBLIC_ORIGIN` set) `rpID` is
  the registrable apex and `expectedOrigins` covers apex + www + app. This is
  the test that would have failed on the broken build. Wired into CI via
  `.github/workflows/auth-tests.yml` — previously NO workflow ran `npm test`,
  so the guard gated nothing.
- **`tests/e2e/passkey-full-ceremony.spec.ts`** (on-demand): drives a real
  Chromium virtual authenticator through register → sign-out → sign-in →
  session-persists, and asserts the live `rpId` equals the host's registrable
  apex. Run against a preview or prod.
