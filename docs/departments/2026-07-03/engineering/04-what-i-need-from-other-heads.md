# Asks of the other heads — specific, dated, blocking-flagged

Each ask names what engineering cannot decide alone, the artifact I need back, and what it blocks. Everything else, engineering proceeds on sensible defaults without waiting.

## Product

1. **Degraded-at-cap copy (blocks un-pause item 5, need by Jul 8).** When a workspace hits its token cap, the surface degrades. I need the customer-facing copy — customer vocab ("Plaino is catching up"), vendor-invisible, no cost/model leak. One paragraph + one banner string.
2. **Portal-off page copy (blocks fix #2, need by Jul 5).** `PORTAL_ENABLED=false` needs a one-line customer-visible state ("Client portal is coming to your plan…" vs. silence). Decide whether the portal is invisible or coming-soon; engineering defaults to **invisible** if no answer by Jul 5.
3. **Inert-controls ruling (fix #4, need by Jul 7).** Confirm soften-vs-wire per control: BYO storage → flag-gate (my default), discipline-heads → soften copy (my default), Test-connection → make real. Silence = defaults.
4. **Guarantee human-review window (fix #1).** How long does the walk-away cron stay in human-review after the writers land? My default: one full Day-7 cycle spot-checked, then auto resumes.

## Data / Analytics

1. **Spend-stamp schema ratification (blocks telemetry v1, need by Jul 5).** `stampSessionCost` already defines a shape; the rollup YAML under `memory/data/` needs your sign-off as its owner-of-record so the weekly kaizen read and the YAML data layer (`lib/memory/data-readers.ts`) don't fork schemas. You own the readers; I own the writers.
2. **Scoreboard instrumentation (the lever's Friday numbers).** Sends / replies / discovery-calls-booked, read from the CRM-lite stages (`/operator/outreach`, doc-06 stage model). Engineering will expose whatever query you need — tell me by Jul 8 whether Friday's scoreboard is a YAML read, a page, or a manual count, and I'll wire the first two.
3. **Margin ledger consumer.** Once per-workspace token cost flows (telemetry item 2), someone must actually read cost-per-workspace against tier price monthly. Claim it or it becomes a Finance-Ops ask.

## Finance-Ops

1. **Ratify the default caps (blocks un-pause item 1, need by Jul 8):** proposed $40/mo + $4/day per workspace (~20% of Regular tier revenue as COGS ceiling). One number back, or the proposal stands.
2. **Prod DB state check (blocks nothing yet, but cheap now):** the P3009 failed-migration state (kaizen 7 finding — fix is `migrate resolve`, NOT resuming Neon) should be cleared before the un-pause window so the first live demo doesn't hit a red deploy. One session, recipe already in memory.
3. **Fleet spend line item.** When telemetry v1 lands (~Jul 9) you get the first real fleet cost ledger. Ask: fold it into whatever monthly view Conner sees, so "no ceiling" stops being unfalsifiable.

## Fleet-Ops

1. **Dispatch overlap check (kills the heal-pass tax, need in the wave template by Jul 10).** Every wave brief declares its expected file-set; dispatch refuses or serializes overlapping waves. The sequential-landings rule exists — nothing runs it. This is the single Fleet-Ops change that most reduces engineering waste.
2. **Mandatory 2-line retro-write in the wave template.** Waves end at "PR open" and lessons evaporate (6 of 7 named memories from the last retro brief don't exist). Add "what trap did you hit → memory file link" as a required template field; engineering's "no recovery without a memory" rule needs the hook to live in.
3. **Spend stamp in the dispatch parent (telemetry call-site #1).** When the dispatch parent fires a pending fire, it stamps the session on completion. I'll hand you the function; you own the call site.
4. **Label bakeoffs.** Duplicate dispatches for the same deliverable (two kaizen-engineering worktrees last cycle) burn a full wave with no decision rule. If it's a bakeoff, the brief says so and names the judge; otherwise it's a dispatch bug.
5. **Merge-train discipline.** Open-PR count cap (~6) before new waves dispatch; a ready PR merges within 24h or gets a `waiting-on-X` label. Engineering enforces the smallest-first sequential landing; Fleet-Ops enforces the cap at dispatch time.

## Chief of Staff (routing, not a build ask)

The conner-queue split-brain (repo YAML shows 0 rows ever; fleet memory says 5 items) means my two Conner-blocking items — branch-protection flip (CI floor) and the un-pause go/no-go — need a delivery channel that provably reaches him. Until the queue is trustworthy, both ride in the PR body and the memory ledger, and I flag them here: **Conner actions this fortnight = one repo-settings click (Jul 5) + one go/no-go read (Jul 11).**
