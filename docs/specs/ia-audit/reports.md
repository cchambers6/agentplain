# Weekly report — IA audit

Files read (via `git show HEAD:`): `app/(product)/app/workspace/[id]/reports/weekly/page.tsx`, `app/(product)/app/workspace/[id]/reports/weekly/actions.ts`. Referenced: `lib/reports/weekly-report-data.ts` (`computeWeeklyReportData`), `lib/onboarding/service-partner.ts`.

## What this tab IS today

The Weekly report tab is the **in-app twin of the Friday "weekly report" email**. Its own comment in `page.tsx` says it: a "customer-facing twin of the Friday weekly report email" rendering "the EXACT numbers the email carries… so the owner can see the report is real, pulled straight from their workspace, not marketing copy."

The page shows:
- A hero: "What {partner} did for you, week by week." plus the Friday 8am email cadence. `{partner}` resolves to "Plaino" via `servicePartnerForWorkspace`.
- An **email-preferences card** (`id="email-preferences"`, the anchor target for the email-footer unsubscribe link) with a single on/off toggle wired to `setWeeklyReportEnabledAction`. The action upserts `WorkspacePreference.weeklyReportEnabled` and writes an `auditLog` (`weekly_report.enabled`/`.disabled`, `payload.via: "dashboard"`).
- A **"this week so far"** live `ReportCard` (current in-progress week).
- A **"previous weeks"** list of `HISTORY_WEEKS = 4` completed-week cards.

Each `ReportCard` mirrors the email's section order: drafts created, approvals approved (+ median time-to-clear), actions auto-handled, approvals "sent back," dollars influenced (only when `hasRealDollars`), vertical outcomes, and a Plaino "look-ahead" `needsInput` list. Empty weeks get a calm "A quiet week" state. Data comes from one shared aggregator, `computeWeeklyReportData`, called for the current week (`now + 7d`) and per historical week (`now - k*7d`) — the same function the cron + email use, so dashboard and inbox "can never drift." Read-only except the one toggle. BROKER_OWNER-gated, RLS-scoped.

## Customer job (JTBD)

Primary job, verbatim: **"Did I get my money's worth?"** This is *the* retention/value-proof surface. Sub-jobs: prove value in owner terms ("12 drafted · 4 approved · ~3.5h saved," "$X in real dollars," vertical outcomes); trust the number (the live card + "pulled straight from your workspace, so you can see it's real" answers the skeptic); look ahead (Plaino's `needsInput` turns a receipt into a forward nudge); control the email. Top-3 customer job; the single best money's-worth artifact in the product.

## Duplications

1. **Email vs. in-app twin** — intentional, *good* duplication via the shared aggregator. Keep.
2. **Briefings overlap (the real one)** — Briefings is also "Plaino tells you what happened," at daily/event cadence vs. this tab's weekly rollup. Same JTBD at two horizons, two top-level tabs. Core IA duplication to collapse.
3. **Value vs. cost split with Settings/Billing UsagePanel** — Settings has the cost side, this tab the value side; the owner's "is it worth it?" needs both in one place. Different vocab registers (this tab clean owner-vocab; UsagePanel risks token/cost leakage).
4. **Look-ahead vs. Approvals/Activity** — `needsInput` restates the "waiting on you" signal that also lives in Approvals/Activity. Acceptable as a digest.

## Relationships

- **Briefings** — sibling "what happened," finer cadence; strongest merge candidate.
- **Approvals** — look-ahead points back here; approved/sent-back counts derive from Approval state.
- **Activity** — the per-event log this rolls up.
- **Settings → email/notification prefs** — the toggle here flips the same `weeklyReportEnabled` column as the email-footer unsubscribe.
- **Settings → Billing/UsagePanel** — the cost half of money's-worth.
- **Friday cron + weekly email** — upstream producers, same flag + aggregator.
- **Vertical outcome packs** — `verticalOutcomes` is where per-vertical value language enters.

## What's broken or confusing

- **Two tabs, one job** — Weekly report + Briefings + (value half of) Settings billing answer one question across three nav entries.
- **Email-pref toggle in two mental homes** — correct here, but also belongs in Account/notifications; owner may hunt in Settings and miss it.
- **Borderline vocab** — "auto-handled," "sent back," "to clear" are owner-readable and acceptable, but "auto-handled" leans toward the engineer "auto-executed" concept; watch for drift. Internal field `actionsAutoExecuted` is never rendered as that label — no leak. No "rooting/live/fire/runtime/slug/skill/token" leaks in rendered copy.
- **History hard-capped at 4 weeks**, no "see more," no monthly roll. An owner 3 months in can't see a quarter of value in one glance — exactly when renewal doubt peaks. Route is `/reports/weekly` (implies a future `/reports/monthly`) but only weekly exists; IA pretends extensible, content isn't.
- **No spend anywhere on the value page** — money's-worth = value ÷ price, and price is absent from the surface named for that job.

## What's working

- **Shared-aggregator design** — one `computeWeeklyReportData` powering cron, email, and dashboard makes "this is real" structurally true. The model the whole Reports bucket should inherit.
- **Owner-vocab altitude is right** — value in business terms, not tokens/cost.
- **Calm heritage voice holds** — "A quiet week… That's normal early on."
- **Live "this week so far" card** proves freshness; **look-ahead** is retention-positive; **audit-logged preference change** is clean.

## Verdict

**KEEP as the anchor of a renamed `/reports` tab — bucket (D) Reports.** Load-bearing core of the Reports bucket and the product's best money's-worth surface.

- **Promote `/reports/weekly` → `/reports`**, weekly as default sub-view, IA extensible to monthly/quarterly.
- **MERGE Briefings INTO Reports** as the finer-cadence "what happened" view — same JTBD, different horizon.
- **PULL a spend-vs-value summary INTO Reports** (derived from UsagePanel, stripped of token internals) so money's-worth is answered in one place; leave raw billing in Account.
- **Fold a compliance-assurance summary** ("N items checked, 0 issues") in as a *trust* line → Reports becomes the unified **"value + trust"** surface; full Compliance detail stays separate.
- **MOVE the email toggle's canonical home to Account/notifications**, keep a contextual mirror here; both flip the one `weeklyReportEnabled` column.

## Migration notes

- **No data-model change for the merge** — the aggregator pattern is the template; Briefings/monthly are added calls behind one `/reports` shell, not new tables.
- **Route move:** `/reports/weekly` → `/reports` with `weekly` as index; **keep `/reports/weekly` as a redirect** so the Friday email deep link and the `#email-preferences` anchor survive (or one-click unsubscribe breaks).
- **Preserve the shared-source guarantee** — any new sub-view must read the same aggregators the email/cron use.
- **Email-pref toggle:** keep `setWeeklyReportEnabledAction`; update its `revalidatePath` if the route moves; audit-log action names can stay.
- **Vocab guard:** when importing the spend summary, strip token/cost-internal language and re-express in owner terms. Reports must inherit *this* tab's clean register, not Settings'.
- **History depth:** raise `HISTORY_WEEKS` / add monthly roll-up at the same time as the route promotion so the extensible shell isn't shipped empty.
