# `lib/integrations` — external-system OAuth + webhook adapters

Owns every external read-side integration: Gmail today, M365 next, then
Calendar / Slack / Zoom as the customer fleet expands. Per
`project_living_portable_architecture.md` + `feedback_no_silent_vendor_lock.md`:
every vendor SDK / REST call lives behind the
[`IntegrationProvider`](./types.ts) interface. Per
`feedback_runner_portability.md`: every provider has at least two
implementations — production (`./google/`, future `./m365/`) and
[`./test-provider.ts`](./test-provider.ts).

## Why this exists

agentplain reads customer email → categorizes → coordinates → schedules →
drafts. Per `project_no_outbound_architecture.md` it never sends.
Receiving inbound notifications + reading via API is in scope; sending
is forbidden.

PR-B (this PR) lands plumbing. PR-C lands the functional value loop on
Conner's real inbox per `feedback_integration_acceptance_is_functional.md`.

## Contract

```ts
import type { IntegrationProvider } from "@/lib/integrations";

const provider: IntegrationProvider = getProvider("GOOGLE");
const tokens = await provider.exchangeCodeForTokens({ code, redirectUri });
```

Every method returns `IntegrationResult<T>` — `{ ok: true, value } | { ok: false, error }`.
No method throws on network or vendor errors; only on programmer error
(empty config, malformed argument before any I/O).

| Method | Purpose |
| --- | --- |
| `exchangeCodeForTokens(args)` | OAuth2 authorization-code → TokenSet |
| `refreshTokens(args)` | OAuth2 refresh → TokenSet (preserves prior refresh token if provider omits one) |
| `revokeTokens(args)` | OAuth2 revocation; idempotent on already-revoked |
| `createSubscription(args)` | Provider-side push subscription create (Gmail: users.watch) |
| `renewSubscription(args)` | Renew before expiry (Gmail: re-call users.watch) |
| `deleteSubscription(args)` | Stop watching (Gmail: users.stop) |
| `verifyWebhookSignature(req)` | Pub/Sub OIDC verify (Google) / Graph clientState (M365) |
| `parseWebhookPayload(req)` | Decode the provider-specific push body |

## Credential codec

`encryptTokenSet` / `decryptCredential` in [`./index.ts`](./index.ts) wrap
the [`lib/security/encryption.ts`](../security/encryption.ts) AES-256-GCM
primitive. Plaintext tokens live in memory for the duration of one
request / cron fire; the `IntegrationCredential` row stores only the
`v1:iv:tag:ciphertext` blobs.

**Never persist a `DecryptedCredential` back to the database.** The
decoder seam is one-way at write time.

## Adding a provider

1. Create `lib/integrations/<provider>/`.
2. Implement `IntegrationProvider` (one file per concern is fine —
   `oauth.ts`, `<surface>-provider.ts`, `webhook-handler.ts`).
3. Wire it in [`./index.ts`](./index.ts)'s `buildProvider` switch.
4. Add the provider's enum value to `IntegrationProvider` in
   `prisma/schema.prisma`. Migration: append the enum value (Postgres
   `ALTER TYPE … ADD VALUE`), don't drop + recreate.
5. Extend the contract test
   [`./__tests__/contract.test.ts`](./__tests__/contract.test.ts) to
   parameterize the new adapter through the shared assertions.
6. Add operator-side setup steps to
   [`docs/operator-integrations-setup.md`](../../docs/operator-integrations-setup.md).

## Credential tiering — per `feedback_no_prod_secrets_in_dev`

Production OAuth client IDs / secrets live in Vercel Production env only.
`.env.local` uses a **dev-tier Google Cloud Project** with its own
client ID + secret + Pub/Sub topic. Sharing prod creds across tiers =
prod incident waiting to happen.

| Env var | Tier scope |
| --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | Per Vercel env. Different ids per tier. |
| `GOOGLE_PUBSUB_TOPIC` | Per tier; topic includes the env in its name. |
| `GMAIL_WEBHOOK_OIDC_AUDIENCE` | The deployment's public URL. |
| `GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL` | The service account configured on Pub/Sub subscription's OIDC. |
| `ENCRYPTION_KEY` | 64-char hex, per env, NEVER reused. |

## Disable flag

Each Inngest function in `lib/inngest/functions/*.ts` reads
`process.env.INNGEST_FN_DISABLE_<NORMALIZED_ID>` at handler entry via
[`runWithDisableGate`](../inngest/run-with-disable-gate.ts). Setting the
var to `"true"` pauses the function without redeploying — the canonical
operator kill-switch per the foundation port (PR #4, mirrored from
flatsbo PR #24).

The renewal sweep's flag is:

```
INNGEST_FN_DISABLE_AGENTPLAIN_INTEGRATION_RENEWAL_SWEEP=true
```
