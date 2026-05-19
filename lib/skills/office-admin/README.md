# office-admin skill

Categorization layer for admin / IT / account-hygiene email. Sits between
`read` and `categorize` in the value loop:

```
read → office-admin classify
        ├─ admin (high-conf)  → admin approval, skip vertical chain
        └─ not-admin          → categorize → coordinate → schedule → draft
```

## Scope (the *cheap* version)

This skill **does not** click links, fill forms, hold credentials,
inventory accounts, or auto-execute anything. Per the office-manager
memory (`project_office_manager_skill.md`), the cheap version is:

- recognize the email,
- extract the operator-visible artifact (the code, the URL, the date),
- queue a human-reviewed approval.

The "real version" (account inventory + browser agent + auto-execute) is
gated on infrastructure that is not in scope today. The gate criteria
are in the memory file.

## Categories (9)

| Category                    | Approval kind             | Priority | Has draft |
| --------------------------- | ------------------------- | -------- | --------- |
| email-verification          | ADMIN_VERIFICATION_CODE   | normal   | no        |
| verification-code           | ADMIN_VERIFICATION_CODE   | normal   | no        |
| password-reset              | ADMIN_PASSWORD_RESET      | normal   | no        |
| trial-expiration            | ADMIN_TRIAL_ENDING        | normal   | yes       |
| billing-notice              | ADMIN_BILLING_NOTICE      | normal   | yes       |
| subscription-confirmation   | ADMIN_BILLING_NOTICE      | low      | no        |
| service-status              | ADMIN_BILLING_NOTICE      | low      | no        |
| email-preferences           | ADMIN_BILLING_NOTICE      | low      | no        |
| account-suspension          | ADMIN_SECURITY_ALERT      | critical | no        |

`not-admin` is the off-ramp — the runner lets the vertical chain proceed.

## Architecture

- `screen.ts` — regex pre-screen. Returns `worthClassifying=false` for
  the obvious "no admin vocabulary anywhere" majority of inbound. Saves
  an LLM call. The screen is NOT the classification decision.
- `classifier.ts` — LLM call against `OFFICE_ADMIN_SYSTEM_PROMPT`. Picks
  one of 10 categories (9 admin + `not-admin`) with confidence + reason.
- `signals.ts` — extracts the verification code, URL, expires-at, service
  name, amount. Deterministic; runs on every classified message so the
  approval card has something to show.
- `actions.ts` — composes the approval payload + suggested draft body
  per category. Service-partnership voice.
- `types.ts` — taxonomy + category → approval-kind mapping.
- `prompt.ts` — system prompt (with the office-admin marker).

## Grounded in

- `project_no_outbound_architecture.md` — drafts only, never sends.
- `prohibited_actions` (CLAUDE.md) — no click, no autofill, no creds.
- `project_service_partnership_positioning.md` — "we noticed" voice.
- `feedback_brand_is_plain_not_plane.md` — rooted, calm copy.
- `feedback_no_quick_fixes.md` — classification via LLM, not keyword.
