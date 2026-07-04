# Instrumentation plan — the events we track, and nothing else

**Design rule:** every event exists because a dashboard row reads it and a decision consumes that row. Events with no reader do not ship. This is the inverse of the kaizen retro's core finding (a well-built engine with an empty fuel tank): we wire the fuel line first and only build engine we can feed.

## Storage: a thin first-party event table, not a vendor

One Postgres table (`AnalyticsEvent`: `id, name, workspaceId?, anonymousId?, properties jsonb, createdAt`), written through one function (`lib/analytics/track.ts`, to be created — kaizen retro investment #2, "product-analytics lite"). Reasons:

- **Vendor-invisible rule** (`feedback_model_vendor_invisible_on_customer_surfaces`): no third-party script on any customer surface.
- **Two-bucket data positioning** (ratified): connector data passes through; Plaino-memory persists for account life. Events belong to the second bucket — they are workspace operational history, keyed to `workspaceId`, never to connector payload content.
- **No silent vendor lock-in** (`feedback_no_silent_vendor_lock`): if we ever adopt PostHog-self-hosted or similar, `track.ts` is the adapter seam; consumers never know.
- At our volume (single-digit workspaces), a table plus a script beats any SaaS on truthfulness per dollar.

`track()` is fire-and-forget (never throws into the caller's path, never blocks a user-facing transaction), and validates event names against the registry below — an unregistered name is a build error, not a silent new metric.

## The five product events

| Event | Fires where (verified call sites on origin/main) | Properties |
|---|---|---|
| `signup.completed` | `lib/auth/flows.ts` → `signUpBrokerOwner`, after the workspace transaction commits (the same place the `workspace.created` audit row is written today) | `workspaceId`, `vertical`, `utm_source/medium/campaign/content` (from the sign-up page), `referrer`, `selfReportedSource` (the "how did you hear about us" field — 6 options + free text, optional) |
| `workspace.created` | Same transaction — for the broker-owner flow this is one moment with `signup.completed`; kept as a separate event so team-member invites and any future multi-workspace path don't overload signup | `workspaceId`, `vertical`, `createdByRole` |
| `connector.added` | The OAuth callback / connect success path per connector (`app/api/integrations/*/connect/route.ts`, `app/api/integrations/[integrationId]/oauth/start/route.ts` completions) — fired on verified connection, not on button click, per `feedback_integration_acceptance_is_functional` | `workspaceId`, `integrationId`, `isFirstConnector` (boolean), `method` (oauth/api-key) |
| `workflow.first_run` | The skill fire path, immediately after `gateSkillFire` allows and the run completes (`lib/fleet/activation.ts` documents the gate contract; artifact persistence in `lib/skills/persist-artifacts.ts` marks completion) | `workspaceId`, `skillSlug`, `outcome` (completed/failed), `isFirstEver` (boolean) |
| `save_motion.triggered` | `lib/guarantee/saved-time.ts` → `recordSavedTime` — one line inside the existing writer, so the event and the guarantee ledger can never disagree | `workspaceId`, `actionType`, `minutesSaved`, `isFirstEver` (boolean) |

**Known gap this plan inherits:** audit 9/10 found 4 of 7 calibrated guarantee actions have no `recordSavedTime` writer. Instrumenting inside `recordSavedTime` means those four are invisible to `save_motion.triggered` too — same root cause, same fix (Engineering ask #3 in `05-what-i-need-from-other-heads.md`). The dashboard states this gap on its face rather than implying full coverage.

## The marketing-surface events (from the marketing measurement plan, adopted unchanged)

Four goal events, cookieless, first-party only: trial-start begun (`/app/sign-up` reached), trial-start completed, talk-to-a-partner submitted (the `/api/leads/capture` pipeline already exists and stores source-of-lead), guarantee-page view. Plus pageview/referrer/UTM/landing-page — nothing about identity. Anonymous visitors get a random `anonymousId` in a first-party session cookie at most; no cross-site anything.

## The outbound events (must be live before Monday)

Not code events — ledger rows in the CRM-of-record (`/operator/outreach`, PR #355):

1. `outbound.sent` — prospect, date, template variant, booking-link ref, at send time.
2. `outbound.replied` — logged manually by Conner or the operator on reply (with date and disposition).
3. `discovery.booked` — the booking flow records the `ref` from the booking URL so the call resolves to the send.

**Opens are not instrumented and will be reported as "not instrumented."** Founder sends from a personal inbox carry no open tracking, and we do not add pixels to one-to-one founder email. If the sales tool stack later adds open tracking, the column turns on then. Truthful counts means an honest "unknown" beats a fabricated rate.

## Consent framing

- Product events are operational records of the customer's own workspace, disclosed in `/privacy` as part of the service (bucket two of the ratified positioning: workspace memory persists for the life of the account — a feature, plainly stated). No dark patterns, no per-event consent theater for the customer's own activity log.
- Marketing-surface analytics ship cookieless/first-party-only, which is why no cookie banner exists today and none is added.
- **Any change ships through the `/privacy` counsel packet before it deploys** — adding analytics without updating `/privacy` would manufacture a Truth Wave violation (marketing doc 06, adopted as a hard rule). Legal/compliance kaizen note stands: counsel sign-off is still open; the privacy-page diff joins that packet, it does not wait for it silently.
- Banned framings stay banned: never "nothing stored," never "forgets."

## Explicitly out of scope

Session replay, heatmaps, third-party pixels, cross-site retargeting audiences, per-user behavioral profiles, and any event on connector payload *content*. None feeds a decision on the current path to profit; all of them spend the privacy posture we advertise. See `06-what-data-must-stop.md`.
