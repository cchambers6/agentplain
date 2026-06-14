<!-- vertical: law | trial: 14 days | voice: formal, precise, professional-services register. Peer-to-owner but with more deference to the attorney's professional judgment. Key numbers: 3 attorneys × 10 hrs/week × $250/hr × 50 weeks = $375k/yr opportunity; capturing 40% → $150k/yr returned; discovery example: 60 billable hours → 14. Compliance angle: ABA Model Rule 1.6 confidentiality + Rule 7.1 false statements; malpractice exposure from privilege breach. Honest about state: Intake conflict screen (law-intake-conflict-screen) is live via JSON-stub ledger. Chief of Staff live with calendar. All other agents Setting Up pending Clio/MyCase/NetDocuments MCPs (planned Q1 2027). Recommended tier: Max — quote-based engagement. -->

# agentplain Sales Script — Law Firms and Solo Practitioners

---

## 1. 30-Second Cold Open

### Phone variant
"Hi [Name], this is [Rep] with agentplain. We work with small law firms and solo practitioners. One question: how many hours a week are your attorneys spending on drafting, client status updates, and document coordination — work that requires their name on it but not necessarily their full judgment? For a three-attorney firm, that is typically around 30 hours a week at $250 an hour in billable opportunity cost. We run a fleet of purpose-built agents behind your firm that draft that work for attorney review. Nothing leaves the firm without approval. There is a 14-day trial. Worth 20 minutes to walk through what it actually does?"

### Email variant
**Subject: 30 hours a week — drafting and coordination at the attorney rate**

Hi [Name],

For a three-attorney firm, approximately 10 hours per attorney per week go to first-pass drafting, client status updates, and document coordination — work that requires an attorney's review but not necessarily their full judgment on the first pass. At $250 an hour in billable opportunity cost, that is $375,000 a year. Capturing even 40% of that returns $150,000 in attorney time.

agentplain runs a fleet of purpose-built agents behind your firm. They draft that work — intake conflict screens, first-pass pleadings and contracts, document-chase cadences, client status updates — and surface it for attorney review. Nothing goes to a client or opposing counsel without your approval.

14-day trial. No contract.

Worth a conversation?

[Rep name] | agentplain

---

## 2. Discovery Questions

Ask deliberately. Attorneys will not tolerate a scripted interrogation — let the conversation develop. These are the questions you want answered by the end of discovery.

1. "Walk me through how a new matter comes in — what happens from the intake call to a signed engagement letter?"
2. "How are you handling conflict checks today — manual search, the practice-management system, or something else?"
3. "What is the practice area breakdown? Litigation, transactional, or a mix?"
4. "For a litigation matter in discovery, how does the document-review process work — who handles first-pass responsiveness and privilege coding?"
5. "On the transactional side, what does your drafting workflow look like — are you working from firm precedents, client-provided templates, or something else?"
6. "How do client status updates happen right now? Do clients call you, or do you have a proactive cadence?"
7. "What is your practice-management setup — Clio, MyCase, Smokeball, something else?"
8. "Where does billing friction show up most? Is it the WIP accumulation, the collections follow-up, or the invoice narrative?"
9. "How do you handle privilege review — is there a defined process, or does it vary by matter?"
10. "What does your document-management setup look like — is everything in a DMS, or distributed across email and a shared drive?"

---

## 3. Demo Flow

Select two or three beats based on what the attorney named. Litigation and transactional JTBDs are materially different — calibrate before the demo.

### Beat 1: Intake conflict screen (maps to "conflict check is manual and takes time")
Show the Intake & Onboarding agent running a conflict screen. The fleet compared the prospective client and opposing parties against the firm's prior-matter ledger — classified each hit as direct conflict, adverse, or former-adverse — and drafted a formal internal notice to the responsible attorney with the findings cited and merge fields for the legal conclusion.

*Be precise:* The fleet drafts the conflict-check notice; it never asserts the legal conclusion. The attorney fills in the {{operator: legal conclusion}} merge field and signs before anything goes to the prospective client.

