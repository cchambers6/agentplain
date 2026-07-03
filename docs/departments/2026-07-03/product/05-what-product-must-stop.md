# The product freeze list

The audits said it once ("the built-and-marketed surface area exceeds what a one-operator company can keep truthful") and the CEO kill list ratified it. This is Product's enforcement copy: what is frozen, what the trigger to thaw is, and what happens to the copy that marketed it. **Frozen means: no build, no polish, no spec, no "small improvement" PRs.** Truth-fixes to stop marketing a frozen thing are always allowed — they're subtraction, not investment.

| # | Frozen workstream | Disposition | Thaw trigger |
|---|---|---|---|
| 1 | **Client portal** | OFF (ratified). Routes gated; the S-effort safety net only (RLS + teardown on the 9 PII tables so the liability closes). No PORTAL-1..6 wave. Remove portal marketing from every surface | First signed design partner who needs client document exchange |
| 2 | **CPA / law / property-management / general productization** | Frozen. Two cheap exceptions ride as truth-fixes, already sanctioned: stop advertising TaxDome/Karbon as available (or ship the api-key forms if E1's pattern makes it truly S), and the QBO books-recon worker only if it costs nothing from the RE path | 2 RE pilots live |
| 3 | **LLM-dependent features** (listing-copy drafting, richer chat, insight generation, anything whose customer value needs the key) | Queue-blocked | Prod-key un-pause |
| 4 | **BYO storage** | Flag-gated; marketing copy removed (it currently has zero write path — audit 10 P0-3) | A paying Partner-tier customer asks, and the credential path gets funded as a unit |
| 5 | **Insight library / 50-detector BI ambition** | Killed as a spec; the shipped `lib/reports` stack is the reconciled reality (kaizen friction 4). Reports tab improvements limited to honesty fixes | Post-profitability roadmap cycle |
| 6 | **Voice/Twilio expansion** | Frozen at the shipped env-gated layer | A pilot asks for voice, post-un-pause |
| 7 | **Mobile app store push (EAS/TestFlight)** | Frozen (was infra-blocked anyway) | 2 pilots live + a pilot actually asking for the native app over the responsive web app |
| 8 | **New connectors** beyond the FUB activation path | Frozen — including kvCORE/BoldTrail/FMLS/GAMLS (XL, partner-program-gated). The roster's 5-of-8 "rooting" agents stay honestly labeled **Setting up / Needs a connector**, not promised | A signed RE pilot whose workflow is blocked on a named CRM/MLS |
| 9 | **Seasonal-pause billing** | do-not-build (already ruled by the profitability lens) | — |
| 10 | **New audit / retro / journey / planning loops from Product** | Stopped. Product's analysis budget for 14 days is: discovery-call deltas against 01, nothing else | Top-20 rows 9–14 merged and read back |
| 11 | **New verticals, new surface area, period** | Locked rule restated. The test for any build request: is it in 00's tables or this freeze list's sanctioned exceptions? If not, it waits | Ratified roadmap change from Conner |

## The enforcement mechanics (so this list isn't a vibe)

1. **Copy follows the freeze.** Anything frozen that today's surfaces market present-tense gets a truth-fix PR (remove or "coming soon") — Pattern 1 of the master synthesis is copy outrunning runtime; a freeze without a copy sweep just widens that gap.
2. **PR review question:** "which line of 00 or which sanctioned exception does this serve?" A feature PR with no answer is declined, politely and without a meeting.
3. **The freeze list is versioned here.** Thaws happen by editing this file in a PR that names the trigger being met — not by drift.

## What this buys

At 3–9 customers to cash-breakeven, the scarce inputs are Conner's hours and fleet landing capacity — not ideas. Every frozen row above returns capacity to the only three product artifacts that convert a Monday email into a paying broker: the five-minute path, the killer workflow, and a dashboard that never lies.
