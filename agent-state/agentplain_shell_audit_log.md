---
name: agentplain_shell_audit_log
description: Append-only audit log of customer-surface-shell deploys — vertical-tier ratification, marketing/[vertical] route shipment, signup flow extensions, OnboardingState schema migrations. Written when a shell-level change ships (PR merge or preview deploy). Newest at bottom (chronological).
type: project
created: 2026-05-11
originSessionId: feat-agentplain-customer-surface-shell-2026-05-11
---

# agentplain customer surface shell — audit log

Append-only. Every row is written AFTER reading back actual state from the
build (per `feedback_verify_after_create`). One row per shell-level deploy
event (PR merge, Vercel preview cut, schema migration applied to a Neon
branch). Smaller in-PR commits do not get rows here.

Row schema:
- **timestamp** — ISO8601 UTC
- **branch / sha** — git ref of the deploy
- **environment** — preview or production
- **summary** — one line; what shipped
- **routes verified** — list of public URLs confirmed returning 200 (or 30x)
- **db migrations** — Prisma migration name(s) applied, if any

---

## 2026-05-11 — feat/agentplain-customer-surface-shell branch cut

- **timestamp:** 2026-05-11T00:00:00Z (build-time; deploy timestamp appended on Vercel preview)
- **branch / sha:** `feat/agentplain-customer-surface-shell` first cut at `fc32d73`, rebased onto main `78f4f9d` as `df9b49a`
- **environment:** preview (pending)
- **summary:** customer-surface shell ratified per product_spec.md §13 — OnboardingState schema + wizard, vertical picker on signup, withWorkspace tenant-isolation helper, slug↔enum bridge into main's vertical-content registry. /pricing + /signup-redirect dropped during rebase to honor marketing-truth-pass deletions.
- **routes verified** (build-time `next build` post-rebase — 20 routes total):
  - `/` (static, marketing-truth-pass copy)
  - `/about` (static, marketing-truth-pass copy)
  - `/verticals` (static, index page from PR #5)
  - `/real-estate` (SSG, PR #5 depth content)
  - `/mortgage` (SSG, PR #5 depth content)
  - `/insurance` (SSG, PR #5 depth content)
  - `/property-management` (SSG, PR #5 depth content)
  - `/title-escrow` (SSG, PR #5 depth content)
  - `/recruiting` (SSG, PR #5 depth content)
  - `/home-services` (SSG, PR #5 depth content)
  - `/cpa` (SSG, PR #5 depth content)
  - `/law` (SSG, PR #5 depth content)
  - `/ria` (SSG, PR #5 depth content)
  - `/app/sign-up` (server-rendered, vertical picker reads from `getAllVerticals()`)
  - `/app/workspace/[id]` (auth-gated; onboarding banner + vertical/tier readout)
  - `/app/workspace/[id]/onboarding` (auth-gated, 3-step wizard)
- **db migrations:** `20260511000000_add_vertical_and_onboarding` — adds `Vertical` enum (10 values, medical excluded), `WorkspaceVerticalTier` enum, `Workspace.vertical`, `Workspace.verticalTier`, `OnboardingState` model + RLS policy. Backfills `OnboardingState` for existing workspaces.
- **build script:** `prisma generate && prisma migrate deploy && next build` (flatsbo pattern verbatim per `C:\flatsbo\CLAUDE.md`). `build:no-migrate` escape hatch for local builds without `DATABASE_URL_DIRECT`.
- **typecheck:** clean
- **lint:** clean
- **tests:** 126 pass, 0 fail (was 137 pre-rebase; dropped `verticals.test.ts` + `pricing-tiers.test.ts` superseded by PR #5's `vertical-routes.test.ts`)
