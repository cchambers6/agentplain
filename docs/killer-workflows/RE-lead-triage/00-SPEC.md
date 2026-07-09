# RE killer workflow — after-hours lead triage: the discovery-call demo state

**Status:** shipped (this PR) · **Workflow ratified:** PR #359 (`docs/departments/2026-07-03/product/02-killer-workflow-RE-first.md`) · **Runtime shipped:** PR #303

## 1. The pick (confirmed, not re-litigated)

**After-hours lead triage** is THE killer workflow for Georgia real estate. The Head of Product ratified it on 2026-07-03 with the instruction not to re-pick, and this PR honors that. The four bars, restated once:

| Bar | How lead-triage clears it |
|---|---|
| **$500/mo owner-pay bar** | ~27 calibrated minutes per after-hours lead × ~2/night ≈ 27 hrs/month of licensed-agent time, counted by the conservative `ACTION_MINUTES` table — several multiples of the $199 Regular price before speed-to-lead value is even argued. One incremental commission a year pays for the product many times over, and the broker does that math themselves. |
| **Demo-in-5-min bar** | The whole story is three screens: the queue (three leads caught overnight, ranked), one open card (scored, routed, drafted), one approve click. The autoplay runtime (`/demo`) replays the night in ~40 seconds. |
| **Works-without-prod-key bar** | The triage skill is deterministic — heuristic scoring, templated composition, zero LLM calls (`lib/skills/lead-triage-realestate/skill.ts`). The seed runs it with `persister: null` and no `llm` provider. Degraded mode changes nothing about this demo. |
| **Evidence it's the real pain** | The candidate analysis in the ratified pick doc: universal broker pain (slow first response loses the client), highest trigger frequency of the three candidates (leads arrive daily; offers weekly), and the only candidate that is already built, tested, and honest under the paused key. Listing-copy is LLM-shaped with no deterministic fallback; offer-comparator is net-new surface area — both rejected there, both stay rejected. |

## 2. What this PR adds on top of the shipped runtime

PR #303 shipped the *watch-it-run* autoplay (`/app/workspace/[id]/demo`) — one synthetic lead, in-memory, nothing persisted. The discovery-call playbook (minutes 15–22) needs more: **a draft sitting in the approval queue that Conner opens, edits, and approves live.** That requires a persistent, seeded workspace. This PR ships it.

**The synthetic workspace — "Peachtree Realty Demo":**

