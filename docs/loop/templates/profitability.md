# Profitability lens — {vertical}

<!-- Emitted by L2 (weekly Fable profitability lens), chained after L1.
     Path: docs/profitability/<run-date>/<vertical>.md
     Schema: memory/data/loop/schema.yaml → profitability_row (schema_version 1)
     Scope: ONLY wants with delivering ∈ {partial, no}. Delivered wants and
     not-in-scope wants do not get rows. -->

**Run date:** {YYYY-MM-DD} · **Journey inputs:** {paths to the L1 files read} · **Schema:** v1

## How to read this file

Each row answers two questions about one undelivered want: *how would we
deliver it* and *is it worth delivering at our prices*. Margin bands are
directional (accretive / neutral / dilutive per tier at 100 / 1k / 10k
customers), not fabricated dollar figures — we have no customer-count actuals
to anchor dollars to, and Truth Wave forbids inventing them.

Hard rules every row is checked against (violating rows are `do-not-build` or
get a redesigned delivery path):
1. **No outbound runtime** — agents draft; the customer's own system sends.
2. **BYO keys** for integrations by default.
3. **Degraded mode is a live experience** — the want must still be honestly
   described when the LLM key is paused.
4. **Cost architecture** — Haiku triage first, escalate to Sonnet/Opus only on
   need; no polling loops; prompt caching on repeated context.
5. **Service partnership, not software** — we sit on top of Claude SBM; wants
   whose delivery would position us as a competitor are `not-in-scope` upstream
   in L1 and should never reach this file.

## Rows

One `###` per want, ordered by (impact desc, build_effort asc) — the same order
L3 scans in.

### {want_id} — {want, one line}

| Field | Value |
|---|---|
| Build effort | S / M / L / XL |
| Runtime cost | none / tokens-light / tokens-heavy / integration / human-time — {which model tier, cached?} |
| Support burden | none / low / medium / high |
| Tier | regular / partner / max / all |
| Add-on viable | yes/no — {why} |
| Differentiator | table-stakes / parity / differentiator vs {incumbent} |
| Margin @100 / @1k / @10k | accretive/neutral/dilutive × 3 — driver: {one sentence} |
| **Classification** | include-in-tier / sell-as-add-on / partner-referral / do-not-build |
| **Impact** | high / medium / low |
| Rule check | outbound ✓/✗ · byo ✓/✗ · degraded ✓/✗ · cost-arch ✓/✗ |

{2–4 sentences: the delivery sketch — what we'd actually build, and what the
cheapest honest version is. Cite existing seams (files) the build would reuse.}

## Machine block

```yaml
rows: []   # list of profitability_row, same order as prose
```

## Roll-up

- Counts by classification.
- The single best include-in-tier candidate and the single best add-on
  candidate, with one sentence each on why.
