# PR description — chore(audit): live agentplain.com sanity audit 2026-05-12

**PR-create URL** (gh CLI not installed on this machine — open in browser):
https://github.com/cchambers6/agentplain/pull/new/chore/agentplain-live-sanity-audit

**Title:** `chore(audit): live agentplain.com sanity audit 2026-05-12`

**Body** (copy-paste verbatim):

---

## Summary

Read-only third-party-visitor audit of `https://agentplain.com` run against `main` @ `76b5644` (PR #12 merge). **No application source files touched** — the only artifacts in this PR are `outputs/agentplain_live_audit_2026-05-12/findings.md` + raw HTML responses for every surface audited.

## Headline

**Production is serving a build ~13 commits behind `main`.** Three of the five required customer-conversion surfaces are 404 in prod:

- `/pricing`, `/custom`, `/signup`, `/app/sign-up`, `/app`, `/verticals` → **HTTP 404**
- All 10 vertical pages (`/real-estate`, `/mortgage`, `/insurance`, `/property-management`, `/title-escrow`, `/recruiting`, `/home-services`, `/cpa`, `/law`, `/ria`) → **HTTP 404**
- Homepage `/` → 200, but the deployed HTML is the **pre-narrative-rebuild build** — still serving the exact "Agents in the fleet: 7 / Pilot length: 30 days / Verticals at v0: Realty" stat block flagged in `feedback_everything_tells_a_story.md` line 41
- `/about` → 200, but also stale (H1 `Quiet software for brokerages.` + 4 occurrences of `v0`)
- `/pilot` → 200, but the page was **deleted in `main`** and every H2 violates the pilot-pricing ban

CDN evidence: `X-Vercel-Cache: HIT` + `Age: 536083s` (~6.2 days) on the homepage response. Local `npm run build:no-migrate` against `main` passes cleanly and the route table reproduces every page the audit looked for — the code is fine; the deploy is not.

## Severity breakdown

- **17 total findings**
- **5 × P0** (customer-impact-now — blocks demo / contradicts brand)
- **7 × P1** (fix-this-week)
- **5 × P2** (polish-later)

## Top 3 items Conner should know before any customer demo

1. **P0 — Trigger a fresh production deploy of `76b5644` and bust the Vercel edge cache.** This single action resolves 13 of the 17 findings. Do not demo on `agentplain.com` until `curl -I https://agentplain.com/` shows `Age:` resetting toward 0 and `/pricing` + `/custom` + a vertical page all return 200.
2. **P0 — `/pilot` still 200s in production with banned content.** Every header CTA links to it. After Finding #1 lands, add a permanent redirect `/pilot → /pricing` in `next.config.js` so any indexed legacy URL doesn't drop customers on a deleted page.
3. **P0 — `/custom` end-to-end form test could not be run.** `/custom` is 404, so there was no form to submit against. Re-run as the first acceptance step after the redeploy: submit `{ name, email, vertical, scope }`, verify the inquiry email lands at the destination mailbox within ~60s.

## /custom form test result

**NOT RUN.** `https://agentplain.com/custom` returned HTTP 404. The `/api/custom-inquiry` route compiles in `main` but cannot be exercised end-to-end while the form-rendering page is 404. Re-test after Finding #1 redeploy.

## Lighthouse scoring

Deliberately not run on the stale build (the numbers would not inform the right fix). Documented as P2 Finding #17 — to be run after the redeploy against `/`, `/pricing`, `/custom`, and `/real-estate`.

## Acceptance against the audit task

- [x] `outputs/agentplain_live_audit_2026-05-12/findings.md` written (comprehensive table with URL / issue / severity / fix / owner / memory rule violated)
- [x] 20 raw HTML response files saved at `outputs/agentplain_live_audit_2026-05-12/raw/`
- [x] No application source files modified (`git diff main…HEAD -- ':!outputs'` is empty)
- [x] PR description summarizes total + severity breakdown + top 3 + /custom form test result
- [x] Local `npm run build:no-migrate` confirmed clean on `main` (after `npm install`)

## Test plan

- [ ] Conner reviews `findings.md` and confirms the dominant-finding framing (deploy staleness, not 17 independent content issues)
- [ ] devops triggers fresh Vercel production deploy of `76b5644` + cache invalidation
- [ ] Auditor (or any agent) re-runs this audit against the fresh deploy and confirms `/pricing`, `/custom`, all 10 verticals return 200 + banned-framing scan returns 0 matches
- [ ] `/custom` form submission re-test once the page renders
- [ ] Follow-up small PRs for `/pilot` redirect (Finding #5) and `/signup` rewrite (Finding #14)
- [ ] Lighthouse run after redeploy (Finding #17)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
