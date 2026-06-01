# Flatsbo daily-agent trio — cost audit & disposition (2026-05-29)

**Why this lives in the agentplain repo:** wave-8 cost-control sweep covers
both repos. Conner's calibration is in the agentplain memory tree; the
recommendations need to land somewhere both repos can see. The actual changes
(if any) happen in flatsbo — this doc is a coordination artifact, not a
modification.

**Scope:** the three top-of-chain "daily floor" Inngest functions in flatsbo —
flatsbo-ceo-daily, flatsbo-business-manager-daily, flatsbo-tech-lead-daily.
The b2b-* agents in flatsbo are out of scope here (they're being moved to
agentplain in wave-8 PR-1).

Files read 2026-05-29:
- `C:\flatsbo\lib\inngest\functions\flatsbo-ceo-daily.ts`
- `C:\flatsbo\lib\inngest\functions\flatsbo-business-manager-daily.ts`
- `C:\flatsbo\lib\inngest\functions\flatsbo-tech-lead-daily.ts`

## Per-agent dossier

### flatsbo-ceo-daily

| Field | Value |
|---|---|
| Schedule | `0 10 * * *` (06:00 ET during EDT, daily) |
| Triggers | Cron only |
| Model | `claude-opus-4-7` |
| Memory files | 13 (project_flatsbo, brand-standards, positioning, decisions, approval-queue, fleet-activity, ceo-recommendations, capability-learning, capability-principles, personal-tasks, low-friction-feedback, no-quick-fixes-feedback, company-context) |
| Max output tokens | 8192 |
| Min output chars | 1500 |
| Task budget | medium (~150k tokens total) |

**Rough cost per fire (Opus 4.7 pricing):**
- Memory load — 13 files × ~250 truncated lines × ~80 chars/line ÷ 4 chars/token ≈ **65k input tokens**
- Output — typical ~5k tokens
- Per-fire cost ≈ 65k × $15/M + 5k × $75/M ≈ **$1.35**
- Daily cadence × 30 days = **~$40/mo**

**Output destination:** Postgres `CronRun` row + Notion briefing DB (one page per fire, titled "FlatSBO CEO — daily state-of-the-consumer-business — YYYY-MM-DD").

**Does Conner read it?** This is the question only Conner can answer. The brief
is structured for "state of the consumer business at 6:08 ET chief-of-staff read."
If Conner reads it daily and acts on it, $40/mo is cheap. If it goes to Notion
and gets skipped, it's pure waste.

**Recommendation: KEEP, but verify reading cadence.** $40/mo is below the bar
where cost-control should drive a change. The question is whether the daily-
floor cadence still earns its place vs. a weekly cadence. If Conner is reading
the daily output 5/7 days, keep daily. If reading 1-2/week, move to weekly
cron (`0 10 * * 1` Mondays) and save 75% of cost without losing the artifact.

### flatsbo-business-manager-daily

| Field | Value |
|---|---|
| Schedule | `0 13 * * *` (09:00 ET during EDT, daily) |
| Triggers | Cron + 6 event triggers (`agent/flatsbo-business-manager.fire`, capability-builder recommendations targeting bizmgr, approval-queue ops-request, approval-queue escalation, sentry error-spike on business/finance/compliance, cs/customer-flag high severity) |
| Model | `claude-opus-4-7` |
| Memory files | 9 (project_flatsbo, company-context, positioning, approval-queue, fleet-activity, bizmgr-recommendations, decisions, personal-tasks, low-friction-feedback) |
| Max output tokens | 8192 |
| Min output chars | 1500 |

**Rough cost per fire:** ~$1.10 (smaller memory footprint than CEO — 9 files vs 13).

**Cadence reality check:** unlike CEO, this agent has 6 event triggers on top of
the daily cron. A noisy day (one ops-request + one escalation + an error-spike)
fires this 4× before the daily cron even runs. Realistic estimate: **2-5
fires/day average**, so roughly **$1.50-$5.50/day** = **$45-$165/mo**.

**Output destination:** same — Postgres `CronRun` + Notion briefing DB. One
Notion page per fire ⇒ if it fires 5× in a day, Conner sees 5 BizMgr pages on
that date.

**Recommendation: CAP TRIGGER FAN-IN.** Per-fire cost is fine but the trigger
fan-in is the cost lever:

