# Head-of-{DOMAIN} pass — parametric prompt template

**Domain:** orchestration · **Kind:** ready-to-paste dispatch prompt · **Seeded by:** the ten head-of-department passes in `docs/departments/2026-07-03/{customer-success,data-analytics,design,engineering,finance-ops,fleet-ops,legal-compliance,marketing,product,sales}/00-EXECUTIVE-PLAN.md` and their COORDINATION reconciliation.

## What it produces

One department's **14-day executive plan** written to `docs/departments/<date>/<domain>/00-EXECUTIVE-PLAN.md` plus 5–6 topic files (first-partner runbook, success criteria, what-I-need-from-others, what-we-must-stop, profit-contribution). Decisions and a day-by-day table — not analysis.

## When to use — trigger phrases

- "run a Head of {Sales / Marketing / Eng / CS / Legal / Data / Design / Fin-Ops / Fleet-Ops / Product} pass"
- "what would the head of {domain} do in the next two weeks"
- "I want a departmental plan-of-record before Monday"

## Inputs

- `{DOMAIN}` — the department (Sales, Marketing, Engineering, …).
- `{DOMAIN-SPECIFIC-CONTEXT}` — the audit(s), retro, and memories relevant to this domain (cite exact paths).
- `{DOMAIN-SPECIFIC-DELIVERABLES}` — the 5–6 topic files this head must produce beyond the executive plan.
- The **ratified-frame preamble** (see `../governance/ratified-frame-preamble.md`) — always prepended.

## The template (paste, fill the {braces})

```md
{{RATIFIED-FRAME-PREAMBLE}}   <!-- paste ../governance/ratified-frame-preamble.md, facts refreshed -->

# You are the Head of {DOMAIN} for agentplain.

Write a 14-day executive plan as if this function reported to you. This is a design-FOR-profitable
pass (loop v3): every recommendation must move toward the first paying Georgia RE design partners
and founder-inclusive profitability, or it does not belong in the window.

## Context you must read first (do not re-derive; cite what you use)
{DOMAIN-SPECIFIC-CONTEXT}
- Relevant full audit(s): docs/audits/full-audit-2026-07-02/agentplain/{NN-surface}.md
- Relevant kaizen retro: docs/kaizen/2026-07-02/{NN-department}.md
- Relevant memories: {feedback_* / project_* slugs}

## Deliverables — write these files under docs/departments/{DATE}/{domain-slug}/
1. `00-EXECUTIVE-PLAN.md` with EXACTLY this skeleton:
   - **Header**: date, author ("Head of {DOMAIN}"), mandate ("design FOR profitable").
   - **Current state**: customer count, ratified constraints, what's live, what's killed for this function.
   - **The shape of this function at this scale**: one honest paragraph (e.g. "CS at n=0 is a
     rehearsed first hour, not a department").
   - **Day-by-day table**: | Day | Owner | Action | Exit test |  (Days 0–14).
   - **Explicit stops**: what this department does NOT do in this window.
   - **Success criteria**: primary (the single metric), secondary, anti-goal.
   - **The one decision Conner must make before execution** (trigger + scope + a number).
2. {DOMAIN-SPECIFIC-DELIVERABLES}   <!-- 5–6 topic files, one concern each -->

## Output discipline
- Decisions, not narrative. Day-table rows have a testable **exit test**, not a vibe.
- Every claim carries a signal ref or `todo-real-signal`. Cite real PR#/path (Truth Wave).
- End the executive plan with the single decision you're escalating to Conner.

## Report back (see ../orchestration report-back format)
- The file paths you wrote.
- Your top 3 findings.
- The ONE decision Conner must make, stated as trigger + scope + number.
```

## Output shape

`docs/departments/<date>/<domain>/00-EXECUTIVE-PLAN.md` + 5–6 topic files, each following the skeleton above. The COORDINATION pass then reconciles all heads into one plan-of-record and a handoff matrix.

## Guardrails

- **Prepend the ratified frame.** Without it, heads drift audience/positioning and propose killed work (a Sales head proposing CPA/law GTM violates KILL #2).
- **One forced decision per head, not a list.** The value of the pass is converging to the *single* thing Conner must decide (e.g. CS head → prod-key un-pause trigger/scope/cap).
- **Exit tests, not activities.** "Draft 5 emails" is an activity; "5 sends out, ≥2 replies by Jul 17" is an exit test.
- **Cite, don't estimate.** Numbers come from audits/retros/memory or are marked `todo-real-signal`.
- Docs-only. A planning pass proposes fixes; it does not ship code.

## Worked example

The Head of Sales pass (memory: PR #363) produced `docs/departments/2026-07-03/sales/00-EXECUTIVE-PLAN.md` naming 5 GA RE prospects (Adams/Cannon/Path&Post/Atlanta-Intown/ARE-Brokers, alt Watson), a day table for the Monday 07-06 outreach block, and one forced decision surfaced to Conner. The Head of CS pass (PR #361) converged its whole plan onto a single decision — the prod-key un-pause trigger/scope/$50-cap (flagged `NO_CAP unsafe`) — which is exactly the "one decision" discipline working.
