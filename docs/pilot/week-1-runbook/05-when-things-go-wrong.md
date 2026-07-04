# When things go wrong — the top 5 failure modes and Conner's move for each

**Operating posture for all five:** honesty-first, data-first, founder-speed. We tell them before they notice; we diagnose from instrumentation before we touch them; and during week 1 every recovery has founder attention behind it — a failure handled well in week 1 is worth more trust than a week with no failures. Never fake, never spin, never improvise a discount ("pilot pricing" is banned and the pilot is already free — there is no pricing lever to pull, which is a feature of the program design).

At the bottom of every recovery: the failure gets filed (ranked list to Product/Engineering, one line to the partner folder, memory inbox if it changes how we operate). The first partner's failures are the cheapest lessons this company will ever buy.

---

## 1. The connector fails at setup (the Day-1 nightmare)

**Scenario:** the Follow Up Boss API key won't verify on the activation call — bad key, permissions, provider-side hiccup, or our form. The one bug this path is not allowed to inherit is the silent dead-end; verify-on-submit means we at least fail loudly.

**Conner's move, on the call:**
1. One retry with the obvious checks (whole key copied, right account, key not just-created-and-propagating). Two minutes, narrated calmly — "this is the least interesting part, let's make it boring."
2. If it still fails: **don't debug live past minute five.** Pivot the call order — connect email (OAuth, independent path) so the call still produces real drafts and a real approval, and run the killer-workflow story on the demo runtime (labeled sample data) so they've still seen the workflow.
3. Close the loop honestly: "The lead connection needs a look on my side. You'll have it working by [specific time today/tomorrow], and I'll message you the moment it's on." Then Conner/Fable actually diagnose (our form vs. their key vs. FUB's API — the error and logs say which) and confirm the fix with a message *and* a visible first lead-triage draft.
4. The Day-1 success criteria flex, deliberately: an approval still happens on the call (via email drafts), FUB moves to a same-week hard promise. A rescheduled criterion beats a faked one.

**Prevention already in the runbook:** the key ask went out in the Day-0 welcome email; the connect path was walked on Day 0; the recovery is pre-planned so the partner never watches us panic.

## 2. The workflow doesn't produce the expected output

**Scenario:** leads arrive but drafts don't; or drafts arrive wrong — flat voice, bad showing windows, wrong name, a draft that would embarrass anyone who sent it. Includes the quieter version: everything "works" but the saved-time ledger isn't writing, so Friday's number will be wrong.

**Conner's move:**
1. **Severity sort, from the data:** (a) nothing produced — treat as a bug, mode 4; (b) produced but wrong — quality loop below; (c) produced but uncounted — P0 to Engineering same day, and Friday's number gets an asterisk or a fix, never a silent wrong value.
2. **For quality misses:** read every draft (at n=1, all of them, daily — already the Day-2/3 discipline). If a bad draft reached the partner's queue, get ahead of it within 4 hours: "The [name] draft isn't up to standard — reject it, and here's what I've changed so the next one is better." Encode their voice corrections (sign-off, formality, phrasing) as preferences the same day; the fix must be visible in the *next* draft, not promised for "soon."
3. **If quality can't be fixed same-week:** narrow honestly rather than degrade broadly — better one draft type that's consistently good than five that are coin-flips. Tell them the scope change and why.
4. **Never** let the Friday call be the first time either side mentions a bad output. The brief lists every miss and what changed because of it.

## 3. The partner ghosts

**Scenario:** queue unopened, nudges unanswered, or the Friday call missed. At week 1 this is rarely rejection — it's a closing, a listing crisis, a vacation, or a habit that didn't take root in three days.

**Conner's move — the graduated ladder (CS plan, inherited), cheapest touch first, diagnosis before contact:**
1. **First, check whether it's us:** notifications actually delivering? drafts actually landing? connection quietly dead? A partner who got nothing to approve isn't ghosting.
2. **Queue untouched by day 3:** the named-item nudge (already in doc 02): one specific draft, named — "the [lead name] reply is waiting on you" — with a 5-minute-call offer. Not "just checking in."
3. **Friday call missed ×1:** reschedule same week, zero drama, Fable drafts, Conner sends.
4. **Nudge + reschedule both ignored (or call missed ×2):** the save-motion opens — one focused call + one product change inside 5 business days. The call is direct, evidence-led: "Here's what I see: you approved [N] on Monday's call and nothing since. What changed?" Then **re-scope to exactly one workflow** — the single thing from discovery that made them answer the email — and kill everything else from their queue if needed. One workflow used weekly is a pilot succeeding; five ignored is a churn.
5. **Any verbatim like "I don't have time for this":** skip the ladder, save-motion same day.
6. **The honest exit (weeks away, but the posture starts now):** if saves fail, part cleanly, ask what *did* work on record, keep the relationship. Never trade honesty for retention — a partner #1 who leaves respected refers; one who leaves guilt-tripped warns.

**Week-1 tempo note:** at three days old the relationship is warm and the save is cheap. Move fast — a ghost caught on day 3 costs one message; caught in week 3 it costs the pilot.

## 4. They hit a bug

**Scenario:** anything from a blank tab to a crashed connect flow to a draft with someone else's data in it (the last one is a different animal — see below).

**Conner's move:**
1. **Acknowledge inside 4 hours** (aim for one during business hours), from Conner directly: "Seeing it, it's real, it's mine now. You'll hear from me by [time]." A design partner reporting a bug is doing their job in the program — say thank you like you mean it.
2. **Triage honestly:** breaks the killer workflow or the approval loop → drop-everything (founder + fleet, same day); cosmetic/peripheral → fixed on a stated date, and the date is kept. During the pilot, "won't fix" is said out loud when true, with the reason — never a silent backlog.
3. **Close the loop with specifics:** what it was (plain language, no internals, no vendor names), what changed, and — when true — "fixed because you found it." The design-partner promise made tangible is worth more than a bug-free illusion.
4. **If it's a data-boundary issue** (their workspace showing anything not theirs): the honesty bar is at its maximum — Conner informs them proactively with exactly what was exposed and to whom, the same day, even if they'd never have noticed. Trust survives a disclosed incident; it does not survive a discovered cover-up. (This also gets the incident treated as the P0-of-P0s internally, ahead of every other item in this runbook.)
5. Every bug goes on the ranked Engineering list with a severity and the partner-visible impact — week 1's bug list is the most honest QA the product has ever had.

## 5. They want a feature we don't have

**Scenario:** "Can it also post my listings to Instagram?" / "Can it just send the replies automatically?" / "Does it pull comps from the MLS?" — inevitable, healthy, and the most dangerous mode on this list because the failure (overpromising to a partner we're courting) is painless today and lethal in month 2.

**Conner's move — sort every ask into one of four honest buckets, on the spot:**
1. **Exists already:** show it, on the call or in a same-day message with a screenshot of *their* workspace.
2. **Buildable inside the pilot's frame** (config, preference, small extension of a live workflow): "That we can do — you'll see it by [date]." Then it lands by that date and Friday's call names it *their* change. This is the design-partner value proposition operating exactly as designed — spend these yeses gladly, one per week (the doc-03 rule: one visible change per week, delivered, beats three promised).
3. **Real roadmap, not soon** (e.g., MLS enrichment — explicitly out of scope while kvCORE/FMLS are frozen): "Not today, and I won't give you a date I can't keep. It's on the list, and pilot partners get first say in what connects next — tell me what it'd be worth to you." Log the ask verbatim with their why; the ask-behind-the-ask often *is* servable (they want comps in the draft → maybe they really want the listing's own facts referenced, which the payload already carries).
4. **Never** (auto-send is the canonical case): the deliberate no, with the reason as the pitch — "That one's a no by design, not by limitation. You carry the fair-housing exposure, so you keep the pen; what we compress is everything before the decision. The day we auto-send into a regulated business is the day this product isn't safe to buy." A confident no to a design partner reads as integrity; a weaseled maybe reads as a company that will say anything.

**The bookkeeping that makes this compound:** every ask → the feature-ask log (verbatim, their why, bucket assigned). The week-4 version of this log is the roadmap's single best input, and the "what would have made it a yes" ledger for the next four partners.