- **Brokerage:** Peachtree Realty Demo (slug `peachtree-realty-demo`), REAL_ESTATE, Georgia. Owner login: `DEMO_OWNER_EMAIL` (default Conner's email) as BROKER_OWNER — normal magic-link/passkey auth, no special demo auth path.
- **Roster:** 4 agents (Alicia Grant — relocation/first-time buyer; Rob Delgado — luxury/investment; Maya Chen — first-time buyer; Sam Whitaker — land/commercial, *not accepting leads*, proving routing respects availability). 3 drip campaigns (nurture / cold / general).
- **Leads:** 20, spread across metro-Atlanta zips (30306–30345, Decatur, Marietta, Roswell, Kennesaw, Woodstock, Dunwoody), price bands $250K–$1.2M, seven sources (Zillow, Realtor.com, IDX, referral, open house, sphere, cold inbound). All obviously fake by construction and by test (`lib/demo/peachtree-dataset.test.ts`): `@example.com` emails, `(555) 555-01XX` phones, `999`-prefixed street addresses.
  - **3 "overnight" leads** → PENDING `LEAD_TRIAGE` approval cards (one hot, one warm, one nurture — the ranking spread is visible in the queue itself).
  - **17 prior-week leads** → APPROVED cards decided by the owner, backdated across six days.
- **Connected state:** an ACTIVE `FOLLOW_UP_BOSS` credential whose `providerMetadata.isDemo = true` and whose token is a labeled sentinel. The hourly FUB sync sweep now treats demo credentials as not-connected (`lib/inngest/functions/follow-up-boss-sync-sweep.ts`), so **no code path ever calls the vendor with the fake key**. The connections page shows Follow Up Boss connected, which is the true story of what a live workspace looks like.
- **Saved-time ledger:** `TimeSavingsEntry` rows per lead (`lead-enrichment` + `drafted-email`, calibrated by `lib/guarantee/savings-calibration.ts`) — ~290 honest minutes accrued across the week. The counter Conner shows is the same counter a paying customer earns from.
- **Substrate:** each lead is also an `isDemo`-flagged `KnowledgeDocument`; the three overnight leads have handoff-log entries so the activity trail isn't empty.

**How it's built — the load-bearing design decision:** the seed does not fabricate approval cards. It feeds the 20 fixture leads through the **production skill** (`runSkill` over the shipped `JsonLeadFetcher` port) and persists through the **production sink** (`PrismaLeadTriageApprovalSink` / `buildLeadTriageApprovalRow`, encrypted payloads and all). The demo is the real workflow on synthetic inputs. When a real brokerage connects Follow Up Boss, the only change is which fetcher feeds the same skill; when the prod key un-pauses, the optional LLM refinement layers onto the same output shape. Nothing shown on a call has to be rebuilt or walked back.

## 3. Demo flow (summary — the word-for-word script is 01-DEMO-SCRIPT.md)

1. **Trigger:** Conner opens the workspace Today view. Because three PENDING approvals exist, the workspace presents as a working brokerage the morning after — not an empty trial.
2. **The queue:** three leads caught overnight (9:14pm, 10:47pm, 7:03pm), already ranked hot / warm / nurture.
3. **The card (the lean-in beat):** the 9:14pm Zillow lead — scored (motivation/timeline/preapproval), routed to the relocation specialist by name with a rationale, first-touch reply drafted with the two-showing-windows slot, all stamped 9:16pm. **Two minutes after the lead landed, while the broker was at dinner.**
4. **The approve:** one click. The draft-only / no-outbound contract is said out loud — approval hands the draft to *their* sending system; agentplain never sends.
5. **The ledger:** the saved-time counter, accrued from the same week of triage, counting calibrated minutes per action — the renewal math, visible.
6. **Watch-it-run (optional replay):** `/demo` autoplays the whole night in 40 seconds for the visitor who wants to see the machinery move.
7. **The pivot:** "That's a demonstration workspace on synthetic data — you're seeing the real product, not your data. Connecting your Follow Up Boss makes this your queue." (Playbook line, verbatim.)

**The output artifact the broker sees:** a personalized, send-ready first-touch email + a named routing decision + the scores that justify both — sitting in a queue waiting for one human click. Not a chat window. Not a report. The night's work, done, gated on their approval.

## 4. Honesty affordances (Truth Wave / locked rules compliance)

- Every synthetic identity is flagged and test-enforced fake; the brokerage name itself says "Demo".
- The demo claims nothing about customers: no "trusted by" pill, no invented conversion stats. The speed-to-lead argument is structural, per the ratified pick doc.
- Drafts carry explicit `{{operator: …}}` slots for showing windows and signature — the product **never invents the broker's calendar**, and the script calls that out as a feature.
- Model/vendor never appears on any demo surface (the runtime and cards already comply; the seed adds no new customer-facing strings).
- One lead (open-house walk-in, phone only) is triaged but honestly reports "draft skipped — missing email" — the demo shows the product declining to fabricate a channel.
- No-outbound architecture is the demo's spine: the approve action is the whole point of the third beat.

## 5. Operations

| Action | Command |
|---|---|
| Seed / re-seed | `npx tsx prisma/seed-demo.ts` |
| Reset between calls | `node scripts/reset-demo.mjs` |
| Point at a different owner login | `DEMO_OWNER_EMAIL=… node scripts/reset-demo.mjs` |
| Seed on the production DB | add `DEMO_SEED_ALLOW_PRODUCTION=peachtree` (script refuses otherwise; it only ever touches the `peachtree-realty-demo` slug) |

Requires the app's normal env (`DATABASE_URL`, `ENCRYPTION_KEY` — approval payloads are encrypted at rest). Reset is delete-and-recreate: cards Conner decided on the previous call return to PENDING, and every timestamp re-anchors to "last night."

Cost guardrails note (runbook 06): the demo workspace runs zero LLM calls, but it should still carry the minimal per-workspace cap ($5/mo + $1/day) once per-workspace caps land, per the pilot runbook's recommendation for non-partner workspaces.

## 6. Demo→live cutover (unchanged, restated)

The `isDemoMode` contract and the cutover checklist in the ratified pick doc still govern: the moment a real workspace has real approvals, demo surfaces step aside. The Peachtree workspace is a *separate seeded workspace*, not a mode of a customer workspace — it never touches, and can never leak into, a design partner's data.
