# agentplain mobile (Expo / React Native)

The native companion app for agentplain. It talks to the existing Next.js
backend (`app.agentplain.com`) over a small JSON API — it does **not** embed any
business logic or its own database. Auth, briefings, and approvals are real;
chat and the integration marketplace are labeled stubs in V1 (see
[Scope](#v1-scope)).

## Architecture (how it fits the monorepo)

- The app lives in `apps/mobile/` with its **own** `node_modules` (Expo SDK).
- It imports exactly one shared module from the repo root:
  `lib/mobile/api-client.ts`, aliased as `@shared/lib/mobile/api-client`. That
  file is isomorphic (no React Native, no Next imports) so the same contract
  types compile under both the web and mobile tsconfigs. Metro is configured
  (`metro.config.js`) to watch only the shared `lib/` folder, not the whole
  repo root.
- Auth model: the magic-link exchange returns the **same sealed iron-session
  token** the web app uses; the app stores it in Expo SecureStore and replays it
  as `Authorization: Bearer <token>`. Server side: `lib/auth/mobile-session.ts`.
  No new auth primitive was introduced.

## Prerequisites

- Node 18+ and npm
- The Expo tooling is pulled in by `npm install` below (no global install needed;
  use `npx expo …`)
- **iOS simulator:** macOS + Xcode (with at least one iOS Simulator runtime)
- **Android emulator:** Android Studio with an AVD created, or a physical device
  running Expo Go / a dev build

## Install & run (dev)

```bash
cd apps/mobile
npm install
npx expo start
```

Then in the Expo CLI:

- press **i** to open the iOS simulator (macOS only)
- press **a** to open the Android emulator
- or scan the QR code with **Expo Go** on a physical device

### Pointing at a backend

Resolution order for the API origin (`src/config.ts`):

1. `EXPO_PUBLIC_API_BASE_URL` env var (per-build override)
2. `app.json` → `expo.extra.apiBaseUrl` (committed default: `https://app.agentplain.com`)
3. `http://localhost:3000` fallback

To run against a local `next dev`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npx expo start
```

> On a physical device, `localhost` is the phone, not your machine — use your
> machine's LAN IP (e.g. `http://192.168.1.20:3000`).

### Signing in during development

The transactional magic-link email currently emits the **web** verify link.
Until the email is updated to emit the app deep link (tracked follow-up), use
either:

- **Deep link** — `agentplain://auth/callback?token=<raw>` (custom scheme) or
  the universal link `https://app.agentplain.com/app/verify?token=<raw>`. Both
  land on the shared exchange screen.
- **Manual token paste** — the sign-in screen has a "Have a sign-in token?"
  disclosure for pasting a raw token directly (dev affordance).

## Type checking

```bash
cd apps/mobile
npm run typecheck   # tsc --noEmit
```

The mobile tsconfig is isolated from the web build — the repo-root `tsconfig.json`
excludes `apps/mobile`, and `.eslintrc.json` ignores it, so the two toolchains
never collide.

## EAS Build prep (TestFlight / Play Store)

1. Install the CLI and sign in:
   ```bash
   npm i -g eas-cli
   eas login
   ```
2. Configure the project (creates `eas.json`):
   ```bash
   cd apps/mobile
   eas build:configure
   ```
3. Set the real EAS project id in `app.json` → `expo.extra.eas.projectId`
   (currently `REPLACE_WITH_EAS_PROJECT_ID`).
4. Bundle identifiers are already set: iOS `com.agentplain.app`, Android
   `com.agentplain.app`.
5. Builds:
   ```bash
   eas build --platform ios       # → TestFlight via App Store Connect
   eas build --platform android    # → Play Console internal testing
   ```
6. Submit:
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

### Placeholder assets

`assets/` holds flat-color placeholder PNGs (icon, splash, adaptive, favicon,
notification). The real **8-bit robot dog** icon set is a tracked follow-up —
replace these before a public submission.

## ⚠️ App Review: Sign in with Apple

Apple's App Store Review Guideline **4.8** requires that any app offering
third-party or email-based login **also** offers **Sign in with Apple** on iOS,
*unless* the only sign-in method is the developer's own email/password-equivalent
account system that doesn't use a third-party identity provider.

Our magic-link flow is our own first-party email auth (no third-party IdP), which
generally falls **outside** the 4.8 mandate — but App Review applies this case by
case, and a magic link is sometimes read as an "email login." Before submitting:

- Be prepared to add **Sign in with Apple** if Review flags it. The cleanest path
  is to add it as an additional option that mints the same sealed session server
  side (a new exchange route), keeping the bearer model unchanged.
- Until then, expect a possible 4.8 rejection and budget a review cycle for it.

This is the single most likely App Review blocker for this app — do not discover
it at submission time.

## V1 scope

| Screen | Status |
| --- | --- |
| Magic-link sign-in | ✅ wired (request + deep-link exchange + manual token) |
| Workspace selector | ✅ wired (`/api/mobile/me`) |
| Briefings inbox | ✅ wired (`/api/mobile/workspace/:id/briefing`) |
| Approvals queue | ✅ wired, **read-only** (`/api/mobile/workspace/:id/approvals`) |
| Talk-to-Plaino chat | 🚧 labeled stub (reuses web `/api/chat` backbone — next PR) |
| Integration marketplace | 🚧 labeled stub (status route + web connect hand-off — next PR) |
| Push notifications | 🚧 client permission/token only; no backend registration yet |

## Follow-ups

- Replace placeholder assets with the 8-bit robot dog icon set.
- Push: add `POST /api/mobile/push/register` (device token → workspace) and a
  briefing/approval notification trigger. Send fan-out runs from the
  customer/notification system, not an agent (no-outbound rule).
- Approvals: wire the decision actions (approve / edit / "doesn't sound like
  us") through the closed-loop feedback substrate + RLS-gated decision actions
  in their own reviewed PR.
- Plaino chat: native streaming transport + message UI over the existing
  support-mode chat endpoint.
- Update the transactional magic-link email to emit the app deep link.
- Decide Sign in with Apple before iOS submission (see above).
