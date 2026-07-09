# The discovery-call demo — exact walkthrough

**Slot:** minutes 15–22 of the discovery call (playbook: `docs/sales/deep-dive-2026-07-02/04-discovery-call-playbook.md`, "Show one thing").
**Before every call:** `node scripts/reset-demo.mjs`, then log in as the demo owner and leave the workspace Today view open in a tab. Reset takes seconds; do it between back-to-back calls so decided cards return to PENDING.

**The one rule:** show the approval gate as the headline, not the AI. Every beat below ends on something the broker controls.

---

## Beat 1 — The morning after (Today view, ~60 seconds)

**Screen:** Today view of Peachtree Realty Demo. Three items waiting.

**Say:** *"This is a demonstration brokerage on synthetic data — Peachtree Realty Demo, fake leads, fake phone numbers — but it's the real product, not a video. Here's what its owner would walk into this morning: three buyer leads came in after close of business last night. All three are already handled and waiting for sign-off."*

Don't click anything yet. Let the queue sit on screen for a breath — three ranked items is the whole pitch in one screenshot.

## Beat 2 — The 9:14pm lead (open the hot card — THE lean-in moment, ~2 minutes)

**Screen:** the top card — `lead triage · Jordan Ellis · category: hot · routing: agent`.

**Say:** *"9:14 last night, a Zillow inquiry on a Midtown listing. Watch the timestamps."* Then read the card, top to bottom:

1. **Caught + scored:** *"It read the message — 'relocating for work, preapproved to six hundred, wants to tour this weekend' — and scored it: motivation, timeline, financing. This one's hot. The 10:47 lead below scored warm; the open-house browser scored nurture and went to a drip campaign instead of eating an agent's morning."*
2. **Routed, with a reason:** *"It assigned Alicia Grant — and it tells you why: she carries the relocation specialty on your roster. Your fourth agent is marked not taking leads right now, and it respected that."*
3. **Drafted:** *"And it wrote the first-touch reply — references the property, confirms the financing detail, asks for the showing. Notice the two showing windows: it leaves a slot for* your *calendar rather than inventing times. It drafts; it doesn't guess."*
4. **The clock line — land this:** *"All of that was sitting here at 9:16pm. Two minutes after the lead landed, while everyone at the brokerage was at dinner. The lead that waits until 9am is the lead that called two other agents at 8."*

**Pause here.** This is where brokers lean in — the timestamp math on the card, not any claim from us.

## Beat 3 — The approve (one click, ~45 seconds)

**Do:** edit one word of the draft (show it's editable), then click Approve.

**Say:** *"Nothing went out until just now, and even now — approving hands the draft to your own email and your own CRM to send. This system never contacts your client directly. Every send in this product is a human at your brokerage clicking this button. That's the design, not a setting."*

## Beat 4 — The receipts (saved time, ~30 seconds)

**Screen:** the saved-time counter / reports surface.

**Say:** *"It also keeps score honestly. Every action gets a fixed minute value — five to enrich a lead, ten to draft the reply — conservative numbers, written down, per action. Last week on this demo pipeline that's about five hours of coordination work. Your renewal decision is meant to be this number versus the invoice, nothing fuzzier."*

## Beat 5 — Optional replay: watch it run (~40 seconds)

If the broker asks "but what's it *doing*?" — open **`/demo`** ("Try with sample data"). The runtime autoplays the whole night on one lead: caught → enriched → drafted → showing windows → logged, counter ticking. It's labeled `sample data · not your real numbers` on-screen; no need to caveat it twice.

## Beat 6 — The pivot (verbatim from the playbook)

**Say:** *"This is a demonstration workspace on synthetic data — you're seeing the real product, not your data. The setup call makes it run on yours: you connect Follow Up Boss with your own API key, and this queue becomes your queue, on your leads, that night."*

Then stop demoing. Back to their questions.

---

## If something goes sideways

- **A card was already approved (stale state):** you forgot to reset. Say so plainly — *"I ran this earlier and approved one, let me show you the decided view"* — the decided history is itself a good screen. Reset after the call.
- **Slow / broken screen:** don't debug past one reload. Fall back to Beat 5 (the `/demo` runtime is self-contained), or the recorded bridge per `docs/pilot/week-1-runbook/05-when-things-go-wrong.md`.
- **"Is this AI writing to my clients?"** — Beat 3's answer, again, shorter: *"No. It drafts. You send. Always."*
- **"What's it cost to run?"** — *"The triage you just watched runs deterministically — there's no per-lead metered cost that scales against you."* (Do not name models or vendors; that stays off customer surfaces.)

## What NOT to say (locked rules)

- No "trusted by N brokers", no invented response-rate or conversion stats — the timestamp on the card is the whole speed argument.
- No model or vendor names, ever, on this call.
- "Local businesses", never "SMB".
- Don't say "pilot pricing" — the tiers are Regular ($199 list, $99 today) / Partner ($299 list, $199 today) / Max (sales-led).