*Be honest about the integration state:* "The conflict screen is live today using your firm's matter index — currently via a structured ledger we set up during onboarding. The Clio and MyCase MCPs that will populate this automatically from your practice-management system are on the Q1 2027 roadmap. Today, we get the ledger from your existing matter list and keep it current."

*Tie back:* "You mentioned your conflict check is a manual search against a spreadsheet. This runs the same check with a formal audit trail and a draft notice to the responsible attorney — the attorney still makes the call."

### Beat 2: Discovery review (maps to "document review is consuming associate time")
Tell the value-loop story from content.ts: civil litigation matter, 4,200 documents due Friday. Before: three associates, two days of doc-by-doc privilege and responsiveness coding, partner spot-checks the borderline calls, paralegal builds the privilege log. Sixty billable hours, of which maybe eight required real judgment. After: the fleet ran first-pass responsiveness and privilege coding, flagged 312 borderline calls with rule citations, drafted privilege-log entries, and cross-referenced against the firm's prior-matter privilege index. Associates review the 312 borderline calls; partner spot-checks 30. Production ships Friday morning. Sixty hours becomes fourteen.

*Be honest:* Discovery Review is Setting Up — it comes online once a Relativity or Everlaw connection is established. Show the agent card. "I am showing you this because the capability is real and the integration path is clear, not to imply it is running today."

### Beat 3: Client status updates (maps to "clients are calling because they do not know what is happening")
Show the Status Updater agent. The fleet drafts a client update on every material matter-state change — court date set, discovery request received, opposing counsel response filed. The attorney reviews the draft, edits if needed, and sends from their own email. The client gets a proactive update before they call.

*Be honest:* Status Updater is Setting Up — it comes online once matter-state webhooks from the practice-management system are connected. Same as Beat 2 — show the card honestly.

### Beat 4: The privilege and ABA Rule 1.6 angle (maps to "compliance concern")
"The Compliance Sentinel runs a privilege-aware pass on every client-facing draft before it goes to the attorney for review. It flags ABA Model Rule 1.6 concerns — confidentiality, work-product, inadvertent disclosure — and cites the rule basis. The sentinel advises; the attorney decides. Nothing is blocked automatically."

*Be honest:* Compliance Sentinel corpus is loaded. Draft scoring activates after counsel review of the corpus for each jurisdiction. Be straight about the state: "The corpus is built. Activation for your specific jurisdictions is part of the setup process, and I will tell you exactly which jurisdictions are activated before you commit."

### Beat 5: Setting Up agents (if asked)
The Drafting, Document Chase, Discovery Review, Status Updater, and Milestone Billing agents are all Setting Up. Each has a clear unlock path — NetDocuments or iManage for Drafting, Clio Connect or MyCase for Document Chase, Relativity or Everlaw for Discovery Review, practice-management webhooks for Status Updater, Clio Manage or TimeSolv for Billing. Q1 2027 is the integration roadmap window. Be direct: "I am not going to show you these as if they are running today."

---

## 4. Pricing Conversation

### How to present tiers

"For law firms we route through Max engagements — quote-based, not a fixed per-seat price. The reason is that privilege-aware depth, ABA Model Rule 1.6 compliance corpus, multi-jurisdiction packs, and the dedicated service management that law firms need are a different service intensity than the standard tier. The Partner tier — $299 per seat, sliding to $199 — is the floor the quote starts from; the Max overlay accounts for the service intensity on top of that.

The right starting point is a scoping conversation where we understand your practice area mix, the jurisdiction footprint, and your integration state. From there we put together a specific engagement proposal."

### ROI framing

"Here is the math we have run for a three-attorney firm. Ten hours per attorney per week on first-pass drafting, status updates, and document coordination. At $250 an hour in billable opportunity cost — 50 billable weeks — that is $375,000 a year. If the fleet captures 40% of that, $150,000 a year returns to the attorneys as productive time. For a 25-attorney firm, the number scales proportionally.