1. The `sentry/error-spike` trigger is a meta-firing pattern — if a deploy
   regresses, you can get a burst of 10+ fires in an hour. Add a debounce or
   per-day-per-event-kind ceiling.
2. The `agent/flatsbo-business-manager.fire` catch-all gives any upstream agent
   the ability to fire this without limit. Audit who's sending it; if no one
   is, retire the trigger.

Keep the daily cron. Cap fan-in to the higher-signal events
(approval-queue/escalation, cs/customer-flag) and drop the catch-all if it's
unused. This is the highest-leverage change in the trio — could halve or
more the average daily cost without touching reading value.

### flatsbo-tech-lead-daily

| Field | Value |
|---|---|
| Schedule | `0 13 * * *` (09:00 ET during EDT, daily — fires concurrently with bizmgr) |
| Triggers | Cron + 5 event triggers (`agent/flatsbo-tech-lead.fire`, capability-builder recs targeting tech-lead, approval-queue/tech-request, sentry/error-spike high, git/main-push when touches schema or security) |
| Model | `claude-opus-4-7` |
| Memory files | 9 (project_flatsbo, codebase, decisions, product-agent-specs, approval-queue, fleet-activity, tech-lead-recommendations, no-quick-fixes-feedback, verify-after-create-feedback) |
| Max output tokens | 8192 |
| Min output chars | 1500 |

**Rough cost per fire:** ~$1.10.

**Cadence reality check:** of the three, this is the most likely to fire
multiple times daily — every push to main that touches schema OR security
fires it. On a busy dev day (10+ commits to main touching schema/security
files), this could fire 5-15×. Realistic average: **3-7 fires/day**, so
**$3.50-$8.00/day** = **$100-$240/mo**.

**Output destination:** same Postgres + Notion pattern.

**Recommendation: CAP THE `git/main-push` TRIGGER.** This is the cost driver.

1. Right now `event.data.touches_schema == true || event.data.touches_security
   == true` fires on every qualifying push. A 5-commit Wave PR firing this 5×
   in a row is pure waste — tech-lead doesn't need 5 separate reads of the
   same diff.
2. Add a 30-min debounce on `git/main-push` so a batch of pushes coalesces
   into one fire. The Sentry trigger probably wants the same treatment.

Keep the daily cron + the high-signal event triggers (approval-queue, sentry).
Debounce git-push and capability-builder events to one fire per 30-min window.
Could cut cost by 50-70% without losing the artifact.

## Aggregate trio cost (rough)

| Agent | Daily-cron only | Cron + events realistic |
|---|---|---|
| flatsbo-ceo-daily | $40/mo | $40/mo (cron-only triggers) |
| flatsbo-business-manager-daily | $33/mo | $45-$165/mo |
| flatsbo-tech-lead-daily | $33/mo | $100-$240/mo |
| **Total trio** | **~$110/mo** | **$185-$445/mo** |

## Bottom-line recommendations

| Agent | Action | Confidence | Rationale |
|---|---|---|---|
| flatsbo-ceo-daily | **KEEP** (verify Conner reads it) | Medium — depends on reading cadence | $40/mo is below the threshold for cost-driven changes; if it's noise, move to weekly |
| flatsbo-business-manager-daily | **CAP fan-in** — debounce sentry, audit/retire generic-fire trigger | High | The 6-trigger fan-in is the cost lever; per-fire cost is fine |
| flatsbo-tech-lead-daily | **CAP fan-in** — 30-min debounce on git-push and capability-builder triggers | High | Multiple-fire-per-PR pattern is pure waste |

**One last thing — these are also affected by wave-8 PR-1:** when the b2b-*
agents move out of flatsbo, flatsbo's overall API spend drops materially (the
b2b-ceo-daily was ~$1.35/day too plus event-driven fan-in). The trio above is
what's left after that move. So the right order:

1. Land wave-8 PR-1 (b2b-* move) — frees flatsbo's API key from agentplain's load.
2. Land trio fan-in caps in a follow-up flatsbo PR — biggest remaining lever.
3. Revisit CEO daily cadence weekly→monthly if Conner finds the artifact unused.

Final ask of Conner per phase-4 of the wave-8 brief: pick keep / cap / weekly /
disable for each, then file the followup. Defaults if no preference: keep CEO,
cap BizMgr + TechLead fan-in.
