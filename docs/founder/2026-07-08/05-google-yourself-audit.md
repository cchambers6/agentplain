# Google-yourself audit — what a prospect finds before they reply

Run the two queries a shortlist prospect actually runs — **"Conner Chambers agentplain"** and **"Conner Chambers Georgia real estate"** — in a logged-out browser, and work this list. Three facts below were verified live on 2026-07-08; the rest depend on your accounts and need your eyes.

**Verified today:** `agentplain.com` is live (200). `flatsbo.com` is live (200). **The GitHub repo `cchambers6/agentplain` is public** — confirmed unauthenticated, and it is the single most urgent item on this page.

---

## The top 10 surfaces, ranked by what to do about them

| # | Surface | What they find today | Control | Action before Monday |
|---|---|---|---|---|
| 1 | **GitHub: `cchambers6/agentplain` (PUBLIC)** | The entire working repo: the outreach shortlist with prospects' names and contact research (`docs/outreach/.../00-cohort-shortlist.md`), pricing strategy, legal-gap docs, department plans — and this folder | Yours | **Make the repo private today.** A prospect finding their own name in a public prospecting file ends the conversation; it's a courtesy-to-them problem as much as an image problem. Nothing in the sales motion needs this repo public |
| 2 | **GitHub profile `cchambers6`** | Public profile; whatever repos, pins, and activity are visible | Yours | After #1, review what remains: pinned repos, old experiments (the shelved Stripe-recovery project among them), profile README. Keep it plain or empty; a bare profile beats a contradictory one |
| 3 | **LinkedIn profile** | Today: the least-managed surface in the funnel — day-job-forward, no agentplain framing | Yours | Run `02-linkedin-profile-audit.md` end to end. Once fixed, this is the result you *want* ranking first, and for a person-name query LinkedIn usually does |
| 4 | **agentplain.com** | Live, on-brand. But `/how-it-works` still redirects to `/#how` (verified today) — anyone sharing or featuring the deep link gets bounced to an anchor | Yours | Land the redirect fix; until then every link you publish points at `agentplain.com/` root. Confirm the founder name on `/security` reads correctly (fixed in PR #369 — verify in prod) |
| 5 | **flatsbo.com** | A live flat-fee, for-sale-by-owner marketplace with your name on it | Yours | Keep it live (ratified — kill #3 overridden), but know how it reads to a broker: FSBO is the model that cuts agents out. Have the one-liner ready: *"flatsbo is where I built and proved the fleet — it's the company I mean when I say my own operation runs on it."* Do not volunteer it in outreach; do be unembarrassed when asked |
| 6 | **Georgia Secretary of State business search** | A diligent broker-owner searches "agentplain" in the GA corporations registry. Today that likely returns nothing — the entity is the known silent gap (ruling due ~Jul 10) | Yours (with counsel) | Get the entity filed/confirmed. Until then, nothing in the bios claims an entity form (they say "founder," not "CEO of agentplain LLC") — keep it that way |
| 7 | **The day job** | LinkedIn and any press/professional listings tie your name to a large consumer-goods employer | Partly | Decide the framing once (audit item 7 in `02`): it stays visible because it's true, and the call answer is scripted. Check there's no employer-conflict surprise *they* would find before you've addressed it |
| 8 | **X/Twitter, Facebook, Instagram** | Whatever exists under your name — or squatters/namesakes if nothing does | Yours | Claim or update the X handle with the 25-word bio from `01`. Personal accounts: set private or scrub anything you wouldn't show a design partner. An absent account is fine; a contradictory one isn't |
| 9 | **Name collisions** | "Conner Chambers" alone returns other people — athletes, obituaries, unrelated professionals. A prospect may skim the wrong person | No | You can't remove them; you can outrank them for the queries that matter. Every artifact in this folder that goes live ("Conner Chambers, founder, agentplain, Georgia") strengthens the entity Google associates with you. The LinkedIn post from `02` item 7 helps here too |
| 10 | **Old project remnants** | The shelved dunning-recovery experiment (RecoverAI) and anything else once public: parked domains, directory listings, launch-site posts | Mixed | Search for them by name. Anything you control: take down or add a one-line "shelved to build agentplain" note. Anything you don't: leave it; a founder with a visible earlier attempt reads as normal |

## De-index / cleanup notes

- Making the GitHub repo private (#1) removes the live page, but Google's cache and code-search mirrors can linger. After flipping it, request removal of `github.com/cchambers6/agentplain` paths via Google Search Console's Removals tool. Mirrors expire on their own once the source 404s.
- No other surface here needs de-indexing. The strategy is not scrubbing — it's making the two or three results you control answer the question the prospect is actually asking: *is this a real person building a real thing?* LinkedIn (#3), the site (#4), and one recent post do that.

## The 20-minute run order

1. Flip the repo to private (#1) and file the Search Console removal.
2. Run both queries logged-out; note anything this table didn't predict.
3. Fix LinkedIn per `02`.
4. Claim/update the X handle with the 25-word bio.
5. Everything else is a decision, not a task — day-job framing (#7) and the flatsbo one-liner (#5). Decide each once, write the answer down, move on.