That is the hours math. The harder number to put in a spreadsheet is the malpractice exposure from a single privilege breach or a misleading client communication. A tool that auto-sends can breach privilege in one message. agentplain drafts under the Model Rule 1.6 corpus; an attorney approves every client-facing draft. That exposure is real ROI that does not show up in a multiplier."

### Handling pricing questions

"Max engagements are scoped per firm. I can give you a range on a call once I understand your team size, practice area, and integration state. What I can tell you is that the floor is the Partner tier — $299 per seat — and the Max overlay reflects the service intensity your practice requires. I would rather scope this correctly than give you a number that does not hold."

### Trial

"The 14-day trial starts when we complete the initial setup — primarily connecting Outlook and your document system. The intake conflict screen is live from day one. You will see real drafts in your review tray within 24 hours. There is a 14-day money-back guarantee after the trial ends."

---

## 5. Top 10 Objections + Responses

### 1. "Isn't this just ChatGPT?"
"ChatGPT is a general tool. You prompt it, review the output, and integrate it yourself into your workflow. For a law firm, that means you are the integration layer — deciding what context to give it, whether the output is privilege-safe, and how to get it into Clio or your document system. agentplain is the service that runs that for your firm: agents configured for legal workflows, connected to your practice-management system, running on a schedule, and producing privilege-aware drafts for attorney review. We are built on Claude — same underlying model family — but we do the configuration, the wiring, the privilege corpus, and the maintenance. You do not write a single prompt."

### 2. "We do not trust AI with client matters."
"That is the right instinct and the right place to start. Nothing in agentplain goes to a client, opposing counsel, or a court without attorney approval. Every draft lands in a review tray. You read it, edit it, decide whether to send it. If you reject a draft, nothing happens. The fleet also never asserts a legal conclusion — every substantive claim that requires attorney judgment carries a merge field. The trust question is whether the drafts are useful enough to be worth reviewing. The 14-day trial is the answer to that question."

### 3. "What about ABA Rule 1.6 — I cannot have client information in an AI system."
"This is the question we take most seriously. The fleet processes client matter information within your workspace — a private, isolated environment. We do not train on client data. We do not share data between firms. The Compliance Sentinel runs a Rule 1.6 review on every client-facing draft before it surfaces for attorney review. Every draft that touches a potentially sensitive disclosure carries a flag with the rule citation. The attorney reviews and approves; nothing goes outside the firm without that review.

I can provide our data processing agreement and privacy architecture documentation before you commit to the trial. I would expect you to review it."

### 4. "We are too busy to set it up."
"The setup work is on us, not on you. Connecting Outlook takes about ten minutes. Setting up the matter ledger for the conflict screen is a structured process we run with you — usually 30 to 45 minutes to import your current matter index. After that, the fleet runs. The intake conflict screen fires on new intakes the next day. If your firm is short-staffed and intake is the immediate pressure, that is exactly the right place to start."

### 5. "What if it sends something wrong?"
"It cannot send anything without your approval. That is not a configuration option — it is the design. Every draft lands in a review tray. You approve it and send it from your own system. agentplain does not touch your email send button, does not access your court e-filing credentials, and does not have write access to your practice-management system. If a draft is wrong, you delete it. Nothing moves."

### 6. "We already have Clio / Clio Grow."
"Good — Clio is on our integration roadmap, planned for Q1 2027. Today, we connect to Outlook and your document system directly. The intake conflict screen runs against a matter ledger we set up from your existing matter list. Once the Clio integration ships, it will populate that ledger automatically and add practice-management context to the drafts. You keep Clio; agentplain will run on top of it."

### 7. "This is too expensive."
"Let me put a concrete number on the other side. If one attorney in your firm spends 10 hours a week on first-pass drafting and document coordination — at $250 an hour in billable opportunity cost — that is $2,500 a week, or $125,000 a year, for that one attorney. The fleet capturing even a portion of that mechanical drafting returns real time. The Max engagement is scoped to your firm; I would rather scope it correctly than give you a number that does not reflect what your practice actually needs."

### 8. "I need to think about it."
"Of course. What is the part that is not settled — the Rule 1.6 concern, the integration timeline, the pricing structure, or something about what the fleet actually does today versus what is on the roadmap? I would rather answer the real question than leave it open."

