# Measurement gates for paid ads — the 4-condition gate, operationalized

The spend gate is ratified in the marketing deep-dive (`04-ad-creative-and-distribution.md`, "THE SPEND GATE") and re-ratified in the 2026-07-03 kill list ("no paid until measurement wired"). This document does not renegotiate it; it turns each condition into a checkable data assertion, names the checker, and defines what evidence opens the gate. **All four must be green simultaneously. The gate is checked on the Friday scorecard; it is never checked mid-week under enthusiasm.**

## Condition 1 — Front door fixed

*Original:* audit dept-1 P0/P1s closed, the `/how-it-works` redirect above all.

**Data assertion:** every P0/P1 row from `docs/audits/full-audit-2026-07-02/agentplain/01-marketing-home.md` has a merged PR reference. The `/how-it-works` unshadowing shipped in the send-path wave (PR #355); the remaining rows are checked against main, not against intentions.
**Checker:** me, against the audit table; Engineering confirms merge SHAs.
**Evidence to open:** a row-by-row table in the Friday scorecard, each row PR-linked. No "mostly done."

## Condition 2 — Measurement wired

*Original:* analytics + UTM discipline + "how did you hear about us" live.

**Data assertion, all of:**
- The four marketing goal events writing rows (trial-start begun, trial-start completed, talk-to-a-partner submitted, guarantee-page view).
- `signup.attributed` capturing UTM + self-report, with **source-known rate >80%** over the trailing 2 weeks — the wiring existing is not enough; it has to demonstrably capture.
- The UTM convention document applied to every live outbound link (spot-checked).
- The activation funnel dashboard producing scorecards for **2 consecutive weeks with no `dataGaps` line affecting its top 3 rows** — an instrument proves itself by running, not by merging.
- `/privacy` updated for whatever shipped, through the counsel packet.

**Checker:** me. This condition is this department's own deliverable; if it's red, that's my name on it.

## Condition 3 — First proof asset earned

*Original:* at least one permissioned design-partner quote for the vertical being tested.

**Data assertion:** one CLOSED-WON row in the outbound funnel whose partner has signed the permission to be quoted (sales doc-05 case-study template), for the same vertical the ad test targets (realty first). Anonymous "a customer says" copy is banned and does not count.
**Checker:** Sales/GTM produces it; I verify the chain — the quote must trace through the CRM row to a real workspace with real activation events. A proof asset our own funnel can't corroborate is a liability, not an asset.

## Condition 4 — Ratified GTM order respected

*Original:* founder-led design-partner outreach is the #1 channel; paid amplifies a working motion, it never substitutes for one.

**Data assertion:** the outbound funnel shows ≥4 of the trailing 6 weeks hit the 5-sends target, and at least one partner reached DEMO or beyond through the founder channel. "Working motion" is a measured cadence, not a vibe. If sends stalled and paid is proposed as the workaround, the gate is doing exactly what it was built for: **paid spend to avoid founder sends is the specific failure mode this condition exists to block.**
**Checker:** the Friday scorecard row is the evidence; nobody has to argue.

---

## When the gate opens

The first test inherits the marketing plan's budget logic (realty first, ~$3–5K/month worst-case concurrent exposure, one vertical at a time) and adds one measurement precondition of its own: **cost-per-qualified-trial-start must be computable from day one** — platform spend (Finance-Ops rollup) over qualified trial starts (activation funnel), reviewed weekly with the continue/kill/rebalance decision attached. A paid test we can't score weekly is a test we don't run.

## When the gate stays shut

If the gate never opens this quarter, the realty budget rolls to photography production (already the ratified fallback). A shut gate with honest instruments is a decision; a shut gate is not a failure state. The failure state is spending around it.
