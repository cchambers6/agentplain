# 04 — Discovery-call playbook

**Relationship to existing assets:** each vertical packet already ships a timed discovery agenda (`docs/marketing/design-partner-outreach/<vertical>/`). This playbook is the *cross-vertical operating layer on top*: qualification, disqualification, the objection library, and the vendor-invisibility handling. Where a packet agenda and this document disagree on vertical specifics, the packet wins; where older `docs/marketing/sales-scripts/*` disagree with either, **the older scripts lose** (they carry known drift — "first month is free," stale live-agent lists — flagged in kaizen 05 friction #9; treat them as deprecated until reconciled).

**Standing rules for every call:** recorded with stated consent ("I record these so I can listen instead of taking notes — okay?"). Listen-first — the prospect should talk >60% of the first half. Every call updates the CRM the same day and feeds one line into this playbook's living sections (§7). A "no" with a stated reason is a deliverable, not a failure.

---

## 1. The 30-minute agenda

| Time | Block | What happens |
|---|---|---|
| 0–3 | Open + frame | Thanks, consent to record, the framing line (§2), agenda check ("I want to spend most of this hearing how your week actually runs — then I'll show you one thing, then we'll both decide if there's a next step. Fair?") |
| 3–15 | Discovery | Questions from §3 — their week, their bottleneck, their stack, their risk. Follow the pain, not the script order. |
| 15–22 | Show one thing | The synthetic-data demo (PR #303): a draft *sitting in the approval queue*, edited, approved. Say out loud: "This is a demonstration workspace on synthetic data — you're seeing the real product, not your data." Show the approval gate as the headline, not the AI. |
| 22–27 | Qualify + the ask | Map to tier (§4). If design-partner fit: the program terms, plainly (3 months free, weekly call with me, joint case study you approve every word of, on-record testimonial when you've seen value). |
| 27–30 | Next step | One concrete step with a date: send the one-pager + workspace link, book the kickoff, or a clean "not yet" (§5). Never end on "I'll follow up sometime." |

## 2. Opening framing — service partner, not tool

The one paragraph that sets the frame (adapt, don't recite):

> "Quick framing so you know what this is and isn't: we're not selling you software to figure out. We install a service that reads the tools you already use — your email, your calendar, your QuickBooks — and drafts the work you'd otherwise type: the follow-ups, the chasing, the status updates. **Nothing sends without your name on it — every draft waits for your approval.** We set it up, we run a monthly review, and you stay the one in control. I want to find out today whether your week has enough of that kind of work in it to be worth it."

What this framing forecloses on purpose: "another AI tool" (it's a service with humans accountable), "automation that acts on its own" (the approval gate is the product), and "you'll have to learn something" (we install and run it).

## 3. The 12 discovery questions

Core eight (every call):
1. "Walk me through last Tuesday — where did the day actually go?" *(the concrete-scene opener; their answer writes the case-study 'before')*
2. "What's the work you personally do that someone with your judgment shouldn't have to?"
3. "What does a lead/client/tenant email sitting unanswered for a day cost you?"
4. "Who touches email, the calendar, and the books today — just you, or staff too?" *(seat count, stack reality)*
5. "What tools run the business — email, books, e-sign, CRM? What do you love/hate about them?" *(fit check against the live-integration story — and honesty about what we don't connect yet)*
6. "Has anything ever gone out to a client that shouldn't have? What happened?" *(opens the approval-gate value without pitching it)*
7. "Have you tried any AI for this — ChatGPT, your CRM's assistant? What made it stick or not stick?"
8. "If drafting and chasing were handled, what would you spend the hours on?" *(their ROI, in their words — never supply it for them)*

Top-3 vertical add-ons (from the packet agendas, condensed):

| Vertical | Add-on questions |
|---|---|
| Real estate | 9. "How do commission invoices get chased today, and how late do they run?" · 10. "Who reviews outbound agent communication for fair-housing exposure — and how?" · 11. "When a lead comes in at 9pm, what happens before 9am?" |
| Property mgmt | 9. "What share of the front office's day is tenant email?" · 10. "Walk me through a late-rent follow-up — who drafts, who sends, when?" · 11. "Where do the books live — QuickBooks, or inside the PMS?" *(routes the disqualifier)* |
| CPA | 9. "At month-end, how many missing-document chases go out, and who writes them?" · 10. "How do you think about §6694 exposure when staff draft client communication?" · 11. "What runs in QuickBooks vs your practice-management tool?" |
| Law | 9. "Who drafts client status updates, and how many hours a week is that?" · 10. "How does intake conflict-checking work today?" · 11. "What would your malpractice carrier want to see before anything AI-drafted reaches a client?" *(they answer with the approval gate themselves)* |
| General | 9. "How long does inbox triage take before real work starts?" · 10. "What follow-ups slip through in a normal week?" · 11. "Is there a process only you know how to run?" |

## 4. Qualification frame — Regular / Partner / Max

Map what you heard, don't pitch tiers (pricing lives at `lib/pricing/tiers.ts`; cite the pricing page, don't recite a table):

- **Regular fit:** owner or small team (1–~10 seats), standard workflows, self-serve temperament, wants the service to run and a monthly review. Most design-partner candidates are Regular-shaped.
- **Partner fit:** more seats or more operational surface, wants priority support and the quarterly async check-in. **Never promise reserved founder hours or scheduled Conner calls at Partner** — Partner support is `hello@agentplain.com` priority email/chat + quarterly async (`PARTNER_SUPPORT`, `lib/billing/facts.ts`). The *design-partner pilot* weekly call is a program benefit, not a tier benefit — say so explicitly or it becomes a churn-shaped misunderstanding at conversion.
- **Max fit:** multi-office/multi-state, white-label wishes, non-standard scope, wants named human hours ongoing. Sales-led, quoted. Route to a separate scoping conversation; do not improvise a price.
- **Custom flag:** a workflow or integration we don't have that they'd fund — note it, route to /custom framing, never promise a date.

**Disqualify on the call when:** any document-01 disqualifier surfaces (locked franchise stack, PMS-only books, SOC 2 gate, wants auto-send, regulated business through the general door); or the buyer can't name a recurring block of draft-shaped work (no pain = no pilot); or authority is absent and unreachable (staffer with no owner access). Disqualify warmly and specifically: "Here's the honest read — until your books leave the PMS / until we've built X, we'd be selling you less than you're asking for. Can I check back when that changes?"

## 5. What "yes" and "not yet" look like at minute 30

**Yes (design-partner path):** they've agreed to the program terms *including the asks* (weekly call, on-record testimonial, case study), a kickoff is booked with a date, and the stack check (Google/M365 + QBO access) is scheduled. Anything less specific than a calendar entry is not a yes.

**Not yet (a good outcome when it's true):** a named blocker with a named revisit date in the CRM ("after tax season," "after the prod pilot slots open," "when Buildium connects"). They get the one-pager and land in the T+3/7/14/21 sequence or a long-cycle drip — their choice, asked out loud.

**No:** thank them, ask the one learning question — "what would have had to be true for this to be a yes?" — log the answer verbatim in §7, close the CRM row as LOST with the reason. Never argue with a no.

## 6. Objection library — 20 objections

Format: **short first response** (say this, then stop talking) → *longer follow-up* if they push. Every answer traces to the claims spine or code; nothing here overclaims.

**Trust / proof**

1. **"You have no customers."**
   Short: "Right — zero named customers, and that's exactly why you're getting three months free and weekly access to the founder. You'd be first, on purpose, with the terms priced for it."
   Long: *The design-partner program is the honest version of this moment: you get founder attention no later customer will get, and we get the on-record proof. Here's what we can show today instead of logos: the working product on a demonstration workspace, and the fact that the same fleet pattern runs a real brokerage's operations daily. If you need referenceable customers to move, that's a fair bar — can I come back when we have them?*

2. **"How do I know you'll still exist in a year?" / "You're a solo founder."**
   Short: "Fair. Two honest answers: month-to-month with a money-back guarantee, so your downside is bounded — and your data exports any time, so there's no hostage situation."
   Long: *The service is built so the founder isn't in the daily loop — the fleet drafts on schedule whether or not I'm at my desk; my job is the review cadence and the roadmap. And everything we touch stays in your systems — your inbox, your books. If we vanished, you'd lose drafts you hadn't approved yet, not your business records.*

3. **"Can I talk to someone who uses it?"**
   Short: "Not yet — no invented references here. First design partners are signing now; I can show you the product instead, live, today."
   Long: *When partners are on record you'll be able to call them — that's literally a term of the program. Until then the demo and the terms carry the argument.*

**AI trust / risk**

4. **"What if it sends something wrong to a client?"**
   Short: "It can't send anything. Every draft waits in your approval queue until you approve it — from your own inbox, your own systems. That gate is the product."
   Long: *There's no auto-send mode to misconfigure — the architecture has no outbound path from our side. A compliance check also reviews drafts and flags issues before you see them — it advises, you decide. The worst case is a bad draft you reject in five seconds, not a bad email your client received.*

5. **"AI makes things up."**
   Short: "It does, which is why nothing it writes goes anywhere without a human reading it. Drafts are grounded on your actual email and records, and you approve every one."
   Long: *We also don't let it do open-web research — it works from your knowledge base and your systems, which shrinks the making-things-up surface. And when it's wrong, rejecting the draft teaches the system — 'doesn't sound like us' is a button.*

6. **"Which AI is under the hood — is this GPT? Claude?"** *(vendor-invisibility handling)*
   Short: "We don't discuss which models we run — we manage that layer so you don't have to. What I can tell you exactly is what it does with your data and where every draft waits for your approval."
   Long: *We select and operate the AI layer the way your accountant selects their software — you're buying the service and the accountability, not a model brand. What matters contractually: your data handling is in our privacy policy, our subprocessors are listed there, and nothing leaves without your approval.* **Never confirm or deny a vendor name, in any direction, even casually — the subprocessor list on the privacy/security pages is the sole sanctioned disclosure, and it speaks for itself.**

7. **"Is this just ChatGPT with extra steps?"**
   Short: "ChatGPT waits for you to type at it. This reads your inbox, your calendar, your books on a schedule, and shows up with the work already drafted."
   Long: *The difference is the service around it: connected to your systems, a compliance pass per your industry's rules, an approval queue, a monthly review with us — and no prompt-writing. If typing at a chatbot were solving this, it already would have.*

8. **"Where does my data go? Who can see it?"**
   Short: "Your working data stays in your systems — we read it in flight to draft, we don't copy your records out. What we keep is the working memory of your business, and you can export or delete it any time."
   Long: *Two buckets, plainly: your raw tool data — the emails, the books — stays in your tools; we read it pass-through. The service's memory of your business persists for your account's life because that's what makes it useful, and it's yours — exportable and deletable. Full detail is on the privacy and security pages, and I'd genuinely rather you read them than take my word.* *(Never say "nothing is stored" / "it forgets" — banned framings.)*

9. **"Do you have SOC 2 / a security questionnaire answer?"**
   Short: "No SOC 2 today — I won't pretend otherwise. What we have is a published security page, encryption at rest, and per-workspace isolation."
   Long: *If certification is a hard procurement gate, we're honestly early for you — I'd rather tell you that now. If it's a comfort question, the security page plus how the approval architecture bounds what can go wrong is usually the real answer. (Log every SOC 2 ask in §7 — the count is the business case for pursuing it.)*

10. **"What happens when the AI is down?"** *(degraded-mode optics)*
    Short: "The service tells you, plainly, in the app — and nothing is lost. Drafting pauses; your email and your systems are untouched because they were never in our hands."
    Long: *Failure mode by design: drafts stop arriving; nothing half-sends, because sending was never automatic. When it resumes, it picks the work back up. Compare that to the failure mode of automation that acts on its own.*

**Price / ROI**

11. **"That's expensive." / "What's the ROI?"**
    Short: "The math we model: the drafting-and-chasing work in a shop like yours is worth thousands a month in owner time. But it's a model, not a customer result — I'll say so plainly — which is why the trial and the guarantee exist: run it against your own week."
    Long: *Take the hours you told me about at [their Tuesday answer], price them at your rate, and compare against the subscription on the pricing page. Our modeled numbers per vertical are published; I won't dress them up as customer-attested results because we don't have customers to attest yet. The design-partner deal exists so the price of finding out is zero for three months.*

12. **"Why not hire a VA instead?"**
    Short: "A good VA costs more per month, needs managing, and leaves with the training. This runs on schedule, doesn't churn, and your review takes minutes, not management."
    Long: *They're also not exclusive — several of the best-fit owners have an admin who's drowning; this makes that person senior, reviewing drafts instead of typing them. What we don't do that a VA does: answer phones, run errands, exercise judgment. We're the drafting layer under the judgment.*

13. **"Why not just DIY — ChatGPT plus Zapier?"**
    Short: "You can, and some do — it costs the thing you have least of: your evenings, to build and babysit it."
    Long: *The DIY stack has no compliance pass for your industry, no approval queue, no one accountable when it breaks at month-end. You'd be the integrator and the maintainer. Our whole pitch is that you shouldn't have a second job running your first one.*

14. **"Three months free — what's the catch?"**
    Short: "The catch is stated, not hidden: a weekly 30-minute call, an on-record testimonial once you've seen value, and a case study you approve word by word. You're paying in proof, not dollars."
    Long: *We need named, honest references more than we need three months of your subscription. If the service doesn't earn the testimonial, you don't give it and you walk — no obligation to convert.*

**Competition / incumbents**

15. **"Why not [my CRM]'s built-in AI / [vertical incumbent]?"**
    Short: "Use it if it solves it — honestly. Those assistants live inside one tool; your bottleneck runs *across* email, calendar, books, and clients. We work the seams the point tools don't."
    Long: *The incumbents are per-tool features: your CRM drafts inside the CRM. Nobody at your size is offering the done-for-you, cross-tool, approval-gated service at a flat affordable price — enterprise vendors start far above it, DIY tools hand you the work. That intersection is deliberately where we sit.* *(Never position against Claude/ChatGPT as competitors — we run the AI layer as a service; the comparison is with tools and labor, not models.)*

16. **"My CRM/PMS isn't integrated — FUB, Buildium, TaxDome…"**
    Short: "Correct, and I won't pretend otherwise. Live today: email, calendar, QuickBooks, DocuSign, Drive. Your [tool] is on the roadmap — I won't give you a date I can't keep."
    Long: *The honest question is how much of your pain lives in the connected spine versus inside [tool]. For most owners we talk to, the chasing and drafting is email-and-books-shaped, which is live today. If your workflows are locked inside [tool], we're early for you — that's a 'not yet' with a revisit date, and design partners get first say in what connects next.*

**Adoption / effort**

17. **"I don't have time to review drafts."** *(the approval-burden objection)*
    Short: "Reviewing is minutes; writing is hours. You already review everything that goes out — today you review it by writing it."
    Long: *The queue is built for an owner's thumb: approve, edit, or reject with a reason; routine low-stakes work batches. If reviewing drafts costs you more than drafting did, the service is failing and we'd see it in the numbers together at the weekly call.*

18. **"My team will hate it / we tried AI and it didn't stick."**
    Short: "What usually dies is another tool someone has to remember to open. This shows up in the inbox and the queue they already check — the habit is 'review,' not 'operate.'"
    Long: *What made the last attempt not stick? [Listen — log it.] The setup is on us, the cadence is scheduled, and the monthly review exists precisely to catch 'nobody's using X' before it becomes 'we quit.' Your team keeps their tools; nothing is ripped out — we augment what runs, we don't replace it.*

19. **"Can't it just send automatically? Approving everything sounds slow."**
    Short: "No — and that's a feature you'll appreciate the first time a draft is wrong. Nothing goes out without your name on it, by architecture, not by setting."
    Long: *You carry the liability — fair housing, client privilege, tax positions — so you keep the pen. What we compress is everything before the decision. An AI that auto-sends into a regulated business is a product we deliberately refuse to build; if auto-send is the requirement, we're the wrong vendor and I'll say so.*

20. **"Let me think about it." / "Not right now."**
    Short: "Of course. What would need to be true for this to be worth revisiting — and when should I check back?"
    Long: *Get the real blocker named (budget cycle, season, a missing integration, an unconvinced partner) and a real date; log both. Offer the one-pager and the recorded walkthrough for the unconvinced partner. Then actually check back on the date — the T+3/7/14/21 sequence handles silence; a stated 'not now' gets the stated date instead. No pressure plays; the trust gap closes on kept promises.*

## 7. Living sections (updated after every call)

- **Heard-objection log:** verbatim objection → which library entry was used → did it land (Y/N) → wording that worked better. New objections get drafted into the library within the week.
- **"What would have made it a yes":** verbatim answers from every no. This list is the roadmap's sales input.
- **Agenda drift:** where the real calls depart from §1, change §1 — version this file, don't fork it.