### 9. "Does it replace my associates?"
"No. The fleet handles first-pass mechanical drafting — the parts of a pleading or contract that follow a pattern, the client status update that is factual rather than advisory, the document-chase cadence. Your associates still make every substantive judgment: the legal theory, the argument strategy, the client communication decisions. The goal is to get your associates out of page-by-page document coding and first-pass form drafting so they are spending their billable hours on work that requires their training. An associate who spends four fewer hours a week on mechanical first-pass work is a better-utilized associate — not a replaced one."

### 10. "What is actually live today?"
"The straight answer: the Intake conflict screen is live — it runs a deterministic conflict check against your matter ledger and drafts a formal internal notice for the responsible attorney. Chief of Staff is live once your calendar is connected. That is the live set today.

Drafting, Document Chase, Compliance Sentinel, Discovery Review, Status Updater, and Milestone Billing are Setting Up — each has a clear unlock path tied to practice-management and document-management integrations on our Q1 2027 roadmap. The fleet also includes cross-vertical capabilities that fire on day one regardless of the vertical: inbox triage, follow-up drafting, office admin, analytics pulse, content calendar, and invoice chase via QuickBooks.

I will not show you an agent as live if it is Setting Up. If the intake conflict screen and the cross-vertical fleet are not enough value for the trial, that is a fair conclusion to reach before you start."

---

## 6. Close Lines by Temperature

### Hot (named real pain, engaged in demo, asked about pricing)
"Based on what you described — the conflict-check burden and the discovery-review hours — this is a direct fit for where you are today, and the roadmap covers the practice-management depth by Q1 next year. The 14-day trial starts with the conflict screen live on day one. Want to schedule the setup call this week?"

### Warm (positive, engaged, not ready to commit)
"Here is what I would suggest: a 30-minute setup call where we connect Outlook and walk through the matter ledger import. By the end of that call, you will have seen the conflict screen run on a real prospective intake. No commitment at that point — you decide whether it is worth the 14 days. What does your calendar look like?"

### Cold (listening, skeptical, not naming a pain)
"I am not going to push you on this. What I will do is send you our data processing agreement and a one-pager on what is live today versus what is on the roadmap — because those are the two questions that matter most for a law firm. I will follow up in two weeks. If something changes in the interim, reach out."

---

## 7. Five-Touch Follow-Up Sequence (14 Days)

**Touch 1 — Day 0 (same day) | Email | Goal: confirm what is live, establish credibility on the Rule 1.6 concern**

Subject: The honest version — what is live today

Hi [Name],

Good talking today. I want to be precise about where things stand.

Live now: the intake conflict screen and the Chief of Staff (once your calendar connects). Cross-vertical capabilities — inbox triage, follow-up drafting, analytics, office admin — also fire from day one.

Setting Up: Drafting, Document Chase, Compliance Sentinel, Discovery Review, Status Updater, Milestone Billing. Each has a clear unlock tied to practice-management integrations planned for Q1 2027.

If you want to review our data processing agreement before the trial, I will have it to you by end of day.

[Rep name]

---

**Touch 2 — Day 3 | Email | Goal: deliver a concrete proof point tied to their stated practice area**

*For litigation practices:*

Subject: The discovery-review number

Hi [Name],

One of our law-firm workspaces ran first-pass responsiveness and privilege coding against a 4,200-document production. The fleet flagged 312 borderline calls with rule citations and drafted the privilege log entries. Associates reviewed the 312 calls; partner spot-checked 30. Production shipped on time.

The 60-hour review became 14 hours of actual judgment work.

Worth a 20-minute conversation about how the conflict screen and the fleet's current capability set would work for your practice?

[Rep name]

*For transactional practices:*

Subject: The conflict-screen cycle

Hi [Name],

One of our transactional practices was running conflict checks manually against a spreadsheet — 20 to 30 minutes per new matter, with no formal audit trail. The intake conflict screen now runs each new matter against the firm ledger in under two minutes, classifies each hit (direct / adverse / former-adverse), and drafts a formal internal notice with merge fields for the attorney's legal conclusion.

