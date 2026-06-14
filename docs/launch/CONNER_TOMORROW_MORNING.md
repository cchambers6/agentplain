# Conner — Tomorrow Morning — 2026-06-15

## TL;DR

Five P0 audit findings are still live in production and reachable by any buyer you send to the site. **FW-1 "Truth Wave"** is the single highest-leverage action — one fleet PR clears most of them. Your job today is to fire it and make four decisions so it ships clean.

---

## Top of the queue (in order, with effort estimates)

### 1. Make the four decisions that unblock FW-1 — 20 minutes

FW-1 "Truth Wave" is a single PR (one Opus agent, ~1 day to build) that clears P0-2, P0-3, P0-5, P0-6, P1-7, P1-11, and the P2 small-fixes batch in one shot. It can't fire until you've committed on these:

**Decision A — Trial timing (P0-1):** Right now the site says three different things about when a card is charged. Prod is silently running the *add-card-later* path (Stripe env misconfigured in Vercel). Recommended: ratify add-card-later as the product decision, let FW-1 align all copy to that truth. The alternative (fix the Stripe env so card-at-signup fires on day 1) is fine too, but add-card-later is what prod does and makes every "no commitment" line already on the site accurate.

**Decision B — Metered billing (P0-7):** A live env-gated pipeline (`STRIPE_USAGE_METER_ENABLED=true`) can post per-token micro-charges to Stripe. Zero public page discloses it. Pick one: (a) commit publicly to "no usage charges" and gate the meter behind a contract amendment, or (b) add a fair-use clause to /pricing + /terms now. Recommended: (a) — the flat-fee story is your competitive edge and the meter's never been flipped on in prod.

**Decision C — Vertical pricing leak (P0-2, already clear but needs your nod):** `/cpa` and `/home-services` show $299 Partner; `/law` and `/ria` show a "Max — quoted to scope" wall. This is the banned 2026-05-09 vertical-to-tier mapping resurfaced and wired into Stripe billing via `flows.ts:101`. FW-1 will set all four `content.ts` tier fields to `"regular"` and delete the `flows.ts` content-tier→billing flow. Nod to confirm you want all 10 verticals to display Regular pricing on their pages (cadence, not vertical, determines tier).

**Decision D — home-services runtime (P0-3):** `home-services-estimate-followup` skill is module-complete but missing `runtime: 'live'` in `registry.ts`. It's a one-line fix included in FW-1. Confirm: yes, ship it live.

Once you've decided, tell the fleet to fire FW-1. It runs overnight and opens a PR by morning of 2026-06-16.

---

### 2. Status page — 15 minutes

`/api/health` is green on both hosts right now and nothing external probes it. `status.agentplain.com` returns connection refused.

