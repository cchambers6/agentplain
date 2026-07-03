# Audit 7/10 — Weekly BI + insight surfaces

- **Date:** 2026-07-02
- **Pinned at:** `origin/main` @ `f928400` (merge of #316, Heritage Plains Editorial)
- **Scope (per Strategic 7):** `lib/inngest/functions/weekly-bi/`, `lib/bi/insights/`, `components/bi/WeeklyBrief.tsx`, Reports tab surface, email delivery via Resend.
- **Verdict:** The spec'd module does not exist under those names — but a **real, well-built weekly BI capability ships today** under `lib/reports/` + `lib/measurement/` + the Reports tab. What exists is honest, deterministic, tested (33/33 pass locally), and vendor-invisible. The gaps are: **the flagship weekly email escapes both brand-gate and voice-gate and has already drifted off the Heritage palette (P0)**, two overlapping weekly emails with independent opt-outs (P1), a fixed-600px email layout at 375 px (P1), and the Strategic-7 insight-library ambition (50+ detectors, per-insight muting, thresholds, customer-local delivery) is unbuilt (P1).

---

## 1. What actually exists (the map)

The Strategic-7 names (`lib/bi/insights/`, `weekly-bi/`, `WeeklyBrief.tsx`) match nothing on main. The real weekly-BI stack is:

| Surface | Where | Cadence / gate |
|---|---|---|
| **Weekly customer report email** (rich: outcomes, stats, workflows, look-ahead) | `lib/reports/weekly-report{,-data,-email}.ts` + `lib/inngest/functions/weekly-customer-report-sweep.ts` | Friday `0 12 * * 5` UTC ≈ 8am ET; gated by `WorkspacePreference.weeklyReportEnabled` (default on) |
| **Weekly proof-of-value digest** (thin: headline numbers + deep link, persists a `WorkspaceBriefing` row) | `lib/measurement/weekly-digest{,-data,-email}.ts` + `weekly-proof-digest-sweep.ts` | Monday `0 12 * * 1` UTC ≈ 8am ET; gated by briefings mute |
| **In-app live twin** of the Friday email (current week building + 4 weeks history + email toggle) | `app/(product)/app/workspace/[id]/reports/weekly/page.tsx` | Reuses `computeWeeklyReportData` — email and dashboard cannot drift |
| **Reports hub** (J4 door: weekly value / compliance / briefings) | `app/(product)/app/workspace/[id]/reports/page.tsx` | — |
| **Analytics weekly pulse** (per-workspace analytics draft into the approval queue) | `analytics-weekly-pulse-sweep.ts` | Monday 8am ET; skill-installed gate |
| **"Insight" layer** — per-vertical outcome phrasing (kind → trade language) | `lib/reports/vertical-outcomes.ts` | ~16 phrase mappings: 5 vertical builders (RE 4, PM 1, CPA 2, HS 1, Law 2) + 6 generic kinds |

Email delivery goes through the `lib/email/` seam (`resend-provider.ts`) — Resend behind an interface, per `feedback_no_silent_vendor_lock`. Inngest registration is filesystem-derived (`lib/inngest/registry.ts`), so both sweeps register automatically.

## 2. Checklist verdicts

| Verify item | Verdict | Evidence |
|---|---|---|
| 50+ pattern detectors defined + tested | ❌ **Not built.** | No `lib/bi/insights/`. Closest analog is `vertical-outcomes.ts` (~16 kind→phrase mappings, tested). `lib/kaizen/pattern-detectors.ts` is internal fleet self-improvement, not customer BI. |
| Narrative renders Plaino-voice prose, not a dashboard | ✅ | `weekly-report-email.ts` — deterministic template, calm partner-reporting-in register ("Plaino drafted 42 things and you approved 38, saving you ~6 hours"), sections that had no activity simply don't render. No LLM in the hot path (correct: reproducible ROI surface). |
| Empty state | ◐ Partial | Honest "quiet week" state exists in email + in-app ("Plaino is still learning your business, watching your inbox…"). The spec'd "connect X to unlock" generative-CTA form is absent — the empty state names no missing connection. |
| Delivery cron Monday 7am customer-local | ❌ | Friday 12:00 UTC (report) + Monday 12:00 UTC (digest); both fixed-UTC ≈ ET, drifting an hour across DST. No customer-local logic; the only IANA-timezone field in the schema (`SkillScheduleWindow.workspaceTimezone`) is not wired to either sweep. A Pacific owner gets the Monday digest at 5am; a customer in Europe gets it mid-afternoon. |
| Owner can mute insight types / customize thresholds | ❌ | Single global toggles only: `weeklyReportEnabled` (Friday email) and briefings mute (Monday digest). No per-insight-type muting, no thresholds. |
| No fabricated numbers | ✅ Strong | `feedback_no_guesses_no_estimates` is obeyed structurally: dollar outcomes render only when a real invoice/estimate amount rode the payload (`hasRealDollars`); labor estimates stay in the ledger section, labelled. Look-ahead derives from real pending rows. Copy never says "sent" where it means "drafted". |
| Voice-gate on all narrative | ❌ **Gate blind spot.** | Both `tools/brand/voice-gate.mjs` and `brand-gate.mjs` scan the same six named email templates — `lib/measurement/weekly-digest-email.ts` is in the list; **`lib/reports/weekly-report-email.ts`, `weekly-report-data.ts`, and `vertical-outcomes.ts` are not**, and `lib/reports/` is in neither gate's directory roots. The richest recurring customer email is ungated. (Manual check: copy itself is clean — no VA–VE hits, ≤2 em-dashes per rendered line.) |
| Model-vendor invisible | ✅ | Zero `Claude`/`Anthropic` matches across `lib/reports/` and the report surfaces. Sign-off is "— Plaino, your service partner at agentplain". |
| Heritage Plains styling in report + email | ◐ In-app ✅ / Email ❌ **drifted.** | In-app pages use `ApPaperCard`/`ApEyebrow`/heritage utilities. The Friday email hardcodes the **pre-#316 palette** (`#F7F4ED/#1A1A1F/#2E2E33/#B65D3A/#9A4D2F/#E0DAC9`) under a stale "mirrors app/globals.css" comment; globals.css now carries `#F5F0E6/#1A1612/#34302A/#B85540/#97402E/#D8CFBA`. The gated Monday digest email was updated to heritage values — direct evidence the gate gap is what let the Friday email drift. |
| Mobile: reads at 375px | ◐ In-app ✅ / Email ⚠ | In-app weekly page is fluid Tailwind (flex-wrap stat rows, no fixed widths). The Friday email's outer table is `width="600"` + `style="width:600px; max-width:600px"` with **no `width:100%` fluid fallback** — at 375 px, clients that don't shrink-to-fit (older Outlook mobile, some Android clients) horizontally clip; Gmail zoom-out shrinks the 16px body to ~10px effective. |

**Tests:** 33/33 pass locally (`lib/reports/*.test.ts` 29 across 5 suites: render, gates, idempotency, CAN-SPAM footer, HTML escaping, quiet-week; sweep test 4). Real strengths worth naming: RFC 8058 one-click List-Unsubscribe headers, AuditLog-keyed same-week idempotency, billing-pause + opt-out + no-recipient gates, signed unsubscribe token.

## 3. Findings

### P0-1 · Weekly report email escapes both CI gates and has already drifted off-brand
`lib/reports/weekly-report-email.ts` ships to every active workspace owner every Friday, yet is invisible to brand-gate (hex canon) and voice-gate (LLM-ese). The predicted failure already happened: it carries the retired pre-Heritage palette while the gated sibling (`weekly-digest-email.ts`) was correctly retuned in the #316 rollout. Fix is two-part: add `lib/reports/weekly-report-email.ts` (and ideally `vertical-outcomes.ts` + `weekly-report-data.ts`, which carry narrative strings) to both gates' surface lists, then update the palette to the Heritage tokens. Structural option: both gates share the same hand-maintained six-file email list — extract one shared "customer email templates" manifest so the next email template can't be forgotten twice.

### P1-1 · Two overlapping weekly proof-of-value emails, two independent opt-outs
Monday's digest and Friday's report both cover the same prior Mon–Sun week ("what Plaino did for you last week"), to the same recipient, behind different toggles (briefings mute vs `weeklyReportEnabled`). A customer gets the thin version Monday and the rich version of the *same week* Friday — reads as either a duplicate or an inconsistency, on the surface whose whole job is renewal trust. Needs a product call (Conner): consolidate to one weekly email (the rich report, arguably on Monday — spec agrees), or clearly differentiate ("week ahead" vs "week in review") and unify the opt-out.

### P1-2 · Friday email is fixed 600px — degraded at 375px
Outer table lacks the fluid hybrid pattern (`width:100%; max-width:600px`). The Monday digest email is fluid (plain body, no fixed table). One-line fix plus a render check across Gmail iOS/Android.

### P1-3 · Strategic-7 insight library unbuilt
No `lib/bi/insights/`, no detector library (16 phrase mappings vs the spec'd 50+), no per-insight muting, no thresholds, no customer-local Monday-7am delivery, no "connect X to unlock" empty state. The good news: the substrate to build it on is solid and already audited-honest (`computeWeeklyReportData` + the value ledger + `WorkspaceBriefing` persistence + the fluid `vertical-outcomes` builder pattern is exactly the detector shape to extend). This is a build item, not a fix — and it should reuse, not rebuild, the existing stack.

## 4. What's genuinely good (don't rebuild)

- One aggregator feeds email + dashboard — they cannot drift.
- Truth-Wave discipline is structural, not editorial: real dollars only when carried on payloads; "drafted" never "sent".
- Deterministic render was the right call for an ROI-proof surface (also LLM-key-outage-proof).
- Gates/idempotency/deliverability (one-click unsubscribe, postal address, billing-pause) are production-grade.

## 5. Estimated spend

Single-agent audit, no subagent fan-out: ~**$4–6** of Fable tokens (worktree setup + ~15 file reads + 2 test runs + report). Well under any ceiling.
