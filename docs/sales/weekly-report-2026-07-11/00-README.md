# Weekly design-partner report — narrative writer pack

**Written 2026-07-11 (Fable audit #387, item A2-a). Docs + typechecked reference code, deliberately unwired.** This folder is the production prompt suite for the Friday report a design partner reads and Conner signs — built now so the writer exists before the first partner's first Friday, not after it.

## What already exists (do not rebuild)

The Friday report is **already a shipped, deterministic email** on main:

- **Data:** `lib/reports/weekly-report-data.ts` — drafts created, approvals/rejections with median time-to-approve, workflows fired, saved-time hours, per-vertical outcomes, look-ahead. Every figure traces to `WorkApprovalQueueItem` rows or the saved-time ledger (`TimeSavingsEntry`, calibrated by `lib/guarantee/savings-calibration.ts`).
- **Render:** `lib/reports/weekly-report-email.ts` — deterministic template, no model call, honest quiet-week state.
- **Send:** `lib/inngest/functions/weekly-customer-report-sweep.ts`, cron `0 12 * * 5` — **Fridays 12:00 UTC ≈ 8:00am ET**, reporting the **prior completed Mon–Sun week** (`resolveReportedWeek`). Gates: opt-out, billing pause, no-recipient, already-sent idempotency.

Two corrections to the commissioning brief, per the artifacts: the report fires **Friday morning (8am ET)**, not Friday 5pm — the week-1 runbook's "Friday morning you'll get an email from Plaino" and the Day-5 call opener both depend on the morning fire, so the code is right and the brief was wrong. And the reported window is the *prior* Mon–Sun week, which produces a real pilot-week-1 problem — see the dry-run P0 list (`docs/pilot/dry-runs/2026-07-11-hypothetical-partner-1/07-observed-P0-list.md`, P0-2) before wiring anything here.

## What this pack adds

A **narrative layer** on top of that data: the first-person note from Plaino that makes the Friday email read like a colleague reporting in rather than a stat block. The deterministic email stays the surface of record; the narrative writer produces the story that sits above the numbers.

| File | What it is |
|---|---|
| `01-prompt.ts` | The production prompt: cached system prompt (writer + voice + truth rules), cached partner-profile block, cached week-data block, uncached per-call suffix. Generation loop with one corrective retry, validated by the schema. Compiles against `lib/llm/types.ts` and `lib/reports/weekly-report-data.ts`. |
| `02-schema.ts` | Zod contract for the narrative object. Enforces at the schema layer: every metric carries a `source_row_id`, no vendor/model names anywhere, the worst voice-gate phrases rejected. |
| `03-golden-examples.md` | Three full golden outputs — happy-path week, mixed-bag week, one-thing-broke week — on labeled SAMPLE data. These set the bar. |
| `04-voice-guide.md` | How the report speaks. Not marketing, not a compliance report. |

## Who reads the report

1. **The design partner** — a Georgia broker-owner, over Friday coffee. The report is the retention heartbeat and the artifact the Friday call runs on ("You got Plaino's report this morning — is it lying?", runbook doc 03).
2. **The internal fleet + Conner** — the same structured object feeds the Day-4 call-brief prep (runbook doc 03 §Day 4), so Thursday's brief and Friday's email can never disagree with each other: one data pull, two renders.

## Truth Wave rules (non-negotiable, enforced in three layers)

- **Numbers come from the saved-time ledger and workspace instrumentation only.** The writer's input is `WeeklyReportData` plus raw ledger/approval rows; the prompt forbids computing, extrapolating, or estimating; the schema rejects any quantified line without a `source_row_id`; and the known ledger gap (the lead-triage path writes no saved-time rows in production — dry-run P0-3) means the hours figure carries that asterisk until Engineering closes it.
- **Incidents in, always.** Anything that broke and was (or should have been) disclosed mid-week appears in `watches`. No Friday surprises in either direction (runbook doc 03).
- **Quiet weeks are quiet.** `isEmpty` weeks produce the honest quiet-week narrative, not manufactured momentum.
- **Model vendor invisible.** No provider or model name on any partner-facing string — schema-enforced; the sole company-wide exception remains the `/privacy` + `/security` subprocessor lists.

## One deliberate deviation from the brief

The brief specified a `chiron_voice_signature` field. Chiron is the homeschool product; the named service partner on every agentplain surface is **Plaino** (`project_plaino_named_agent`). The field ships as `plaino_voice_signature`. Same intent — a one-line first-person sign-off tied to something that actually happened — right cast member.

## Wiring gate (why this is unwired)

Promotion to `lib/reports/` happens only when all three hold:

1. **P0-2 (first-Friday window) is resolved** — otherwise the narrative writer would narrate the wrong week to the first partner on the most important Friday of the pilot.
2. **P0-3 (lead-triage saved-time writer) is closed or the asterisk copy is ratified** — the first number the partner ever sees must survive scrutiny (runbook doc 03).
3. **Conner approves the golden examples as the bar** — they are the acceptance test; the first live generation is diffed against them by a human before anything sends.

Until then, the intended first consumer is **Conner's Day-4 prep**: run the writer manually against the partner workspace Thursday, read it, and let the Friday email stay deterministic. The narrative earns its way onto the customer surface by being right four Fridays in a row.
