# Incident log

Production incidents and the fixes that closed them. Newest first. Each entry
documents the user-facing symptom, the actual log evidence, root cause, fix,
and any monitoring gap that should be closed so the same class of incident is
caught earlier next time.

## 2026-05-18 pre-push build gate added (broken main shipped twice in one week)

**Trigger.** Two main-breaking pushes inside a single week, both of which
would have been caught by running the Next.js build locally before push:

1. **TypeScript error in `scripts/verify-knowledge-seed.ts`** — landed on
   main, broke Vercel preview builds for downstream branches until reverted.
   `next lint` did not catch it because the script lives outside the App
   Router compile graph that lint inspects; only `next build` (which runs
   `tsc` across the whole project) surfaces it.
2. **`/app/verify` cookie crash** — see the next entry below. Cookie
   mutation from a Server Component compiled cleanly but threw at runtime
   on the first request. `next build` would not have caught the runtime
   throw on its own, but the broader rule still holds: the more of the
   build pipeline we run pre-push, the fewer ways a broken push reaches
   Vercel.

Two breakages in seven days is the pattern, not the exception. The pre-push
hook already runs `npm run lint` (Layer 1) and a staleness gate (Layer 0),
but nothing actually compiled the project. That's the gap this change
closes.

**Fix.** Added a Layer 2 build gate to `.husky/pre-push` that runs
`npm run build:no-migrate` and aborts the push on failure. The
`build:no-migrate` script is `prisma generate && next build` (no
`migrate deploy`), so it's safe from any developer machine and doesn't
need a live `DATABASE_URL`.

**Bypass.** `HUSKY=0 git push ...` skips every husky hook, including the
new build gate. Use this only for genuine emergencies (e.g. shipping a
fix to a still-failing build, where the bypass is the point). Every
bypass should be logged here with: the SHA, the reason, and what
follow-up brought the build back to green.

| Date | SHA | Reason | Follow-up |
| --- | --- | --- | --- |
| — | — | — | — |

**Why not `git push --no-verify`.** `--no-verify` works too and remains
documented as the Layer 1 bypass, but `HUSKY=0` reads more clearly in
shell history and matches husky's own documented escape hatch. Either
form skips every hook — neither is more selective.

**Monitoring gap to close.** This gate runs on the developer machine.
Vercel's own build will catch the same class of error a few minutes later
when the push lands, but at that point main is already red and downstream
branches see the failure on rebase. A pre-merge GitHub Actions build
would be the next defense; tracked as a follow-up.

## 2026-05-17 app login crash

**Timestamp.** Detected ~2026-05-18 00:00 UTC (2026-05-17 evening ET). Tied to
the `/app/verify` route on production deploy `agentplain-go8yv77jw` (built
from `8996b32`, deployed 03:58:03 UTC, marked Ready 1m later).

**User-facing symptom.** Conner clicked the magic-link in his sign-in email
and landed on `https://app.agentplain.com/app/verify?token=…`. Instead of
being signed in and redirected to his workspace, he saw the Next.js global
error page:

> Application error: a server-side exception has occurred (see the server logs
> for more information).
> Digest: 2234350772

The user-facing impact was a hard block on logging in — no workaround.

**Log evidence (verbatim, via `vercel logs --status-code 500 --expand --since
2h --no-branch`).**

```
00:00:53.89  app.agentplain.com  error  λ GET /app/verify
[Error]: Cookies can only be modified in a Server Action or Route Handler.
Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#cookiessetname-value-options
  at Proxy.callable (/var/task/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:13:13497)
  at l (/var/task/.next/server/chunks/2614.js:13:5773)
  at async u (/var/task/.next/server/chunks/805.js:1:2214)
  at async a (/var/task/.next/server/app/(product)/app/verify/page.js:1:4062)
{ digest: '2234350772' }
```

**Root cause.** `app/(product)/app/verify/page.tsx` was a Server Component
that called `verifyAction(token)` directly from its render function. The happy
path of `verifyAction` calls `writeSession(payload)`, which calls
`cookies().set(...)`. Next.js permits cookie mutation only from a Server
Action handler or a Route Handler — never from a Server Component render —
and throws this exact error in production.

The defect was latent from the original Phase 1 auth ship in `baa7436` (the
broker-owner customer surface). It went undetected because the worker repo
had no end-to-end test that exercised the real magic-link round trip: unit
tests covered `verifyMagicLink` (pure DB logic) and `buildVerifyUrl` (string
formatting), but nothing actually hit `/app/verify?token=…` against a running
server.

**Fix.** Replaced the Server Component page with a Route Handler.

- `app/(product)/app/verify/route.ts` (new): GET handler that reads the
  token, calls `verifyMagicLink`, calls `writeSession` (legal from a Route
  Handler), and 303-redirects to the workspace destination. Failure cases
  (missing token, invalid token, expired link, already-used link) redirect to
  `/app/sign-in?reason=<code>`.
- `app/(product)/app/verify/page.tsx` (removed): the file that was crashing.
  Pages and route handlers cannot coexist at the same path in the App Router,
  so the page had to go.
- `app/(product)/app/sign-in/page.tsx` (updated): now an async Server
  Component that reads `searchParams.reason` and renders a flash message
  above the form. This preserves the previous UX where failed verifications
  told the user *why* the link did not work.
- `app/(product)/app/actions.ts` (cleaned): removed the now-dead
  `verifyAction`. Added a comment pointing future readers at the Route
  Handler so the same mistake is not reintroduced.

**Verification.**

- `npm run typecheck` — clean.
- `npx next build` — clean. The build report shows `/app/verify` as a
  Route Handler (`ƒ 0 B`, no React payload) and `/app/sign-in` as dynamic
  (`ƒ`, because it reads searchParams).
- `node --import tsx --test tests/auth-flows.test.ts
  tests/auth-providers.test.ts tests/auth-token.test.ts
  tests/middleware.test.ts` — 15/15 pass.
- Production curl evidence captured in the fix PR.

**Monitoring gap to close.** Vercel runtime errors were only surfaced because
a human user happened to land on the broken flow and tell us. Two follow-ups
worth scheduling:

1. ~~Add Vercel log drain → alert on any 500-class response from `/app/*`
   routes (or at minimum, an end-of-day digest of error-level runtime logs).
   The digest fingerprint (`2234350772` in this incident) is stable across
   occurrences and is the right de-dup key.~~ **Closed 2026-05-18** by
   `chore/runtime-alerting-2026-05-18` — wired Sentry via `@sentry/nextjs`
   behind the `lib/observability` adapter. The Next.js `captureRequestError`
   hook (re-exported from `instrumentation.ts` as `onRequestError`) catches
   Server Component / Server Action / Route Handler throws — the exact class
   of failure that produced this incident. Setup details + Sentry alert-rule
   configuration in `docs/runtime-alerting-2026-05-18.md`. The `error.digest`
   value is forwarded as a Sentry `extra` so the same de-dup key is preserved.
2. Add an end-to-end test that issues a real magic link via `TestAuthProvider`
   and follows the verify URL against a running Next.js server. The current
   suite tested everything except the round trip that actually broke. **Still
   open** — tracked for the testing-strategy pass.