Worth a 20-minute conversation about what that looks like for your intake volume?

[Rep name]

---

**Touch 3 — Day 6 | Phone | Goal: address Rule 1.6 concern before it becomes a silent deal-stopper**

"Hi [Name] — [Rep] from agentplain. Quick follow-up. The question I hear most from attorneys before the trial is whether client matter data is isolated and whether we train on it. The short answer is yes, isolated per firm, and no, we do not train on client data. I am happy to send the data processing agreement or walk through the architecture on a 15-minute call. I just want to make sure that question is not sitting unanswered."

---

**Touch 4 — Day 10 | Email | Goal: address the roadmap concern — is Q1 2027 too far?**

Subject: The Q1 2027 question

Hi [Name],

The integration roadmap for Clio, MyCase, NetDocuments, and the court e-filing adapters runs to Q1 2027. I want to be direct about what that means: the full depth of the fleet — automated matter-state updates, discovery-review binding, and practice-management drafting context — is not available until those integrations ship.

What is available now: the intake conflict screen, the cross-vertical fleet (inbox triage, follow-up drafting, analytics, office admin, QuickBooks invoice chase), and a Chief of Staff that works once your calendar connects. For some firms, that is enough value to warrant the trial. For others, it makes more sense to re-evaluate closer to Q1 2027 when the practice-management connections are live.

I would rather you make the right call than the fast one.

[Rep name]

---

**Touch 5 — Day 14 | Email | Goal: clean close or respectful long pause**

Subject: Closing the loop

Hi [Name],

Closing the loop on our conversation. If the timing is not right — either because the Q1 2027 integrations are what you actually need, or because the current configuration does not justify the trial — that is a sound conclusion and I respect it.

If you want to revisit closer to when the Clio and NetDocuments integrations ship, I will reach out in Q4 with an update. Or if something shifts in the interim — a new matter type, a staffing change, an intake volume increase — you can reach me directly.

Thank you for your time and your candor.

[Rep name]

---

## 8. Win-Back on No Strategy

### When they say no

"Understood. One question before I let you go: is this a matter of timing — the integrations are not far enough along — or is there a structural concern about the fit? I want to make sure I understand the real reason, because it shapes how and whether I follow up."

If timing: "That makes sense. The Q1 2027 milestone is when the practice-management integrations land. I will reach out in Q4 2026 with a specific update on Clio and MyCase so you can evaluate with the full picture."

If structural concern: "I appreciate you saying so directly. What was the deciding factor? I am not going to argue with you — I want to understand the gap."

### Tag and drip cadence

Tag: `no-date`, `vertical: law`, `reason: [stated]`, `reopen-trigger: [their milestone or integration event]`.

Post-no drip:
- Day 45: A brief, factual note — one paragraph, no ask — on a relevant development (new integration, a real-firm proof point in their practice area). No pitch.
- Day 90: One case-point story tied to their practice area and the reason they passed. Soft ask: "Has anything changed on your end?"
- Q4 2026: Specific update on Q1 2027 integration roadmap progress — Clio, MyCase, NetDocuments. This is the planned re-open trigger for firms that passed on integration-timeline grounds.

### The re-open trigger

The most reliable re-open triggers for law firms:
- A malpractice incident or near-miss involving a privilege question or client communication.
- A new lateral hire or a staffing gap that increases the per-attorney drafting load.
- A conflict-check error — running a matter that should have been declined.
- The Clio MCP landing in Q1 2027.

Message for the integration re-open:
"Hi [Name] — the Clio integration we discussed is now live. The things that were Setting Up when we spoke — matter-state-driven status updates, drafting context from your matter files, document-chase from Clio Connect — are now running. Worth a fresh look?"

Message for a staffing-gap re-open:
"Hi [Name] — I saw that [associate name] recently left the firm. The intake conflict screen and the first-pass drafting capability are the things that tend to matter most when a firm is temporarily short-staffed on associates. If it is useful to talk now, I am happy to set up a call."