Go to [Better Stack Uptime](https://uptime.betterstack.com) (free tier works), create a monitor for `https://agentplain.com/api/health` + `https://app.agentplain.com/api/health`, set the CNAME for `status.agentplain.com`. Then tell the fleet to add a one-line footer link in a follow-on PR. That's it — cheapest trust signal in the audit, and it's the only thing Operations and Support both independently flagged.

---

### 3. Provision `ANTHROPIC_API_KEY_SECONDARY` in Vercel — 30 minutes

The primary Anthropic key is intentionally paused (policy: stays off until you're actively prospecting). But the secondary key slot costs nothing to provision now. When the primary comes back on, the failover logic (`lib/llm/key-rotation-provider.ts`) needs a live secondary to self-heal instead of degrading. Without it, one 401 = fleet-wide calm-copy degradation for every customer.

Go to Vercel → agentplain project → Environment Variables. Add `ANTHROPIC_API_KEY_SECONDARY` with a backup key. It won't be called while the primary is paused — but it'll be there the day you flip the primary back on.

---

### 4. Review and merge PR #246 — 20 minutes

PR #246 ("signup → first-value funnel hardening") is open, mergeable, and CI should be green. It hardens the trial-honesty copy, first-fire watch error messaging, and other funnel seams. Review the diff, confirm it matches your trial-timing decision from #1 above, merge.

After #246 is in, queue #247 (Playwright e2e revenue path) — it's a test-only PR, no production risk, adds permanent CI coverage for the revenue path.

---

### 5. Engage counsel on the P1-10 packet — 30 minutes (email)

Six items need a lawyer's eyes before you go live with regulated verticals (CPA, law, RIA, mortgage, insurance, title):

- Policy review (three factual accuracy defects in /privacy + /security: OpenAI is an active subprocessor not listed; knowledge-substrate docs are NOT AES-256-GCM encrypted despite the claim; email scopes stated wrong)
- DPA + subprocessor exhibit
- §7216 (CPA) + attorney-client privilege (law) language in /terms
- AS-IS / no-warranty / no-reliance + indemnification clauses
- Red-line the live real-estate HUD corpus (`counselReviewer: null` — the one live scanner has never been counsel-reviewed)
- US-state privacy rights (CCPA/CPRA at minimum)

The handoff machinery already exists: `scripts/render-counsel-handoff-packets.ts`. Run it, send the output to counsel, and get the clock started. This is a weeks-long engagement — starting Monday morning matters.

---

### 6. Start one testimonial ask — 10 minutes (email)

Zero social proof exists anywhere on the site. The audit scored this as the second-biggest sales conversion drag after pricing contradictions. You have at least one design partner (FlatSBO counts). Send one email today. Something that would go on the /about page or /pricing as a pull quote. One is enough to start — it signals the product is real.

---

## Things you DON'T have to do (and why)

- **Restore `ANTHROPIC_API_KEY`** — policy, not a gap. Stays off until you're actively prospecting and the product is market-ready. The site degrades gracefully; Plaino says "catching his breath" and lead-captures; nothing breaks.
- **Re-set `FLEET_TRUSTED_HUMAN_EMAIL`** — done today, set to `hello@agentplain.com`. Pages now route to a real monitored inbox.
- **Fix approval-aging nag (S5)** — real gap, but fleet work (FW-3 wave). Not a Conner action.
- **Build the registry-truth CI guard (#223)** — the guard test was written but superseded. The fleet will rebuild it as part of the next hardening wave. Not blocking today.
- **Merge #247 before #246** — wrong order. #246 first (production changes), then #247 (tests).
- **SOC 2** — put it on the calendar for Q3. It takes 6–12 months of evidence collection. Posture is already being built.

---

## Things in flight (no action from you yet)

- **PR #246** — signup funnel hardening, open and mergeable. Waiting on your review (see #4 above).
- **PR #247** — Playwright e2e revenue path, open and mergeable. Merge after #246.
- **FW-1 "Truth Wave"** — ready to fire the moment you nod on the four decisions in #1. Will deliver a PR by 2026-06-16 morning.
- **FW-3 "Trust surfaces"** — queued: support front door (every `/help /docs /faq` route 404s; header Help link missing; in-app degraded chat lead-captures paying customers), approval-aging nag (S5 silent failure), buying-motion coherence (Partner/Max CTAs are raw `mailto:`). Fire after FW-1 lands.

---

## Reference docs to read when you have time

All in `docs/audits/` on `origin/main`:

- `MASTER_AUDIT_ACTION_QUEUE_2026_06_11.md` — the canonical P0–P3 ranked list with effort estimates, lens scores, and fix-wave assignments
- `CONNER_DEAD_SIMULATION_2026_06_11.md` — the 30-day adversarial walkthrough; shows exactly which failure modes self-heal vs. silent vs. dead-letter
- `audit_legal_2026_06_11.md` — the three policy accuracy defects in detail (send to counsel)
- `audit_compliance_risk_2026_06_11.md` — the vertical-page compliance-scanner copy problem; FW-1 fixes it
- `audit_sales_2026_06_11.md` — the free-trial contradiction full breakdown + buying-motion gaps
- `SIGNUP_TO_GO_AUDIT_2026_06_10.md` — the original 95-finding audit; most items have since been cleared

---

## State as of 2026-06-14T23:00Z UTC

- Open PRs: 2 (#246, #247)
- Active fleet sessions: 0 auto-running; FW-1 ready to fire on your nod
- Customer count: 0 (pre-launch)
- Production status: degraded LLM intentional (Anthropic key paused by policy) · fleet self-heals on integration failures (Pillar 2 merged) · L1 support triage live but auto-answer dormant (key paused) · fleet health check fires daily 6am ET · FLEET_TRUSTED_HUMAN_EMAIL set to hello@agentplain.com · 3 of 10 verticals supported at signup (real-estate, cpa, law + general on-ramp) · home-services waitlisted (flagged, honest)
