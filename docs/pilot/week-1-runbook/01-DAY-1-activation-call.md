# Day 1 — the 90-minute activation call

**Lineage:** this is the CS onboarding runbook (`docs/departments/2026-07-03/customer-success/01-first-partner-onboarding-runbook.md`) specialized to the ratified RE killer workflow. One deliberate departure, stated so it doesn't read as drift: the CS runbook's config table says connect email first; the Product plan (`docs/departments/2026-07-03/product/02-killer-workflow-RE-first.md`) ratifies after-hours lead triage — unlocked by **Follow Up Boss** — as THE workflow, chosen by the codebase and locked against re-picking. This call connects **FUB first** (it unlocks the workflow the partner was actually sold), **email second** on the same call (it powers inbox drafts and the notification habit). Both fit inside 90 minutes; QuickBooks waits for week 2 unless invoice-chasing was their named pain.

**Hard gate, inherited unchanged:** if the Day-0 preflight isn't green on call morning — key live, caps set, same-day smoke draft, signup path walked — **reschedule.** The first impression is unrepeatable; a resting product does not get to make it.

**Voice on the call:** customer vocabulary only. "Working," "Setting up," "Watching," "connected," "ready to connect." Never "live," "fired," "workspace credential," or any model/vendor name. If asked what's under the hood: agentplain is a service layer built on foundation-model infrastructure; the subprocessor list on /security is the honest reference — and that is the entire answer.

---

## Call-morning checklist (Conner, 15 min before)

1. ☐ Fresh smoke draft generated this morning on the dry-run workspace (not yesterday's).
2. ☐ Discovery handoff sheet open beside the call notes — their named task, email system, QBO yes/no, named operator, degraded-tolerance answer.
3. ☐ Partner workspace caps staged (or set, if they signed up early).
4. ☐ Screen-share tech check. Ground rule for the call: Conner shares screens for orientation, but **the partner's hands drive every action that matters** — their signup, their API key paste, their approve click.
5. ☐ Recording consent line ready ("I record these so I can listen instead of taking notes — okay?").

## Agenda — the 90 minutes

### Segment 1 — Frame and promises (0:00–0:10, no screens)

Say four things, plainly, then stop:

1. **What this is:** "Plaino watches the leads that land after hours — the ones you told me about that wait until morning — and leaves you a drafted reply, two showing times, and the CRM update, all waiting on one approve. Nothing ever sends on its own; your systems do the sending." (The no-outbound rule, framed as the feature it is for a liability-conscious broker.)
2. **What the pilot is:** three months free, Friday 30 minutes with Conner, their voice in the roadmap; in return the Friday calls, an on-record quote once they've seen value, and the co-authored case study they approve word by word. Restating signed terms — no new promises.
3. **What done looks like today:** "Before we hang up, you will have approved a real item, with your own hands, in your own workspace."
4. **What memory means:** Plaino remembers their preferences and corrections for the life of the account — that's the product learning their business, and it's theirs. (Two-bucket positioning; the words "nothing is stored" and "it forgets" are banned.)

### Segment 2 — Live signup and the shape of the workspace (0:10–0:22)

**Screens:** `/real-estate` → signup → workspace.

- They sign up on their own machine, their own email, watching the magic-link interstitial do its job. If they signed up early (Day 0 note), tour what they made instead — two minutes, no penalty.
- The Today tab opens in demo mode: the lead-triage story autoplays on clearly-labeled sample data — "9:14pm — a new buyer lead landed while you were off the clock" → caught → enriched → drafted → two showing windows → logged, saved-time counter ticking calibrated minutes. Let it run once without narrating over it. Then say the honest sentence: "That's a demonstration on sample data. The rest of this call makes it run on yours."
- Walk the five tabs once, one sentence each: **Today** (what Plaino surfaced), **Plaino** (talk to it), **Connections** (what it can see), **Reports** (what it did for you), **Account** (billing, team). Tour the shape, not the features.

### Segment 3 — Connections and config (0:22–0:45)

**Screens:** data-disclosure page → Follow Up Boss api-key form → Connections tab → skills/preferences.

**The FUB connect, their hands:** through the disclosure screen first (for this persona the disclosure is trust-building, not friction — let them read it), then they paste the API key they prepared from the Day-0 email. Verify runs on submit against the live provider. Connections shows Follow Up Boss **connected**. If the key isn't ready or verify fails, the recovery path is `05-when-things-go-wrong.md` §1 — do not improvise on the call.

**Config decisions, made on the call, from the discovery sheet:**

| Decision | Default for this partner | Why |
|---|---|---|
| First connection | **Follow Up Boss** (api-key) | Unlocks the ratified killer workflow — the thing they were sold |
| Second connection | **Their email** (Gmail/Outlook OAuth) | Inbox drafts + the notification channel the after-hours premise depends on |
| Third connection | QuickBooks **only if** invoice-chasing was their named discovery pain; otherwise week 2 | One workflow that runs beats three that confuse |
| Skills on | **Lead triage** (the killer workflow) + inbox drafts | Their named workflow first; nothing speculative |
| Daily briefing time | Their first coffee, in their words (default ~9am ET) | The daily heartbeat goes where they'll actually see it |
| Approval notifications | **On, to their phone/email, and tested** | An after-hours draft nobody hears about until morning defeats the premise |
| Named operator | Them, personally, for the pilot | A queue nobody opens is the churn signature |
| Team invites | Not today | Every extra face on day 1 dilutes the habit being built |

Watch the first fire land, live, narrated honestly in customer vocabulary: "Setting up… Working." If something sits at "Setting up" longer than expected: "first activity lands soon," and move on with what did fire — never dead-air a spinner.

### Segment 4 — The first approval (0:45–1:10) — **the point of the call**

**Screens:** Approvals queue.

- Open the queue. Read the first item together, out loud. With FUB freshly connected, the first real after-hours lead may not have arrived yet — that's expected, and the queue seeds from the connected inbox drafts and any lead events since connect. Whatever real item is there, work it. (If nothing real has landed at all by 0:45, run the fallback in `05-when-things-go-wrong.md` §2 — the recorded demo bridge plus the same-day promise — and be plain about it.)
- **Ask them to edit something.** One word is enough. The edit is the moment the product becomes theirs, and their corrections are the highest-value signal the pilot produces.
- **They click approve. Their hands.** Then say what just happened: the approved draft goes out through *their* system, or sits ready for them to send — nothing left the building on its own.
- Repeat for two or three items if the queue has them. Stop while it's still delightful.
- Return to Today once more — now non-empty, now theirs. This is the "seen their own data in the product" moment: their leads, their inbox, their names on screen.

### Segment 5 — Cadence, support, close (1:10–1:30)

1. **Confirm the Friday call series** — they accept the recurring invite before hanging up (it was sent Day 0; this is confirmation, not scheduling).
2. **Support expectations, stated exactly:** "Anything, any time: hello@agentplain.com or the support button in the app. During the pilot you'll usually hear back from me directly, same business day." (Founder-grade response is the sanctioned design-partner exception; it ends at conversion unless they're Max — say so at conversion time, not today.)
3. **Set the week-1 contract:** "Your only job this week: open the queue each morning with your coffee and approve or toss what's there. Ten minutes. Friday morning you'll get an email from Plaino showing what it did all week — on our Friday call, tell me if it's lying."
4. **Plant the after-hours expectation:** "The first evening a lead comes in after you've knocked off, you'll get a notification that a reply is drafted and waiting. Approve it from your phone or leave it for coffee — either is fine. That moment is what this pilot is about."
5. **Open the case study, on the record, with consent:** "Two minutes for the before-picture, so in three months we're comparing against facts instead of memory?" Fill the "before" fields in their own words: hours per week on lead follow-up and the named task, what an unanswered evening lead costs them, the concrete Tuesday-night scene from discovery. Their words, transcribed, into the case-study file.

## Success criteria to close the call on (all five, or the call is not done)

1. ☐ **≥1 real item approved by the partner's own hand, live on the call.**
2. ☐ **Follow Up Boss connected** (verify-on-submit passed) and the lead-triage workflow showing **"Working" or "Watching"** — plus email connected and approval notifications tested to their phone.
3. ☐ **They watched the killer workflow run** — the full lead-triage story, demo-labeled on sample data — **and then saw their own data in the product** (their queue, their leads/inbox, non-empty Today tab).
4. ☐ **Friday call series accepted** in their calendar; internal silent Day-2 check already scheduled.
5. ☐ **Case-study "before" fields filled from their own words**, on the recorded call, with consent.

## Post-call (same day, 15 min)

- Recap email drafted for Conner's approval, sent from Conner's inbox: what got set up, what lands tomorrow, the one thing to watch for (the first after-hours notification). Customer vocabulary throughout.
- Call notes + final config logged to the partner folder and the memory inbox.
- **Every friction moment observed on the call filed as a ranked list to Product/Engineering the same day.** The first real onboarding is the highest-density product-feedback artifact the company has ever produced — treat it like one.
